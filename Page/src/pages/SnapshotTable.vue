<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { getSnapshot } from '../api/assets.js';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  todayStr,
} from '../utils/format.js';
import { useChart } from '../utils/useChart.js';

const snapshotDate = ref(todayStr());
const loading = ref(false);
const snapshot = ref({ assets: [], total: 0, by_category: [] });

async function load() {
  loading.value = true;
  try {
    const data = await getSnapshot(snapshotDate.value);
    snapshot.value = data;
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

const sorted = computed(() =>
  [...snapshot.value.assets].sort(
    (a, b) => Number(b.value || 0) - Number(a.value || 0),
  ),
);

const topAssets = computed(() => sorted.value.slice(0, 10));

function categoryClass(name) {
  const map = {
    存款: 'cat-deposit',
    投资资产: 'cat-invest',
    其他资产: 'cat-other',
  };
  return map[name] || 'cat-default';
}

// ========= 饼图（分类） =========
const pieOption = () => ({
  tooltip: {
    trigger: 'item',
    valueFormatter: (v) => formatCurrency(v),
    backgroundColor: 'rgba(20,24,40,0.92)',
    borderColor: 'rgba(212,175,106,0.35)',
    textStyle: { color: '#e9ecf5' },
  },
  legend: {
    bottom: 0,
    textStyle: { color: '#c8cfe2' },
    itemGap: 14,
  },
  color: ['#d4af6a', '#4fd1a5', '#7aa6ff', '#ffb48a', '#c488ff'],
  series: [
    {
      name: '分类占比',
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '46%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: '#0b0f1a',
        borderWidth: 2,
      },
      label: { color: '#c8cfe2', formatter: '{b}\n{d}%' },
      labelLine: { lineStyle: { color: 'rgba(200,207,226,0.35)' } },
      data: snapshot.value.by_category.map((c) => ({
        name: c.category,
        value: Number(c.sum || 0),
      })),
    },
  ],
});

const pie = useChart(pieOption);

// ========= 条形图（Top 资产） =========
const barOption = () => ({
  grid: { left: 120, right: 30, top: 20, bottom: 20 },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    valueFormatter: (v) => formatCurrency(v),
    backgroundColor: 'rgba(20,24,40,0.92)',
    borderColor: 'rgba(212,175,106,0.35)',
    textStyle: { color: '#e9ecf5' },
  },
  xAxis: {
    type: 'value',
    axisLabel: { color: '#8a93ad' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
  },
  yAxis: {
    type: 'category',
    inverse: true,
    axisLabel: { color: '#c8cfe2' },
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    data: topAssets.value.map((a) => a.name),
  },
  series: [
    {
      type: 'bar',
      data: topAssets.value.map((a) => ({
        value: Number(a.value || 0),
        itemStyle: {
          color:
            a.value >= 0
              ? 'linear-gradient(90deg, #4fd1a5, #d4af6a)'
              : 'linear-gradient(90deg, #ff6b7a, #ffb48a)',
          borderRadius: [0, 6, 6, 0],
        },
      })),
      barWidth: 14,
    },
  ],
});

const bar = useChart(barOption);

onMounted(load);

watch(snapshotDate, async () => {
  await load();
  pie.refresh();
  bar.refresh();
});
</script>

<template>
  <div class="page">
    <!-- 控制栏 -->
    <section class="snap-toolbar">
      <div class="tool-left">
        <span class="tool-label">查询日期</span>
        <input type="date" v-model="snapshotDate" class="date-input" />
        <button class="btn ghost small" @click="goPrev">◀ 上一天</button>
        <button class="btn ghost small" @click="goNext">下一天 ▶</button>
        <button class="btn primary small" @click="goToday">今日</button>
        <button class="btn ghost small" @click="load">刷新</button>
      </div>
      <div class="tool-right">
        <span class="hint"
          >当前快照：<b>{{ snapshot.date || snapshotDate }}</b> · 共 {{
            snapshot.assets.length
          }}
          项资产</span
        >
      </div>
    </section>

    <!-- 汇总卡片 -->
    <section class="hero">
      <div class="hero-card hero-main">
        <div class="hero-sub">NET WORTH · 净资产总额</div>
        <div class="hero-amount">
          <span class="currency">¥</span>
          <span class="number">{{
            formatCurrency(snapshot.total).replace('¥', '')
          }}</span>
        </div>
        <div class="hero-foot">
          <span>{{ snapshot.assets.length }} 项记录</span>
          <span class="dot" />
          <span>{{ snapshot.by_category.length }} 个分类</span>
        </div>
      </div>

      <div
        v-for="c in snapshot.by_category"
        :key="c.category"
        class="hero-card"
        :class="categoryClass(c.category)"
      >
        <div class="chip-top">
          <span class="chip-name">{{ c.category }}</span>
        </div>
        <div class="chip-value">{{ formatCurrency(c.sum) }}</div>
        <div class="chip-bar">
          <span
            class="chip-bar-fill"
            :style="{
              width:
                Math.max(
                  4,
                  (Math.abs(c.sum) /
                    (Math.abs(snapshot.total) || 1)) *
                    100,
                ) + '%',
            }"
          />
        </div>
        <div class="chip-percent">
          占比
          {{
            formatPercent(
              (c.sum / (Math.abs(snapshot.total) || 1)) * 100,
            )
          }}
        </div>
      </div>
    </section>

    <!-- 图表 -->
    <section class="charts">
      <div class="chart-card">
        <div class="chart-title">分类构成</div>
        <div class="chart-inner" ref="pie.el" />
      </div>
      <div class="chart-card">
        <div class="chart-title">Top 10 资产价值</div>
        <div class="chart-inner" ref="bar.el" />
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
      <div v-else-if="sorted.length === 0" class="empty">
        <div class="empty-glyph">◇</div>
        <div class="empty-text">该日期暂无资产记录</div>
      </div>
      <template v-else>
        <div v-for="row in sorted" :key="row.id || row.name" class="row">
          <div class="col col-cat">
            <span class="pill" :class="categoryClass(row.category)"
              >{{ row.category }}</span
            >
          </div>
          <div class="col col-name">
            <div class="name">{{ row.name }}</div>
          </div>
          <div class="col col-value align-right">
            <div class="value" :class="Number(row.value) < 0 ? 'neg' : 'pos'">
              {{ formatCurrency(row.value) }}
            </div>
          </div>
          <div class="col col-date subtle">{{ formatDate(row.purchase_date) }}</div>
          <div class="col col-price align-right subtle">
            {{ row.purchase_price != null ? formatCurrency(row.purchase_price) : '—' }}
          </div>
          <div class="col col-note subtle">{{ row.remark || '—' }}</div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: fadeUp 0.5s ease both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.snap-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  flex-wrap: wrap;
}

.tool-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tool-label {
  color: #8a93ad;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.date-input {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--line);
  color: #e9ecf5;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.date-input:focus {
  border-color: var(--gold);
  background: rgba(212, 175, 106, 0.06);
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
  transition: transform 0.2s ease, background 0.2s ease;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.btn.primary {
  background: linear-gradient(135deg, #d4af6a, #b98644);
  color: #1a1206;
  font-weight: 600;
}

.btn.ghost { background: transparent; }
.btn.small { padding: 7px 12px; font-size: 12px; }

.hint { color: #8a93ad; font-size: 13px; }
.hint b { color: #d4af6a; font-weight: 600; }

/* 汇总卡片 */
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
}

.hero-main {
  background: linear-gradient(135deg, rgba(212, 175, 106, 0.18), rgba(212, 175, 106, 0.04) 45%, transparent 80%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
  border: 1px solid rgba(212, 175, 106, 0.35);
}

.hero-main::before {
  content: '';
  position: absolute;
  right: -40px;
  top: -40px;
  width: 180px;
  height: 180px;
  background: radial-gradient(closest-side, rgba(245, 217, 138, 0.35), transparent);
  filter: blur(10px);
}

.hero-sub {
  font-size: 11px;
  letter-spacing: 4px;
  color: #8a93ad;
  text-transform: uppercase;
}

.hero-amount {
  margin-top: 12px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hero-amount .currency { font-size: 22px; color: #d4af6a; font-family: 'Noto Serif SC', serif; }
.hero-amount .number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 40px;
  font-weight: 700;
  color: #fff;
}

.hero-foot {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #8a93ad;
  font-size: 13px;
}
.hero-foot .dot { width: 3px; height: 3px; border-radius: 50%; background: #5b6478; }

.chip-top {
  display: flex;
  justify-content: space-between;
  color: #8a93ad;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.chip-value {
  margin-top: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.chip-bar {
  margin-top: 14px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.chip-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #d4af6a, #f5d98a);
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.cat-invest .chip-bar-fill { background: linear-gradient(90deg, #4fd1a5, #7ee8c2); }
.cat-other .chip-bar-fill { background: linear-gradient(90deg, #7aa6ff, #b3ceff); }

.chip-percent { margin-top: 10px; font-size: 12px; color: #8a93ad; letter-spacing: 1px; }

/* 图表 */
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
}

.chart-title {
  font-size: 12px;
  letter-spacing: 3px;
  color: #8a93ad;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.chart-inner {
  width: 100%;
  height: 360px;
}

/* 表格 */
.table-wrap {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 130px 1.4fr 180px 140px 140px 1.2fr;
  align-items: center;
  padding: 14px 20px;
  font-size: 11px;
  letter-spacing: 3px;
  color: #8a93ad;
  text-transform: uppercase;
  border-bottom: 1px solid var(--line);
}

.row {
  display: grid;
  grid-template-columns: 130px 1.4fr 180px 140px 140px 1.2fr;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}

.row:last-child { border-bottom: none; }

.align-right { text-align: right; }
.subtle { color: #8a93ad; font-size: 13px; }

.pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.03);
  color: #c8cfe2;
}

.pill.cat-deposit { color: #f5d98a; border-color: rgba(212, 175, 106, 0.4); background: rgba(212, 175, 106, 0.1); }
.pill.cat-invest { color: #8fe7c2; border-color: rgba(79, 209, 165, 0.35); background: rgba(79, 209, 165, 0.08); }
.pill.cat-other { color: #b3ceff; border-color: rgba(122, 166, 255, 0.35); background: rgba(122, 166, 255, 0.08); }

.name { font-size: 14px; color: #e9ecf5; font-weight: 500; }

.value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 600;
}
.value.pos { color: #4fd1a5; }
.value.neg { color: #ff6b7a; }

.empty { padding: 60px 20px; text-align: center; }
.empty-glyph { font-size: 48px; color: #5b6478; opacity: 0.6; animation: pulse 2s ease-in-out infinite; }
.empty-text { margin-top: 8px; color: #8a93ad; font-size: 14px; }
.spinner {
  width: 34px; height: 34px; margin: 0 auto 12px; border-radius: 50%;
  border: 2px solid var(--line); border-top-color: var(--gold); animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }

@media (max-width: 1280px) {
  .hero { grid-template-columns: 1fr 1fr; }
  .hero-main { grid-column: 1 / -1; }
  .charts { grid-template-columns: 1fr; }
}

@media (max-width: 820px) {
  .hero { grid-template-columns: 1fr; }
  .table-header, .row {
    grid-template-columns: 110px 1fr 150px 1fr;
  }
  .col-date, .col-price { display: none; }
  .chart-inner { height: 300px; }
}
</style>
