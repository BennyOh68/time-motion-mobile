import { reactive, watch } from 'vue'

const STORAGE_KEY = 'tm_appState'

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

// ── Local-time date helpers (no UTC shift) ──
function formatLocalDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sanitizeLogDate(raw) {
  if (!raw) return null
  // Handle both "yyyy-MM-dd" (10 chars) and full ISO datetime strings
  const datePart = raw.slice(0, 10)
  // Re-parse locally to strip any UTC-offset shift baked into the value
  const parts = datePart.split('-')
  if (parts.length !== 3) return null
  const d = new Date(+parts[0], +parts[1] - 1, +parts[2])
  return isNaN(d.getTime()) ? null : formatLocalDate(d)
}

const todayLocal = formatLocalDate(new Date())

const persisted = loadState()

// Always sanitize persisted logDate — migrates stale datetime strings automatically
const safeLogDate = sanitizeLogDate(persisted?.logDate) || todayLocal

export const appState = reactive({
  // ── Auth ──
  user: persisted?.user || null,
  session: persisted?.session || null,

  // ── Persistent header fields (restored from localStorage) ──
  projectName: persisted?.projectName || '',
  teamRig: persisted?.teamRig || '',

  // ── Current form state ──
  workType: persisted?.workType || 'JGP',
  refPoint: persisted?.refPoint || '',
  logDate: safeLogDate,

  // ── Chart filter defaults (persisted across sessions) ──
  chartFilterTeam: persisted?.chartFilterTeam || '',

  // ── Three-segment form entries ──
  prepActivity: persisted?.prepActivity || '',
  prepTimeIn: persisted?.prepTimeIn || '',
  prepTimeOut: persisted?.prepTimeOut || '',
  prepStartDepth: persisted?.prepStartDepth ?? '0.0',
  prepEndDepth: persisted?.prepEndDepth ?? '0.0',

  prodActivity: persisted?.prodActivity || '',
  prodTimeIn: persisted?.prodTimeIn || '',
  prodTimeOut: persisted?.prodTimeOut || '',
  prodStartDepth: persisted?.prodStartDepth ?? '0.0',
  prodEndDepth: persisted?.prodEndDepth ?? '0.0',

  waitActivity: persisted?.waitActivity || '',
  waitTimeIn: persisted?.waitTimeIn || '',
  waitTimeOut: persisted?.waitTimeOut || '',
  waitStartDepth: persisted?.waitStartDepth ?? '0.0',
  waitEndDepth: persisted?.waitEndDepth ?? '0.0',

  // ── Accumulated log rows (for Summary page) ──
  logRows: persisted?.logRows || [],

  // ── Chart snapshot for export (not persisted) ──
  chartSnapshot: null,
})

// Persist relevant fields to localStorage on every change
watch(
  () => {
    const { user, session, chartSnapshot, ...rest } = appState
    return JSON.parse(JSON.stringify(rest))
  },
  (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  },
  { deep: true }
)

/**
 * Clear all form fields but keep header defaults and logRows.
 */
export function resetForm() {
  // Keep workType, refPoint as defaults (set from Page 1)
  appState.prepActivity = ''
  appState.prepTimeIn = ''
  appState.prepTimeOut = ''
  appState.prepStartDepth = '0.0'
  appState.prepEndDepth = '0.0'
  appState.prodActivity = ''
  appState.prodTimeIn = ''
  appState.prodTimeOut = ''
  appState.prodStartDepth = '0.0'
  appState.prodEndDepth = '0.0'
  appState.waitActivity = ''
  appState.waitTimeIn = ''
  appState.waitTimeOut = ''
  appState.waitStartDepth = '0.0'
  appState.waitEndDepth = '0.0'
}

/**
 * Push current form entries as a row into logRows, then reset form.
 * Returns true if at least one segment was populated.
 */
export function submitFormRows() {
  const rows = []

  const segments = [
    {
      category: 'Preparation',
      activity: appState.prepActivity,
      timeIn: appState.prepTimeIn,
      timeOut: appState.prepTimeOut,
      startDepth: appState.prepStartDepth,
      endDepth: appState.prepEndDepth,
    },
    {
      category: 'Production',
      activity: appState.prodActivity,
      timeIn: appState.prodTimeIn,
      timeOut: appState.prodTimeOut,
      startDepth: appState.prodStartDepth,
      endDepth: appState.prodEndDepth,
    },
    {
      category: 'Waits',
      activity: appState.waitActivity,
      timeIn: appState.waitTimeIn,
      timeOut: appState.waitTimeOut,
      startDepth: appState.waitStartDepth,
      endDepth: appState.waitEndDepth,
    },
  ]

  for (const seg of segments) {
    if (seg.activity && seg.timeIn && seg.timeOut) {
      rows.push({
        id: crypto.randomUUID(),
        category: seg.category,
        activityName: seg.activity,
        timeIn: seg.timeIn,
        timeOut: seg.timeOut,
        projectName: appState.projectName,
        teamRig: appState.teamRig,
        workType: appState.workType,
        refPoint: appState.refPoint,
        startDepth: seg.startDepth,
        endDepth: seg.endDepth,
        logDate: appState.logDate || new Date().toISOString().slice(0, 10),
      })
    }
  }

  appState.logRows.push(...rows)
  resetForm()
  return rows.length > 0
}
