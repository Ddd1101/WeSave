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
const granularity = ref('day'); // day | month
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

// 图表调色
const palette = ['#d4af6a', '#4fd1a5', '#7aa6ff', '#ffb48a', '#c488ff', '#85e3ff'];

// 折线图：净资产总额
const lineOption = () => ({
  tooltip: {
    trigger: 'axis',
    valueFormatter: (v) => formatCurrency(v),
    backgroundColor: 'rgba(20,24,40,0.92)',
    borderColor: 'rgba(212,175,106,0.35)',
    textStyle: { color: '#e9ecf5' },
  },
  legend: { show: false },
  grid: { left: 60, right: 30, top: 30, bottom: 40 },
  xAxis: {
    type: 'category',
    data: trend.value.dates,
    boundaryGap: false,
    axisLabel: { color: '#8a93ad' },
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      color: '#8a93ad',
      formatter: (v) => {
        if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '万';
        return v;
      },
    },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
  },
  series: [
    {
      name: '净资产',
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2.5, color: '#d4af6a' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(212,175,106,0.4)' },
            { offset: 1, color: 'rgba(212,175,106,0.0)' },
          ],
        },
      },
      data: trend.value.totals,
    },
  ],
});

// 堆叠折线图：各分类价值
const stackOption = () => {
  const cats = trend.value.by_category || [];
  const series = cats.map((c, i) => ({
    name: c.category,
    type: 'line',
    stack: 'assets',
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 1.8, color: palette[i % palette.length] },
    areaStyle: {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: palette[i % palette.length] + '88' },
          { offset: 1, color: palette[i % palette.length] + '00' },
        ],
      },
    },
    data: c.values,
  }));
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v) => formatCurrency(v),
      backgroundColor: 'rgba(20,24,40,0.92)',
      borderColor: 'rgba(212,175,106,0.35)',
      textStyle: { color: '#e9ecf5' },
    },
    legend: {
      top: 0,
      textStyle: { color: '#c8cfe2' },
      itemGap: 14,
    },
    grid: { left: 60, right: 30, top: 40, bottom: 40 },
    xAxis: {
      type: 'category',
      data: trend.value.dates,
      boundaryGap: false,
      axisLabel: { color: '#8a93ad' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8a93ad',
        formatter: (v) => {
          if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '万';
          return v;
        },
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series,
  };
};

// 柱状图：每日净变化
const changeBarOption = () => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    valueFormatter: (v) => formatSignedCurrency(v),
    backgroundColor: 'rgba(20,24,40,0.92)',
    borderColor: 'rgba(212,175,106,0.35)',
    textStyle: { color: '#e9ecf5' },
  },
  grid: { left: 60, right: 30, top: 20, bottom: 40 },
  xAxis: {
    type: 'category',
    data: changes.value.daily.map((d) => d.date),
    axisLabel: { color: '#8a93ad', rotate: trend.value.dates.length > 15 ? 30 : 0 },
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      color: '#8a93ad',
      formatter: (v) => {
        if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '万';
        return v;
      },
    },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
  },
  series: [
    {
      type: 'bar',
      barWidth: '60%',
      data: changes.value.daily.map((d) => ({
        value: d.change,
        itemStyle: {
          color:
            d.change >= 0
              ? 'linear-gradient(180deg, #4fd1a5, #4fd1a533)'
              : 'linear-gradient(180deg, #ff6b7a, #ff6b7a33)',
          borderRadius: [6, 6, 0, 0],
        },
      })),
    },
  ],
});

// 雷达图：分类最新值
const radarOption = () => {
  const by = trend.value.by_category || [];
  if (by.length === 0) return {};
  const max = Math.max(...by.map((c) => Math.max(...c.values, 0))) * 1.1 || 1;
  return {
    tooltip: {
      valueFormatter: (v) => formatCurrency(v),
      backgroundColor: 'rgba(20,24,40,0.92)',
      borderColor: 'rgba(212,175,106,0.35)',
      textStyle: { color: '#e9ecf5' },
    },
    radar: {
      indicator: by.map((c) => ({ name: c.category, max })),
      axisName: { color: '#c8cfe2', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.01)', 'rgba(255,255,255,0.02)'] } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#d4af6a', width: 2 },
        areaStyle: { color: 'rgba(212,175,106,0.25)' },
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

onMounted(load);
watch([start, end, granularity], load);
</script>

<template>
  <div class="page">
    <!-- 控制栏 -->
    <section class="trend-toolbar">
      <div class="tool-left">
        <span class="tool-label">日期范围</span>
        <input type="date" v-model="start" class="date-input" />
        <span class="sep">~</span>
        <input type="date" v-model="end" class="date-input" />
        <span class="tool-label" style="margin-left: 12px;">粒度</span>
        <div class="seg">
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
        <button class="btn ghost small" @click="start = daysAgoStr(7); end = todayStr()">近 7 天</button>
        <button class="btn ghost small" @click="start = daysAgoStr(30); end = todayStr()">近 30 天</button>
        <button class="btn ghost small" @click="start = daysAgoStr(90); end = todayStr()">近 90 天</button>
        <button class="btn primary small" @click="load">刷新</button>
      </div>
      <div class="tool-right">
        <span class="hint"
          >区间变化：<b :class="netChange >= 0 ? 'pos' : 'neg'"
            >{{ formatSignedCurrency(netChange) }}</b
          >
          <span class="subtle">（{{ formatSignedPercent(netChangePercent) }}）</span></span
        >
      </div>
    </section>

    <div v-if="loading" class="empty">
      <div class="spinner" />
      <div class="empty-text">加载中…</div>
    </div>

    <template v-else>
      <!-- 图表 -->
      <section class="charts-grid">
        <div class="chart-card span-2">
          <div class="chart-title">净资产总额趋势</div>
          <div class="chart-inner" ref="lineChart.el" />
        </div>

        <div class="chart-card span-2">
          <div class="chart-title">分类资产价值（堆叠）</div>
          <div class="chart-inner" ref="stackChart.el" />
        </div>

        <div class="chart-card">
          <div class="chart-title">每日净变化</div>
          <div class="chart-inner" ref="changeChart.el" />
        </div>

        <div class="chart-card">
          <div class="chart-title">期末分类构成</div>
          <div class="chart-inner" ref="radarChart.el" />
        </div>
      </section>

      <!-- 汇总表 -->
      <section class="summary-wrap">
        <div class="summary-header">
          <span class="summary-title">分类区间汇总</span>
          <span class="hint">期初 → 期末 · 变化额 / 变化率</span>
        </div>
        <div class="summary-header summary-row-head">
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
          <div class="col col-cat"><span class="pill">{{ c.category }}</span></div>
          <div class="col align-right">{{ formatCurrency(c.values[0] || 0) }}</div>
          <div class="col align-right">{{ formatCurrency(c.values[c.values.length - 1] || 0) }}</div>
          <div
            class="col align-right"
            :class="(c.values[c.values.length - 1] || 0) - (c.values[0] || 0) >= 0 ? 'pos' : 'neg'"
          >
            {{ formatSignedCurrency((c.values[c.values.length - 1] || 0) - (c.values[0] || 0)) }}
          </div>
          <div
            class="col align-right"
            :class="(c.values[c.values.length - 1] || 0) - (c.values[0] || 0) >= 0 ? 'pos' : 'neg'"
          >
            {{
              c.values[0]
                ? formatSignedPercent(
                    (((c.values[c.values.length - 1] || 0) - c.values[0]) /
                      Math.abs(c.values[0])) *
                      100,
                  )
                : '—'
            }}
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
  gap: 24px;
  animation: fadeUp 0.5s ease both;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.trend-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  flex-wrap: wrap;
  gap: 12px;
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

.sep { color: #8a93ad; }

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

.seg { display: inline-flex; gap: 6px; }
.seg-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
  color: #c8cfe2;
  padding: 7px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 12px;
  letter-spacing: 1px;
  transition: all 0.2s ease;
}
.seg-item.active {
  background: linear-gradient(135deg, #d4af6a, #b98644);
  color: #1a1206;
  border-color: rgba(212, 175, 106, 0.4);
  font-weight: 600;
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
  transition: background 0.2s ease;
}
.btn:hover { background: rgba(255, 255, 255, 0.05); }
.btn.primary { background: linear-gradient(135deg, #d4af6a, #b98644); color: #1a1206; font-weight: 600; }
.btn.ghost { background: transparent; }
.btn.small { padding: 7px 12px; font-size: 12px; }

.hint { color: #8a93ad; font-size: 13px; }
.hint b { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; }
.hint b.pos { color: #4fd1a5; }
.hint b.neg { color: #ff6b7a; }
.hint .subtle { margin-left: 6px; font-size: 12px; color: #8a93ad; }

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.chart-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px 20px 14px;
}
.chart-card.span-2 { grid-column: 1 / -1; }

.chart-title {
  font-size: 12px;
  letter-spacing: 3px;
  color: #8a93ad;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.chart-inner { width: 100%; height: 340px; }

/* 汇总表 */
.summary-wrap {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}

.summary-title {
  font-size: 13px;
  letter-spacing: 3px;
  color: #c8cfe2;
  text-transform: uppercase;
}

.summary-row-head {
  font-size: 11px;
  letter-spacing: 3px;
  color: #8a93ad;
  text-transform: uppercase;
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;
  gap: 16px;
}

.summary-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
}
.summary-row:last-child { border-bottom: none; }

.summary-row .col { color: #e9ecf5; }
.summary-row .col.pos { color: #4fd1a5; }
.summary-row .col.neg { color: #ff6b7a; }

.align-right { text-align: right; }

.pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  color: #c8cfe2;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.03);
  font-family: 'Inter', sans-serif;
}

.empty { padding: 60px 20px; text-align: center; }
.empty-text { margin-top: 8px; color: #8a93ad; font-size: 14px; }
.spinner {
  width: 34px; height: 34px; margin: 0 auto 12px; border-radius: 50%;
  border: 2px solid var(--line); border-top-color: var(--gold); animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 1280px) {
  .charts-grid { grid-template-columns: 1fr; }
}
@media (max-width: 820px) {
  .chart-inner { height: 260px; }
  .summary-row-head, .summary-row { grid-template-columns: 1.4fr 1fr 1fr; }
  .summary-row-head .col:nth-child(4),
  .summary-row-head .col:nth-child(5),
  .summary-row .col:nth-child(4),
  .summary-row .col:nth-child(5) { display: none; }
}
</style>
