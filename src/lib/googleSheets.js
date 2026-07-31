/**
 * Google Sheets sync helper — direct browser-to-Sheets via service account JWT.
 *
 * No backend server required. Uses SubtleCrypto for RSA-SHA256 signing
 * against a Google OAuth2 JWT bearer assertion flow.
 *
 * Security note: the private key is exposed in the Vite bundle.
 * Only use this for internal/field tools, never public-facing apps.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

// ── PKCS#8 → JWK via SubtleCrypto ──────────────────────────────
async function importKey(pem) {
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = pem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')
  const binary = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

// ── Base64url encode (no padding) ──────────────────────────────
function base64url(buf) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function strToUtf8(str) {
  return new TextEncoder().encode(str)
}

// ── Build & sign a JWT ─────────────────────────────────────────
async function createJWT(header, payload, key) {
  const enc = (obj) => base64url(strToUtf8(JSON.stringify(obj)))
  const partial = `${enc(header)}.${enc(payload)}`
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, strToUtf8(partial))
  return `${partial}.${base64url(sig)}`
}

// ── Exchange JWT for access token ──────────────────────────────
async function getAccessToken(clientEmail, key) {
  const now = Math.floor(Date.now() / 1000)
  const jwt = await createJWT(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    },
    key,
  )

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

// ── Ensure worksheet tab exists, return its sheetId ────────────
async function ensureSheet(spreadsheetId, tabName, accessToken) {
  // List existing sheets
  const metaRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!metaRes.ok) {
    const err = await metaRes.text()
    throw new Error(`Sheets metadata fetch failed: ${metaRes.status} ${err}`)
  }
  const meta = await metaRes.json()
  const existing = meta.sheets?.find(s => s.properties?.title === tabName)

  if (existing) return existing.properties.sheetId

  // Create the tab
  const createRes = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: tabName } } }],
    }),
  })
  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Sheet creation failed: ${createRes.status} ${err}`)
  }
  const createData = await createRes.json()
  return createData.replies[0].addSheet.properties.sheetId
}

// ── Public: Sync rows to Google Sheets ─────────────────────────
/**
 * Append rows to a Google Sheet tab named by projectName.
 *
 * @param {object}   options
 * @param {string}   options.clientEmail  - Service account email
 * @param {string}   options.privateKey   - PEM-encoded PKCS#8 private key
 * @param {string}   options.spreadsheetId
 * @param {string}   options.tabName      - Sheet tab name (e.g. project name)
 * @param {object[]} options.rows         - Array of flat row objects
 * @returns {Promise<{count: number}>}
 */
export async function syncToGoogleSheets({
  clientEmail,
  privateKey,
  spreadsheetId,
  tabName,
  rows,
}) {
  if (!rows.length) throw new Error('No rows to sync')

  // Normalize newlines in the private key (Vite .env may have literal \n)
  const cleanKey = privateKey.replace(/\\n/g, '\n')

  const key = await importKey(cleanKey)
  const accessToken = await getAccessToken(clientEmail, key)

  await ensureSheet(spreadsheetId, tabName, accessToken)

  // Build headers and values from mapped rows
  const headers = Object.keys(rows[0])
  const values = rows.map(row => headers.map(h => row[h] ?? ''))

  // Check if tab already has headers
  const rangeQuery = encodeURI(`'${tabName}'!A1`)
  const checkRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${rangeQuery}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!checkRes.ok) {
    const err = await checkRes.text()
    throw new Error(`Sheets read failed: ${checkRes.status} ${err}`)
  }
  const checkData = await checkRes.json()
  const isEmpty = !checkData.values || checkData.values.length === 0

  // Use append for both cases — simpler, no range-encoding issues
  const appendPayload = {
    range: `'${tabName}'!A:A`,
    majorDimension: 'ROWS',
    values: isEmpty ? [headers, ...values] : values,
  }

  const appendUrl = `${SHEETS_API}/${spreadsheetId}/values/${encodeURI(`'${tabName}'!A:A`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const appendRes = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(appendPayload),
  })

  if (!appendRes.ok) {
    const err = await appendRes.text()
    throw new Error(`Sheets append failed: ${appendRes.status} ${err}`)
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  return { count: rows.length, url }
}

