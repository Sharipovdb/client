import { describe, expect, it } from 'vitest'

import { dayClosedReason, isCrewLedBy, isDayOpen } from '@/lib/domain-types'
import type { Crew, TaxiFare, TransportDay } from '@/lib/domain-types'

function crew(leads: Pick<Crew, 'driverLeadId' | 'crewLeadId'>): Crew {
  return {
    id: 1,
    name: 'Crew',
    routeId: 1,
    tariffId: null,
    seatCapacity: 4,
    ...leads,
  }
}

function dayWithFares(taxiFares: TaxiFare[], isSettled = false): TransportDay {
  return {
    id: 1,
    crewId: 1,
    date: '2026-10-05',
    morningMode: 'Taxi',
    afternoonMode: 'Taxi',
    driverId: null,
    commuteKmPerLeg: 0,
    drivenKm: 0,
    extraBusinessKm: 0,
    notes: null,
    loggedBy: 1,
    loggedAt: '2026-10-05T08:00:00.000Z',
    taxiFares,
    isSettled,
  }
}

function fare(status: TaxiFare['status']): TaxiFare {
  return { id: 1, leg: 'Morning', amount: 40, paidById: 2, status }
}

describe('isCrewLedBy', () => {
  it('recognises the driver-lead and the crew lead', () => {
    expect(isCrewLedBy(crew({ driverLeadId: 7, crewLeadId: null }), 7)).toBe(
      true,
    )
    expect(isCrewLedBy(crew({ driverLeadId: null, crewLeadId: 7 }), 7)).toBe(
      true,
    )
  })

  it('rejects anyone else and a missing user', () => {
    expect(isCrewLedBy(crew({ driverLeadId: 7, crewLeadId: null }), 8)).toBe(
      false,
    )
    expect(
      isCrewLedBy(crew({ driverLeadId: null, crewLeadId: null }), undefined),
    ).toBe(false)
  })
})

describe('isDayOpen', () => {
  it('keeps a day with unpaid fares open', () => {
    expect(isDayOpen(dayWithFares([fare('Pending')]))).toBe(true)
  })

  it('closes a day once one of its fares is paid', () => {
    expect(isDayOpen(dayWithFares([fare('Pending'), fare('Paid')]))).toBe(false)
  })

  it('closes a day its confirmed month covers', () => {
    expect(isDayOpen(dayWithFares([fare('Pending')], true))).toBe(false)
  })
})

describe('dayClosedReason', () => {
  it('has nothing to say about an open day', () => {
    expect(dayClosedReason(dayWithFares([]))).toBeNull()
  })

  it('names the confirmed month first', () => {
    expect(dayClosedReason(dayWithFares([fare('Paid')], true))).toBe(
      'Its month is confirmed — withdraw the confirmation to change it',
    )
  })

  it('names the paid taxi fare', () => {
    expect(dayClosedReason(dayWithFares([fare('Paid')]))).toBe(
      'Its taxi fare has already been paid',
    )
  })
})
