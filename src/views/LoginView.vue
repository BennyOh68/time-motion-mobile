<template>
  <div class="login-page">
    <div class="login-card">
      <h1>🔐 Time & Motion Study</h1>
      <p class="subtitle">Sign in to continue</p>

      <form @submit.prevent="handleLogin">
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Your password"
            required
            autocomplete="current-password"
          />
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'Signing in…' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase.js'
import { appState } from '../store/appState.js'

const router = useRouter()
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) {
      errorMsg.value = error.message
      return
    }
    appState.user = data.user
    appState.session = data.session
    router.push('/input')
  } catch (e) {
    errorMsg.value = 'Unexpected error. Check your connection.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80dvh;
  padding: 16px;
}

.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

h1 {
  font-size: 22px;
  text-align: center;
  margin-bottom: 4px;
}

.subtitle {
  text-align: center;
  color: #64748b;
  margin-bottom: 24px;
  font-size: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #334155;
}

.field input {
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.15s;
}

.field input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #dc2626;
  font-size: 13px;
  margin-bottom: 12px;
  text-align: center;
}
</style>
