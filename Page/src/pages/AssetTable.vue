<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import AssetForm from "../components/AssetForm.vue";
import BatchForm from "../components/BatchForm.vue";
import {
  getSnapshot,
  listSnapshotDates,
  deleteAsset,
} from "../api/assets.js";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  todayStr,
} from "../utils/format.js";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function shiftDate(dateStr, delta) {
  if (!dateStr) return todayStr();
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

const snapshotDates = ref([]);
const selectedDate = ref(todayStr());
const snapshot = ref({ assets: [], total: 0, by_category: [] });
const loading = ref(false);
const keyword = ref("");
const categoryFilter = ref("");
const sortKey = ref("value_desc"); // value_desc | value_asc | name | cat | date | price

function goPrevDay() {
  selectedDate.value = shiftDate(selectedDate.value, -1);
}
function goNextDay() {
  selectedDate.value = shiftDate(selectedDate.value, 1);
}
function goToday() {
  selectedDate.value = todayStr();
}

// 单项编辑/删除
const formVisible = ref(false);
const editingItem = ref(null);

// 批量录入弹窗
const batchVisible = ref(false);
const batchInitialDate = ref("");

async function loadDates() {
  try {
    const data = await listSnapshotDates();
    const list = (data && data.dates) || [];
    snapshotDates.value = list;
    if (list.length > 0 && !list.includes(selectedDate.value)) {
      // 首次加载时如果默认日期无快照，回退到最新的快照日期
      if (selectedDate.value === todayStr()) {
        selectedDate.value = list[0];
      }
    }
  } catch (e) {
    snapshotDates.value = [];
  }
}

const recentSnapshotDates = computed(() => {
  // 展示最近 5 个快照日期作为快捷按钮
  return (snapshotDates.value || []).slice(0, 5);
});

async function loadSnapshot() {
  loading.value = true;
  try {
    const data = await getSnapshot(selectedDate.value);
    snapshot.value = data;
  } catch (e) {
    ElMessage.error("加载快照失败：" + (e.message || e));
    snapshot.value = { assets: [], total: 0, by_category: [] };
  } finally {
    loading.value = false;
  }
}

async function initialLoad() {
  await loadDates();
  if (snapshotDates.value.length === 0) {
    snapshot.value = { assets: [], total: 0, by_category: [] };
    return;
  }
  await loadSnapshot();
}

function openBatchForm(targetDate) {
  const isValid = typeof targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(targetDate);
  batchInitialDate.value =
    (isValid ? targetDate : null) || selectedDate.value || todayStr();
  batchVisible.value = true;
}

function editSelectedDate() {
  openBatchForm(selectedDate.value);
}

function onBatchSaved(res) {
  if (res && res.date) {
    selectedDate.value = res.date;
  }
  loadDates().then(loadSnapshot);
}

function handleAddNew() {
  editingItem.value = null;
  formVisible.value = true;
}

const categories = computed(() => {
  const set = new Set();
  snapshot.value.assets.forEach((row) => row.category && set.add(row.category));
  return Array.from(set);
});

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const cat = categoryFilter.value;
  let rows = snapshot.value.assets.filter((row) => {
    if (cat && row.category !== cat) return false;
    if (!kw) return true;
    return (
      (row.name || "").toLowerCase().includes(kw) ||
      (row.remark || "").toLowerCase().includes(kw) ||
      (row.category || "").toLowerCase().includes(kw)
    );
  });

  // 排序
  const key = sortKey.value;
  const copy = [...rows];
  if (key === "value_desc") copy.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  else if (key === "value_asc") copy.sort((a, b) => Number(a.value || 0) - Number(b.value || 0));
  else if (key === "name") copy.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"));
  else if (key === "cat") copy.sort((a, b) => String(a.category || "").localeCompare(String(b.category || ""), "zh-CN"));
  else if (key === "date") copy.sort((a, b) => String(b.purchase_date || "").localeCompare(String(a.purchase_date || "")));
  else if (key === "price") copy.sort((a, b) => Number(b.purchase_price || 0) - Number(a.purchase_price || 0));
  return copy;
});

const groupSummary = computed(() => {
  const map = new Map();
  filteredRows.value.forEach((row) => {
    map.set(row.category, (map.get(row.category) || 0) + Number(row.value || 0));
  });
  return map;
});

const total = computed(() =>
  filteredRows.value.reduce((s, r) => s + Number(r.value || 0), 0)
);

const maxAbsValue = computed(() =>
  filteredRows.value.reduce(
    (m, r) => Math.max(m, Math.abs(Number(r.value || 0))),
    0
  )
);

const percentOf = (row) => {
  const base = Math.abs(total.value);
  if (base === 0) return 0;
  return (Number(row.value || 0) / base) * 100;
};

function valueTone(row) {
  const v = Number(row.value);
  if (!Number.isFinite(v)) return "neutral";
  if (v < 0) return "neg";
  if (v === 0) return "neutral";
  return "pos";
}

function barWidth(row) {
  if (maxAbsValue.value === 0) return "0%";
  const ratio = Math.abs(Number(row.value || 0)) / maxAbsValue.value;
  return Math.max(2, ratio * 100).toFixed(2) + "%";
}

function categoryClass(name) {
  const map = {
    存款: "cat-deposit",
    投资资产: "cat-invest",
    其他资产: "cat-other",
  };
  return map[name] || "cat-default";
}

// 单项编辑
function handleEdit(row) {
  editingItem.value = { ...row };
  formVisible.value = true;
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${row.name}」吗？该资产将从数据库移除，当前日期的快照会在下次录入时更新。`,
      "删除确认",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
      }
    );
    await deleteAsset(row.id);
    ElMessage.success("已删除");
    await loadSnapshot();
  } catch (e) {
    if (e !== "cancel" && !(e && e.action === "cancel")) {
      ElMessage.error("删除失败：" + (e.message || e));
    }
  }
}

function onSaved() {
  formVisible.value = false;
  loadSnapshot();
}

watch(selectedDate, loadSnapshot);

onMounted(initialLoad);
</script>

<template>
  <div class="page">
    <!-- 顶部操作栏 -->
    <section class="action-bar">
      <div class="action-left">
        <button class="btn primary" @click="openBatchForm">
          <span class="btn-icon">＋</span>
          <span>录入 / 编辑 · 批量</span>
        </button>
        <button class="btn ghost" @click="handleAddNew">
          <span class="btn-icon">✎</span>
          <span>新增单项</span>
        </button>

        <div class="date-selector">
          <span class="field-label">按日期查看</span>
          <button class="nav-btn" :disabled="loading" @click="goPrevDay" title="前一天">
            ‹
          </button>
          <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :disabled="loading"
            clearable
            class="date-picker"
          />
          <button class="nav-btn" :disabled="loading" @click="goNextDay" title="后一天">
            ›
          </button>
          <button class="btn ghost small" :disabled="loading" @click="goToday">
            今天
          </button>
          <div v-if="snapshotDates.length > 0" class="quick-dates">
            <button
              v-for="d in recentSnapshotDates"
              :key="d"
              class="quick-date"
              :class="{ active: d === selectedDate }"
              :disabled="loading"
              @click="selectedDate = d"
            >
              {{ formatDate(d) }}
            </button>
          </div>
          <button class="btn ghost small" :disabled="loading" @click="editSelectedDate">
            编辑该日
          </button>
        </div>
      </div>

      <div class="action-right">
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
        <select v-model="sortKey" class="select small">
          <option value="value_desc">价值 高→低</option>
          <option value="value_asc">价值 低→高</option>
          <option value="name">名称</option>
          <option value="cat">类别</option>
          <option value="date">购买日期</option>
          <option value="price">购买价格</option>
        </select>
        <button class="btn ghost" @click="loadSnapshot">刷新</button>
      </div>
    </section>

    <!-- Hero 汇总卡 -->
    <section class="hero">
      <div class="hero-card hero-main">
        <div class="hero-sub">NET WORTH · 净资产总额</div>
        <div class="hero-amount">
          <span class="currency">¥</span>
          <span class="number">{{ formatCurrency(snapshot.total).replace("¥", "") }}</span>
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
          <span class="sep" />
          <div class="hero-foot-item">
            <span class="hero-foot-label">快照日期</span>
            <span class="hero-foot-value gold">{{ formatDate(selectedDate) }}</span>
          </div>
        </div>
      </div>

      <div
        v-for="(chip, i) in snapshot.by_category"
        :key="chip.category"
        class="hero-card hero-chip"
        :class="categoryClass(chip.category)"
        :style="{ animationDelay: (60 + i * 70) + 'ms' }"
      >
        <div class="chip-top">
          <span class="chip-name">{{ chip.category }}</span>
          <span class="chip-pill">{{ formatPercent((chip.sum / (Math.abs(snapshot.total) || 1)) * 100, 1) }}</span>
        </div>
        <div class="chip-value">{{ formatCurrency(chip.sum) }}</div>
        <div class="chip-bar">
          <span
            class="chip-bar-fill"
            :class="categoryClass(chip.category)"
            :style="{ width: Math.max(4, (Math.abs(chip.sum) / (Math.abs(snapshot.total) || 1)) * 100) + '%' }"
          />
        </div>
        <div class="chip-foot">
          <span>{{ formatPercent((chip.sum / (Math.abs(snapshot.total) || 1)) * 100) }} 占比</span>
        </div>
      </div>
    </section>

    <!-- 表格 -->
    <section class="table-wrap">
      <div class="table-scroll">
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

        <div v-else-if="snapshot.assets.length === 0" class="empty">
          <div class="empty-glyph">◇</div>
          <div class="empty-title">暂无资产快照</div>
          <div class="empty-text">点击下方按钮，开始录入您的第一份资产快照</div>
          <button class="btn primary" @click="openBatchForm">
            <span class="btn-icon">＋</span>
            <span>录入今日资产</span>
          </button>
        </div>

        <div v-else-if="filteredRows.length === 0" class="empty">
          <div class="empty-glyph">◎</div>
          <div class="empty-text">没有匹配的记录，请尝试调整搜索条件</div>
        </div>

        <template v-else>
          <div
            v-for="(row, idx) in filteredRows"
            :key="row.id || row.name + idx"
            class="row"
            :class="{ 'row-even': idx % 2 === 1 }"
            :style="{ animationDelay: (idx * 22) + 'ms' }"
          >
            <div class="col col-cat">
              <span class="pill" :class="categoryClass(row.category)">
                {{ row.category }}
              </span>
            </div>
            <div class="col col-name">
              <div class="name">{{ row.name }}</div>
              <div v-if="row.change_amount != null" class="name-sub" :class="row.change_amount >= 0 ? 'pos' : 'neg'">
                变动 {{ row.change_amount >= 0 ? '+' : '' }}{{ formatCurrency(row.change_amount).replace('¥', '¥') }}
              </div>
              <div v-else-if="row.remark && row.remark.length < 20" class="name-sub subtle">{{ row.remark }}</div>
            </div>
            <div class="col col-value align-right">
              <div class="value" :class="valueTone(row)">
                {{ formatCurrency(row.value) }}
              </div>
            </div>
            <div class="col col-share">
              <div class="share-row">
                <div class="share-bar">
                  <span
                    class="share-fill"
                    :class="valueTone(row)"
                    :style="{ width: barWidth(row) }"
                  />
                </div>
                <span class="share-num" :class="valueTone(row)">
                  {{ formatPercent(percentOf(row)) }}
                </span>
              </div>
            </div>
            <div class="col col-date subtle">
              <span class="date-chip">{{ formatDate(row.purchase_date) }}</span>
            </div>
            <div class="col col-price align-right subtle">
              {{ row.purchase_price != null && row.purchase_price !== "" ? formatCurrency(row.purchase_price) : "—" }}
            </div>
            <div class="col col-note subtle">
              <span class="ellipsis">{{ row.remark || "—" }}</span>
            </div>
            <div class="col col-action align-right">
              <button class="link" @click="handleEdit(row)">编辑</button>
              <button class="link danger" @click="handleDelete(row)">删除</button>
            </div>
          </div>
        </template>
      </div>

      <div v-if="filteredRows.length > 0" class="summary">
        <div class="summary-main">
          <span class="pill total-pill">合计</span>
          <span class="summary-label">{{ filteredRows.length }} 项资产</span>
          <span class="summary-bar">
            <span class="summary-bar-fill" />
          </span>
          <span class="summary-value">{{ formatCurrency(total) }}</span>
          <span class="summary-percent">100.00%</span>
        </div>
        <div class="summary-breakdown">
          <span v-for="(sum, cat) in groupSummary" :key="cat" class="mini-sum">
            <i class="dot" :class="categoryClass(cat)" />{{ cat }}：
            <b>{{ formatCurrency(sum) }}</b>
          </span>
        </div>
      </div>
    </section>

    <AssetForm v-model:visible="formVisible" :record="editingItem" @saved="onSaved" />
    <BatchForm
      v-model:visible="batchVisible"
      :initial-date="batchInitialDate"
      @saved="onBatchSaved"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: fadeUp 0.5s ease both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Action Bar */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: var(--shadow-1);
  flex-wrap: wrap;
}

.action-left,
.action-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.field-label {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--ink-2);
  text-transform: uppercase;
}

.date-selector {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding-left: 14px;
  margin-left: 6px;
  border-left: 1px solid var(--line);
  flex-wrap: wrap;
}

.date-selector .date-picker {
  width: 170px;
}

.quick-dates {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding-left: 6px;
  margin-left: 2px;
  border-left: 1px dashed var(--line);
}

.quick-date {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
  color: var(--ink-2);
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.quick-date:hover {
  border-color: rgba(212, 175, 106, 0.4);
  color: var(--gold-2);
}
.quick-date.active {
  background: rgba(212, 175, 106, 0.14);
  border-color: var(--gold);
  color: var(--gold-2);
}

.nav-btn {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
  color: var(--ink-1);
  width: 34px;
  height: 34px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  font-family: "JetBrains Mono", monospace;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.nav-btn:hover:not(:disabled) {
  border-color: rgba(212, 175, 106, 0.4);
  color: var(--gold-2);
  background: rgba(212, 175, 106, 0.08);
}
.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn {
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ink-1);
  padding: 10px 16px;
  border-radius: 11px;
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  font-family: inherit;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(212, 175, 106, 0.3);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: var(--gold);
  font-size: 14px;
}

.btn.primary {
  background: linear-gradient(135deg, #d4af6a, #b98644);
  color: #1a1206;
  border: 1px solid rgba(255, 255, 255, 0.25);
  font-weight: 600;
  box-shadow: var(--shadow-gold);
}
.btn.primary .btn-icon { color: #1a1206; }

.btn.ghost { background: transparent; }

.btn.small {
  padding: 8px 12px;
  font-size: 12px;
}

.input-group {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: var(--ink-2);
  font-size: 14px;
  pointer-events: none;
}

.input,
.select {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--line);
  color: var(--ink-0);
  padding: 10px 14px 10px 34px;
  border-radius: 11px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  font-family: inherit;
  min-width: 180px;
}

.select {
  padding: 10px 30px 10px 12px;
  min-width: 130px;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-2) 50%),
    linear-gradient(135deg, var(--ink-2) 50%, transparent 50%);
  background-position: calc(100% - 18px) 15px, calc(100% - 12px) 15px;
  background-size: 6px 6px;
  background-repeat: no-repeat;
  background-color: rgba(0, 0, 0, 0.25);
}
.select.small { min-width: 110px; }

.input:focus,
.select:focus {
  border-color: var(--gold);
  background: var(--gold-soft);
  box-shadow: 0 0 0 3px rgba(212, 175, 106, 0.15);
}

/* Hero */
.hero {
  display: grid;
  grid-template-columns: 1.6fr repeat(3, 1fr);
  gap: 16px;
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
  min-width: 0;
  box-shadow: var(--shadow-1);
}

.hero-card:hover {
  transform: translateY(-2px);
  border-color: rgba(212, 175, 106, 0.25);
  box-shadow: 0 18px 40px -20px rgba(0, 0, 0, 0.6);
}

.hero-main {
  background: linear-gradient(
      135deg,
      rgba(212, 175, 106, 0.18),
      rgba(212, 175, 106, 0.04) 45%,
      transparent 80%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
  border: 1px solid rgba(212, 175, 106, 0.35);
}

.hero-main::before {
  content: "";
  position: absolute;
  right: -60px;
  top: -60px;
  width: 220px;
  height: 220px;
  background: radial-gradient(closest-side, rgba(245, 217, 138, 0.35), transparent);
  filter: blur(10px);
  animation: heroGlow 4s ease-in-out infinite alternate;
}
@keyframes heroGlow {
  from { opacity: 0.6; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1.05); }
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

.hero-amount .currency {
  font-size: 22px;
  color: var(--gold-2);
  font-family: "Noto Serif SC", serif;
  font-weight: 700;
}

.hero-amount .number {
  font-family: "JetBrains Mono", monospace;
  font-size: 38px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #fff;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.hero-foot {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--ink-2);
  font-size: 12px;
  flex-wrap: wrap;
  padding-top: 14px;
  border-top: 1px dashed rgba(255, 255, 255, 0.06);
}

.hero-foot-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hero-foot-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--ink-3);
  text-transform: uppercase;
}
.hero-foot-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  color: var(--ink-0);
  font-weight: 600;
}
.hero-foot-value.gold { color: var(--gold-2); }

.sep {
  width: 1px;
  height: 22px;
  background: var(--line);
}

.chip-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--ink-2);
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  min-width: 0;
}

.chip-top > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Noto Serif SC', serif;
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--ink-1);
  text-transform: none;
  font-size: 14px;
}

.chip-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--gold);
  background: rgba(212, 175, 106, 0.1);
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid rgba(212, 175, 106, 0.2);
}

.chip-value {
  margin-top: 12px;
  font-family: "JetBrains Mono", monospace;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.5px;
  overflow-wrap: anywhere;
  word-break: break-all;
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
.chip-bar-fill.cat-deposit { background: linear-gradient(90deg, var(--gold), var(--gold-2)); }

.chip-foot {
  margin-top: 10px;
  font-size: 11px;
  color: var(--ink-2);
  letter-spacing: 1px;
}

/* Table */
.table-wrap {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--shadow-1);
}

.table-scroll {
  overflow-x: auto;
  min-width: 0;
}

.table-scroll::-webkit-scrollbar {
  height: 8px;
}

.table-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}

.table-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(212, 175, 106, 0.3);
}

.table-header {
  display: grid;
  grid-template-columns: 110px 1.3fr 150px 220px 130px 140px 1.2fr 120px;
  align-items: center;
  padding: 14px 22px;
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--ink-2);
  text-transform: uppercase;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  min-width: 1080px;
}

.row {
  display: grid;
  grid-template-columns: 110px 1.3fr 150px 220px 130px 140px 1.2fr 120px;
  align-items: center;
  padding: 16px 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.2s ease;
  animation: fadeUp 0.4s ease both;
  min-width: 1080px;
}

.row:hover { background: rgba(212, 175, 106, 0.04); }
.row.row-even { background: rgba(255, 255, 255, 0.012); }
.row.row-even:hover { background: rgba(212, 175, 106, 0.05); }

.col { min-width: 0; }
.align-right { text-align: right; }
.subtle { color: var(--ink-2); font-size: 13px; }

.date-chip {
  display: inline-block;
  padding: 3px 9px;
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

/* 合计 */
.summary {
  padding: 18px 22px;
  background: linear-gradient(90deg, rgba(212, 175, 106, 0.08), rgba(212, 175, 106, 0.01));
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid var(--line);
}

.summary-main {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  align-items: center;
  gap: 16px;
}

.summary-label { color: var(--ink-2); font-size: 13px; letter-spacing: 1px; }

.summary-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 22px;
  font-weight: 700;
  color: var(--gold-2);
  letter-spacing: 0.5px;
  text-align: right;
  overflow-wrap: anywhere;
}

.summary-bar {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.summary-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--gold), var(--gold-2));
  width: 100%;
}

.summary-percent {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  color: var(--ink-1);
  text-align: right;
}

.summary-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.06);
  padding-top: 12px;
}

.mini-sum {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-2);
  letter-spacing: 0.5px;
}

.mini-sum b {
  color: var(--ink-0);
  font-family: "JetBrains Mono", monospace;
  font-weight: 600;
  margin-left: 2px;
}

.mini-sum .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-3);
}
.mini-sum .dot.cat-deposit { background: var(--gold); }
.mini-sum .dot.cat-invest { background: var(--emerald); }
.mini-sum .dot.cat-other { background: #7aa6ff; }

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

.total-pill {
  color: var(--gold-2);
  border-color: rgba(212, 175, 106, 0.45);
  background: rgba(212, 175, 106, 0.15);
  font-weight: 700;
}

.name { font-size: 14px; color: var(--ink-0); font-weight: 500; }
.name-sub {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--ink-2);
  margin-top: 3px;
  letter-spacing: 0.5px;
}
.name-sub.pos { color: var(--emerald); }
.name-sub.neg { color: var(--rose); }

.value {
  font-family: "JetBrains Mono", monospace;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.value.pos { color: var(--emerald); }
.value.neg { color: var(--rose); }
.value.neutral { color: var(--ink-0); }

.share-row {
  display: flex;
  align-items: center;
  gap: 14px;
  justify-content: flex-end;
}

.share-bar {
  position: relative;
  width: 160px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.share-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}

.share-fill.pos { background: linear-gradient(90deg, var(--emerald), #b6f0d8); }
.share-fill.neg { background: linear-gradient(90deg, var(--rose), #ffb1b9); }
.share-fill.neutral { background: linear-gradient(90deg, var(--ink-2), var(--ink-1)); }

.share-num {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  min-width: 60px;
  text-align: right;
}
.share-num.pos { color: var(--emerald); }
.share-num.neg { color: var(--rose); }
.share-num.neutral { color: var(--ink-2); }

.link {
  background: transparent;
  border: 1px solid transparent;
  color: var(--ink-1);
  cursor: pointer;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 8px;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  font-family: inherit;
  margin-left: 4px;
}

.link:hover {
  color: var(--gold-2);
  background: rgba(212, 175, 106, 0.12);
  border-color: rgba(212, 175, 106, 0.3);
}
.link.danger:hover { color: var(--rose); background: rgba(255, 107, 122, 0.1); border-color: rgba(255, 107, 122, 0.3); }

.empty {
  padding: 68px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-glyph {
  font-size: 56px;
  color: var(--ink-2);
  opacity: 0.5;
  animation: pulse 2.2s ease-in-out infinite;
  line-height: 1;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.96); }
  50% { opacity: 0.7; transform: scale(1.04); }
}

.empty-title {
  font-size: 17px;
  color: var(--ink-0);
  font-weight: 600;
  letter-spacing: 2px;
}

.empty-text {
  color: var(--ink-2);
  letter-spacing: 1px;
  font-size: 13px;
  margin-bottom: 8px;
  max-width: 420px;
}

.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: var(--gold);
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 1280px) {
  .hero { grid-template-columns: 1fr 1fr; }
  .hero-main { grid-column: 1 / -1; }
  .hero-amount .number { font-size: 32px; }
}

@media (max-width: 820px) {
  .hero { grid-template-columns: 1fr; }
  .table-header, .row { grid-template-columns: 90px 1fr 120px 180px 120px; }
  .col-date, .col-price, .col-note { display: none; }
  .input, .select { width: 100%; min-width: 0; }
  .action-bar { flex-direction: column; align-items: stretch; }
  .action-left, .action-right { justify-content: flex-start; }
}
</style>
