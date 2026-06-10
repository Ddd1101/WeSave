<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { getSnapshot } from '../api/assets.js';
import BatchForm from '../components/BatchForm.vue';
import { formatCurrency, formatPercent, todayStr } from '../utils/format.js';
import { useChart } from '../utils/useChart.js';

const snapshotDate = ref(todayStr());
const loading = ref(false);
const snapshot = ref({ assets: [], total: 0, by_category: [] });

const batchVisible = ref(false);

async function load() {
  loading.value = true;
  try {
    const data = await getSnapshot(snapshotDate.value);
    snapshot.value = data;
    pie.refresh();
    bar.refresh();
  } finally {
    loading.value = false;
  }
}

function goPrev() {
  const d = new Date(`${snapshotDate.value}T00:00:00`);
  d.setDate(d.getDate() - 1);
  snapshotDate.value = d.toISOString().slice(0, 10);
}

function goNext() {
  const d = new Date(`${snapshotDate.value}T00:00:00`);
  d.setDate(d.getDate() + 1);
  snapshotDate.value = d.toISOString().slice(0, 10);
}

function goToday() {
  snapshotDate.value = todayStr();
}

function editThisDate() {
  batchVisible.value = true;
}

function onBatchSaved() {
  load();
}

function categoryClass(name) {
  const map = { 存款: 'cat-deposit', '投资资产': 'cat-invest', '其他资产': 'cat-other' };
  return map[name] || 'cat-default';
}

const topAssets = computed(() =>
  [...snapshot.value.assets]
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
);

const colors = ['#d4af6a', '#4fd1a5', '#7aa6ff', '#ffb48a', '#c488ff', '#85e3ff'];

// 饼图
const pieOption = () => ({
  tooltip: {
    trigger: 'item',
    valueFormatter: (v) => formatCurrency(v),
    backgroundColor: 'rgba(12,16,28,0.94)',
    borderColor: 'rgba(212,175,106,0.35)',
    borderWidth: 1,
    textStyle: { color: '#e9ecf5', fontFamily: 'JetBrains Mono, monospace' },
    extraCssText: 'box-shadow: 0 8px 30px rgba(0,0,0,0.5); border-radius: 10px;',
  },
  legend: {
    bottom: 6,
    textStyle: { color: '#c8cfe2', fontFamily: 'Inter, sans-serif', fontSize: 12 },
    itemGap: 18,
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
  },
  color: colors,
  series: [
    {
      name: '分类构成',
      type: 'pie',
      radius: ['50%', '74%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: '#0b0f1a',
        borderWidth: 3,
        borderRadius: 4,
      },
      label: {
        color: '#c8cfe2',
        formatter: '{b}\n{d}%',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
      },
      labelLine: {
        lineStyle: { color: 'rgba(200,207,226,0.35)' },
        length: 10,
        length2: 12,
      },
      data: snapshot.value.by_category.map((c) => ({
        name: c.category,
        value: Number(c.sum || 0),
      })),
      emphasis: {
        scale: true,
        scaleSize: 6,
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(212,175,106,0.4)' },
      },
    },
  ],
});

const pie = useChart(pieOption);

// 条形图
const barOption = () => {
  const top = topAssets.value.slice(0, 10);
  return {
    grid: { left: 120, right: 30, top: 20, bottom: 20 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => formatCurrency(v),
      backgroundColor: 'rgba(12,16,28,0.94)',
      borderColor: 'rgba(212,175,106,0.35)',
      textStyle: { color: '#e9ecf5', fontFamily: 'JetBrains Mono, monospace' },
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8a93ad', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      axisLabel: {
        color: '#c8cfe2',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      data: top.map((a) => a.name),
    },
    series: [
      {
        type: 'bar',
        data: top.map((a) => ({
          value: Number(a.value || 0),
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#d4af6a' },
                { offset: 1, color: '#f5d98a' },
              ],
            },
            borderRadius: [0, 6, 6, 0],
          },
        })),
        barWidth: 12,
        animationDuration: 800,
      },
    ],
  };
};

const bar = useChart(barOption);

onMounted(load);
watch(snapshotDate, async () => {
  await load();
});
</script>

<template>
  <div class="page">
    <!-- 工具栏 -->
    <section class="toolbar">
      <div class="tool-left">
        <span class="tool-label">查询日期</span>
        <input type="date" v-model="snapshotDate" class="date-input" />
        <button class="btn ghost small" @click="goPrev">◀ 前一天</button>
        <button class="btn ghost small" @click="goNext">下一天 ▶</button>
        <button class="btn primary small" @click="goToday">今日</button>
        <button class="btn ghost small" @click="load">⟳ 刷新</button>
        <div class="divider" />
        <button class="btn ghost small edit-btn" @click="editThisDate">
          <span class="btn-icon">✎</span>
          <span>编辑该日快照</span>
        </button>
      </div>
      <div class="tool-right">
        <div class="date-hint">
          <span class="hint-dot" />
          <span>当前快照：</span>
          <b>{{ snapshot.assets.length }}</b>
          <span>项资产 · 总值</span>
          <b class="gold">{{ formatCurrency(snapshot.total) }}</b>
        </div>
      </div>
    </section>

    <!-- Hero 汇总卡 -->
    <section class="hero">
      <div class="hero-card hero-main">
        <div class="hero-sub">NET WORTH · 净资产总额</div>
        <div class="hero-amount">
          <span class="currency">¥</span>
          <span class="number">{{ formatCurrency(snapshot.total).replace('¥', '') }}</span>
        </div>
        <div class="hero-foot">
          <div class="hero-foot-item">
            <span class="hero-foot-label">资产项</span>
            <span class="hero-foot-value">{{ snapshot.assets.length }}</span>
          </div>
          <span class="sep" />
          <div class="hero-foot-item">
            <span class="hero-foot-label">分类</span>
            <span class="hero-foot-value">{{ snapshot.by_category.length }}</span>
          </div>
        </div>
      </div>

      <div
        v-for="c in snapshot.by_category"
        :key="c.category"
        class="hero-card hero-chip"
        :class="categoryClass(c.category)"
      >
        <div class="chip-top">
          <span class="chip-name">{{ c.category }}</span>
          <span class="chip-pill">{{ formatPercent((c.sum / (Math.abs(snapshot.total) || 1)) * 100, 1) }}</span>
        </div>
        <div class="chip-value">{{ formatCurrency(c.sum) }}</div>
        <div class="chip-bar">
          <span
            class="chip-bar-fill"
            :class="categoryClass(c.category)"
            :style="{ width: Math.max(4, (Math.abs(c.sum) / (Math.abs(snapshot.total) || 1)) * 100) + '%' }"
          />
        </div>
        <div class="chip-foot">
          <span>占比 {{ formatPercent((c.sum / (Math.abs(snapshot.total) || 1)) * 100) }}</span>
        </div>
      </div>
    </section>

    <!-- 图表区 -->
    <section class="charts">
      <div class="chart-card">
        <div class="chart-head">
          <span class="chart-title">分类构成</span>
          <span class="chart-desc">饼图 · 按类别占比</span>
        </div>
        <div v-if="loading" class="chart-empty">
          <div class="spinner" />
          <div>加载中…</div>
        </div>
        <div v-else-if="snapshot.by_category.length === 0" class="chart-empty">
          <div class="empty-glyph">◇</div>
          <div>该日期暂无资产数据</div>
        </div>
        <div class="chart-inner" ref="pie.el" v-show="!loading && snapshot.by_category.length > 0" />
      </div>

      <div class="chart-card">
        <div class="chart-head">
          <span class="chart-title">Top 10 · 资产价值</span>
          <span class="chart-desc">条形图 · 金额由高到低</span>
        </div>
        <div v-if="loading" class="chart-empty">
          <div class="spinner" />
          <div>加载中…</div>
        </div>
        <div v-else-if="topAssets.length === 0" class="chart-empty">
          <div class="empty-glyph">◇</div>
          <div>该日期暂无资产数据</div>
        </div>
        <div class="chart-inner" ref="bar.el" v-show="!loading && topAssets.length > 0" />
      </div>
    </section>

    <!-- 明细 -->
    <section class="table-wrap">
      <div class="table-header">
        <div class="th col-cat">类别</div>
        <div class="th col-name">资产名称</div>
        <div class="th col-value align-right">当时价值</div>
        <div class="th col-date">购买日期</div>
        <div class="th col-price align-right">购买价格</div>
        <div class="th col-note">备注</div>
      </div>

      <div v-if="loading" class="empty">
        <div class="spinner" />
        <div class="empty-text">加载中…</div>
      </div>
      <div v-else-if="topAssets.length === 0" class="empty">
        <div class="empty-glyph">◇</div>
        <div class="empty-title">该日期暂无资产记录</div>
        <div class="empty-text">可点击工具栏的「编辑该日快照」录入数据</div>
        <button class="btn primary" @click="editThisDate">
          <span class="btn-icon">＋</span>
          <span>录入该日快照</span>
        </button>
      </div>
      <template v-else>
        <div v-for="(row, idx) in topAssets" :key="row.id || row.name + idx" class="row">
          <div class="col col-cat">
            <span class="pill" :class="categoryClass(row.category)">{{ row.category }}</span>
          </div>
          <div class="col col-name">
            <div class="name">{{ row.name }}</div>
            <div v-if="row.remark && row.remark.length < 20" class="name-sub">{{ row.remark }}</div>
          </div>
          <div class="col col-value align-right">
            <div class="value" :class="Number(row.value) >= 0 ? 'pos' : 'neg'">
              {{ formatCurrency(row.value) }}
            </div>
          </div>
          <div class="col col-date subtle">
            <span class="date-chip">{{ row.purchase_date || '—' }}</span>
          </div>
          <div class="col col-price align-right subtle">
            {{ row.purchase_price != null ? formatCurrency(row.purchase_price) : '—' }}
          </div>
          <div class="col col-note subtle">
            <span class="ellipsis">{{ row.remark || '—' }}</span>
          </div>
        </div>
      </template>
    </section>

    <BatchForm
      v-model:visible="batchVisible"
      :initial-date="snapshotDate"
      @saved="onBatchSaved"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 22px;
  animation: fadeUp 0.5s ease both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  flex-wrap: wrap;
  box-shadow: var(--shadow-1);
}

.tool-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tool-label {
  color: var(--ink-2);
  font-size: 11px;
  letter-spacing: 3px;
  text-transform: uppercase;
}

.date-input {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--line);
  color: var(--ink-0);
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.date-input:focus {
  border-color: var(--gold);
  background: var(--gold-soft);
  box-shadow: 0 0 0 3px rgba(212, 175, 106, 0.15);
}

.divider {
  width: 1px;
  height: 22px;
  background: var(--line);
  margin: 0 4px;
}

.btn {
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ink-1);
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.btn:hover { transform: translateY(-1px); background: rgba(255, 255, 255, 0.05); border-color: rgba(212, 175, 106, 0.3); }

.btn.primary {
  background: linear-gradient(135deg, var(--gold), #b98644);
  color: #1a1206;
  border: 1px solid rgba(255, 255, 255, 0.25);
  font-weight: 600;
  box-shadow: var(--shadow-gold);
}

.btn-icon { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--gold); font-size: 13px; }
.btn.primary .btn-icon { color: #1a1206; }

.btn.ghost { background: transparent; }
.btn.small { padding: 7px 12px; font-size: 12px; }

.edit-btn {
  background: linear-gradient(135deg, rgba(212, 175, 106, 0.12), transparent);
  border-color: rgba(212, 175, 106, 0.3);
  color: var(--gold-2);
}

.date-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
  font-size: 13px;
}
.date-hint b { color: var(--ink-0); font-weight: 600; font-family: 'JetBrains Mono', monospace; }
.date-hint b.gold { color: var(--gold-2); }

.hint-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--emerald);
  box-shadow: 0 0 8px var(--emerald);
  margin-right: 4px;
}

/* Hero */
.hero {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 18px;
}

.hero-card {
  position: relative;
  padding: 22px 24px;
  border-radius: 18px;
  background: var(--card);
  border: 1px solid var(--line);
  overflow: hidden;
  animation: fadeUp 0.55s ease both;
  box-shadow: var(--shadow-1);
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.hero-card:hover {
  transform: translateY(-2px);
  border-color: rgba(212, 175, 106, 0.25);
}

.hero-main {
  background: linear-gradient(135deg, rgba(212, 175, 106, 0.18), rgba(212, 175, 106, 0.04) 45%, transparent 80%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
  border: 1px solid rgba(212, 175, 106, 0.35);
}
.hero-main::before {
  content: '';
  position: absolute;
  right: -60px; top: -60px;
  width: 220px; height: 220px;
  background: radial-gradient(closest-side, rgba(245, 217, 138, 0.3), transparent);
  filter: blur(10px);
}

.hero-sub {
  font-size: 11px;
  letter-spacing: 4px;
  color: var(--ink-2);
  text-transform: uppercase;
}

.hero-amount {
  margin-top: 12px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.hero-amount .currency { font-size: 22px; color: var(--gold-2); font-family: 'Noto Serif SC', serif; font-weight: 700; }
.hero-amount .number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 38px; font-weight: 700; letter-spacing: 1px; color: #fff;
  word-break: break-all;
}

.hero-foot {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--ink-2);
  font-size: 12px;
}

.hero-foot-item { display: flex; flex-direction: column; gap: 4px; }
.hero-foot-label { font-size: 10px; letter-spacing: 2px; color: var(--ink-3); text-transform: uppercase; }
.hero-foot-value { font-family: 'JetBrains Mono', monospace; font-size: 15px; color: var(--ink-0); font-weight: 600; }

.sep { width: 1px; height: 22px; background: var(--line); }

.chip-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.chip-name {
  font-family: 'Noto Serif SC', serif;
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--ink-1);
  font-size: 14px;
}

.chip-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--gold);
  background: rgba(212, 175, 106, 0.1);
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid rgba(212, 175, 106, 0.2);
}

.chip-value {
  margin-top: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: var(--ink-0);
}

.chip-bar {
  margin-top: 14px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}
.chip-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--gold), var(--gold-2));
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.chip-bar-fill.cat-invest { background: linear-gradient(90deg, var(--emerald), #7ee8c2); }
.chip-bar-fill.cat-other { background: linear-gradient(90deg, #7aa6ff, #b3ceff); }

.chip-foot { margin-top: 10px; font-size: 11px; color: var(--ink-2); letter-spacing: 1px; }

/* Charts */
.charts {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 18px;
}

.chart-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px 20px 14px;
  box-shadow: var(--shadow-1);
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.chart-card:hover {
  transform: translateY(-2px);
  border-color: rgba(212, 175, 106, 0.25);
}

.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.chart-title {
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--ink-0);
  text-transform: uppercase;
  font-family: 'Noto Serif SC', serif;
  font-weight: 600;
}
.chart-desc { font-size: 11px; color: var(--ink-2); letter-spacing: 1px; }

.chart-inner { width: 100%; height: 360px; }

.chart-empty {
  height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ink-2);
  font-size: 13px;
}

.empty-glyph {
  font-size: 40px;
  color: var(--ink-3);
  opacity: 0.5;
  animation: pulse 2.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.96); }
  50% { opacity: 0.6; transform: scale(1.04); }
}

.spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: var(--gold);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Table */
.table-wrap {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--shadow-1);
}

.table-header {
  display: grid;
  grid-template-columns: 130px 1.4fr 180px 140px 140px 1.2fr;
  align-items: center;
  padding: 14px 22px;
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--ink-2);
  text-transform: uppercase;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
}

.row {
  display: grid;
  grid-template-columns: 130px 1.4fr 180px 140px 140px 1.2fr;
  align-items: center;
  padding: 14px 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.2s ease;
  animation: fadeUp 0.4s ease both;
}
.row:hover { background: rgba(212, 175, 106, 0.04); }
.row:last-child { border-bottom: none; }

.align-right { text-align: right; }
.subtle { color: var(--ink-2); font-size: 13px; }

.date-chip {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.ellipsis {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pill {
  display: inline-block;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--ink-1);
  background: rgba(255, 255, 255, 0.03);
  font-weight: 500;
}
.pill.cat-deposit { color: var(--gold-2); border-color: rgba(212, 175, 106, 0.4); background: rgba(212, 175, 106, 0.12); }
.pill.cat-invest { color: #8fe7c2; border-color: rgba(79, 209, 165, 0.35); background: rgba(79, 209, 165, 0.1); }
.pill.cat-other { color: #b3ceff; border-color: rgba(122, 166, 255, 0.35); background: rgba(122, 166, 255, 0.1); }

.name { font-size: 14px; color: var(--ink-0); font-weight: 500; }
.name-sub { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-2); margin-top: 3px; }

.value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 600;
}
.value.pos { color: var(--emerald); }
.value.neg { color: var(--rose); }

.empty {
  padding: 68px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.empty-title { font-size: 17px; color: var(--ink-0); font-weight: 600; letter-spacing: 2px; }
.empty-text { color: var(--ink-2); letter-spacing: 1px; font-size: 13px; max-width: 420px; }

@media (max-width: 1280px) {
  .hero { grid-template-columns: 1fr 1fr; }
  .hero-main { grid-column: 1 / -1; }
  .charts { grid-template-columns: 1fr; }
  .hero-amount .number { font-size: 32px; }
}

@media (max-width: 820px) {
  .hero { grid-template-columns: 1fr; }
  .table-header, .row {
    grid-template-columns: 110px 1fr 150px 1fr;
  }
  .col-date, .col-price { display: none; }
  .chart-inner, .chart-empty { height: 280px; }
}
</style>
