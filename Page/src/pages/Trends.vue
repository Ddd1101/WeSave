<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { getSnapshots, getChanges } from '../api/assets.js';
import {
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
  todayStr,
  daysAgoStr,
} from '../utils/format.js';
import { useChart } from '../utils/useChart.js';

const start = ref(daysAgoStr(30));
const end = ref(todayStr());
const granularity = ref('day');
const loading = ref(false);

const trend = ref({ dates: [], totals: [], by_category: [] });
const changes = ref({ daily: [], by_category: [], top_items: [] });

async function load() {
  loading.value = true;
  try {
    const [t, c] = await Promise.all([
      getSnapshots({
        start: start.value,
        end: end.value,
        granularity: granularity.value,
      }),
      getChanges({ start: start.value, end: end.value }),
    ]);
    trend.value = t;
    changes.value = c;
    refreshAll();
  } finally {
    loading.value = false;
  }
}

const netChange = computed(() => {
  const arr = trend.value.totals;
  if (!arr || arr.length < 2) return 0;
  return arr[arr.length - 1] - arr[0];
});

const netChangePercent = computed(() => {
  const arr = trend.value.totals;
  if (!arr || arr.length < 2 || !arr[0]) return 0;
  return (netChange.value / Math.abs(arr[0])) * 100;
});

const maxAbsChange = computed(() => {
  const list = (changes.value && changes.value.by_category) || [];
  let m = 0;
  for (const c of list) m = Math.max(m, Math.abs(Number(c.change || 0)));
  return m;
});

// 调色板
const palette = ['#d4af6a', '#4fd1a5', '#7aa6ff', '#ffb48a', '#c488ff', '#85e3ff'];

// 净资产趋势折线图
const lineOption = () => ({
  tooltip: {
    trigger: 'axis',
    valueFormatter: (v) => formatCurrency(v),
    backgroundColor: 'rgba(12,16,28,0.94)',
    borderColor: 'rgba(212,175,106,0.35)',
    borderWidth: 1,
    textStyle: { color: '#e9ecf5', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
    axisPointer: { type: 'line', lineStyle: { color: 'rgba(212,175,106,0.4)' } },
  },
  grid: { left: 70, right: 30, top: 30, bottom: 50 },
  xAxis: {
    type: 'category',
    data: trend.value.dates,
    boundaryGap: false,
    axisLabel: { color: '#8a93ad', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      color: '#8a93ad',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
      formatter: (v) => {
        if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '万';
        return v;
      },
    },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
  },
  series: [
    {
      name: '净资产',
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 3, color: '#d4af6a', shadowBlur: 10, shadowColor: 'rgba(212,175,106,0.5)' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(212,175,106,0.45)' },
            { offset: 1, color: 'rgba(212,175,106,0)' },
          ],
        },
      },
      data: trend.value.totals,
      animationDuration: 1000,
    },
  ],
});

// 堆叠面积图
const stackOption = () => {
  const cats = trend.value.by_category || [];
  const series = cats.map((c, i) => ({
    name: c.category,
    type: 'line',
    stack: 'assets',
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 2, color: palette[i % palette.length] },
    itemStyle: { color: palette[i % palette.length] },
    areaStyle: {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: palette[i % palette.length] + '88' },
          { offset: 1, color: palette[i % palette.length] + '10' },
        ],
      },
      opacity: 0.9,
    },
    data: c.values,
    emphasis: { focus: 'series' },
  }));
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v) => formatCurrency(v),
      backgroundColor: 'rgba(12,16,28,0.94)',
      borderColor: 'rgba(212,175,106,0.35)',
      textStyle: { color: '#e9ecf5', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
    },
    legend: {
      top: 0,
      textStyle: { color: '#c8cfe2', fontFamily: 'Inter, sans-serif', fontSize: 12 },
      itemGap: 18,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 8,
    },
    grid: { left: 70, right: 30, top: 50, bottom: 50 },
    xAxis: {
      type: 'category',
      data: trend.value.dates,
      boundaryGap: false,
      axisLabel: { color: '#8a93ad', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8a93ad',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        formatter: (v) => {
          if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '万';
          return v;
        },
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series,
    animationDuration: 1000,
  };
};

// 每日变化柱状图
const changeBarOption = () => {
  const daily = changes.value.daily || [];
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => formatSignedCurrency(v),
      backgroundColor: 'rgba(12,16,28,0.94)',
      borderColor: 'rgba(212,175,106,0.35)',
      textStyle: { color: '#e9ecf5', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
    },
    grid: { left: 70, right: 30, top: 20, bottom: 50 },
    xAxis: {
      type: 'category',
      data: daily.map((d) => d.date),
      axisLabel: {
        color: '#8a93ad',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        rotate: daily.length > 20 ? 40 : 0,
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8a93ad',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        formatter: (v) => {
          if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '万';
          return v;
        },
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [
      {
        type: 'bar',
        barWidth: '55%',
        data: daily.map((d) => ({
          value: d.change,
          itemStyle: {
            color: d.change >= 0
              ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                  { offset: 0, color: '#4fd1a5' },
                  { offset: 1, color: '#4fd1a540' },
                ] }
              : { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                  { offset: 0, color: '#ff6b7a' },
                  { offset: 1, color: '#ff6b7a40' },
                ] },
            borderRadius: [4, 4, 0, 0],
          },
        })),
        animationDuration: 900,
      },
    ],
  };
};

// 雷达图
const radarOption = () => {
  const by = trend.value.by_category || [];
  if (by.length === 0) return {};
  const max = Math.max(...by.map((c) => Math.max(...c.values, 0))) * 1.15 || 1;
  return {
    tooltip: {
      valueFormatter: (v) => formatCurrency(v),
      backgroundColor: 'rgba(12,16,28,0.94)',
      borderColor: 'rgba(212,175,106,0.35)',
      textStyle: { color: '#e9ecf5', fontFamily: 'JetBrains Mono, monospace' },
    },
    radar: {
      indicator: by.map((c) => ({ name: c.category, max })),
      axisName: {
        color: '#c8cfe2',
        fontSize: 12,
        fontFamily: 'Noto Serif SC, serif',
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.07)' } },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.01)', 'rgba(255,255,255,0.02)'] } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#d4af6a', width: 2 },
        areaStyle: { color: 'rgba(212,175,106,0.3)' },
        itemStyle: { color: '#f5d98a' },
        data: [
          {
            value: by.map((c) => (c.values && c.values.length ? c.values[c.values.length - 1] : 0)),
            name: '期末值',
          },
        ],
      },
    ],
  };
};

const lineChart = useChart(lineOption);
const stackChart = useChart(stackOption);
const changeChart = useChart(changeBarOption);
const radarChart = useChart(radarOption);

function refreshAll() {
  lineChart.refresh();
  stackChart.refresh();
  changeChart.refresh();
  radarChart.refresh();
}

const quickRanges = [
  { label: '近7天', days: 7 },
  { label: '近30天', days: 30 },
  { label: '近90天', days: 90 },
  { label: '近180天', days: 180 },
];

function setRange(days) {
  start.value = daysAgoStr(days);
  end.value = todayStr();
}

onMounted(load);
watch([start, end, granularity], load);
</script>

<template>
  <div class="page">
    <!-- 控制栏 -->
    <section class="toolbar">
      <div class="tool-left">
        <span class="tool-label">日期范围</span>
        <input type="date" v-model="start" class="date-input" />
        <span class="sep">至</span>
        <input type="date" v-model="end" class="date-input" />
        <span class="tool-label" style="margin-left:10px;">粒度</span>
        <div class="seg-wrap">
          <button
            class="seg-item"
            :class="{ active: granularity === 'day' }"
            @click="granularity = 'day'"
          >日</button>
          <button
            class="seg-item"
            :class="{ active: granularity === 'month' }"
            @click="granularity = 'month'"
          >月</button>
        </div>

        <div class="divider" />

        <button
          v-for="r in quickRanges"
          :key="r.days"
          class="btn ghost small"
          @click="setRange(r.days)"
        >{{ r.label }}</button>

        <button class="btn primary small" @click="load">
          <span class="btn-icon">⟳</span>
          <span>刷新</span>
        </button>
      </div>

      <div class="tool-right">
        <div class="summary-chip" :class="netChange >= 0 ? 'pos' : 'neg'">
          <span class="chip-label">区间变化</span>
          <span class="chip-value">{{ formatSignedCurrency(netChange) }}</span>
          <span class="chip-percent">{{ formatSignedPercent(netChangePercent) }}</span>
        </div>
      </div>
    </section>

    <div v-if="loading" class="empty loading">
      <div class="spinner" />
      <div class="empty-text">加载图表数据中…</div>
    </div>

    <template v-else>
      <!-- 图表区 -->
      <section class="charts-grid">
        <div class="chart-card span-2">
          <div class="chart-head">
            <span class="chart-title">净资产趋势</span>
            <span class="chart-desc">面积折线图 · 日期序列</span>
          </div>
          <div class="chart-inner" :ref="lineChart.el" />
        </div>

        <div class="chart-card span-2">
          <div class="chart-head">
            <span class="chart-title">分类资产价值</span>
            <span class="chart-desc">堆叠面积 · 按分类叠加</span>
          </div>
          <div class="chart-inner" :ref="stackChart.el" />
        </div>

        <div class="chart-card">
          <div class="chart-head">
            <span class="chart-title">每日净变化</span>
            <span class="chart-desc">柱状图 · 正/负分色</span>
          </div>
          <div class="chart-inner" :ref="changeChart.el" />
        </div>

        <div class="chart-card">
          <div class="chart-head">
            <span class="chart-title">期末分类构成</span>
            <span class="chart-desc">雷达图 · 相对规模</span>
          </div>
          <div class="chart-inner" :ref="radarChart.el" />
        </div>
      </section>

      <!-- 分类变化 & Top Items -->
      <section class="mini-grid">
        <div class="mini-card">
          <div class="mini-head">
            <span class="chart-title">分类变化额</span>
            <span class="chart-desc">区间内各分类净值变化</span>
          </div>
          <div v-if="!(changes.by_category && changes.by_category.length)" class="chart-empty small">
            <div class="empty-glyph">◇</div>
            <div>暂无变化数据</div>
          </div>
          <div v-else class="bar-list">
            <div
              v-for="c in changes.by_category"
              :key="c.category"
              class="bar-item"
            >
              <span class="bar-label">{{ c.category }}</span>
              <div class="bar-track">
                <span
                  class="bar-fill"
                  :class="c.change >= 0 ? 'pos' : 'neg'"
                  :style="{ width: Math.min(100, Math.abs(c.change) / (maxAbsChange || 1) * 100).toFixed(1) + '%' }"
                />
              </div>
              <span class="bar-value" :class="c.change >= 0 ? 'pos' : 'neg'">
                {{ formatSignedCurrency(c.change) }}
              </span>
            </div>
          </div>
        </div>

        <div class="mini-card">
          <div class="mini-head">
            <span class="chart-title">Top 变动项</span>
            <span class="chart-desc">区间内变化额最大的资产</span>
          </div>
          <div v-if="!(changes.top_items && changes.top_items.length)" class="chart-empty small">
            <div class="empty-glyph">◇</div>
            <div>暂无变动数据</div>
          </div>
          <div v-else class="item-list">
            <div
              v-for="(item, idx) in changes.top_items"
              :key="item.name"
              class="item-row"
            >
              <span class="rank">{{ String(idx + 1).padStart(2, '0') }}</span>
              <span class="item-name">{{ item.name }}</span>
              <span class="item-value" :class="item.change >= 0 ? 'pos' : 'neg'">
                {{ formatSignedCurrency(item.change) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 汇总表 -->
      <section class="summary-wrap">
        <div class="summary-header">
          <span class="summary-title">分类区间汇总</span>
          <span class="hint">期初 → 期末 · 变化额 / 变化率</span>
        </div>
        <div class="summary-grid">
          <div class="summary-row-head">
            <div class="col col-cat">类别</div>
            <div class="col align-right">期初</div>
            <div class="col align-right">期末</div>
            <div class="col align-right">变化额</div>
            <div class="col align-right">变化率</div>
          </div>
          <div
            v-for="c in (trend.by_category || [])"
            :key="c.category"
            class="summary-row"
          >
            <div class="col col-cat">
              <span class="pill">{{ c.category }}</span>
            </div>
            <div class="col align-right subtle">{{ formatCurrency(c.values[0] || 0) }}</div>
            <div class="col align-right strong">{{ formatCurrency(c.values[c.values.length - 1] || 0) }}</div>
            <div
              class="col align-right signed"
              :class="(c.values[c.values.length - 1] || 0) - (c.values[0] || 0) >= 0 ? 'pos' : 'neg'"
            >
              {{ formatSignedCurrency((c.values[c.values.length - 1] || 0) - (c.values[0] || 0)) }}
            </div>
            <div
              class="col align-right signed"
              :class="(c.values[c.values.length - 1] || 0) - (c.values[0] || 0) >= 0 ? 'pos' : 'neg'"
            >
              {{
                c.values[0]
                  ? formatSignedPercent(((c.values[c.values.length - 1] || 0) - c.values[0]) / Math.abs(c.values[0]) * 100)
                  : '—'
              }}
            </div>
          </div>
        </div>
      </section>
    </template>
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
  padding: 16px 22px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: var(--shadow-1);
  flex-wrap: wrap;
  gap: 16px;
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

.sep {
  color: var(--ink-2);
  font-size: 12px;
}

.seg-wrap {
  display: inline-flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.02);
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--line);
}

.seg-item {
  background: transparent;
  border: none;
  color: var(--ink-1);
  padding: 6px 14px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12px;
  letter-spacing: 1px;
  font-family: inherit;
  transition: all 0.2s ease;
}

.seg-item.active {
  background: linear-gradient(135deg, var(--gold), #b98644);
  color: #1a1206;
  font-weight: 600;
  box-shadow: 0 4px 12px -4px rgba(212, 175, 106, 0.5);
}

.divider {
  width: 1px;
  height: 24px;
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
}

.btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(212, 175, 106, 0.3);
}

.btn.primary {
  background: linear-gradient(135deg, var(--gold), #b98644);
  color: #1a1206;
  border: 1px solid rgba(255, 255, 255, 0.25);
  font-weight: 600;
  box-shadow: var(--shadow-gold);
}

.btn-icon {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: var(--gold);
  font-size: 13px;
}
.btn.primary .btn-icon { color: #1a1206; }

.btn.ghost { background: transparent; }
.btn.small { padding: 7px 12px; font-size: 12px; }

.summary-chip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 22px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(212, 175, 106, 0.12), transparent);
  border: 1px solid rgba(212, 175, 106, 0.3);
  min-width: 180px;
  align-items: flex-end;
}
.summary-chip.pos {
  background: linear-gradient(135deg, rgba(79, 209, 165, 0.12), transparent);
  border-color: rgba(79, 209, 165, 0.3);
}
.summary-chip.neg {
  background: linear-gradient(135deg, rgba(255, 107, 122, 0.12), transparent);
  border-color: rgba(255, 107, 122, 0.3);
}

.chip-label {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--ink-2);
  text-transform: uppercase;
}
.chip-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  color: var(--gold-2);
}
.summary-chip.pos .chip-value { color: #8fe7c2; }
.summary-chip.neg .chip-value { color: #ff9099; }
.chip-percent {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--ink-2);
}

/* Charts */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.chart-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px 22px 16px;
  box-shadow: var(--shadow-1);
  transition: transform 0.3s ease, border-color 0.3s ease;
}
.chart-card:hover {
  transform: translateY(-2px);
  border-color: rgba(212, 175, 106, 0.25);
}
.chart-card.span-2 { grid-column: 1 / -1; }

.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
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

.chart-inner { width: 100%; height: 340px; }

/* Summary */
.summary-wrap {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--shadow-1);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 22px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
}

.summary-title {
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--ink-0);
  text-transform: uppercase;
  font-family: 'Noto Serif SC', serif;
  font-weight: 600;
}

.hint { color: var(--ink-2); font-size: 12px; letter-spacing: 1px; }

.summary-grid {
  padding: 8px 22px;
}

.summary-row-head,
.summary-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;
  gap: 16px;
  padding: 14px 4px;
}

.summary-row-head {
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--ink-2);
  text-transform: uppercase;
  border-bottom: 1px solid var(--line);
}

.summary-row {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.2s ease;
}
.summary-row:hover { background: rgba(212, 175, 106, 0.04); }
.summary-row:last-child { border-bottom: none; }

.summary-row .col { color: var(--ink-0); }
.summary-row .subtle { color: var(--ink-2); font-size: 13px; }
.summary-row .strong { color: var(--ink-0); font-weight: 700; }
.summary-row .signed { font-weight: 600; }
.summary-row .pos { color: var(--emerald); }
.summary-row .neg { color: var(--rose); }

.align-right { text-align: right; }

.pill {
  display: inline-block;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--gold-2);
  background: rgba(212, 175, 106, 0.1);
  font-weight: 500;
  font-family: 'Inter, sans-serif';
}

/* Empty / loading */
.empty {
  padding: 68px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: var(--shadow-1);
}

.empty-text {
  color: var(--ink-2);
  letter-spacing: 1px;
  font-size: 13px;
}

.spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: var(--gold);
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.mini-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.mini-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px 22px 20px;
  box-shadow: var(--shadow-1);
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.mini-card:hover {
  transform: translateY(-2px);
  border-color: rgba(212, 175, 106, 0.25);
}

.mini-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14px;
}

.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 12px;
  color: var(--ink-2);
  font-size: 12px;
}
.chart-empty.small { padding: 24px 8px; }
.chart-empty .empty-glyph {
  font-size: 30px;
  color: var(--ink-3);
  opacity: 0.5;
  animation: pulse 2.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.96); }
  50% { opacity: 0.7; transform: scale(1.04); }
}

.bar-list { display: flex; flex-direction: column; gap: 10px; }
.bar-item {
  display: grid;
  grid-template-columns: 100px 1fr 120px;
  align-items: center;
  gap: 12px;
  padding: 8px 4px;
  border-bottom: 1px dashed rgba(255,255,255,0.04);
  font-size: 13px;
}
.bar-label { color: var(--ink-1); }
.bar-track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.bar-fill.pos { background: linear-gradient(90deg, var(--emerald), #7ee8c2); }
.bar-fill.neg { background: linear-gradient(90deg, var(--rose), #ffb1b9); }
.bar-value { font-family: 'JetBrains Mono', monospace; text-align: right; font-weight: 600; }
.bar-value.pos { color: var(--emerald); }
.bar-value.neg { color: var(--rose); }

.item-list { display: flex; flex-direction: column; gap: 4px; }
.item-row {
  display: grid;
  grid-template-columns: 44px 1fr 120px;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px dashed rgba(255,255,255,0.04);
  font-size: 13px;
}
.rank {
  font-family: 'JetBrains Mono', monospace;
  color: var(--gold);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 1px;
  opacity: 0.85;
}
.item-name { color: var(--ink-1); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-value { font-family: 'JetBrains Mono', monospace; text-align: right; font-weight: 600; }
.item-value.pos { color: var(--emerald); }
.item-value.neg { color: var(--rose); }

@media (max-width: 1280px) {
  .charts-grid { grid-template-columns: 1fr; }
  .mini-grid { grid-template-columns: 1fr; }
}

@media (max-width: 820px) {
  .chart-inner { height: 260px; }
  .summary-row-head, .summary-row {
    grid-template-columns: 1.4fr 1fr 1fr;
  }
  .summary-row-head .col:nth-child(4),
  .summary-row-head .col:nth-child(5),
  .summary-row .col:nth-child(4),
  .summary-row .col:nth-child(5) { display: none; }
}
</style>
