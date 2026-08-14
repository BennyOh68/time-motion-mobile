import { reactive, watch } from 'vue'
import {
  fetchDropdownSettings,
  upsertDropdownSettings,
} from '../lib/supabaseData.js'

const STORAGE_KEY = 'tm_dropdowns'

const DEFAULT_RIGS = [
  'Rig 1',
  'Rig 2',
  'Rig 3',
  'Rig 4',
  'Rig 5',
  'Rig 6',
]

const DEFAULT_PREPARATION = [
  'Permit to work',
  'Toolbox meeting',
  'Platform leveling',
  'Rig positioning',
  'Rig shifting',
  'Peg setting',
  'Casing installation',
]

const DEFAULT_PRODUCTION = [
  'Drilling',
  'RE/RTO inspection',
  'Grouting',
  'Rod extraction',
  'Hard drilling',
  'Obstruction probing',
]

const DEFAULT_WAITS = [
  'Lunch',
  'Rig maintenance',
  'Tool damaged',
  'Soil clearance',
  'Material clearance',
  'Waiting RE/RTO',
  'Waiting Client',
  'Safety PGI',
  'Safety Time Out',
  'NCE permit',
  'Singtel permit',
  'Netlink Trust permit',
  'PUB permit',
  'SPPG permit',
  'Blocked access',
  'Dinner',
]

function loadLists() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

const persisted = loadLists()

export const dropdowns = reactive({
  rigList: persisted?.rigList || [...DEFAULT_RIGS],
  preparationList: persisted?.preparationList || [...DEFAULT_PREPARATION],
  productionList: persisted?.productionList || [...DEFAULT_PRODUCTION],
  waitsList: persisted?.waitsList || [...DEFAULT_WAITS],

  // Last selected per segment
  lastPrepSelection: persisted?.lastPrepSelection || '',
  lastProdSelection: persisted?.lastProdSelection || '',
  lastWaitSelection: persisted?.lastWaitSelection || '',
})

// ── Hidden items per list (index-based) ──
export const hiddenItems = reactive({
  rigList: persisted?.hiddenRig || {},
  preparationList: persisted?.hiddenPrep || {},
  productionList: persisted?.hiddenProd || {},
  waitsList: persisted?.hiddenWait || {},
})

let hydrating = false
let pushTimer = null

watch(
  () => ({
    ...JSON.parse(JSON.stringify(dropdowns)),
    hiddenRig: JSON.parse(JSON.stringify(hiddenItems.rigList)),
    hiddenPrep: JSON.parse(JSON.stringify(hiddenItems.preparationList)),
    hiddenProd: JSON.parse(JSON.stringify(hiddenItems.productionList)),
    hiddenWait: JSON.parse(JSON.stringify(hiddenItems.waitsList)),
  }),
  (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    // Push to Supabase (debounced) so the same user's lists sync across devices.
    if (hydrating) return
    clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      upsertDropdownSettings(state).catch((err) =>
        console.warn('Supabase settings push deferred (offline?):', err?.message)
      )
    }, 600)
  },
  { deep: true }
)

/**
 * Load the current user's dropdown settings from Supabase and apply them.
 * Called after login. Falls back to local defaults if the server has no row yet.
 */
export async function hydrateDropdownSettings() {
  hydrating = true
  try {
    const settings = await fetchDropdownSettings()
    if (settings) {
      dropdowns.rigList = settings.rigList
      dropdowns.preparationList = settings.preparationList
      dropdowns.productionList = settings.productionList
      dropdowns.waitsList = settings.waitsList
      dropdowns.lastPrepSelection = settings.lastPrepSelection
      dropdowns.lastProdSelection = settings.lastProdSelection
      dropdowns.lastWaitSelection = settings.lastWaitSelection
      hiddenItems.rigList = settings.hiddenRig
      hiddenItems.preparationList = settings.hiddenPrep
      hiddenItems.productionList = settings.hiddenProd
      hiddenItems.waitsList = settings.hiddenWait
    }
  } catch (err) {
    console.warn('Supabase dropdown hydration failed (offline?):', err?.message)
  } finally {
    hydrating = false
  }
}

/**
 * Reset all dropdown lists to their defaults.
 */
export function resetDropdowns() {
  dropdowns.rigList = [...DEFAULT_RIGS]
  dropdowns.preparationList = [...DEFAULT_PREPARATION]
  dropdowns.productionList = [...DEFAULT_PRODUCTION]
  dropdowns.waitsList = [...DEFAULT_WAITS]
  hiddenItems.rigList = {}
  hiddenItems.preparationList = {}
  hiddenItems.productionList = {}
  hiddenItems.waitsList = {}
}
