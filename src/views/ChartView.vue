<template>
  <div class="chart-page">
    <!-- Chart wrapper -->
    <div class="chart-wrapper">
      <h2>📈 Time & Motion Chart</h2>
      <div class="chart-meta">
        <span><b>Project Name:</b> {{ appState.projectName || '—' }}</span>
      </div>

      <div class="chart-controls">
        <select v-model="filterTeam" @change="updateChart" class="filter-select">
          <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
        </select>
        <div class="date-nav">
          <button class="nav-btn" :disabled="!filterDate" @click="prevDay">◀</button>
          <span class="date-spacer"></span>
          <span class="date-label">{{ formattedDate }}</span>
          <span class="date-spacer"></span>
          <button class="nav-btn" :disabled="!filterDate" @click="nextDay">▶</button>
        </div>
      </div>

      <div class="chart-scroll-box">
        <div class="chart-canvas-view">
          <Scatter ref="scatterRef" :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Action bar: below the chart, mirrors Summary page -->
      <div class="action-bar">
        <button class="btn-outline" @click="router.push('/summary')">← Back</button>
        <button class="btn-primary" @click="router.push('/export')">Next → Export</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'ChartView' })
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Scatter } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import zoomPlugin from 'chartjs-plugin-zoom'
import { appState } from '../store/appState.js'
import { workTypePrefix } from '../store/dropdowns.js'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)
ChartJS.register(annotationPlugin)
ChartJS.register(zoomPlugin)

const router = useRouter()
const scatterRef = ref(null)

// ── Plugin: afterRender sets exact pixel-space rotation on label annotations ──
const labelRotatorPlugin = {
  id: 'labelRotator',
  afterRender(chart) {
    const anns = chart.options.plugins.annotation.annotations
    if (!anns) return

    let changed = false
    const usedPositions = [] // { pxX, adjY }

    for (const [key, ann] of Object.entries(anns)) {
      if (!key.startsWith('mid-')) continue
      if (ann._tIn == null) continue

      const px1 = chart.scales.x.getPixelForValue(ann._tIn)
      const py1 = chart.scales.y.getPixelForValue(ann._sD)
      const px2 = chart.scales.x.getPixelForValue(ann._tOut)
      const py2 = chart.scales.y.getPixelForValue(ann._eD)

      const angleRad = Math.atan2(py2 - py1, px2 - px1)
      const angle = angleRad * 180 / Math.PI
      if (ann.rotation !== angle) {
        ann.rotation = angle
        changed = true
      }

      // Perpendicular decomposition:
      // Line direction vector in pixel space = (cos θ, sin θ)
      // Rotate -90° for "above" perpendicular: (sin θ, -cos θ)
      // Scale by offset to get pixel-space (xAdjust, yAdjust)
      const sinA = Math.abs(Math.sin(angleRad))
      const cosA = Math.abs(Math.cos(angleRad))
      let xAdj, yAdj
      if (sinA < 0.1) {
        // Nearly horizontal line: fixed vertical offset above (scaled for font size 14)
        xAdj = 0
        yAdj = -22
      } else {
        const offset = 5 / Math.max(cosA, 0.15)
        xAdj = offset * Math.sin(angleRad)
        yAdj = -offset * Math.cos(angleRad)
      }

      // Collision avoidance: flip to opposite side of line
      const midPX = (px1 + px2) / 2
      const midPY = (py1 + py2) / 2
      for (const used of usedPositions) {
        if (Math.abs(used.pxX - (midPX + xAdj)) < 60 && Math.abs(used.adjY - (midPY + yAdj)) < 26) {
          xAdj = -xAdj   // flip perpendicular direction
          yAdj = -yAdj
          break
        }
      }
      usedPositions.push({ pxX: midPX + xAdj, adjY: midPY + yAdj })
      if (ann.xAdjust !== xAdj || ann.yAdjust !== yAdj) {
        ann.xAdjust = xAdj
        ann.yAdjust = yAdj
        changed = true
      }
    }

    if (changed) {
      requestAnimationFrame(() => chart.update('none'))
    }
  },
}

ChartJS.register(labelRotatorPlugin)

const filterTeam = ref('')
const filterDate = ref('')

// ── Activity color palette (Plotly default 10) ──────────────────
const ACTIVITY_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
]

// ── Derived data ────────────────────────────────────────────────
const teams = computed(() => {
  const set = new Set(appState.logRows.map(r => r.teamRig).filter(Boolean))
  return [...set]
})

const formattedDate = computed(() => {
  const d = filterDate.value
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
})

function parseTime(t) {
  if (!t) return null
  const parts = String(t).replace(/\./g, ':').split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function minutesToTimeLabel(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Filter rows by date & team ──────────────────────────────────
const filteredRows = computed(() => {
  return appState.logRows.filter(r => {
    if (filterDate.value && r.logDate !== filterDate.value) return false
    if (filterTeam.value && r.teamRig !== filterTeam.value) return false
    return true
  })
})

// ── Computed axis ranges (mirrors afterDataLimits logic) ─────────
const axisRanges = computed(() => {
  const rows = filteredRows.value
  let minTime = Infinity
  let maxTime = -Infinity
  let maxDepth = 10
  for (const row of rows) {
    const tIn = parseTime(row.timeIn)
    const tOut = parseTime(row.timeOut)
    if (tIn !== null) {
      if (tIn < minTime) minTime = tIn
      if (tIn > maxTime) maxTime = tIn
    }
    if (tOut !== null) {
      if (tOut < minTime) minTime = tOut
      if (tOut > maxTime) maxTime = tOut
    }
    const sd = parseFloat(row.startDepth)
    const ed = parseFloat(row.endDepth)
    if (!isNaN(sd) && sd > maxDepth) maxDepth = sd
    if (!isNaN(ed) && ed > maxDepth) maxDepth = ed
  }
  const xMin = minTime !== Infinity ? Math.floor(minTime / 60) * 60 - 60 : 360
  const xMax = maxTime !== -Infinity ? Math.ceil(maxTime / 60) * 60 + 60 : 1320
  const yMin = 0
  const yMax = Math.ceil(maxDepth) + 1
  return { xMin, xMax, yMin, yMax }
})

// ── Build chart datasets (one dataset per row — no separators needed) ─
function buildChartData() {
  const rows = filteredRows.value

  // Build activity→color lookup (preserve ordering of first appearance)
  const activityColorMap = new Map()
  let colorIdx = 0
  for (const row of rows) {
    const name = row.activityName || '(Unnamed)'
    if (!activityColorMap.has(name)) {
      activityColorMap.set(name, ACTIVITY_COLORS[colorIdx % ACTIVITY_COLORS.length])
      colorIdx++
    }
  }

  // Sort all rows by timeIn (global order, interleaved across refPoints)
  const sortedRows = [...rows].sort((a, b) => (a.timeIn || '').localeCompare(b.timeIn || ''))

  const datasets = []

  for (const row of sortedRows) {
    const tIn = parseTime(row.timeIn)
    const tOut = parseTime(row.timeOut)
    const sDepth = parseFloat(row.startDepth)
    const eDepth = parseFloat(row.endDepth)

    if (tIn === null || tOut === null) continue

    const name = row.activityName || '(Unnamed)'
    const color = activityColorMap.get(name) || '#64748b'

    datasets.push({
      label: name,
      data: [
        { x: tIn,  y: !isNaN(sDepth) ? sDepth : 0 },
        { x: tOut, y: !isNaN(eDepth) ? eDepth : 0 },
      ],
      backgroundColor: color,
      borderColor: color,
      pointRadius: 4,
      pointHoverRadius: 7,
      showLine: true,
      spanGaps: false,
      tension: 0,
    })
  }

  return { datasets }
}


// ── Build annotations (midpoint labels + vertical refPoint bands) ─
function buildAnnotations(xMin, xMax, yMin, yMax) {
  const rows = filteredRows.value
  const annotations = {}

  // -- 1. Midpoint activity labels (rotation + offset handled by labelRotatorPlugin) --
  const activityColorMap = new Map()
  {
    const seen = new Set()
    let ci = 0
    for (const row of rows) {
      const name = row.activityName || '(Unnamed)'
      if (!seen.has(name)) {
        seen.add(name)
        activityColorMap.set(name, ACTIVITY_COLORS[ci % ACTIVITY_COLORS.length])
        ci++
      }
    }
  }

  let labelIdx = 0

  for (const row of rows) {
    const tIn = parseTime(row.timeIn)
    const tOut = parseTime(row.timeOut)
    const sDepth = parseFloat(row.startDepth)
    const eDepth = parseFloat(row.endDepth)

    if (tIn === null || tOut === null) continue

    const sD = isNaN(sDepth) ? 0 : sDepth
    const eD = isNaN(eDepth) ? 0 : eDepth
    const midX = (tIn + tOut) / 2
    const midY = (sD + eD) / 2

    const actName = row.activityName || '(Unnamed)'
    const color = activityColorMap.get(actName) || '#64748b'

    annotations[`mid-${labelIdx}`] = {
      type: 'label',
      xValue: midX,
      yValue: midY,
      // Metadata for labelRotatorPlugin pixel-angle computation
      _tIn: tIn,
      _sD: sD,
      _tOut: tOut,
      _eD: eD,
      content: actName.split(/\s+/),
      font: { size: 14, weight: 'normal' },
      color: color,
      rotation: 0,       // set by labelRotatorPlugin afterRender
      xAdjust: 0,        // set by labelRotatorPlugin (perpendicular x)
      yAdjust: 0,        // set by labelRotatorPlugin (perpendicular y)
      opacity: 0.85,
      textAlign: 'center',
    }
    labelIdx++
  }

  // -- 2. Vertical bands per refPoint ──
  const refPointMap = new Map()
  for (const row of rows) {
    if (!row.refPoint) continue
    if (!refPointMap.has(row.refPoint)) refPointMap.set(row.refPoint, [])
    refPointMap.get(row.refPoint).push(row)
  }

  // Sort refPoints by min timeIn
  const refPointEntries = [...refPointMap.entries()]
  refPointEntries.sort((a, b) => {
    const aMin = Math.min(...a[1].map(r => parseTime(r.timeIn) || Infinity))
    const bMin = Math.min(...b[1].map(r => parseTime(r.timeIn) || Infinity))
    return aMin - bMin
  })

  let bandIdx = 0
  const BAND_COLORS = [
    'rgba(59,130,246,0.07)',
    'rgba(239,68,68,0.07)',
  ]

  for (const [refPoint, refRows] of refPointEntries) {
    const times = refRows.flatMap(r => [parseTime(r.timeIn), parseTime(r.timeOut)])
    const validTimes = times.filter(t => t !== null)
    if (validTimes.length === 0) continue

    const bandXMin = Math.min(...validTimes) - 2
    const bandXMax = Math.max(...validTimes) + 2

    annotations[`band-${bandIdx}`] = {
      type: 'box',
      xMin: bandXMin,
      xMax: bandXMax,
      yMin: 'min',
      yMax: 'max',
      backgroundColor: BAND_COLORS[bandIdx % BAND_COLORS.length],
      borderWidth: 0,
    }

    // RefPoint band label — centered in offset zone between depth 0m and axis edge
    annotations[`band-label-${bandIdx}`] = {
      type: 'label',
      xValue: (bandXMin + bandXMax) / 2,
      yValue: -0.75,
      yAdjust: 0,
      drawTime: 'afterDraw',
      content: `${workTypePrefix(refRows[0].workType)} - ${refPoint}`,
      font: { size: 13, weight: 'bold' },
      color: '#1e293b',
      backgroundColor: 'rgba(255,255,255,0.85)',
      padding: { top: 2, bottom: 2, left: 6, right: 6 },
      borderRadius: 4,
    }

    bandIdx++
  }

  return annotations
}

// ── Reactive chart config ───────────────────────────────────────
const chartData = ref(buildChartData())

const chartOptions = computed(() => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        display: false, // we use custom legend
      },
      datalabels: {
        display: false, // suppress automatic point labels from globally-registered plugin
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
          modifierKey: null,
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          drag: {
            enabled: false,
          },
          mode: 'xy',
        },
        limits: {
          x: {
            min: axisRanges.value.xMin,
            max: axisRanges.value.xMax,
          },
          y: {
            min: axisRanges.value.yMin,
            max: axisRanges.value.yMax,
          },
        },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const ds = chartData.value.datasets[ctx.datasetIndex]
            const point = ds.data[ctx.dataIndex]
            if (!point) return ''
            const tLabel = point.x !== null && !isNaN(point.x)
              ? minutesToTimeLabel(point.x)
              : '—'
            const dLabel = point.y !== null && !isNaN(point.y)
              ? `${point.y} m`
              : '—'
            return `${ds.label}: ${tLabel}  @ ${dLabel}`
          },
        },
      },
      annotation: {
        annotations: buildAnnotations(
          axisRanges.value.xMin,
          axisRanges.value.xMax,
          axisRanges.value.yMin,
          axisRanges.value.yMax,
        ),
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Time',
          font: { size: 14, weight: 'bold' },
        },
        ticks: {
          stepSize: 60,
          callback(val) {
            return minutesToTimeLabel(val)
          },
          font: { size: 11 },
        },
        grid: {
          color: '#e2e8f0',
          drawOnChartArea: true,
        },
        afterBuildTicks(axis) {
          axis.ticks = axis.ticks.filter(t => t.value % 60 === 0)
        },
        afterDataLimits(axis) {
          const rows = filteredRows.value
          let minTime = Infinity
          let maxTime = -Infinity
          for (const row of rows) {
            const tIn = parseTime(row.timeIn)
            const tOut = parseTime(row.timeOut)
            if (tIn !== null) {
              if (tIn < minTime) minTime = tIn
              if (tIn > maxTime) maxTime = tIn
            }
            if (tOut !== null) {
              if (tOut < minTime) minTime = tOut
              if (tOut > maxTime) maxTime = tOut
            }
          }
          if (minTime !== Infinity) {
            axis.min = Math.floor(minTime / 60) * 60 - 60  // 1h before earliest
            axis.max = Math.ceil(maxTime / 60) * 60 + 60   // 1h after latest
          } else {
            axis.min = 6 * 60
            axis.max = 22 * 60
          }
        },
      },
      y: {
        type: 'linear',
        offset: true,
        title: {
          display: true,
          text: 'Depth below ground (m)',
          font: { size: 14, weight: 'bold' },
        },
        ticks: {
          callback(val) {
            return val + ' m'
          },
          font: { size: 11 },
        },
        grid: {
          color: '#e2e8f0',
          drawOnChartArea: true,
        },
        afterDataLimits(axis) {
          // Auto-expand based on data — max depth + 1 m
          const rows = filteredRows.value
          let maxDepth = 10
          for (const row of rows) {
            const sd = parseFloat(row.startDepth)
            const ed = parseFloat(row.endDepth)
            if (!isNaN(sd) && sd > maxDepth) maxDepth = sd
            if (!isNaN(ed) && ed > maxDepth) maxDepth = ed
          }
          axis.max = Math.ceil(maxDepth) + 1
          axis.min = 0
        },
      },
    },
  }
})

// ── Date navigation ──────────────────────────────────────────────
function prevDay() {
  if (!filterDate.value) return
  const d = new Date(filterDate.value)
  d.setDate(d.getDate() - 1)
  filterDate.value = d.toISOString().split('T')[0]
}

function nextDay() {
  if (!filterDate.value) return
  const d = new Date(filterDate.value)
  d.setDate(d.getDate() + 1)
  filterDate.value = d.toISOString().split('T')[0]
}

// ── Helpers ─────────────────────────────────────────────────────
async function captureSnapshot() {
  const wrapper = document.querySelector('.chart-wrapper')
  if (!wrapper) return
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(wrapper, {
    scale: 2,
    backgroundColor: '#ffffff',
    // exclude UI chrome from the snapshot (header/title/controls are added programmatically by exportPDF)
    ignoreElements: (el) =>
      el.classList.contains('action-bar') ||
      el.classList.contains('chart-meta') ||
      el.classList.contains('chart-controls') ||
      el.tagName === 'H2',
  })
  appState.chartSnapshot = canvas.toDataURL('image/png')
}

async function updateChart() {
  chartData.value = buildChartData()
  await nextTick()
  // Force Canvas2D refresh after KeepAlive reactivation
  if (scatterRef.value && scatterRef.value.chart) {
    scatterRef.value.chart.update('none')
  }
  captureSnapshot()
}

onMounted(() => {
  // Restore persisted chartFilterDate if available, otherwise default to max date
  if (appState.chartFilterDate && filterDate.value !== appState.chartFilterDate) {
    filterDate.value = appState.chartFilterDate
  } else if (!filterDate.value) {
    const maxDate = appState.logRows
      .map(r => r.logDate)
      .filter(Boolean)
      .sort()
      .pop()
    if (maxDate) filterDate.value = maxDate
  }

  // Default team filter: restore last-selected if still available, otherwise first team
  if (appState.chartFilterTeam && teams.value.includes(appState.chartFilterTeam)) {
    filterTeam.value = appState.chartFilterTeam
  } else if (teams.value.length > 0) {
    filterTeam.value = teams.value[0]
  }

  updateChart()
})

watch(filterDate, (val) => {
  appState.chartFilterDate = val
  updateChart()
})
watch(filterTeam, (val) => {
  appState.chartFilterTeam = val
  updateChart()
})
</script>

<style scoped>
.chart-page {
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 52px);
  min-height: 0;
}

.chart-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

h2 {
  font-size: 18px;
  margin-bottom: 4px;
}

.chart-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: nowrap;
}

.filter-select {
  flex: 1 1 0;
  min-width: 0;
  width: 200px;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 12px;
  outline: none;
  background: #fff;
}
.chart-controls input {
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 12px;
  outline: none;
  background: #fff;
}

/* Chart scroll */
.chart-scroll-box {
  flex: 1;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  border-radius: 12px;
  background: #fff;
  padding: 16px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
}

.chart-canvas-view {
  width: 100%;
  height: 100%;
  min-height: 240px;
  position: relative;
}

/* Date navigator */
.date-nav {
  flex: 1 1 0;
  min-width: 204px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Auto-adjusting margin between the triangle buttons and the date label
   (grows to fill free space up to 24px, shrinks to a 6px minimum) */
.date-spacer {
  flex: 1 1 auto;
  min-width: 6px;
  max-width: 24px;
  height: 1px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
  color: #475569;
}

.nav-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.nav-btn:active {
  background: #e2e8f0;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.date-label {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  min-width: 120px;
  text-align: center;
}

.action-bar {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.btn-primary,
.btn-outline {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}
.btn-outline {
  background: #fff;
  color: #475569;
  border: 1px solid #cbd5e1;
}

@media (min-width: 800px) {
  .chart-canvas-view {
    min-height: 260px;
  }
}

@media (orientation: landscape) {
  .chart-page {
    max-width: none;
    padding: 0;
  }

  .chart-wrapper {
    padding: 0 12px;
  }

  .chart-scroll-box {
    padding: 8px;
  }

  .chart-canvas-view {
    height: 100%;
    min-height: 220px;
  }
}
</style>
