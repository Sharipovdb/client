import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import { hasTravel, startsNewMonth } from './monthly-report'
import type { MonthlyReport } from './monthly-report'
import {
  formatCurrency,
  formatKm,
  formatKmRate,
  formatMonthLabel,
  formatPeriodRange,
} from '@/lib/format'

const margin = 14
const ink = '#0f172a'
const muted = '#64748b'
const accent = '#0284c7'
const travelledFill = '#e0f2fe'
const gridLine = '#cbd5e1'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fileName(report: MonthlyReport) {
  const crew = report.crewName.trim().replace(/\s+/g, '-').toLowerCase()
  const month = String(report.month).padStart(2, '0')

  return `transport-report-${crew || 'crew'}-${report.year}-${month}.pdf`
}

/**
 * Renders one crew's month as a printable, signable A4 sheet.
 *
 * The month is a calendar: one cell is one day, marked with the distance the crew drove
 * that day or the taxi fare it cost. Legs are not broken out — a day is the unit the
 * accountant prices — and neither is who fronted a fare, since the whole amount is
 * handed to the lead to distribute. The summary underneath turns the month into one
 * figure: what the crew's own driving is worth — its kilometres at the accountant's
 * index, or its legs at the crew's tariff — plus the fares, plus the allowance for the
 * lead's own car.
 *
 * Returning the document rather than saving it is what lets the layout be rendered and
 * inspected outside a browser.
 */
export function renderMonthlyReportPdf(report: MonthlyReport) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  let cursor = drawHeader(doc, report, pageWidth)
  cursor = drawCalendar(doc, report, pageWidth, cursor)
  cursor = drawSummary(doc, report, pageWidth, cursor)

  drawSignatures(doc, pageWidth, cursor)

  return doc
}

/** Renders the report and hands it to the browser as a download. */
export function downloadMonthlyReportPdf(report: MonthlyReport) {
  renderMonthlyReportPdf(report).save(fileName(report))
}

function statusLabel(report: MonthlyReport) {
  if (report.isPaid) return 'Paid'

  return report.isConfirmed ? 'Confirmed — not paid yet' : 'Draft'
}

function drawHeader(doc: jsPDF, report: MonthlyReport, pageWidth: number) {
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(ink)
  doc.text('Crew Transport Report', margin, 20)

  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(muted)
  doc.text(formatMonthLabel(report.year, report.month), margin, 27)

  doc.setDrawColor(accent).setLineWidth(0.6)
  doc.line(margin, 31, pageWidth - margin, 31)

  const facts: [string, string][] = [
    ['Crew', report.crewName],
    ['Paid to', report.recipientFullname],
    ['Period', formatPeriodRange(report.periodStart, report.periodEnd)],
    ['Status', statusLabel(report)],
    ['Priced', pricingLabel(report)],
  ]

  facts.forEach(([label, value], index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = margin + column * ((pageWidth - margin * 2) / 2)
    const y = 39 + row * 6

    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(muted)
    doc.text(`${label}:`, x, y)

    doc.setFont('helvetica', 'bold').setTextColor(ink)
    doc.text(value, x + 22, y)
  })

  return 52
}

/** Day number on top, then what the day is worth — distance, money, or both. */
function cellText(
  cell: MonthlyReport['weeks'][number][number],
  report: MonthlyReport,
) {
  if (cell === null) return ''

  // A period can run across a month boundary, so the 1st says which month it opens.
  const lines = [
    startsNewMonth(cell)
      ? `1 ${monthAbbreviation(cell.date)}`
      : String(cell.dayOfMonth),
  ]

  // A crew on a tariff earns by the leg, so its cells count legs and price them. The
  // distance is left off entirely: nobody is paid for it, and showing it invites the
  // reader to add it to the money.
  if (report.isPricedByTariff) {
    if (cell.drivenLegCount > 0) {
      lines.push(cell.drivenLegCount === 2 ? '2 legs' : '1 leg')
      lines.push(formatCurrency(cell.drivenLegCount * report.tariffPerLeg))
    }
  } else {
    if (cell.drivenKm > 0) lines.push(formatKm(cell.drivenKm))
    if (cell.extraBusinessKm > 0)
      lines.push(`+${formatKm(cell.extraBusinessKm)}`)
  }

  if (cell.taxiAmount > 0) lines.push(formatCurrency(cell.taxiAmount))

  return lines.join('\n')
}

function monthAbbreviation(isoDate: string) {
  return formatMonthLabel(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)),
  ).slice(0, 3)
}

/** How this settlement's driving was priced, stated once at the top of the sheet. */
function pricingLabel(report: MonthlyReport) {
  return report.isPricedByTariff
    ? `${formatCurrency(report.tariffPerLeg)} per leg`
    : formatKmRate(report.kmRate)
}

function drawCalendar(
  doc: jsPDF,
  report: MonthlyReport,
  pageWidth: number,
  startY: number,
) {
  const columnWidth = (pageWidth - margin * 2) / weekdays.length

  autoTable(doc, {
    startY,
    head: [weekdays],
    body: report.weeks.map((week) =>
      week.map((cell) => cellText(cell, report)),
    ),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 1.5,
      minCellHeight: 15,
      valign: 'top',
      textColor: ink,
      lineColor: gridLine,
      cellWidth: columnWidth,
    },
    headStyles: {
      fillColor: '#f1f5f9',
      textColor: muted,
      fontStyle: 'bold',
      halign: 'center',
      minCellHeight: 7,
    },
    // A day the crew travelled is shaded, so the month reads at a glance as the set of
    // marked cells the report is actually about.
    didParseCell: ({ section, row, column, cell }) => {
      if (section !== 'body') return

      const day = report.weeks[row.index][column.index]

      if (day !== null && hasTravel(day)) {
        cell.styles.fillColor = travelledFill
        cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: margin, right: margin },
  })

  return getTableEndY(doc) + 10
}

/**
 * The month read as distance first, then as money. Every line that is money says where
 * it came from — the index it was priced with, or the car it is owed for — so the sheet
 * can be checked without the system that produced it.
 */
function summaryLines(report: MonthlyReport): [string, string][] {
  const lines: [string, string][] = [
    ['Days travelled', String(report.travelledDayCount)],
  ]

  // The crew is measured in the unit it is paid in and in no other. A crew on a tariff
  // has no kilometres on its sheet at all — showing a distance nothing prices is what
  // made the figure look like it was owed.
  if (report.isPricedByTariff) {
    lines.push(['Legs driven', String(report.totalDrivenLegs)])
    lines.push([
      `Trips priced (${report.totalDrivenLegs} x ${formatCurrency(report.tariffPerLeg)})`,
      formatCurrency(report.totalTariffAmount),
    ])

    // The tariff buys the commute. Driving elsewhere for the company is not the
    // commute, so it stays distance and is priced with the index.
    if (report.totalExtraBusinessKm > 0) {
      lines.push([
        `Business travel (${formatKm(report.totalExtraBusinessKm)} x ${formatKmRate(report.kmRate)})`,
        formatCurrency(report.totalKmAmount),
      ])
    }
  } else {
    lines.push(['Distance driven (round trip)', formatKm(report.totalDrivenKm)])
    lines.push([
      'Extra business distance',
      formatKm(report.totalExtraBusinessKm),
    ])
    lines.push([
      `Distance priced (${formatKm(report.totalPricedKm)} x ${formatKmRate(report.kmRate)})`,
      formatCurrency(report.totalKmAmount),
    ])
  }

  // Only a driver-lead drives the crew in their own car, so the line appears only when
  // there is a car to be paid for.
  if (report.amortizationAmount > 0) {
    lines.push([
      'Car allowance (amortization)',
      formatCurrency(report.amortizationAmount),
    ])
  }

  lines.push([
    'Taxi fares to reimburse',
    formatCurrency(report.totalTaxiAmount),
  ])

  return lines
}

function drawSummary(
  doc: jsPDF,
  report: MonthlyReport,
  pageWidth: number,
  startY: number,
) {
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(ink)
  doc.text('Monthly summary', margin, startY)

  let y = startY + 7

  summaryLines(report).forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(muted)
    doc.text(label, margin, y)

    doc.setFont('helvetica', 'bold').setTextColor(ink)
    doc.text(value, pageWidth - margin, y, { align: 'right' })

    y += 6
  })

  doc.setDrawColor(gridLine).setLineWidth(0.2)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(ink)
  doc.text('Amount payable', margin, y)
  doc.setTextColor(accent)
  doc.text(formatCurrency(report.totalPayable), pageWidth - margin, y, {
    align: 'right',
  })

  y += 6
  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(muted)
  doc.text(
    `Paid to ${report.recipientFullname || 'the crew lead'} as one amount, for distribution inside the crew.`,
    margin,
    y,
  )

  if (report.isPricedByTariff) {
    y += 4
    doc.text(
      'This crew is settled per trip: its commute is counted in legs, not kilometres.',
      margin,
      y,
    )
  }

  return y + 14
}

function drawSignatures(doc: jsPDF, pageWidth: number, startY: number) {
  const columnWidth = (pageWidth - margin * 2 - 10) / 2
  const labels = ['Crew lead signature', 'Approved by']

  labels.forEach((label, index) => {
    const x = margin + index * (columnWidth + 10)

    doc.setDrawColor('#94a3b8').setLineWidth(0.3)
    doc.line(x, startY, x + columnWidth, startY)

    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(muted)
    doc.text(label, x, startY + 5)
  })

  const dateY = startY + 18
  doc.setDrawColor('#94a3b8')
  doc.line(margin, dateY, margin + columnWidth, dateY)
  doc.text('Date', margin, dateY + 5)
}

// autoTable records where it stopped on the document; typings expose it as an optional
// field, so it is read through one helper instead of casting at every call site.
function getTableEndY(doc: jsPDF) {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 0
  )
}
