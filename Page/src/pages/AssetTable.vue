<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AssetForm from '../components/AssetForm.vue';
import { listAssets, deleteAsset } from '../api/assets.js';
import { formatCurrency, formatPercent, formatDate } from '../utils/format.js';

const tableData = ref([]);
const loading = ref(false);
const keyword = ref('');
const categoryFilter = ref('');
const formVisible = ref(false);
const editingItem = ref(null);

async function load() {
  loading.value = true;
  try {
    const list = await listAssets();
    tableData.value = Array.isArray(list) ? list : [];
  } catch (e) {
    ElMessage.error('加载资产列表失败：' + (e.message || e));
  } finally {
    loading.value = false;
  }
}

const categories = computed(() => {
  const set = new Set();
  tableData.value.forEach((row) => row.category && set.add(row.category));
  return Array.from(set);
});

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const cat = categoryFilter.value;
  return tableData.value.filter((row) => {
    if (cat && row.category !== cat) return false;
    if (!kw) return true;
    return (
      (row.name || '').toLowerCase().includes(kw) ||
      (row.remark || '').toLowerCase().includes(kw) ||
      (row.category || '').toLowerCase().includes(kw)
    );
  });
});

const groupSummary = computed(() => {
  const map = new Map();
  filteredRows.value.forEach((row) => {
    map.set(row.category, (map.get(row.category) || 0) + Number(row.value || 0));
  });
  return map;
});

const total = computed(() =>
  filteredRows.value.reduce((s, r) => s + Number(r.value || 0), 0),
);

const maxAbsValue = computed(() =>
  filteredRows.value.reduce((m, r) => Math.max(m, Math.abs(Number(r.value || 0))), 0),
);

const percentOf = (row) => {
  const base = Math.abs(total.value);
  if (base === 0) return 0;
  return (Number(row.value || 0) / base) * 100;
};

const categoryChips = computed(() => {
  const out = [];
  const map = new Map();
  filteredRows.value.forEach((r) => {
    const cur = map.get(r.category) || { name: r.category, sum: 0, count: 0 };
    cur.sum += Number(r.value || 0);
    cur.count += 1;
    map.set(r.category, cur);
  });
  map.forEach((v) => out.push(v));
  out.sort((a, b) => b.sum - a.sum);
  return out;
});

function handleAdd() {
  editingItem.value = null;
  formVisible.value = true;
}

function handleEdit(row) {
  editingItem.value = { ...row };
  formVisible.value = true;
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除 "${row.name}" 吗？此操作不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
    await deleteAsset(row.id);
    ElMessage.success('已删除');
    load();
  } catch (e) {
    if (e !== 'cancel' && !(e && e.action === 'cancel')) {
      ElMessage.error('删除失败：' + (e.message || e));
    }
  }
}

function onSaved() {
  formVisible.value = false;
  load();
}

function valueTone(row) {
  const v = Number(row.value);
  if (!Number.isFinite(v)) return 'neutral';
  if (v < 0) return 'neg';
  if (v === 0) return 'neutral';
  return 'pos';
}

function barWidth(row) {
  if (maxAbsValue.value === 0) return '0%';
  const ratio = Math.abs(Number(row.value || 0)) / maxAbsValue.value;
  return Math.max(2, ratio * 100).toFixed(2) + '%';
}

function categoryClass(name) {
  const map = { 存款: 'cat-deposit', 投资资产: 'cat-invest', 其他资产: 'cat-other' };
  return map[name] || 'cat-default';
}

onMounted(load);
</script>

<template>
  <div class="page">
    <!-- 总资产卡片 -->
    <section class="hero">
      <div class="hero-card hero-main">
        <div class="hero-sub">NET WORTH · 净资产总额</div>
        <div class="hero-amount">
          <span class="currency">¥</span>
          <span class="number">{{ formatCurrency(total).replace('¥', '') }}</span>
        </div>
        <div class="hero-foot">
          <span>{{ filteredRows.length }} 项记录</span>
          <span class="dot" />
          <span>{{ categories.length }} 个分类</span>
        </div>
      </div>

      <div
        v-for="(chip, i) in categoryChips"
        :key="chip.name"
        class="hero-card hero-chip"
        :class="categoryClass(chip.name)"
        :style="{ animationDelay: (60 + i * 70) + 'ms' }"
      >
        <div class="chip-top">
          <span class="chip-name">{{ chip.name }}</span>
          <span class="chip-count">{{ chip.count }} 项</span>
        </div>
        <div class="chip-value" :class="valueTone(chip)">{{ formatCurrency(chip.sum) }}</div>
        <div class="chip-bar">
          <span
            class="chip-bar-fill"
            :style="{ width: Math.max(4, (Math.abs(chip.sum) / (Math.abs(total.value) || 1)) * 100) + '%' }"
          />
        </div>
        <div class="chip-percent">
          占比 {{ formatPercent((chip.sum / (Math.abs(total.value) || 1)) * 100) }}
        </div>
      </div>
    </section>

    <!-- 操作栏 -->
    <section class="toolbar">
      <div class="toolbar-left">
        <button class="btn primary" @click="handleAdd">
          <span class="plus">＋</span>新增资产
        </button>
        <button class="btn ghost" @click="load">刷新</button>
        <div class="divider" />
        <div class="input-group">
          <span class="input-icon">⌕</span>
          <input
            v-model="keyword"
            class="input"
            placeholder="搜索名称 / 备注 / 类别"
          />
        </div>
        <select v-model="categoryFilter" class="select">
          <option value="">全部类别</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div class="toolbar-right">
        <span class="hint">按价值排序展示 · 点击行直接编辑</span>
      </div>
    </section>

    <!-- 表格 -->
    <section class="table-wrap">
      <div class="table-header">
        <div class="th col-cat">类别</div>
        <div class="th col-name">资产名称</div>
        <div class="th col-value align-right">当前价值</div>
        <div class="th col-share align-right">占比 / 权重</div>
        <div class="th col-date">购买日期</div>
        <div class="th col-price align-right">购买价格</div>
        <div class="th col-note">备注</div>
        <div class="th col-action align-right">操作</div>
      </div>

      <div v-if="loading" class="empty">
        <div class="spinner" />
        <div class="empty-text">加载中…</div>
      </div>

      <div v-else-if="filteredRows.length === 0" class="empty">
        <div class="empty-glyph">◇</div>
        <div class="empty-text">暂无资产记录</div>
        <button class="btn primary small" @click="handleAdd">新增第一项</button>
      </div>

      <template v-else>
        <div
          v-for="(row, idx) in filteredRows"
          :key="row.id"
          class="row"
          :class="{ 'row-even': idx % 2 === 1 }"
          :style="{ animationDelay: (idx * 25) + 'ms' }"
        >
          <div class="col col-cat">
            <span class="pill" :class="categoryClass(row.category)">{{ row.category }}</span>
          </div>
          <div class="col col-name">
            <div class="name">{{ row.name }}</div>
            <div class="name-sub">id · {{ row.id }}</div>
          </div>
          <div class="col col-value align-right">
            <div class="value" :class="valueTone(row)">{{ formatCurrency(row.value) }}</div>
          </div>
          <div class="col col-share">
            <div class="share-row">
              <div class="share-bar">
                <span class="share-fill" :class="valueTone(row)" :style="{ width: barWidth(row) }" />
              </div>
              <span class="share-num" :class="valueTone(row)">
                {{ formatPercent(percentOf(row)) }}
              </span>
            </div>
          </div>
          <div class="col col-date subtle">{{ formatDate(row.purchase_date) }}</div>
          <div class="col col-price align-right subtle">
            {{ row.purchase_price !== null && row.purchase_price !== undefined ? formatCurrency(row.purchase_price) : '—' }}
          </div>
          <div class="col col-note subtle">{{ row.remark || '—' }}</div>
          <div class="col col-action align-right">
            <button class="link" @click="handleEdit(row)">编辑</button>
            <button class="link danger" @click="handleDelete(row)">删除</button>
          </div>
        </div>

        <div class="row row-total">
          <div class="col col-cat"><span class="pill total-pill">合计</span></div>
          <div class="col col-name total-label">{{ filteredRows.length }} 项资产</div>
          <div class="col col-value align-right total-value">{{ formatCurrency(total) }}</div>
          <div class="col col-share">
            <div class="share-row">
              <div class="share-bar"><span class="share-fill pos" style="width:100%" /></div>
              <span class="share-num pos">100.00%</span>
            </div>
          </div>
          <div class="col col-date subtle" colspan="3">
            <span v-for="(sum, cat) in groupSummary" :key="cat" class="mini-sum">
              {{ cat }}：<b>{{ formatCurrency(sum) }}</b>
            </span>
          </div>
          <div class="col col-action" />
        </div>
      </template>
    </section>

    <AssetForm v-model:visible="formVisible" :record="editingItem" @saved="onSaved" />
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

/* Hero 汇总卡片 */
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
  transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
  animation: fadeUp 0.55s ease both;
}

.hero-card:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
  box-shadow: 0 18px 40px -20px rgba(0, 0, 0, 0.6);
}

.hero-main {
  background:
    linear-gradient(135deg, rgba(212, 175, 106, 0.18), rgba(212, 175, 106, 0.04) 45%, transparent 80%),
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
  color: var(--ink-2);
  text-transform: uppercase;
}

.hero-amount {
  margin-top: 12px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hero-amount .currency {
  font-size: 22px;
  color: var(--gold);
  font-family: 'Noto Serif SC', serif;
}

.hero-amount .number {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #fff;
  text-shadow: 0 0 40px rgba(212, 175, 106, 0.25);
}

.hero-foot {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink-2);
  font-size: 13px;
}

.hero-foot .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ink-3);
}

/* 分类卡片 */
.hero-chip .chip-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ink-2);
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.chip-count {
  font-family: 'JetBrains Mono', monospace;
  color: var(--ink-3);
  font-size: 11px;
}

.chip-value {
  margin-top: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.chip-value.pos { color: var(--emerald); }
.chip-value.neg { color: var(--rose); }
.chip-value.neutral { color: var(--ink-1); }

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
  background: linear-gradient(90deg, var(--gold) 0%, var(--gold-2) 100%);
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-chip.cat-invest .chip-bar-fill { background: linear-gradient(90deg, #4fd1a5, #7ee8c2); }
.hero-chip.cat-other .chip-bar-fill { background: linear-gradient(90deg, #7aa6ff, #b3ceff); }
.hero-chip.cat-deposit .chip-bar-fill { background: linear-gradient(90deg, #d4af6a, #f5d98a); }

.chip-percent {
  margin-top: 10px;
  font-size: 12px;
  color: var(--ink-2);
  letter-spacing: 1px;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-right .hint {
  color: var(--ink-3);
  font-size: 12px;
  letter-spacing: 1px;
}

.btn {
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ink-1);
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.05);
}

.btn.primary {
  background: linear-gradient(135deg, #d4af6a, #b98644);
  color: #1a1206;
  border: 1px solid rgba(255, 255, 255, 0.25);
  font-weight: 600;
  box-shadow: 0 10px 24px -12px rgba(212, 175, 106, 0.55);
}

.btn.primary:hover {
  box-shadow: 0 14px 30px -12px rgba(212, 175, 106, 0.7);
}

.btn.ghost {
  background: transparent;
}

.btn.small {
  padding: 7px 12px;
  font-size: 12px;
}

.plus {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
}

.divider {
  width: 1px;
  height: 22px;
  background: var(--line);
  margin: 0 4px;
}

.input-group {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: var(--ink-3);
  font-size: 14px;
  pointer-events: none;
}

.input,
.select {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--line);
  color: var(--ink-0);
  padding: 9px 12px 9px 32px;
  border-radius: 10px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
  width: 240px;
}

.select {
  padding: 9px 12px;
  width: 150px;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-2) 50%),
    linear-gradient(135deg, var(--ink-2) 50%, transparent 50%);
  background-position: calc(100% - 18px) 14px, calc(100% - 12px) 14px;
  background-size: 6px 6px;
  background-repeat: no-repeat;
  padding-right: 30px;
}

.input:focus,
.select:focus {
  border-color: var(--gold);
  background: rgba(212, 175, 106, 0.06);
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
  grid-template-columns: 110px 1.2fr 160px 220px 140px 140px 1.2fr 140px;
  align-items: center;
  padding: 14px 20px;
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--ink-3);
  text-transform: uppercase;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.015);
}

.row {
  display: grid;
  grid-template-columns: 110px 1.2fr 160px 220px 140px 140px 1.2fr 140px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  transition: background 0.2s ease;
  animation: fadeUp 0.4s ease both;
}

.row:hover {
  background: rgba(255, 255, 255, 0.025);
}

.row.row-even {
  background: rgba(255, 255, 255, 0.012);
}

.row.row-total {
  background: linear-gradient(90deg, rgba(212, 175, 106, 0.08), rgba(212, 175, 106, 0.01));
  border-bottom: none;
  padding-top: 18px;
  padding-bottom: 18px;
}

.col {
  min-width: 0;
}

.align-right {
  text-align: right;
}

.subtle {
  color: var(--ink-2);
  font-size: 13px;
}

.pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  border: 1px solid var(--line-strong);
  color: var(--ink-1);
  background: rgba(255, 255, 255, 0.03);
}

.pill.cat-deposit { color: #f5d98a; border-color: rgba(212, 175, 106, 0.4); background: rgba(212, 175, 106, 0.1); }
.pill.cat-invest { color: #8fe7c2; border-color: rgba(79, 209, 165, 0.35); background: rgba(79, 209, 165, 0.08); }
.pill.cat-other { color: #b3ceff; border-color: rgba(122, 166, 255, 0.35); background: rgba(122, 166, 255, 0.08); }
.pill.cat-default { color: var(--ink-1); }

.total-pill {
  color: var(--gold-2);
  border-color: rgba(212, 175, 106, 0.4);
  background: rgba(212, 175, 106, 0.12);
  font-weight: 700;
}

.name {
  font-size: 14px;
  color: var(--ink-0);
  font-weight: 500;
}

.name-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}

.value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.value.pos { color: var(--emerald); }
.value.neg { color: var(--rose); }
.value.neutral { color: var(--ink-0); }

.share-row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.share-bar {
  position: relative;
  width: 140px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.share-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}

.share-fill.pos { background: linear-gradient(90deg, #4fd1a5, #b6f0d8); }
.share-fill.neg { background: linear-gradient(90deg, #ff6b7a, #ffb1b9); }
.share-fill.neutral { background: linear-gradient(90deg, #8a93ad, #c8cfe2); }

.share-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  min-width: 60px;
  text-align: right;
}

.share-num.pos { color: var(--emerald); }
.share-num.neg { color: var(--rose); }
.share-num.neutral { color: var(--ink-2); }

.link {
  background: transparent;
  border: none;
  color: var(--ink-1);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 0.2s ease, background 0.2s ease;
}

.link:hover {
  color: var(--gold-2);
  background: rgba(212, 175, 106, 0.08);
}

.link.danger:hover {
  color: var(--rose);
  background: rgba(255, 107, 122, 0.08);
}

.total-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--gold-2);
  letter-spacing: 0.5px;
}

.total-label {
  color: var(--ink-2);
  font-size: 13px;
}

.mini-sum {
  display: inline-block;
  margin-right: 16px;
  font-size: 12px;
  color: var(--ink-2);
}

.mini-sum b {
  color: var(--gold-2);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  margin-left: 4px;
}

.empty {
  padding: 60px 20px;
  text-align: center;
}

.empty-glyph {
  font-size: 48px;
  color: var(--ink-3);
  opacity: 0.6;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.empty-text {
  margin-top: 8px;
  color: var(--ink-2);
  letter-spacing: 2px;
  font-size: 14px;
  margin-bottom: 18px;
}

.spinner {
  width: 34px;
  height: 34px;
  margin: 0 auto 12px;
  border-radius: 50%;
  border: 2px solid var(--line);
  border-top-color: var(--gold);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式 */
@media (max-width: 1280px) {
  .hero { grid-template-columns: 1fr 1fr; }
  .hero-main { grid-column: 1 / -1; }
}

@media (max-width: 820px) {
  .hero { grid-template-columns: 1fr; }
  .table-header,
  .row {
    grid-template-columns: 90px 1fr 120px 180px 120px;
  }
  .col-date,
  .col-price,
  .col-note {
    display: none;
  }
  .input, .select { width: 100%; }
  .toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
  .toolbar-left { justify-content: flex-start; }
}
</style>
