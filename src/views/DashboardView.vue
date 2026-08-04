<template>
  <!-- UNAUTHORIZED OVERLAY -->
  <div v-if="!isAuthorized" class="unauth-overlay">
    <div class="unauth-card">
      <div class="unauth-icon">⚠️</div>
      <div class="unauth-text">Authorised User Only</div>
    </div>
  </div>

  <!-- AUTHORIZED DASHBOARD -->
  <div v-else class="dashboard-page">
    <h2>📊 Dashboard</h2>

    <!-- Tab Selector -->
    <div class="filter-bar">
      <label class="filter-label">Project Tab:</label>
      <select v-model="selectedTab" @change="loadData" class="filter-select">
        <option v-for="tab in tabList" :key="tab" :value="tab">{{ tab }}</option>
      </select>
      <span v-if="loading" class="loading-spin">⏳ Loading…</span>
      <span v-if="errorMsg" class="error-msg">{{ errorMsg }}</span>
    </div>

    <!-- View Toggle -->
    <div class="view-toggle">
      <button
        v-for="v in views"
        :key="v"
        :class="['toggle-btn', { active: viewMode === v }]"
        @click="viewMode = v"
      >{{ v }}</button>
    </div>

    <!-- HORIZONTAL STACKED BAR CHART -->
    <div v-if="chartReady" class="chart-container">
      <Bar v-if="hasChartData" :data="chartData" :options="chartOptions" />
      <p v-else class="empty-msg" style="padding: 12px 0;">Chart data is all zero — check category mapping.</p>
    </div>
    <p v-else-if="!loading && rows.length === 0" class="empty-msg">No data found in this tab.</p>

    <!-- CATEGORY REPORT TABLE -->
    <div v-if="rows.length > 0" class="report-table">
      <div
        v-for="cat in categories"
        :key="cat.name"
        class="report-row"
      >
        <span class="cat-col">
          <span class="color-dot" :style="{ background: cat.color }"></span>
          {{ cat.name }}
        </span>
        <span class="val-col">
          <span class="val-hr">{{ cat.avgHours }} h</span>
          <span class="val-pct">{{ cat.pct }}%</span>
        </span>
      </div>
    </div>

    <!-- PROJECT TOTALS -->
    <div v-if="rows.length > 0" class="totals-section">
      <h3>Project Totals</h3>
      <div class="totals-grid">
        <div class="total-item">
          <span class="total-label">Total Hours</span>
          <span class="total-value">{{ totals.totalHours }} h</span>
        </div>
        <div class="total-item">
          <span class="total-label">Days Logged</span>
          <span class="total-value">{{ totals.uniqueDays }}</span>
        </div>
        <div class="total-item">
          <span class="total-label">Date Range</span>
          <span class="total-value">{{ totals.dateRange }}</span>
        </div>
        <div class="total-item">
          <span class="total-label">Entries</span>
          <span class="total-value">{{ rows.length }}</span>
        </div>
      </div>
    </div>

    <!-- END DATE PROJECTION (Daily view only) -->
    <div v-if="rows.length > 0 && viewMode === 'Daily'" class="projection-section">
      <h3>📅 End Date Projection</h3>
      <p class="proj-sub">Based on 6 working days per week (Mon–Sat)</p>

      <div class="proj-grid">
        <div class="proj-item">
          <label>Daily Prod Avg</label>
          <span class="proj-value">{{ dailyProdHrs }} h/day</span>
        </div>
        <div class="proj-item">
          <label>Prod Rate</label>
          <input
            v-model.number="prodRate"
            type="number"
            step="0.1"
            min="0"
            class="proj-input"
            placeholder="m/h"
          />
        </div>
        <div class="proj-item">
          <label>Total Required</label>
          <input
            v-model.number="totalRequired"
            type="number"
            step="0.1"
            min="0"
            class="proj-input"
            placeholder="metres"
          />
        </div>
        <div class="proj-item">
          <label>Already Drilled</label>
          <span class="proj-value">{{ alreadyDrilled }} m</span>
        </div>
      </div>

      <div v-if="projectedEnd" class="proj-result">
        <p>Remaining: <strong>{{ remainingMetres }} m</strong></p>
        <p>Days needed: <strong>{{ daysNeeded }}</strong></p>
        <p class="proj-end">→ Projected end: <strong>{{ projectedEnd }}</strong></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { readSheetData, listSheetTabs } from '../lib/googleSheets.js'
import { appState } from '../store/appState.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels)

// ── Authorized user gate ──
const ALLOWED_EMAIL = 'bennyoh68@gmail.com'
const isAuthorized = computed(() => {
  const email = appState.user?.email || ''
  return email.toLowerCase() === ALLOWED_EMAIL
})

// ── Constants ──
const SPREADSHEET_ID = import.meta.env.VITE_GCP_SPREADSHEET_ID
const CLIENT_EMAIL = import.meta.env.VITE_GCP_CLIENT_EMAIL
const PRIVATE_KEY = import.meta.env.VITE_GCP_PRIVATE_KEY

const CATEGORY_CONFIG = [
  { name: 'Preparation Work',           color: '#3b82f6' },
  { name: 'Production Work',            color: '#10b981' },
  { name: 'Safety',                     color: '#f59e0b' },
  { name: 'Rig Maintenance & Tool Damaged', color: '#ef4444' },
  { name: 'Other Wait',                 color: '#94a3b8' },
]

// Map short names from Google Sheets → display names in CATEGORY_CONFIG
const CATEGORY_NORMALIZE_MAP = {
  'preparation':            'Preparation Work',
  'production':             'Production Work',
  'waits':                  'Other Wait',
  'wait':                   'Other Wait',
  'safety':                 'Safety',
  'rig maintenance':        'Rig Maintenance & Tool Damaged',
  'rig maintenance & tool damaged': 'Rig Maintenance & Tool Damaged',
}

function normalizeCategory(raw) {
  if (!raw) return ''
  const key = raw.toLowerCase().trim()
  return CATEGORY_NORMALIZE_MAP[key] || raw
}

const views = ['Daily', 'Weekly', 'Monthly']

// ── State ──
const tabList = ref([])
const selectedTab = ref('')
const rows = ref([])
const loading = ref(false)
const errorMsg = ref('')
const viewMode = ref('Daily')

// Projection inputs
const prodRate = ref(0)
const totalRequired = ref(0)

// ── Parse time "HH:MM" → decimal hours ──
function timeToHours(str) {
  if (!str || !str.includes(':')) return 0
  const [h, m] = str.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return 0
  return h + m / 60
}

// ── Get ISO week number (1-53) ──
function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
}

// ── Parse date string "YYYY-MM-DD" or "M/D/YYYY" ──
function parseDate(str) {
  if (!str) return null
  // Try YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  // Try M/D/YYYY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(+m[3], +m[1] - 1, +m[2])
  return null
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Process rows into category breakdown ──
function processRows() {
  const catMap = new Map()
  const dates = new Set()
  const weeks = new Set()
  const months = new Set()
  let totalDepth = 0

  for (const row of rows.value) {
    const cat = normalizeCategory(row.category || '')
    if (!cat) continue

    const hours = timeToHours(row['time out']) - timeToHours(row['time in'])
    if (hours <= 0) continue

    const existing = catMap.get(cat) || { totalHours: 0, days: new Set(), weeks: new Set(), months: new Set() }
    existing.totalHours += hours

    const d = parseDate(row.date)
    if (d) {
      const ds = formatDate(d)
      existing.days.add(ds)
      existing.weeks.add(`${d.getFullYear()}-W${getISOWeek(d)}`)
      existing.months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      dates.add(ds)
      weeks.add(`${d.getFullYear()}-W${getISOWeek(d)}`)
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    // Accumulate depth from end_depth column
    const ed = parseFloat(row['end depth'] || row['end_depth'] || '0')
    if (!isNaN(ed) && ed > totalDepth) totalDepth = ed

    catMap.set(cat, existing)
  }

  return { catMap, dates, weeks, months, totalDepth }
}

// ── Computed: daily production hours ──
const dailyProdHrs = computed(() => {
  const { catMap, dates } = processRows()
  const prod = catMap.get('Production Work')
  if (!prod || dates.size === 0) return 0
  return +(prod.totalHours / dates.size).toFixed(1)
})

// ── Computed: unique raw category values (debug) ──
const uniqueCategories = computed(() => {
  const seen = new Set()
  for (const row of rows.value) {
    const raw = (row.category || '').trim()
    if (raw) seen.add(raw)
  }
  return [...seen].sort()
})

// ── Computed: categories with averages ──
const categories = computed(() => {
  const { catMap, dates, weeks, months } = processRows()
  const totalHoursAll = [...catMap.values()].reduce((s, c) => s + c.totalHours, 0)

  return CATEGORY_CONFIG.map(cfg => {
    const data = catMap.get(cfg.name)
    if (!data) {
      return { ...cfg, avgHours: '0.0', pct: '0', _hours: 0 }
    }

    let divisor
    if (viewMode.value === 'Daily') divisor = dates.size
    else if (viewMode.value === 'Weekly') divisor = weeks.size
    else divisor = months.size

    const avgHours = divisor > 0 ? (data.totalHours / divisor).toFixed(1) : '0.0'
    const pct = totalHoursAll > 0 ? ((data.totalHours / totalHoursAll) * 100).toFixed(1) : '0.0'

    return {
      ...cfg,
      avgHours,
      pct,
      _hours: data.totalHours,
    }
  })
})

// ── Computed: project totals ──
const totals = computed(() => {
  const { catMap, dates } = processRows()
  const totalHours = +[...catMap.values()].reduce((s, c) => s + c.totalHours, 0).toFixed(1)
  const dateArr = [...dates].sort()
  const dateRange = dateArr.length
    ? `${dateArr[0]} – ${dateArr[dateArr.length - 1]}`
    : 'N/A'
  return {
    totalHours: String(totalHours),
    uniqueDays: dates.size,
    dateRange,
  }
})

// ── Computed: already drilled depth ──
const alreadyDrilled = computed(() => {
  const { totalDepth } = processRows()
  return +totalDepth.toFixed(1)
})

// ── Computed: end date projection ──
const projectedEnd = computed(() => {
  const remaining = totalRequired.value - alreadyDrilled.value
  if (remaining <= 0 || !prodRate.value || !dailyProdHrs.value) return null

  const dailyProdMetres = prodRate.value * dailyProdHrs.value
  if (dailyProdMetres <= 0) return null

  const workDaysNeeded = Math.ceil(remaining / dailyProdMetres)

  // Calculate calendar days (skip Sundays)
  let d = new Date()
  let workDays = 0
  while (workDays < workDaysNeeded) {
    d.setDate(d.getDate() + 1)
    // Sunday = 0 in JS getDay()
    if (d.getDay() !== 0) workDays++
  }
  return formatDate(d)
})

const remainingMetres = computed(() => {
  const r = totalRequired.value - alreadyDrilled.value
  return r > 0 ? +r.toFixed(1) : 0
})

const daysNeeded = computed(() => {
  const remaining = totalRequired.value - alreadyDrilled.value
  if (remaining <= 0 || !prodRate.value || !dailyProdHrs.value) return 0
  const dailyProdMetres = prodRate.value * dailyProdHrs.value
  return dailyProdMetres > 0 ? Math.ceil(remaining / dailyProdMetres) : 0
})

// ── Chart data (horizontal stacked bar) ──
const chartData = computed(() => {
  const cats = categories.value
  return {
    labels: ['Time Breakdown'],
    datasets: cats.map(c => ({
      label: c.name,
      data: [c._hours],
      backgroundColor: c.color,
      borderColor: '#fff',
      borderWidth: 1,
    })),
  }
})

const chartReady = computed(() => {
  if (rows.value.length === 0) return false
  return true
})

const hasChartData = computed(() => {
  const cats = categories.value
  return cats.some(c => c._hours > 0)
})

const chartOptions = computed(() => {
  const total = categories.value.reduce((s, c) => s + c._hours, 0)
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 5,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 12,
          usePointStyle: false,
          boxWidth: 12,
          boxHeight: 12,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0
            return ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)} h (${pct}%)`
          },
        },
      },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold', size: 11, lineHeight: 1.15 },
        textAlign: 'center',
        formatter(value, ctx) {
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0
          if (value <= 0) return ''
          return [`${pct}%`, `${value.toFixed(1)} h`]
        },
        display(ctx) {
          return ctx.dataset.data[ctx.dataIndex] > 0
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          callback(val) { return val + ' h' },
          font: { size: 10 },
        },
        grid: { display: false },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { display: false },
        border: { display: false },
      },
    },
  }
})

// ── Load tabs on mount ──
onMounted(async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const tabs = await listSheetTabs({
      clientEmail: CLIENT_EMAIL,
      privateKey: PRIVATE_KEY,
      spreadsheetId: SPREADSHEET_ID,
    })
    tabList.value = tabs
    if (tabs.length > 0) {
      selectedTab.value = tabs[0]
      await loadData()
    } else {
      errorMsg.value = 'No tabs found in spreadsheet.'
    }
  } catch (e) {
    errorMsg.value = 'Failed to list tabs: ' + e.message
  } finally {
    loading.value = false
  }
})

async function loadData() {
  if (!selectedTab.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await readSheetData({
      clientEmail: CLIENT_EMAIL,
      privateKey: PRIVATE_KEY,
      spreadsheetId: SPREADSHEET_ID,
      tabName: selectedTab.value,
    })
    rows.value = data
  } catch (e) {
    errorMsg.value = 'Failed to load data: ' + e.message
    rows.value = []
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.dashboard-page {
  padding: 8px 0;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 12px;
}

/* ── Filter Bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.filter-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}
.filter-select {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
  flex: 1;
  max-width: 220px;
}
.loading-spin {
  font-size: 0.8rem;
  color: #6366f1;
}
.error-msg {
  font-size: 0.8rem;
  color: #dc2626;
}
.empty-msg {
  text-align: center;
  color: #94a3b8;
  padding: 24px 0;
}

/* ── View Toggle ── */
.view-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}
.toggle-btn {
  flex: 1;
  padding: 8px 0;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}
.toggle-btn.active {
  background: #1e293b;
  color: #fff;
  border-color: #1e293b;
}

/* ── Chart ── */
.chart-container {
  max-width: 100%;
  height: 160px;
  margin: 0 auto 16px;
}

/* ── Category Report Table ── */
.report-table {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
}
.report-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 0.82rem;
}
.report-row + .report-row {
  border-top: 1px solid #f8fafc;
}
.cat-col {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-weight: 500;
}
.val-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: #1e293b;
  font-weight: 600;
  line-height: 1.25;
}
.val-hr {
  font-size: 0.85rem;
}
.val-pct {
  font-size: 0.72rem;
  color: #64748b;
}
.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

/* ── Totals ── */
.totals-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
.totals-section h3 {
  font-size: 0.9rem;
  margin-bottom: 8px;
  color: #334155;
}
.totals-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
}
.total-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.total-label {
  font-size: 0.78rem;
  color: #64748b;
}
.total-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
}

/* ── Projection ── */
.projection-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
.projection-section h3 {
  font-size: 0.9rem;
  color: #334155;
  margin-bottom: 2px;
}
.proj-sub {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-bottom: 10px;
}
.proj-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin-bottom: 12px;
}
.proj-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.proj-item label {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 500;
}
.proj-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  padding: 6px 0;
}
.proj-input {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.85rem;
  width: 100%;
  box-sizing: border-box;
}
.proj-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
}
.proj-result {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 10px 12px;
}
.proj-result p {
  font-size: 0.82rem;
  margin-bottom: 4px;
  color: #334155;
}
.proj-end {
  font-size: 0.95rem !important;
  color: #166534 !important;
  margin-top: 6px;
  margin-bottom: 0 !important;
}

/* ── Debug bar ── */
.debug-bar {
  background: #fefce8;
  border: 1px solid #fde047;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 0.75rem;
}
.debug-label {
  font-weight: 600;
  color: #854d0e;
  margin-right: 6px;
}
.debug-bar code {
  color: #713f12;
  word-break: break-all;
}

/* ── Unauthorized overlay ── */
.unauth-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.unauth-card {
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.unauth-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}
.unauth-text {
  font-size: 1.2rem;
  font-weight: 700;
  color: #dc2626;
  letter-spacing: 0.5px;
}
</style>
