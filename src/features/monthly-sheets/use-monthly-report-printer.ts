import { useCallback } from 'react'

import { buildMonthlyReport } from './monthly-report'
import { useCrews } from '@/features/crews/crews-context'
import type { MonthlySheet } from '@/lib/domain-types'

/**
 * Gives a screen one function: print this crew's month. The sheet already holds every
 * figure, so nothing is recalculated here — only the crew's name is looked up.
 */
export function useMonthlyReportPrinter() {
  const { getCrewName } = useCrews()

  return useCallback(
    async (sheet: MonthlySheet) => {
      const report = buildMonthlyReport(sheet, getCrewName(sheet.crewId))

      // The PDF engine is far heavier than the page that offers the button, so it is
      // fetched on the first print rather than on every visit to Monthly Sheets.
      const { downloadMonthlyReportPdf } = await import('./monthly-report-pdf')

      downloadMonthlyReportPdf(report)
    },
    [getCrewName],
  )
}
