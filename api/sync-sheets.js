/**
 * Vercel Edge Function — Google Sheets Sync
 *
 * Receives a POST with { projectName, rows[] } and appends rows
 * to the matching tab in a Google Sheet via the Sheets API.
 *
 * Required Vercel environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *   GOOGLE_SPREADSHEET_ID
 */

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { projectName, rows } = await req.json()

    if (!projectName || !rows || !rows.length) {
      return jsonResponse({ error: 'Missing projectName or rows' }, 400)
    }

    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

    if (!spreadsheetId || !serviceEmail || !privateKey) {
      return jsonResponse({ error: 'Sheets integration not configured' }, 500)
    }

    // Get access token via service account OAuth2
    const accessToken = await getAccessToken(serviceEmail, privateKey)

    if (!accessToken) {
      return jsonResponse({ error: 'Failed to authenticate with Google' }, 500)
    }

    // Ensure a sheet tab exists for this project
    await ensureSheetTab(accessToken, spreadsheetId, projectName)

    // Build value rows
    const dateStr = rows[0]?.logDate || new Date().toISOString().slice(0, 10)
    // Convert YYYY-MM-DD to DD-MM-YYYY
    const [y, m, d] = dateStr.split('-')
    const formattedDate = `${d}-${m}-${y}`

    const values = rows.map(row => [
      formattedDate,
      row.category || '',
      row.activityName || '',
      row.manualEntry || '',
      row.timeIn || '',
      row.timeOut || '',
      row.startDepth || '',
      row.endDepth || '',
      row.projectName || projectName,
      row.teamRig || '',
      row.workType || '',
      row.refPoint || '',
    ])

    // Append rows
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(projectName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
    const body = { values }

    const appendRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!appendRes.ok) {
      const err = await appendRes.text()
      return jsonResponse({ error: `Sheets API error: ${err}` }, 500)
    }

    return jsonResponse({ success: true, count: values.length })
  } catch (e) {
    return jsonResponse({ error: e.message || 'Internal server error' }, 500)
  }
}

// ── Helpers ──

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

async function getAccessToken(email, key) {
  const now = Math.floor(Date.now() / 1000)
  const jwt = await createJWT(email, key, now)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('OAuth error:', err)
    return null
  }

  const data = await res.json()
  return data.access_token
}

async function createJWT(email, key, now) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3599,
    iat: now,
  }

  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const headerStr = enc(header)
  const payloadStr = enc(payload)
  const signingInput = `${headerStr}.${payloadStr}`

  // For Edge runtime, use Web Crypto to sign
  try {
    const keyData = pemToArrayBuffer(key)
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const sig = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput)
    )

    const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    return `${signingInput}.${sigBase64}`
  } catch {
    // Fallback: use a simple approach for testing
    // In production, Web Crypto in Vercel Edge should handle this
    return ''
  }
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function ensureSheetTab(accessToken, spreadsheetId, tabName) {
  // Check existing sheets
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!metaRes.ok) return

  const meta = await metaRes.json()
  const exists = meta.sheets?.some(
    s => s.properties?.title?.toLowerCase() === tabName.toLowerCase()
  )

  if (exists) return

  // Create new tab
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`
  await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: tabName },
          },
        },
      ],
    }),
  })

  // Write header row
  const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:L1?valueInputOption=USER_ENTERED`
  await fetch(headerUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[
        'Date', 'Category', 'Activity', 'Manual Entry',
        'Time In', 'Time Out', 'Start Depth (m)', 'End Depth (m)',
        'Project', 'Team/Rig', 'Work Type', 'Ref Point',
      ]],
    }),
  })
}
