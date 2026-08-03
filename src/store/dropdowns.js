import { reactive, watch } from 'vue'

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
  'Toolbox meeting',
  'Platform leveling',
  'Rig shifting',
  'Peg setting',
  'Casing installation',
]

const DEFAULT_PRODUCTION = [
  'Drilling',
  'Grouting',
  'Hard drilling',
  'Obstruction drilling',
]

const DEFAULT_WAITS = [
  'Lunch',
  'Main contractor confirmation',
  'NCE permit',
  'Singtel permit',
  'Netlink Trust permit',
  'PUB permit',
  'SPPG permit',
  'Permits to work',
  'RE/RTO inspection',
  'Material clearance',
  'Soil clearance',
  '3rd party clearance',
  'Safety PGI',
  'Safety Time Out',
  'Rig repair / maintenance',
  'Tool damaged',
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
  preparationList: persisted?.hiddenPrep || {},
  productionList: persisted?.hiddenProd || {},
  waitsList: persisted?.hiddenWait || {},
})

watch(
  () => ({
    ...JSON.parse(JSON.stringify(dropdowns)),
    hiddenPrep: JSON.parse(JSON.stringify(hiddenItems.preparationList)),
    hiddenProd: JSON.parse(JSON.stringify(hiddenItems.productionList)),
    hiddenWait: JSON.parse(JSON.stringify(hiddenItems.waitsList)),
  }),
  (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  },
  { deep: true }
)

/**
 * Reset all dropdown lists to their defaults.
 */
export function resetDropdowns() {
  dropdowns.rigList = [...DEFAULT_RIGS]
  dropdowns.preparationList = [...DEFAULT_PREPARATION]
  dropdowns.productionList = [...DEFAULT_PRODUCTION]
  dropdowns.waitsList = [...DEFAULT_WAITS]
  hiddenItems.preparationList = {}
  hiddenItems.productionList = {}
  hiddenItems.waitsList = {}
}
