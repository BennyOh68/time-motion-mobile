import { reactive, watch } from 'vue'
import {
  fetchTimeEntries,
  insertTimeEntries,
  updateTimeEntry,
} from '../lib/supabaseData.js'

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
  chartFilterDate: persisted?.chartFilterDate || '',

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

// Persist relevant fields to localStorage on every change (offline cache only —
// Supabase is the source of truth once hydrated).
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

// ── Supabase sync: known DB state, hydration, realtime, edit pushback ────────
let knownById = new Map()   // id -> JSON snapshot of the row as last known in DB
let pendingUploads = []     // local rows that failed first insert (offline retry)
let syncTimer = null

function refreshKnown(rows = appState.logRows) {
  knownById = new Map(rows.map((r) => [r.id, JSON.stringify(r)]))
}

/**
 * Replace local logRows with the server truth. Called after login / hydration.
 */
export async function hydrateLogRows() {
  const rows = await fetchTimeEntries()
  appState.logRows = rows
  refreshKnown(rows)
  return rows
}

/**
 * Apply a realtime event (INSERT / UPDATE / DELETE) from another device.
 */
export function applyRealtimeEvent(evt) {
  if (evt.type === 'DELETE') {
    appState.logRows = appState.logRows.filter((r) => r.id !== evt.oldId)
  } else if (evt.type === 'INSERT') {
    if (!appState.logRows.some((r) => r.id === evt.newRow.id)) {
      appState.logRows.push(evt.newRow)
    }
  } else if (evt.type === 'UPDATE') {
    const i = appState.logRows.findIndex((r) => r.id === evt.newRow.id)
    if (i >= 0) appState.logRows[i] = evt.newRow
  }
  refreshKnown()
}

// Debounced pushback: Summary-page edits (v-model / picker cell edits) and
// offline-retry inserts are synced to Supabase after local changes settle.
watch(
  () => appState.logRows.map((r) => ({ ...r })),
  () => {
    clearTimeout(syncTimer)
    syncTimer = setTimeout(flushLocalEdits, 800)
  },
  { deep: true }
)

async function flushLocalEdits() {
  const current = appState.logRows

  // 1) Retry first-time inserts that failed while offline
  if (pendingUploads.length > 0) {
    try {
      const saved = await insertTimeEntries(pendingUploads)
      const byId = new Map(saved.map((s) => [s.id, s]))
      for (let i = 0; i < current.length; i++) {
        const server = byId.get(current[i].id)
        if (server) current[i] = server
      }
      pendingUploads = []
      refreshKnown()
    } catch (err) {
      console.warn('Supabase upload retry deferred (offline?):', err?.message)
      return
    }
  }

  // 2) Push edits to rows that already exist in the DB
  const dirty = current.filter((row) => row.id && knownById.get(row.id) !== JSON.stringify(row))
  if (dirty.length === 0) return

  try {
    for (const row of dirty) {
      await updateTimeEntry(row.id, {
        category: row.category,
        activityName: row.activityName,
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        projectName: row.projectName,
        teamRig: row.teamRig,
        workType: row.workType,
        refPoint: row.refPoint,
        startDepth: row.startDepth,
        endDepth: row.endDepth,
        logDate: row.logDate,
      })
    }
  } catch (err) {
    console.warn('Supabase edit sync deferred (offline?):', err?.message)
    return
  }
  refreshKnown()
}

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

// ── Activity auto-classification keywords (case-insensitive) ──────────────
const SAFETY_KEYWORDS = [
  'toolbox', 'tbm', 'safety briefing', 'safety meeting', 'safety talk',
  'safety walk', 'safety audit', 'safety drill',
  'hse', 'hsse', 'health and safety', 'occupational safety',
  'ptw', 'permit to work', 'work permit',
  'jsa', 'job safety analysis', 'job hazard analysis', 'jha',
  'risk assessment', 'risk analysis', 'hazard identification', 'hazid',
  'emergency drill', 'fire drill', 'first aid', 'first-aid',
  'incident', 'accident report', 'near miss',
  'pre-start safety', 'prestart safety', 'pre start safety',
  'safety stand-down', 'safety standdown', 'safety stand down',
  'lockout tagout', 'loto', 'confined space',
  'respirator', 'ppe inspection', 'harness inspection',
  'safety',
]

const QC_KEYWORDS = [
  'pre-grouting inspection',
  'post-grouting inspection',
  're/rto inspection', 're inspection', 'rto inspection',
  'quality check', 'quality control', 'qc inspection', 'qc check',
  'grouting inspection', 'pile inspection', 'concrete inspection',
  'ndt', 'non-destructive', 'ultrasonic test', 'integrity test',
  'material inspection', 'material testing',
]

export function classifyActivity(activityName) {
  if (!activityName) return null
  const lower = activityName.toLowerCase().trim()
  if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) return 'Safety'
  if (QC_KEYWORDS.some(kw => lower.includes(kw))) return 'QC'
  return null
}

/**
 * Push current form entries as a row into logRows, then reset form.
 * Returns true if at least one segment was populated.
 */
export async function submitFormRows() {
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
      // Auto-classify across ALL segments — Safety/QC override the form category
      const override = classifyActivity(seg.activity)
      const category = override || seg.category

      rows.push({
        id: crypto.randomUUID(),
        category,
        activityName: seg.activity,
        timeIn: seg.timeIn,
        timeOut: seg.timeOut,
        projectName: appState.projectName,
        teamRig: appState.teamRig,
        workType: appState.workType,
        refPoint: appState.refPoint,
        startDepth: seg.startDepth || '0',
        endDepth: seg.endDepth || '0',
        logDate: appState.logDate || new Date().toISOString().slice(0, 10),
      })
    }
  }

  try {
    const saved = await insertTimeEntries(rows)
    // Server rows keep the same uuid ids (ids are provided client-side), so we
    // can simply swap in the authoritative copies.
    appState.logRows.push(...saved)
    refreshKnown(saved)
  } catch (err) {
    console.warn('Supabase insert failed (offline?); queued for retry:', err?.message)
    appState.logRows.push(...rows)
    pendingUploads.push(...rows)
  }
  resetForm()
  return rows.length > 0
}
