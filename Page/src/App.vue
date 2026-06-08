<script setup>
import { ref } from 'vue';
import AssetTable from './pages/AssetTable.vue';
import SnapshotTable from './pages/SnapshotTable.vue';
import Trends from './pages/Trends.vue';

const activeTab = ref('current'); // current | snapshot | trends

const tabs = [
  { key: 'current', label: '当前资产', sub: 'ASSETS · TODAY' },
  { key: 'snapshot', label: '历史快照', sub: 'SNAPSHOT · BY DATE' },
  { key: 'trends', label: '趋势分析', sub: 'TRENDS · CHARTS' },
];
</script>

<template>
  <div class="app-shell">
    <div class="app-bg" />
    <header class="app-header">
      <div class="brand">
        <div class="brand-mark">
          <span class="brand-glyph">鼎</span>
        </div>
        <div class="brand-text">
          <div class="brand-title">家庭资产管理</div>
          <div class="brand-sub">Wealth · Stewardship · Clarity</div>
        </div>
      </div>

      <nav class="tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: activeTab === t.key }"
          @click="activeTab = t.key"
          role="tab"
        >
          <span class="tab-label">{{ t.label }}</span>
          <span class="tab-sub">{{ t.sub }}</span>
        </button>
      </nav>
    </header>

    <main class="app-main">
      <AssetTable v-show="activeTab === 'current'" />
      <SnapshotTable v-show="activeTab === 'snapshot'" />
      <Trends v-show="activeTab === 'trends'" />
    </main>

    <footer class="app-foot">
      <span>© Family Asset Ledger · 数据本地持久化 · 支持按日回溯</span>
    </footer>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

html,
body,
#app {
  margin: 0;
  padding: 0;
}

:root {
  --bg-0: #0b0f1a;
  --bg-1: #111729;
  --bg-2: #182039;
  --ink-0: #e9ecf5;
  --ink-1: #c8cfe2;
  --ink-2: #8a93ad;
  --ink-3: #5b6478;
  --line: rgba(255, 255, 255, 0.08);
  --line-strong: rgba(255, 255, 255, 0.14);
  --gold: #d4af6a;
  --gold-2: #f5d98a;
  --emerald: #4fd1a5;
  --rose: #ff6b7a;
  --card: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015));
}

body {
  background: var(--bg-0);
  color: var(--ink-0);
  font-family: 'Inter', 'Noto Serif SC', system-ui, -apple-system, Segoe UI, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.app-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(1200px 600px at 85% -10%, rgba(212, 175, 106, 0.18), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, rgba(79, 209, 165, 0.12), transparent 60%),
    radial-gradient(600px 400px at 50% 50%, rgba(255, 255, 255, 0.03), transparent 70%),
    linear-gradient(180deg, #0b0f1a 0%, #0a0d16 100%);
}

.app-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.35;
  mask-image: radial-gradient(ellipse at center, black 50%, transparent 85%);
}

.app-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 48px;
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(8px);
  gap: 24px;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-mark {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #d4af6a 0%, #b98644 100%);
  color: #1a1206;
  box-shadow: 0 10px 30px -10px rgba(212, 175, 106, 0.55),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25);
  font-family: 'Noto Serif SC', serif;
}

.brand-glyph { font-size: 26px; font-weight: 700; letter-spacing: 1px; }

.brand-text .brand-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-0);
}

.brand-text .brand-sub {
  font-size: 11px;
  letter-spacing: 4px;
  color: var(--ink-2);
  text-transform: uppercase;
  margin-top: 2px;
}

/* Tabs */
.tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-radius: 14px;
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
}

.tab-label {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
}

.tab-sub {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--ink-3);
  text-transform: uppercase;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--ink-1);
}

.tab.active {
  background: linear-gradient(135deg, rgba(212, 175, 106, 0.18), rgba(212, 175, 106, 0.06));
  border-color: rgba(212, 175, 106, 0.35);
  color: var(--gold-2);
  box-shadow: 0 8px 22px -10px rgba(212, 175, 106, 0.45);
}
.tab.active .tab-sub { color: var(--gold); }

.app-main {
  position: relative;
  z-index: 1;
  padding: 36px 48px 24px;
}

.app-foot {
  position: relative;
  z-index: 1;
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
  padding: 24px;
  letter-spacing: 2px;
}

@media (max-width: 1024px) {
  .app-header { padding: 20px 24px; }
  .app-main { padding: 24px 24px 16px; }
  .tab { padding: 8px 12px; }
  .tab-label { font-size: 13px; }
  .tab-sub { display: none; }
}
</style>
