<template>
  <div class="export-page">
    <h2>📤 Export Data</h2>
    <p class="desc">Export log entries as CSV, sync to Google Sheets, or download chart as image/PDF.</p>

    <div class="export-cards">
      <!-- CSV Export -->
      <div class="card">
        <h3>📋 Export as CSV</h3>
        <p>Download current log entries as a CSV file to your device.</p>
        <button class="btn-outline" @click="exportCSV" :disabled="csvLoading">
          {{ csvLoading ? 'Generating…' : 'Download CSV' }}
        </button>
      </div>

      <!-- Google Sheets Sync -->
      <div class="card">
        <h3>🔗 Google Sheets</h3>
        <p>Append current log entries to a Google Sheet tab matching your project name.</p>
        <button
          class="btn-primary"
          @click="syncToSheets"
          :disabled="syncing"
        >
          {{ syncing ? 'Syncing…' : 'Sync to Sheets' }}
        </button>
        <p v-if="syncMsg" class="sync-msg" :class="{ error: syncError }" v-html="syncMsg"></p>
      </div>

      <!-- PNG Download -->
      <div class="card">
        <h3>🖼 Chart as PNG</h3>
        <p>Capture the chart from the Chart page as a high-resolution image.</p>
        <button class="btn-outline" @click="exportPNG" :disabled="pngLoading">
          {{ pngLoading ? 'Generating…' : 'Download PNG' }}
        </button>
      </div>

      <!-- PDF Download -->
      <div class="card">
        <h3>📄 PDF Report</h3>
        <p>Generate a vector PDF containing the chart image.</p>
        <button class="btn-outline" @click="exportPDF" :disabled="pdfLoading">
          {{ pdfLoading ? 'Generating…' : 'Download PDF' }}
        </button>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn-outline" @click="router.push('/chart')">← Back</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { appState } from '../store/appState.js'

const router = useRouter()

const csvLoading = ref(false)
const syncing = ref(false)
const syncMsg = ref('')
const syncError = ref(false)
const pngLoading = ref(false)
const pdfLoading = ref(false)

// ── Shared export row mapper ──
const EXPORT_HEADERS = [
  'date',
  'project',
  'team/rig',
  'work type',
  'ref. point',
  'category',
  'activity',
  'time in',
  'time out',
  'start depth',
  'end depth',
  'duplicate_flag',
  'synced_by',
]

function mapExportRows(rows) {
  return rows.map(row => ({
    'date': row.logDate || '',
    'project': row.projectName || '',
    'team/rig': row.teamRig || '',
    'work type': row.workType || '',
    'ref. point': row.refPoint || '',
    'category': row.category || '',
    'activity': row.activityName || '',
    'time in': row.timeIn || '',
    'time out': row.timeOut || '',
    'start depth': row.startDepth ?? '',
    'end depth': row.endDepth ?? '',
    'duplicate_flag': '',
    'synced_by': appState.user?.email || '',
  }))
}

// ── CSV Export ──
async function exportCSV() {
  csvLoading.value = true
  try {
    if (!appState.logRows.length) {
      alert('No data to export.')
      return
    }
    let rows = mapExportRows(appState.logRows)

    // ── Detect intra-batch duplicates by fingerprint ──
    const seen = new Set()
    let dupCount = 0
    rows = rows.map(row => {
      const fp = [
        row['date'] || '',
        row['work type'] || '',
        row['ref. point'] || '',
        row['activity'] || '',
        row['time in'] || '',
        row['time out'] || '',
      ].join('|')
      if (seen.has(fp)) {
        row['duplicate_flag'] = '⚠️ DUPLICATE'
        dupCount++
      } else {
        seen.add(fp)
      }
      return row
    })

    const csvRows = [
      EXPORT_HEADERS.join(','),
      ...rows.map(row =>
        EXPORT_HEADERS.map(h => {
          const val = String(row[h] ?? '')
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val
        }).join(',')
      ),
    ]
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${appState.projectName || 'export'}_${appState.logDate || new Date().toISOString().slice(0, 10)}.csv`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)

    // ── Rolling local deletion: keep last 2 days, drop oldest if 3+ days exist ──
    const dates = [...new Set(appState.logRows.map(r => r.logDate))].sort()
    let delMsg = ''
    if (dates.length >= 3) {
      const oldest = dates[0]
      const before = appState.logRows.length
      appState.logRows = appState.logRows.filter(r => r.logDate !== oldest)
      const removed = before - appState.logRows.length
      delMsg = `\n🗑️ Removed ${removed} rows from ${oldest} (local storage).`
    }

    const extra = dupCount > 0 ? ` (${dupCount} flagged as duplicate)` : ''
    alert(`✅ Downloaded ${rows.length} rows as CSV${extra}.${delMsg}`)
  } catch (e) {
    alert('Failed to export CSV: ' + e.message)
  } finally {
    csvLoading.value = false
  }
}

// ── Google Sheets Sync ──
async function syncToSheets() {
  syncMsg.value = ''
  syncError.value = false
  if (!appState.logRows.length) {
    syncMsg.value = 'No data to sync.'
    syncError.value = true
    return
  }
  syncing.value = true
  try {
    const { syncToGoogleSheets } = await import('../lib/googleSheets.js')
    const exportRows = mapExportRows(appState.logRows)
    const result = await syncToGoogleSheets({
      clientEmail: import.meta.env.VITE_GCP_CLIENT_EMAIL,
      privateKey: import.meta.env.VITE_GCP_PRIVATE_KEY,
      spreadsheetId: import.meta.env.VITE_GCP_SPREADSHEET_ID,
      tabName: appState.projectName || 'TimeMotion',
      rows: exportRows,
    })

    let msg = `✅ Synced ${result.count} rows`
    if (result.duplicateCount > 0) {
      msg += ` (${result.duplicateCount} flagged as duplicate)`
    }
    msg += `. <a href="${result.url}" target="_blank" rel="noopener">Open Google Sheet</a>`

    // ── Rolling local deletion: keep last 2 days, drop oldest if 3+ days exist ──
    const dates = [...new Set(appState.logRows.map(r => r.logDate))].sort()
    if (dates.length >= 3) {
      const oldest = dates[0]
      const before = appState.logRows.length
      appState.logRows = appState.logRows.filter(r => r.logDate !== oldest)
      const removed = before - appState.logRows.length
      msg += `<br>🗑️ Removed ${removed} rows from ${oldest} (local storage).`
    }

    syncMsg.value = msg
  } catch (e) {
    syncMsg.value = `❌ ${e.message}`
    syncError.value = true
  } finally {
    syncing.value = false
  }
}

// ── PNG Export ──
//
// Renders the Time & Motion chart off-screen at a fixed 1600×900
// landscape canvas so the full chart is captured without scrolling
// or portrait clipping on mobile devices.
async function exportPNG() {
  pngLoading.value = true
  let chartInstance = null
  let containerEl = null

  try {
    // ── 1. Dynamic header values ──────────────────────────────────
    const rigValue = appState.teamRig || 'Unknown Rig'
    const rawDate  = appState.logDate || new Date().toISOString().slice(0, 10)
    const project  = appState.projectName || 'Project Alpha'

    const [y, mo, d] = rawDate.split('-')
    const dateValue = `${d}-${mo}-${y}`

    const subtitle = `${project} - ${rigValue} on ${dateValue}`
    const filename = `chart_${subtitle}.png`

    // ── 2. Filter rows to match current chart view ────────────────
    const maxDate = appState.logRows
      .map(r => r.logDate)
      .filter(Boolean)
      .sort()
      .pop() || ''

    const filterDate = maxDate
    const filterTeam = appState.chartFilterTeam || ''

    const filteredRows = appState.logRows.filter(r => {
      if (filterDate && r.logDate !== filterDate) return false
      if (filterTeam && r.teamRig !== filterTeam) return false
      return true
    })

    if (!filteredRows.length) {
      alert('No data to export for the current chart filters.')
      return
    }

    // ── 3. Compute axis ranges from filtered data ─────────────────
    let minTime = Infinity, maxTime = -Infinity, maxDepth = 10
    for (const row of filteredRows) {
      const tIn  = parseTime(row.timeIn)
      const tOut = parseTime(row.timeOut)
      if (tIn  !== null) { if (tIn  < minTime) minTime = tIn;  if (tIn  > maxTime) maxTime = tIn  }
      if (tOut !== null) { if (tOut < minTime) minTime = tOut; if (tOut > maxTime) maxTime = tOut }
      const sd = parseFloat(row.startDepth)
      const ed = parseFloat(row.endDepth)
      if (!isNaN(sd) && sd > maxDepth) maxDepth = sd
      if (!isNaN(ed) && ed > maxDepth) maxDepth = ed
    }
    const xMin = minTime !== Infinity  ? Math.floor(minTime / 60) * 60 - 60 : 360
    const xMax = maxTime !== -Infinity ? Math.ceil(maxTime  / 60) * 60 + 60 : 1320
    const yMin = 0
    const yMax = Math.ceil(maxDepth) + 1

    // ── 4. Canvas pixel dimensions ──────────────────────────────────
    const CHART_W     = 1600
    const CHART_H     = 900
    const HEADER_H    = 100   // space for title + subtitle
    const COMPOSITE_W = CHART_W
    const COMPOSITE_H = CHART_H + HEADER_H

    // ── 5. Build chart data & annotations ─────────────────────────
    const chartData   = buildChartDataForExport(filteredRows)
    const annotations = buildAnnotationsForExport(
      filteredRows, xMin, xMax, yMin, yMax, CHART_W, CHART_H,
    )

    // ── 6. Create off-screen chart canvas ─────────────────────────
    containerEl = document.createElement('div')
    containerEl.style.cssText = 'position:fixed;left:-9999px;top:-9999px;'
    const chartCanvas = document.createElement('canvas')
    chartCanvas.width  = CHART_W
    chartCanvas.height = CHART_H
    containerEl.appendChild(chartCanvas)
    document.body.appendChild(containerEl)

    // ── 7. Import Chart.js + annotation plugin ────────────────────
    const [
      { Chart: ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend },
      { default: annotationPlugin },
    ] = await Promise.all([
      import('chart.js'),
      import('chartjs-plugin-annotation'),
    ])
    ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)
    ChartJS.register(annotationPlugin)

    // ── 8. Instantiate chart at landscape pixel dimensions ────────
    chartInstance = new ChartJS(chartCanvas, {
      type: 'scatter',
      data: chartData,
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: 1,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          annotation: { annotations },
        },
        scales: {
          x: {
            type: 'linear',
            min: xMin,
            max: xMax,
            title: {
              display: true,
              text: 'Time',
              font: { size: 14, weight: 'bold' },
            },
            ticks: {
              stepSize: 60,
              callback(val) { return minutesToTimeLabel(val) },
              font: { size: 12 },
            },
            grid: { color: '#e2e8f0', drawOnChartArea: true },
            afterBuildTicks(axis) {
              axis.ticks = axis.ticks.filter(t => t.value % 60 === 0)
            },
          },
          y: {
            type: 'linear',
            offset: true,
            min: yMin,
            max: yMax,
            title: {
              display: true,
              text: 'Depth below ground (m)',
              font: { size: 14, weight: 'bold' },
            },
            ticks: {
              callback(val) { return val + ' m' },
              font: { size: 12 },
            },
            grid: { color: '#e2e8f0', drawOnChartArea: true },
          },
        },
      },
    })

    // ── 9. Wait for chart to fully render ─────────────────────────
    await new Promise(resolve => requestAnimationFrame(resolve))
    await new Promise(resolve => requestAnimationFrame(resolve))

    // ── 10. Composite canvas: white bg + header text + chart ─────
    const compCanvas = document.createElement('canvas')
    compCanvas.width  = COMPOSITE_W
    compCanvas.height = COMPOSITE_H
    const ctx = compCanvas.getContext('2d')

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, COMPOSITE_W, COMPOSITE_H)

    // Primary title
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Time & Motion Chart', COMPOSITE_W / 2, 34)

    // Secondary subtitle: Project / Rig / Date
    ctx.font = '16px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#475569'
    ctx.fillText(`${project}  /  ${rigValue}  /  ${dateValue}`, COMPOSITE_W / 2, 70)

    // Draw chart below header (chartCanvas still has rendered pixels)
    ctx.drawImage(chartCanvas, 0, HEADER_H)

    // ── 11. Export composite canvas to PNG and download ───────────
    const pngDataUrl = compCanvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = filename
    link.href = pngDataUrl
    link.click()

    // ── 12. Clean up Chart.js instance & off-screen DOM ───────────
    chartInstance.destroy()
    chartInstance = null
    document.body.removeChild(containerEl)
    containerEl = null
  } catch (e) {
    console.error('PNG export failed:', e)
    alert('Failed to export PNG: ' + e.message)
  } finally {
    // Ensure cleanup even on error
    if (chartInstance) {
      try { chartInstance.destroy() } catch (_) { /* ignore */ }
    }
    if (containerEl && containerEl.parentNode) {
      try { document.body.removeChild(containerEl) } catch (_) { /* ignore */ }
    }
    pngLoading.value = false
  }
}

// ── PDF Export ──
//
// Renders the Time & Motion chart fresh at A4-optimised pixel
// dimensions on an off-screen <canvas>, then places the resulting
// PNG into a jsPDF document at an exact 1 : 1 mm mapping.
// No image scaling → fonts stay crisp and gridlines automatically
// fill the full 281 mm chart width.

// Shared colour palette (mirrors ChartView)
const ACTIVITY_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
]

// Shared helpers (mirrors ChartView)
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

// Build chart datasets — one dataset per row (mirrors ChartView)
function buildChartDataForExport(filteredRows) {
  // Build activity→color lookup (preserve ordering of first appearance)
  const activityColorMap = new Map()
  let colorIdx = 0
  for (const row of filteredRows) {
    const name = row.activityName || '(Unnamed)'
    if (!activityColorMap.has(name)) {
      activityColorMap.set(name, ACTIVITY_COLORS[colorIdx % ACTIVITY_COLORS.length])
      colorIdx++
    }
  }

  // Sort all rows by timeIn (global order)
  const sortedRows = [...filteredRows].sort((a, b) => (a.timeIn || '').localeCompare(b.timeIn || ''))

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
      pointRadius: 5,
      pointHoverRadius: 7,
      showLine: true,
      spanGaps: false,
      tension: 0,
    })
  }

  return { datasets }
}

// Build annotations — midpoint labels + refPoint bands (mirrors ChartView)
// Rotation is pre-computed from data-space slopes × canvas pixel dimensions
// so no afterRender plugin is required.
function buildAnnotationsForExport(filteredRows, xMin, xMax, yMin, yMax, canvasW, canvasH) {
  const annotations = {}

  // -- activity colour lookup --
  const activityColorMap = new Map()
  {
    const seen = new Set()
    let ci = 0
    for (const row of filteredRows) {
      const name = row.activityName || '(Unnamed)'
      if (!seen.has(name)) {
        seen.add(name)
        activityColorMap.set(name, ACTIVITY_COLORS[ci % ACTIVITY_COLORS.length])
        ci++
      }
    }
  }

  // -- midpoint labels --
  let labelIdx = 0
  const xRange = xMax - xMin
  const yRange = yMax - yMin
  const usedPositions = [] // collision avoidance tracking

  for (const row of filteredRows) {
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

    // Pre-compute rotation from data-space slope + canvas pixel dimensions
    const dxData = tOut - tIn
    const dyData = eD - sD
    const dxPx = xRange > 0 ? (dxData / xRange) * canvasW : 0
    const dyPx = yRange > 0 ? (dyData / yRange) * canvasH : 0
    const angle = Math.atan2(-dyPx, dxPx) * 180 / Math.PI

    // Perpendicular offset (same logic as labelRotatorPlugin in ChartView)
    const angleRad = Math.atan2(-dyPx, dxPx)
    const sinA = Math.abs(Math.sin(angleRad))
    const cosA = Math.abs(Math.cos(angleRad))
    let xAdj, yAdj
    if (sinA < 0.1) {
      xAdj = 0; yAdj = -22
    } else {
      const offset = 5 / Math.max(cosA, 0.15)
      xAdj = offset * Math.sin(angleRad)
      yAdj = -offset * Math.cos(angleRad)
    }

    // Collision avoidance: flip to opposite side of line if overlapping
    const midPX = xRange > 0 ? ((midX - xMin) / xRange) * canvasW : 0
    const midPY = yRange > 0 ? canvasH - ((midY - yMin) / yRange) * canvasH : 0
    for (const used of usedPositions) {
      if (Math.abs(used.pxX - (midPX + xAdj)) < 60 && Math.abs(used.pyY - (midPY + yAdj)) < 26) {
        xAdj = -xAdj   // flip perpendicular direction
        yAdj = -yAdj
        break
      }
    }
    usedPositions.push({ pxX: midPX + xAdj, pyY: midPY + yAdj })

    annotations[`mid-${labelIdx}`] = {
      type: 'label',
      xValue: midX,
      yValue: midY,
      content: actName.split(/\s+/),
      font: { size: 12, weight: 'normal' },
      color: color,
      rotation: angle,
      xAdjust: xAdj,
      yAdjust: yAdj,
      opacity: 0.85,
      textAlign: 'center',
    }
    labelIdx++
  }

  // -- refPoint vertical bands --
  const refPointMap = new Map()
  for (const row of filteredRows) {
    if (!row.refPoint) continue
    if (!refPointMap.has(row.refPoint)) refPointMap.set(row.refPoint, [])
    refPointMap.get(row.refPoint).push(row)
  }

  const refPointEntries = [...refPointMap.entries()]
  refPointEntries.sort((a, b) => {
    const aMin = Math.min(...a[1].map(r => parseTime(r.timeIn) || Infinity))
    const bMin = Math.min(...b[1].map(r => parseTime(r.timeIn) || Infinity))
    return aMin - bMin
  })

  let bandIdx = 0
  const BAND_COLORS = ['rgba(59,130,246,0.07)', 'rgba(239,68,68,0.07)']

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
      yMin: yMin,
      yMax: yMax,
      backgroundColor: BAND_COLORS[bandIdx % BAND_COLORS.length],
      borderWidth: 0,
    }

    annotations[`band-label-${bandIdx}`] = {
      type: 'label',
      xValue: (bandXMin + bandXMax) / 2,
      yValue: yMin - 0.75,
      yAdjust: 0,
      drawTime: 'afterDraw',
      content: `${refRows[0].workType} ${refPoint}`,
      font: { size: 12, weight: 'bold' },
      color: '#1e293b',
      backgroundColor: 'rgba(255,255,255,0.85)',
      padding: { top: 2, bottom: 2, left: 6, right: 6 },
      borderRadius: 4,
    }
    bandIdx++
  }

  return annotations
}

async function exportPDF() {
  pdfLoading.value = true
  let chartInstance = null
  let containerEl = null

  try {
    // ── 1. Dynamic header values ──────────────────────────────────
    const rigValue = appState.teamRig || 'Unknown Rig'
    const rawDate  = appState.logDate || new Date().toISOString().slice(0, 10)
    const project  = appState.projectName || 'Project Alpha'

    const [y, mo, d] = rawDate.split('-')
    const dateValue = `${d}-${mo}-${y}`

    const title    = 'Time & Motion Chart'
    const subtitle = `${project} - ${rigValue} on ${dateValue}`
    const filename = `${subtitle}.pdf`

    // ── 2. Filter rows to match current chart view ────────────────
    const maxDate = appState.logRows
      .map(r => r.logDate)
      .filter(Boolean)
      .sort()
      .pop() || ''

    const filterDate = maxDate
    const filterTeam = appState.chartFilterTeam || ''

    const filteredRows = appState.logRows.filter(r => {
      if (filterDate && r.logDate !== filterDate) return false
      if (filterTeam && r.teamRig !== filterTeam) return false
      return true
    })

    if (!filteredRows.length) {
      alert('No data to export for the current chart filters.')
      return
    }

    // ── 3. Compute axis ranges from filtered data ─────────────────
    let minTime = Infinity, maxTime = -Infinity, maxDepth = 10
    for (const row of filteredRows) {
      const tIn  = parseTime(row.timeIn)
      const tOut = parseTime(row.timeOut)
      if (tIn  !== null) { if (tIn  < minTime) minTime = tIn;  if (tIn  > maxTime) maxTime = tIn  }
      if (tOut !== null) { if (tOut < minTime) minTime = tOut; if (tOut > maxTime) maxTime = tOut }
      const sd = parseFloat(row.startDepth)
      const ed = parseFloat(row.endDepth)
      if (!isNaN(sd) && sd > maxDepth) maxDepth = sd
      if (!isNaN(ed) && ed > maxDepth) maxDepth = ed
    }
    const xMin = minTime !== Infinity  ? Math.floor(minTime / 60) * 60 - 60 : 360
    const xMax = maxTime !== -Infinity ? Math.ceil(maxTime  / 60) * 60 + 60 : 1320
    const yMin = 0
    const yMax = Math.ceil(maxDepth) + 1

    // ── 4. A4 layout constants (landscape, mm) ────────────────────
    const PAGE_W    = 297
    const PAGE_H    = 210
    const MARGIN    = 8
    const HEADER_H  = 28

    const CHART_MM_W = PAGE_W - MARGIN * 2            // 281 mm
    const CHART_MM_H = PAGE_H - HEADER_H - MARGIN     // 174 mm

    // ── 5. Canvas pixel dimensions at 150 DPI ─────────────────────
    // 150 DPI ensures crisp output; 1 px ≈ 0.169 mm
    const DPI       = 150
    const MM_TO_PX  = DPI / 25.4                       // ≈ 5.9055 px/mm
    const CANVAS_W  = Math.round(CHART_MM_W * MM_TO_PX) // ≈ 1659 px
    const CANVAS_H  = Math.round(CHART_MM_H * MM_TO_PX) // ≈ 1028 px

    // ── 6. Build chart data & annotations ──────────────────────────
    const chartData   = buildChartDataForExport(filteredRows)
    const annotations = buildAnnotationsForExport(
      filteredRows, xMin, xMax, yMin, yMax, CANVAS_W, CANVAS_H,
    )

    // ── 7. Create off-screen canvas ────────────────────────────────
    containerEl = document.createElement('div')
    containerEl.style.cssText = 'position:fixed;left:-9999px;top:-9999px;'
    const canvasEl = document.createElement('canvas')
    canvasEl.width  = CANVAS_W
    canvasEl.height = CANVAS_H
    containerEl.appendChild(canvasEl)
    document.body.appendChild(containerEl)

    // ── 8. Import Chart.js + annotation plugin ────────────────────
    const [
      { Chart: ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend },
      { default: annotationPlugin },
    ] = await Promise.all([
      import('chart.js'),
      import('chartjs-plugin-annotation'),
    ])
    ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)
    ChartJS.register(annotationPlugin)

    // ── 9. Instantiate chart at A4 pixel dimensions ───────────────
    chartInstance = new ChartJS(canvasEl, {
      type: 'scatter',
      data: chartData,
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: 1,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          annotation: { annotations },
        },
        scales: {
          x: {
            type: 'linear',
            min: xMin,
            max: xMax,
            title: {
              display: true,
              text: 'Time',
              font: { size: 14, weight: 'bold' },
            },
            ticks: {
              stepSize: 60,
              callback(val) { return minutesToTimeLabel(val) },
              font: { size: 12 },
            },
            grid: { color: '#e2e8f0', drawOnChartArea: true },
            afterBuildTicks(axis) {
              axis.ticks = axis.ticks.filter(t => t.value % 60 === 0)
            },
          },
          y: {
            type: 'linear',
            offset: true,
            min: yMin,
            max: yMax,
            title: {
              display: true,
              text: 'Depth below ground (m)',
              font: { size: 14, weight: 'bold' },
            },
            ticks: {
              callback(val) { return val + ' m' },
              font: { size: 12 },
            },
            grid: { color: '#e2e8f0', drawOnChartArea: true },
          },
        },
      },
    })

    // ── 10. Wait for chart to fully render ────────────────────────
    await new Promise(resolve => requestAnimationFrame(resolve))
    await new Promise(resolve => requestAnimationFrame(resolve))

    // ── 11. Export canvas to PNG ──────────────────────────────────
    const pngDataUrl = canvasEl.toDataURL('image/png')

    // ── 12. Clean up off-screen DOM ───────────────────────────────
    chartInstance.destroy()
    chartInstance = null
    document.body.removeChild(containerEl)
    containerEl = null

    // ── 13. Compose PDF with jsPDF ────────────────────────────────
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF('l', 'mm', 'a4')

    // Title
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(title, PAGE_W / 2, MARGIN + 6, { align: 'center' })

    // Subtitle
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.text(subtitle, PAGE_W / 2, MARGIN + 16, { align: 'center' })

    // Chart — placed at exact mm dimensions, 1:1 pixel→mm
    pdf.addImage(pngDataUrl, 'PNG', MARGIN, HEADER_H, CHART_MM_W, CHART_MM_H)

    // ── 14. Save ──────────────────────────────────────────────────
    pdf.save(filename)
  } catch (e) {
    console.error('PDF export failed:', e)
    alert('Failed to export PDF: ' + e.message)
  } finally {
    // Ensure cleanup even on error
    if (chartInstance) {
      try { chartInstance.destroy() } catch (_) { /* ignore */ }
    }
    if (containerEl && containerEl.parentNode) {
      try { document.body.removeChild(containerEl) } catch (_) { /* ignore */ }
    }
    pdfLoading.value = false
  }
}
</script>

<style scoped>
.export-page {
  max-width: 600px;
  margin: 0 auto;
}

h2 {
  font-size: 20px;
  margin-bottom: 4px;
}

.desc {
  color: #64748b;
  font-size: 13px;
  margin-bottom: 20px;
}

.export-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

.card h3 {
  font-size: 16px;
  margin-bottom: 6px;
}

.card p {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 14px;
}

.btn-primary,
.btn-outline {
  width: 100%;
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
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-outline {
  background: #fff;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-outline:hover { background: #f8fafc; }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

.sync-msg {
  margin-top: 10px;
  font-size: 13px;
  color: #22c55e;
}
.sync-msg.error {
  color: #dc2626;
}

.sync-msg :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
  font-weight: 600;
}

.action-bar {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
</style>
