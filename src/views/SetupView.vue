<template>
  <div class="setup-page">
    <h2>⚙ Dropdown Management</h2>
    <p class="desc">Edit the activity lists that appear on the Input form.</p>

    <div class="list-section">
      <h3>Preparation</h3>
      <div
        v-for="(item, i) in dropdowns.preparationList"
        :key="'prep-' + i"
        class="list-row"
      >
        <input
          v-model="dropdowns.preparationList[i]"
          type="text"
          class="list-input"
          :disabled="item.startsWith('---')"
        />
        <button
          class="btn-sm btn-del"
          @click="removeItem('preparationList', i)"
          :disabled="item.startsWith('---')"
        >
          ✕
        </button>
      </div>
      <button class="btn-sm btn-add" @click="addItem('preparationList')">
        + Add Prep Item
      </button>
    </div>

    <div class="list-section">
      <h3>Production</h3>
      <div
        v-for="(item, i) in dropdowns.productionList"
        :key="'prod-' + i"
        class="list-row"
      >
        <input
          v-model="dropdowns.productionList[i]"
          type="text"
          class="list-input"
          :disabled="item.startsWith('---')"
        />
        <button
          class="btn-sm btn-del"
          @click="removeItem('productionList', i)"
          :disabled="item.startsWith('---')"
        >
          ✕
        </button>
      </div>
      <button class="btn-sm btn-add" @click="addItem('productionList')">
        + Add Prod Item
      </button>
    </div>

    <div class="list-section">
      <h3>Waits</h3>
      <div
        v-for="(item, i) in dropdowns.waitsList"
        :key="'wait-' + i"
        class="list-row"
      >
        <input
          v-model="dropdowns.waitsList[i]"
          type="text"
          class="list-input"
          :disabled="item.startsWith('---')"
        />
        <button
          class="btn-sm btn-del"
          @click="removeItem('waitsList', i)"
          :disabled="item.startsWith('---')"
        >
          ✕
        </button>
      </div>
      <button class="btn-sm btn-add" @click="addItem('waitsList')">
        + Add Wait Item
      </button>
    </div>

    <button class="btn-secondary" @click="resetAll">Reset All to Defaults</button>
  </div>
</template>

<script setup>
import { dropdowns, resetDropdowns } from '../store/dropdowns.js'

function removeItem(listKey, idx) {
  dropdowns[listKey].splice(idx, 1)
}

function addItem(listKey) {
  dropdowns[listKey].push('')
}

function resetAll() {
  if (confirm('Reset all dropdown lists to factory defaults?')) {
    resetDropdowns()
  }
}
</script>

<style scoped>
.setup-page {
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

.list-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

h3 {
  font-size: 15px;
  margin-bottom: 12px;
  color: #334155;
}

.list-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.list-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
}

.list-input:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: default;
}

.btn-sm {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
}

.btn-del {
  background: #fee2e2;
  color: #dc2626;
}
.btn-del:hover {
  background: #fca5a5;
}
.btn-del:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-add {
  background: #dbeafe;
  color: #2563eb;
  margin-top: 4px;
  width: 100%;
}
.btn-add:hover {
  background: #bfdbfe;
}

.btn-secondary {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  cursor: pointer;
  width: 100%;
  margin-top: 8px;
}
</style>
