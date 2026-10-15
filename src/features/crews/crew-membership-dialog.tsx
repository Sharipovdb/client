import { ArrowRightLeft, UserMinus, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { useCrewMemberships } from '@/features/crews/crew-memberships-context'
import { useCrews } from '@/features/crews/crews-context'
import { useEmployees } from '@/features/employees/employees-context'
import { getErrorMessage } from '@/lib/api-error'
import type { Crew } from '@/lib/domain-types'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from '@/components/ui/combobox'

// function todayIsoDate() {
//   return new Date().toISOString().slice(0, 10)
// }

interface CrewMembershipDialogProps {
  crew: Crew
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CrewMembershipDialog({
  crew,
  open,
  onOpenChange,
}: CrewMembershipDialogProps) {
  const { employees } = useEmployees()
  const { crews } = useCrews()
  const {
    memberships,
    getActiveMembersForCrew,
    assignMember,
    removeMember,
    transferMember,
  } = useCrewMemberships()

  const [newEmployeeIds, setNewEmployeeIds] = useState<number[]>([])
  const [assignError, setAssignError] = useState('')
  const [removingMembershipId, setRemovingMembershipId] = useState<
    number | null
  >(null)
  const [transferTargetByMembership, setTransferTargetByMembership] = useState<
    Record<number, number>
  >({})

  const activeMembers = getActiveMembersForCrew(crew.id)

  const unassignedEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          !memberships.some(
            (membership) =>
              membership.employeeId === employee.id && membership.isActive,
          ),
      ),
    [employees, memberships],
  )

  const otherCrews = crews.filter((otherCrew) => otherCrew.id !== crew.id)

  function employeeName(employeeId: number) {
    const employee = employees.find((candidate) => candidate.id === employeeId)
    return employee ? employee.fullname : 'Unknown'
  }

  async function handleAssign() {
    if (newEmployeeIds.length === 0) {
      setAssignError('Select an employee to assign.')
      return
    }

    try {
      const success = await assignMember(crew.id, newEmployeeIds)

      if (!success) {
        setAssignError(
          'This employee already has an active crew — use Transfer instead.',
        )
        return
      }

      setAssignError('')
      setNewEmployeeIds([])
    } catch (error) {
      setAssignError(getErrorMessage(error, 'Could not assign this employee.'))
    }
  }

  async function handleTransfer(membershipId: number, employeeId: number) {
    const targetCrewId = transferTargetByMembership[membershipId]

    if (!targetCrewId) {
      return
    }

    try {
      await transferMember(employeeId, crew.id, targetCrewId)
      setTransferTargetByMembership((current) => {
        const next = { ...current }
        delete next[membershipId]
        return next
      })
    } catch (error) {
      setAssignError(
        getErrorMessage(error, 'Could not transfer this employee.'),
      )
    }
  }

  async function handleRemove(membershipId: number) {
    try {
      await removeMember(membershipId)
    } catch (error) {
      setAssignError(getErrorMessage(error, 'Could not remove this member.'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{crew.name} — Membership</DialogTitle>
          <DialogDescription>
            Manage active crew members. Transferring moves the member to another
            crew immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-soft-foreground">
            Active members ({activeMembers.length} / {crew.seatCapacity} seats)
          </p>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {activeMembers.map((membership) => (
              <div
                key={membership.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {employeeName(membership.employeeId)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Active since {membership.activeFrom}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    className="h-10 w-44 text-xs"
                    value={transferTargetByMembership[membership.id] ?? ''}
                    onChange={(event) =>
                      setTransferTargetByMembership((current) => ({
                        ...current,
                        [membership.id]: Number(event.target.value),
                      }))
                    }
                  >
                    <option value="">Transfer to…</option>
                    {otherCrews.map((otherCrew) => (
                      <option key={otherCrew.id} value={otherCrew.id}>
                        {otherCrew.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full border-border text-accent-foreground"
                    title="Move to the selected crew"
                    disabled={!transferTargetByMembership[membership.id]}
                    onClick={() =>
                      handleTransfer(membership.id, membership.employeeId)
                    }
                  >
                    <ArrowRightLeft className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    className="rounded-full"
                    title="Remove from crew"
                    onClick={() => setRemovingMembershipId(membership.id)}
                  >
                    <UserMinus className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {activeMembers.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-faint-foreground">
                No active members yet.
              </p>
            )}
          </div>

          {activeMembers.length > crew.seatCapacity && (
            <Badge variant="warning" className="w-fit">
              Overflow — arrange a second vehicle / extra taxi
            </Badge>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-soft-foreground">
            Assign a new member
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Employees
              </label>
              <Combobox
                multiple
                items={unassignedEmployees}
                value={newEmployeeIds}
                onValueChange={setNewEmployeeIds}
              >
                <ComboboxChips>
                  <ComboboxValue>
                    {(values) =>
                      values.map((id: number) => {
                        const employee = unassignedEmployees.find(
                          (e) => e.id === id,
                        )

                        return (
                          <ComboboxChip key={id}>
                            {employee ? employee.fullname : id}
                          </ComboboxChip>
                        )
                      })
                    }
                  </ComboboxValue>

                  <ComboboxChipsInput placeholder="Select employees" />
                </ComboboxChips>

                <ComboboxContent
                  style={{ pointerEvents: 'auto' }}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <ComboboxEmpty>No items found.</ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item.id} value={item.id}>
                        {item.fullname}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            <Button
              type="button"
              className="h-11 rounded-2xl px-4"
              onClick={handleAssign}
            >
              <UserPlus className="size-4" />
              Assign
            </Button>
          </div>

          {assignError && (
            <p className="mt-2 text-xs font-medium text-destructive">
              {assignError}
            </p>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={removingMembershipId !== null}
        onOpenChange={(isOpen) => !isOpen && setRemovingMembershipId(null)}
        title="Remove this member from the crew?"
        description="This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removingMembershipId !== null) {
            handleRemove(removingMembershipId)
          }
        }}
      />
    </Dialog>
  )
}
