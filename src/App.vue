<template>
  <div id="app-root">
    <nav v-if="isLoggedIn" class="top-nav">
      <router-link to="/input-setup" class="nav-item">Input</router-link>
      <router-link to="/summary" class="nav-item">Summary</router-link>
      <router-link to="/chart" class="nav-item">Chart</router-link>
      <router-link to="/export" class="nav-item">Export</router-link>
      <router-link to="/setup" class="nav-item nav-setup">⚙</router-link>
      <button class="nav-item nav-logout" @click="logout">Logout</button>
    </nav>
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <KeepAlive :include="['ChartView']">
          <component :is="Component" />
        </KeepAlive>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from './lib/supabase.js'
import { appState } from './store/appState.js'

const router = useRouter()
const isLoggedIn = computed(() => !!appState.user)

// Hydrate user from existing Supabase session on page load
onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    appState.user = data.session.user
    appState.session = data.session
  }
})

// Keep appState in sync with Supabase auth events (login/logout/token refresh)
supabase.auth.onAuthStateChange((_event, session) => {
  appState.user = session?.user || null
  appState.session = session || null
})

async function logout() {
  await supabase.auth.signOut()
  appState.user = null
  appState.session = null
  router.push('/login')
}
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
  padding: 12px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}
</style>
