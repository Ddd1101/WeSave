<script setup>
import { ref, onMounted } from 'vue';
import AssetTable from './pages/AssetTable.vue';
import SnapshotTable from './pages/SnapshotTable.vue';
import Trends from './pages/Trends.vue';

const activeTab = ref('current');
const tabs = [
  { key: 'current', label: '当前资产', sub: 'ASSETS · TODAY', icon: '◈' },
  { key: 'snapshot', label: '历史快照', sub: 'SNAPSHOT · BY DATE', icon: '◇' },
  { key: 'trends', label: '趋势分析', sub: 'TRENDS · CHARTS', icon: '◉' },
];

const now = ref(new Date());
onMounted(() => {
  const t = setInterval(() => (now.value = new Date()), 60000);
  return () => clearInterval(t);
});

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}  ${hh}:${mm}`;
}
</script>

<template>
  <div class="app-shell">
    <div class="app-bg" />
    <div class="app-grid-bg" />

    <header class="app-header">
      <div class="brand">
        <div class="brand-mark">
          <span class="brand-glyph">鼎</span>
        </div>
        <div class="brand-text">
          <div class="brand-title">家庭资产管家</div>
          <div class="brand-sub">Family Wealth Ledger · 稳健 · 清晰 · 可回溯</div>
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
          <span class="tab-icon">{{ t.icon }}</span>
          <span class="tab-text">
            <span class="tab-label">{{ t.label }}</span>
            <span class="tab-sub">{{ t.sub }}</span>
          </span>
        </button>
      </nav>

      <div class="header-right">
        <div class="clock">
          <span class="clock-dot" />
          <span>{{ fmt(now) }}</span>
        </div>
      </div>
    </header>

    <main class="app-main">
      <transition name="fade" mode="out-in">
        <AssetTable v-if="activeTab === 'current'" />
        <SnapshotTable v-else-if="activeTab === 'snapshot'" />
        <Trends v-else-if="activeTab === 'trends'" />
      </transition>
    </main>

    <footer class="app-foot">
      <span class="foot-sep" />
      <span>© Family Asset Ledger</span>
      <span class="foot-dot">·</span>
      <span>数据本地持久化</span>
      <span class="foot-dot">·</span>
      <span>支持按日回溯</span>
      <span class="foot-sep" />
    </footer>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

:root {
  --bg-0: #070a14;
  --bg-1: #0c1120;
  --bg-2: #141a2e;
  --ink-0: #f1f3f8;
  --ink-1: #cdd3e3;
  --ink-2: #8b93aa;
  --ink-3: #5a6378;
  --line: rgba(255, 255, 255, 0.07);
  --line-strong: rgba(255, 255, 255, 0.13);
  --gold: #d4af6a;
  --gold-2: #f5d98a;
  --gold-soft: rgba(212, 175, 106, 0.14);
  --emerald: #4fd1a5;
  --rose: #ff6b7a;
  --card: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01));
  --shadow-1: 0 10px 30px -15px rgba(0, 0, 0, 0.6);
  --shadow-gold: 0 10px 30px -12px rgba(212, 175, 106, 0.45);
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background: var(--bg-0);
  color: var(--ink-0);
  font-family: 'Inter', 'Noto Serif SC', system-ui, -apple-system, Segoe UI, sans-serif;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}

/* Shell */
.app-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(900px 500px at 92% -10%, rgba(212, 175, 106, 0.16), transparent 60%),
    radial-gradient(800px 500px at -10% 110%, rgba(79, 209, 165, 0.10), transparent 60%),
    radial-gradient(600px 400px at 50% 30%, rgba(255, 255, 255, 0.03), transparent 70%),
    linear-gradient(180deg, #070a14 0%, #0a0f1e 100%);
}

.app-grid-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(212, 175, 106, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212, 175, 106, 0.04) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse at 50% 20%, black 40%, transparent 85%);
  opacity: 0.6;
}

/* Header */
.app-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 48px;
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(10px);
  gap: 24px;
  flex-wrap: wrap;
  background: linear-gradient(180deg, rgba(212, 175, 106, 0.04), transparent);
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #d4af6a 0%, #b98644 100%);
  color: #1a1206;
  box-shadow: var(--shadow-gold), inset 0 0 0 1px rgba(255, 255, 255, 0.25);
  font-family: 'Noto Serif SC', serif;
  animation: brandPulse 3.6s ease-in-out infinite;
}
.brand-mark::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 16px;
  border: 1px solid rgba(212, 175, 106, 0.18);
  pointer-events: none;
}

@keyframes brandPulse {
  0%, 100% { box-shadow: 0 10px 30px -10px rgba(212, 175, 106, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.25); }
  50% { box-shadow: 0 14px 40px -10px rgba(212, 175, 106, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.35); }
}

.brand-glyph { font-size: 26px; font-weight: 700; letter-spacing: 1px; }

.brand-text .brand-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink-0);
}

.brand-text .brand-sub {
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--ink-2);
  margin-top: 4px;
}

/* Tabs */
.tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow-1);
}

.tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
}

.tab-icon {
  font-size: 14px;
  color: var(--gold);
  opacity: 0.6;
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.tab-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
}

.tab-label {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  color: inherit;
}

.tab-sub {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--ink-3);
}

.tab:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--ink-1);
  transform: translateY(-1px);
}

.tab:hover .tab-icon { opacity: 1; }

.tab.active {
  background: linear-gradient(135deg, rgba(212, 175, 106, 0.18), rgba(212, 175, 106, 0.06));
  border-color: rgba(212, 175, 106, 0.35);
  color: var(--gold-2);
  box-shadow: 0 8px 22px -10px rgba(212, 175, 106, 0.45);
}
.tab.active .tab-icon { opacity: 1; transform: scale(1.15); }
.tab.active .tab-sub { color: var(--gold); }

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.clock {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--ink-2);
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 1px;
}
.clock-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--emerald);
  box-shadow: 0 0 8px var(--emerald);
  animation: pulseDot 1.8s ease-in-out infinite;
}
@keyframes pulseDot {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* Main */
.app-main {
  position: relative;
  z-index: 1;
  padding: 32px 48px 20px;
  flex: 1;
  min-width: 0;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; transform: translateY(-6px); }

.app-foot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ink-3);
  font-size: 11px;
  padding: 18px 24px 24px;
  letter-spacing: 2px;
}
.foot-sep {
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  opacity: 0.4;
}
.foot-dot { color: var(--ink-3); }

@media (max-width: 1024px) {
  .app-header { padding: 18px 20px; justify-content: center; }
  .app-main { padding: 22px 16px 16px; }
  .tab { padding: 8px 12px; }
  .tab-label { font-size: 13px; }
  .tab-sub { display: none; }
  .brand-text .brand-sub { display: none; }
  .header-right { width: 100%; justify-content: center; }
}
</style>
