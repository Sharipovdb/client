// The backend enforces no maximum page size (see plan Batch 2 note on pagination),
// and this app's data volume is small (dozens of rows, not thousands), so every list
// fetch just asks for one big page instead of building real pagination UI. Most
// controllers use the nested `PaginationInfo.*` query convention; Vehicle uses flat
// `PageIndex`/`PageSize` — see the two exports below.

export const nestedLargePage = {
  'PaginationInfo.Index': 0,
  'PaginationInfo.Size': 500,
}

export const flatLargePage = {
  PageIndex: 0,
  PageSize: 500,
}
