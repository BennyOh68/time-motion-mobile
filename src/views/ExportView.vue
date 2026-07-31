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
  'Point Ref.',
  'team/rig',
  'activity',
  'time in',
  'time out',
  'start depth',
  'end depth',
]

function mapExportRows(rows) {
  return rows.map(row => ({
    'Point Ref.': [row.workType, row.refPoint].filter(Boolean).join(' '),
    'team/rig': row.teamRig || '',
    'activity': row.activityName || '',
    'time in': row.timeIn || '',
    'time out': row.timeOut || '',
    'start depth': row.startDepth ?? '',
    'end depth': row.endDepth ?? '',
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
    const rows = mapExportRows(appState.logRows)
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
    syncMsg.value = `✅ Synced ${result.count} rows. <a href="${result.url}" target="_blank" rel="noopener">Open Google Sheet</a>`
  } catch (e) {
    syncMsg.value = `❌ ${e.message}`
    syncError.value = true
  } finally {
    syncing.value = false
  }
}

// ── PNG Export ──
async function exportPNG() {
  pngLoading.value = true
  try {
    if (!appState.chartSnapshot) {
      alert('Please go to the Chart page first to generate a chart before exporting.')
      return
    }
    const link = document.createElement('a')
    link.download = `chart_${appState.projectName || 'export'}_${new Date().toISOString().slice(0, 10)}.png`
    link.href = appState.chartSnapshot
    link.click()
  } catch (e) {
    alert('Failed to export PNG: ' + e.message)
  } finally {
    pngLoading.value = false
  }
}

// ── PDF Export ──
async function exportPDF() {
  pdfLoading.value = true
  try {
    if (!appState.chartSnapshot) {
      alert('Please go to the Chart page first to generate a chart before exporting.')
      return
    }
    const { default: jsPDF } = await import('jspdf')

    // Get image dimensions from the stored data URL
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = appState.chartSnapshot
    })

    // Landscape A4 — stretch chart to fill page with minimal 5mm margins
    const pageW = 297
    const pageH = 210
    const margin = 5
    const imgW = pageW - margin * 2
    const imgH = pageH - margin * 2

    const pdf = new jsPDF('l', 'mm', 'a4')
    pdf.addImage(appState.chartSnapshot, 'PNG', margin, margin, imgW, imgH)
    pdf.save(`report_${appState.projectName || 'export'}_${new Date().toISOString().slice(0, 10)}.pdf`)
  } catch (e) {
    alert('Failed to export PDF: ' + e.message)
  } finally {
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
