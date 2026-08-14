<template>
  <div id="app-root">
    <nav v-if="isLoggedIn" class="top-nav">
      <router-link to="/input-setup" class="nav-item">Input</router-link>
      <router-link to="/summary" class="nav-item">Summary</router-link>
      <router-link to="/chart" class="nav-item">Chart</router-link>
      <router-link to="/export" class="nav-item">Export</router-link>
      <router-link to="/dashboard" class="nav-item">Dashboard</router-link>
      <router-link to="/setup" class="nav-item nav-setup">⚙</router-link>
      <button class="nav-item nav-logout" @click="logout">Logout</button>
    </nav>
    <main
      class="main-content"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from './lib/supabase.js'
import { appState, hydrateLogRows, applyRealtimeEvent, hydrateFormState, applyFormStateEvent } from './store/appState.js'
import { hydrateDropdownSettings } from './store/dropdowns.js'
import { subscribeToTimeEntries, subscribeToFormState } from './lib/supabaseData.js'

const router = useRouter()
const route = useRoute()
const isLoggedIn = computed(() => !!appState.user)

// Realtime subscription handle + event coalescer (bursts become one render pass)
let realtimeUnsub = null
let realtimeTimer = null
let pendingEvents = []
let formStateUnsub = null

// ── Swipe navigation ──
const routeOrder = ['InputSetup', 'Summary', 'Chart', 'Export', 'Dashboard']
const touchStartX = ref(0)
const touchStartY = ref(0)
const SWIPE_THRESHOLD = 60

function onTouchStart(e) {
  const t = e.touches[0]
  touchStartX.value = t.clientX
  touchStartY.value = t.clientY
}

function onTouchEnd(e) {
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX.value
  const dy = t.clientY - touchStartY.value

  // Only trigger if horizontal swipe dominates
  if (Math.abs(dx) < SWIPE_THRESHOLD) return
  if (Math.abs(dx) < Math.abs(dy)) return

  const currentIdx = routeOrder.indexOf(route.name)
  if (currentIdx === -1) return

  if (dx > 0) {
    // Swiped right → go back
    if (currentIdx > 0) {
      router.push({ name: routeOrder[currentIdx - 1] })
    }
  } else {
    // Swiped left → go forward
    if (currentIdx < routeOrder.length - 1) {
      router.push({ name: routeOrder[currentIdx + 1] })
    }
  }
}

// Hydrate user from existing Supabase session on page load
onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    appState.user = data.session.user
    appState.session = data.session
    await hydrateUserData()
  }
})

// Keep appState in sync with Supabase auth events (login/logout/token refresh)
supabase.auth.onAuthStateChange((event, session) => {
  appState.user = session?.user || null
  appState.session = session || null
  if (session) {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      hydrateUserData()
    }
  } else {
    stopRealtime()
  }
})

// ── Data hydration + realtime sync (cross-device) ────────────────────────────
async function hydrateUserData() {
  try {
    await Promise.all([hydrateLogRows(), hydrateDropdownSettings(), hydrateFormState()])
  } catch (err) {
    console.warn('Supabase hydration failed (offline?):', err?.message)
  }
  startRealtime()
}

function startRealtime() {
  if (realtimeUnsub) return // already subscribed
  realtimeUnsub = subscribeToTimeEntries((evt) => {
    pendingEvents.push(evt)
    clearTimeout(realtimeTimer)
    realtimeTimer = setTimeout(flushRealtimeEvents, 50)
  })
  formStateUnsub = subscribeToFormState((evt) => {
    applyFormStateEvent(evt)
  })
}

function flushRealtimeEvents() {
  const batch = pendingEvents
  pendingEvents = []
  for (const evt of batch) applyRealtimeEvent(evt)
}

function stopRealtime() {
  if (realtimeUnsub) {
    realtimeUnsub()
    realtimeUnsub = null
  }
  if (formStateUnsub) {
    formStateUnsub()
    formStateUnsub = null
  }
  clearTimeout(realtimeTimer)
  pendingEvents = []
}

async function logout() {
  await supabase.auth.signOut()
  stopRealtime()
  appState.user = null
  appState.session = null
  router.push('/login')
}

onUnmounted(() => {
  stopRealtime()
})
</script>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  font-size: 16px;
  background: #f5f5f5;
  color: #222;
  -webkit-text-size-adjust: 100%;
  touch-action: manipulation;
}

#app-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #1e293b;
  padding: 6px 2px;
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 1px;
  flex-wrap: nowrap;
}

.nav-item {
  color: #cbd5e1;
  text-decoration: none;
  font-size: 12px;
  padding: 5px 7px;
  border-radius: 6px;
  transition: all 0.15s;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.nav-item:hover,
.nav-item.router-link-active {
  background: #334155;
  color: #fff;
}

.nav-setup {
  font-size: 14px;
  padding: 3px 6px;
}

.nav-logout {
  background: #dc2626;
  color: #fff;
}
.nav-logout:hover {
  background: #b91c1c;
}

.main-content {
  flex: 1;
  padding: 8px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  touch-action: pan-y pinch-zoom;
}
</style>
