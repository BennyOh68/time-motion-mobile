/**
 * supabaseData.js — Supabase Postgres CRUD + realtime for all collected data.
 *
 * Replaces localStorage as the source of truth and Google Sheets as the sync
 * mechanism. All rows are scoped to the authenticated user via RLS
 * (auth.uid() = user_id), so the same account on multiple devices shares one
 * database and stays in sync via realtime subscriptions.
 */
import { supabase } from './supabase.js'

// ── Error helper ──────────────────────────────────────────────────────────────
function message(err, fallback) {
  return err?.message || fallback
}

// ── Time entries (log rows) ──────────────────────────────────────────────────

/**
 * Fetch all time entries for the current user.
 * Maps snake_case DB columns back to the camelCase row shape used by
 * appState.logRows.
 */
export async function fetchTimeEntries() {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .order('log_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(message(error, 'Failed to load entries'))
  return (data || []).map(toRow)
}

/**
 * Insert one or more time entries.
 * @param {Array<object>} rows camelCase rows (same shape as submitFormRows output)
 */
export async function insertTimeEntries(rows) {
  if (!rows || rows.length === 0) {
    console.debug('[sync] insertTimeEntries: 0 rows — nothing to insert')
    return []
  }
  const userId = await currentUserId()
  console.debug('[sync] insertTimeEntries: attempting insert', {
    count: rows.length,
    userId,
    sample: rows[0],
  })
  const payload = rows.map((row) => toDbRow(row, userId))
  const { data, error } = await supabase.from('time_entries').insert(payload).select()

  if (error) {
    console.error('[sync] insertTimeEntries ERROR', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload,
    })
    throw new Error(message(error, 'Failed to save entries'))
  }
  console.debug('[sync] insertTimeEntries OK: returned', data?.length, 'row(s)')
  return (data || []).map(toRow)
}

/**
 * Update a single time entry.
 * @param {string} id
 * @param {object} patch camelCase fields to update
 */
export async function updateTimeEntry(id, patch) {
  const { data, error } = await supabase
    .from('time_entries')
    .update({ ...toDbRow(patch), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()

  if (error) throw new Error(message(error, 'Failed to update entry'))
  return data && data.length > 0 ? toRow(data[0]) : null
}

/**
 * Delete one or more time entries by id.
 * @param {string|string[]} ids
 */
export async function deleteTimeEntries(ids) {
  const list = Array.isArray(ids) ? ids : [ids]
  if (list.length === 0) return
  const { error } = await supabase.from('time_entries').delete().in('id', list)
  if (error) throw new Error(message(error, 'Failed to delete entries'))
}

// ── Realtime subscription ─────────────────────────────────────────────────────

/**
 * Subscribe to live changes on time_entries for the current user.
 * onEvent receives ({ type: 'INSERT'|'UPDATE'|'DELETE', newRow, oldId }).
 * Returns an unsubscribe function.
 */
export function subscribeToTimeEntries(onEvent) {
  const channel = supabase
    .channel('time_entries_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'time_entries' },
      (payload) => {
        const type = payload.eventType // INSERT | UPDATE | DELETE
        if (type === 'DELETE') {
          onEvent({ type, oldId: payload.old?.id })
        } else {
          onEvent({ type, newRow: toRow(payload.new) })
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// ── Dropdown settings ─────────────────────────────────────────────────────────

const EMPTY_DROPDOWN_SETTINGS = {
  rigList: [],
  preparationList: [],
  productionList: [],
  waitsList: [],
  lastPrepSelection: '',
  lastProdSelection: '',
  lastWaitSelection: '',
  hiddenRig: {},
  hiddenPrep: {},
  hiddenProd: {},
  hiddenWait: {},
  workTypeLabels: {
    JGP: 'Jet Grout Pile (JGP)',
    GH: 'Grout Hole (GH)',
  },
}

const EMPTY_SEGMENT = {
  activity: '',
  timeIn: '',
  timeOut: '',
  startDepth: '0.0',
  endDepth: '0.0',
}

const EMPTY_FORM_STATE = {
  projectName: '',
  teamRig: '',
  workType: 'JGP',
  refPoint: '',
  logDate: '',
  prep: { ...EMPTY_SEGMENT },
  prod: { ...EMPTY_SEGMENT },
  wait: { ...EMPTY_SEGMENT },
}

/**
 * Fetch the current user's dropdown settings (Setup page lists).
 * Returns null if none exist yet.
 */
export async function fetchDropdownSettings() {
  const { data, error } = await supabase
    .from('dropdown_settings')
    .select('*')
    .maybeSingle()

  if (error) throw new Error(message(error, 'Failed to load settings'))
  if (!data) return null // no row yet
  return toSettings(data)
}

/**
 * Insert or update the current user's dropdown settings.
 * @param {object} settings camelCase settings (see EMPTY_DROPDOWN_SETTINGS)
 */
export async function upsertDropdownSettings(settings) {
  const userId = await currentUserId()
  if (!userId) throw new Error('Not authenticated')
  const merged = { ...EMPTY_DROPDOWN_SETTINGS, ...(settings || {}) }
  const payload = { user_id: userId, ...toSettingsDb(merged) }

  const { error } = await supabase.from('dropdown_settings').upsert(payload)
  if (error) throw new Error(message(error, 'Failed to save settings'))
}

// ── Form state (Input page in-progress form) ─────────────────────────────────

/**
 * Fetch the current user's in-progress Input-page form. Returns null if
 * nothing has been saved yet.
 */
export async function fetchFormState() {
  const { data, error } = await supabase
    .from('form_state')
    .select('*')
    .maybeSingle()

  if (error) throw new Error(message(error, 'Failed to load form state'))
  if (!data) return null
  return toFormState(data)
}

/**
 * Insert or update the current user's in-progress form state.
 * @param {object} state camelCase form snapshot (see EMPTY_FORM_STATE)
 */
export async function upsertFormState(state) {
  const userId = await currentUserId()
  if (!userId) throw new Error('Not authenticated')
  const merged = { ...EMPTY_FORM_STATE, ...(state || {}) }
  const payload = { user_id: userId, ...toFormStateDb(merged) }

  const { error } = await supabase.from('form_state').upsert(payload)
  if (error) throw new Error(message(error, 'Failed to save form state'))
}

/**
 * Subscribe to form_state changes (INSERT / UPDATE / DELETE) from any device.
 * Returns an unsubscribe function.
 */
export function subscribeToFormState(onEvent) {
  const channel = supabase
    .channel('form_state_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'form_state' },
      (payload) => {
        const type = payload.eventType
        if (type === 'DELETE') {
          onEvent({ type, oldId: payload.old?.user_id })
        } else {
          onEvent({ type, newRow: toFormState(payload.new) })
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// ── Column mapping helpers ────────────────────────────────────────────────────

function toRow(db) {
  return {
    id: db.id,
    category: db.category,
    activityName: db.activity_name,
    timeIn: db.time_in || '',
    timeOut: db.time_out || '',
    projectName: db.project_name || '',
    teamRig: db.team_rig || '',
    workType: db.work_type || '',
    refPoint: db.ref_point || '',
    startDepth: db.start_depth != null ? String(db.start_depth) : '0',
    endDepth: db.end_depth != null ? String(db.end_depth) : '0',
    logDate: db.log_date,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

function toDbRow(row, userId) {
  const out = {
    category: row.category,
    activity_name: row.activityName,
    time_in: row.timeIn || null,
    time_out: row.timeOut || null,
    project_name: row.projectName || null,
    team_rig: row.teamRig || null,
    work_type: row.workType || null,
    ref_point: row.refPoint || null,
    start_depth: row.startDepth == null || row.startDepth === '' ? null : Number(row.startDepth),
    end_depth: row.endDepth == null || row.endDepth === '' ? null : Number(row.endDepth),
    log_date: row.logDate,
  }
  if (row.id) out.id = row.id
  if (userId) out.user_id = userId
  return out
}

function toSettings(db) {
  return {
    rigList: db.rig_list || [],
    preparationList: db.preparation_list || [],
    productionList: db.production_list || [],
    waitsList: db.waits_list || [],
    lastPrepSelection: db.last_prep_selection || '',
    lastProdSelection: db.last_prod_selection || '',
    lastWaitSelection: db.last_wait_selection || '',
    hiddenRig: db.hidden_rig || {},
    hiddenPrep: db.hidden_prep || {},
    hiddenProd: db.hidden_prod || {},
    hiddenWait: db.hidden_wait || {},
    workTypeLabels: db.work_type_labels || {},
  }
}

function toSettingsDb(s) {
  return {
    rig_list: s.rigList,
    preparation_list: s.preparationList,
    production_list: s.productionList,
    waits_list: s.waitsList,
    last_prep_selection: s.lastPrepSelection,
    last_prod_selection: s.lastProdSelection,
    last_wait_selection: s.lastWaitSelection,
    hidden_rig: s.hiddenRig,
    hidden_prep: s.hiddenPrep,
    hidden_prod: s.hiddenProd,
    hidden_wait: s.hiddenWait,
    work_type_labels: s.workTypeLabels,
    updated_at: new Date().toISOString(),
  }
}

function toFormState(db) {
  const seg = (raw) => ({
    activity: raw?.activity || '',
    timeIn: raw?.timeIn || '',
    timeOut: raw?.timeOut || '',
    startDepth: raw?.startDepth ?? '0.0',
    endDepth: raw?.endDepth ?? '0.0',
  })
  return {
    projectName: db.project_name || '',
    teamRig: db.team_rig || '',
    workType: db.work_type || 'JGP',
    refPoint: db.ref_point || '',
    logDate: db.log_date || '',
    prep: seg(db.prep),
    prod: seg(db.prod),
    wait: seg(db.wait),
  }
}

function toFormStateDb(s) {
  return {
    project_name: s.projectName || null,
    team_rig: s.teamRig || null,
    work_type: s.workType || null,
    ref_point: s.refPoint || null,
    log_date: s.logDate || null,
    prep: s.prep || {},
    prod: s.prod || {},
    wait: s.wait || {},
    updated_at: new Date().toISOString(),
  }
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) console.error('[sync] currentUserId ERROR:', error.message)
  console.debug('[sync] currentUserId resolved:', data?.user?.id || null)
  return data?.user?.id || null
}
