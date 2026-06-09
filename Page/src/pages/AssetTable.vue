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

const snapshotDates = ref([]);
const selectedDate = ref(todayStr());
const snapshot = ref({ assets: [], total: 0, by_category: [] });
const loading = ref(false);
const keyword = ref("");
const categoryFilter = ref("");

// 单项编辑/删除（兼容旧行为）
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
      selectedDate.value = list[0];
    }
  } catch (e) {
    snapshotDates.value = [];
  }
}

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
    // 完全没有历史数据：展示空态
    snapshot.value = { assets: [], total: 0, by_category: [] };
    return;
  }
  await loadSnapshot();
}

function openBatchForm(targetDate) {
  batchInitialDate.value = targetDate || selectedDate.value || todayStr();
  batchVisible.value = true;
}

function editSelectedDate() {
  openBatchForm(selectedDate.value);
}

function onBatchSaved(res) {
  // 保存后刷新日期列表 & 当前快照
  if (res && res.date) {
    selectedDate.value = res.date;
  }
  loadDates().then(loadSnapshot);
}

const categories = computed(() => {
  const set = new Set();
  snapshot.value.assets.forEach((row) => row.category && set.add(row.category));
  return Array.from(set);
});

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const cat = categoryFilter.value;
  return snapshot.value.assets.filter((row) => {
    if (cat && row.category !== cat) return false;
    if (!kw) return true;
    return (
      (row.name || "").toLowerCase().includes(kw) ||
      (row.remark || "").toLowerCase().includes(kw) ||
      (row.category || "").toLowerCase().includes(kw)
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

const heroChips = computed(() => {
  const out = [];
  snapshot.value.by_category.forEach((c) => {
    out.push(c);
  });
  return out;
});

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
      `确认删除 "${row.name}" 吗？将从资产主表中移除；当前日期的快照将在下次录入时更新。`,
      "删除确认",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
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
    <!-- 操作入口 -->
    <section class="action-bar">
      <div class="action-left">
        <button class="btn primary" @click="openBatchForm()">
          <span class="plus">＋</span> 录入 / 编辑 今日资产（批量）
        </button>
        <div class="date-selector">
          <label class="label">按日期查看</label>
          <select v-model="selectedDate" class="select" :disabled="loading">
            <option v-for="d in snapshotDates" :key="d" :value="d">
              {{ formatDate(d) }}
            </option>
          </select>
          <button class="btn ghost small" @click="editSelectedDate" :disabled="snapshotDates.length === 0">
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
        <button class="btn ghost" @click="loadSnapshot">刷新</button>
      </div>
    </section>

    <!-- 总资产卡片 -->
    <section class="hero">
      <div class="hero-card hero-main">
        <div class="hero-sub">NET WORTH · 净资产总额</div>
        <div class="hero-amount">
          <span class="currency">¥</span>
          <span class="number">{{ formatCurrency(snapshot.total).replace("¥", "") }}</span>
        </div>
        <div class="hero-foot">
          <span>{{ snapshot.assets.length }} 项记录</span>
          <span class="dot" />
          <span>{{ snapshot.by_category.length }} 个分类</span>
          <span class="dot" />
          <span class="date-label">{{ formatDate(selectedDate) }}</span>
        </div>
      </div>

      <div
        v-for="(chip, i) in heroChips"
        :key="chip.category"
        class="hero-card hero-chip"
        :class="categoryClass(chip.category)"
        :style="{ animationDelay: (60 + i * 70) + 'ms' }"
      >
        <div class="chip-top">
          <span class="chip-name">{{ chip.category }}</span>
        </div>
        <div class="chip-value">{{ formatCurrency(chip.sum) }}</div>
        <div class="chip-bar">
          <span
            class="chip-bar-fill"
            :style="{
              width:
                Math.max(4, (Math.abs(chip.sum) / (Math.abs(snapshot.total) || 1)) * 100) +
                '%',
            }"
          />
        </div>
        <div class="chip-percent">
          占比 {{ formatPercent((chip.sum / (Math.abs(snapshot.total) || 1)) * 100) }}
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
          <div class="empty-text">暂无资产快照 · 请点击上方「批量录入」</div>
          <button class="btn primary small" @click="openBatchForm">录入今日资产</button>
        </div>

        <div v-else-if="filteredRows.length === 0" class="empty">
          <div class="empty-glyph">◇</div>
          <div class="empty-text">没有匹配的记录</div>
        </div>

        <template v-else>
          <div
            v-for="(row, idx) in filteredRows"
            :key="row.id || row.name + idx"
            class="row"
            :class="{ 'row-even': idx % 2 === 1 }"
            :style="{ animationDelay: (idx * 25) + 'ms' }"
          >
            <div class="col col-cat">
              <span class="pill" :class="categoryClass(row.category)">
                {{ row.category }}
              </span>
            </div>
            <div class="col col-name">
              <div class="name">{{ row.name }}</div>
              <div v-if="row.change_amount != null" class="name-sub">
                变动 {{ row.change_amount >= 0 ? "+" : "" }}
                {{ formatCurrency(row.change_amount).replace("¥", "¥") }}
              </div>
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
            <div class="col col-date subtle">{{ formatDate(row.purchase_date) }}</div>
            <div class="col col-price align-right subtle">
              {{ row.purchase_price != null && row.purchase_price !== "" ? formatCurrency(row.purchase_price) : "—" }}
            </div>
            <div class="col col-note subtle">{{ row.remark || "—" }}</div>
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
          <span class="summary-value">{{ formatCurrency(total) }}</span>
          <span class="summary-bar">
            <span class="summary-bar-fill" />
          </span>
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

/* 操作栏 */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  flex-wrap: wrap;
}

.action-left,
.action-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.label {
  font-size: 12px;
  letter-spacing: 2px;
  color: #8a93ad;
  text-transform: uppercase;
}

.date-selector {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
  color: #c8cfe2;
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s, border-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-family: inherit;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.05);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: linear-gradient(135deg, #d4af6a, #b98644);
  color: #1a1206;
  border: 1px solid rgba(255, 255, 255, 0.25);
  font-weight: 600;
  box-shadow: 0 10px 24px -12px rgba(212, 175, 106, 0.55);
}

.btn.ghost { background: transparent; }

.btn.small {
  padding: 7px 12px;
  font-size: 12px;
}

.plus {
  font-family: "JetBrains Mono", monospace;
  font-weight: 700;
}

.input-group {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: #8a93ad;
  font-size: 14px;
  pointer-events: none;
}

.input,
.select {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e9ecf5;
  padding: 9px 12px 9px 32px;
  border-radius: 10px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  font-family: inherit;
  min-width: 160px;
}

.select {
  padding: 9px 30px 9px 12px;
  min-width: 120px;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, #8a93ad 50%),
    linear-gradient(135deg, #8a93ad 50%, transparent 50%);
  background-position: calc(100% - 18px) 14px, calc(100% - 12px) 14px;
  background-size: 6px 6px;
  background-repeat: no-repeat;
  background-color: rgba(0, 0, 0, 0.25);
}

.input:focus,
.select:focus {
  border-color: #d4af6a;
  background: rgba(212, 175, 106, 0.06);
}

/* Hero 卡片 */
.hero {
  display: grid;
  grid-template-columns: 1.6fr repeat(3, 1fr);
  gap: 16px;
}

.hero-card {
  position: relative;
  padding: 20px 22px;
  border-radius: 16px;
  background: #121829;
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
  animation: fadeUp 0.55s ease both;
  min-width: 0;
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
  margin-top: 10px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hero-amount .currency {
  font-size: 20px;
  color: #f5d98a;
  font-family: "Noto Serif SC", serif;
}

.hero-amount .number {
  font-family: "JetBrains Mono", monospace;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #fff;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.hero-foot {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #8a93ad;
  font-size: 12px;
  flex-wrap: wrap;
}

.hero-foot .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #5b6478;
}

.date-label {
  color: #f5d98a;
  font-family: "JetBrains Mono", monospace;
}

.chip-top {
  display: flex;
  justify-content: space-between;
  color: #8a93ad;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  min-width: 0;
}

.chip-top > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-value {
  margin-top: 10px;
  font-family: "JetBrains Mono", monospace;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
  overflow-wrap: anywhere;
  word-break: break-all;
  color: #e9ecf5;
}

.chip-bar {
  margin-top: 12px;
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

.hero-chip.cat-invest .chip-bar-fill { background: linear-gradient(90deg, #4fd1a5, #7ee8c2); }
.hero-chip.cat-other .chip-bar-fill { background: linear-gradient(90deg, #7aa6ff, #b3ceff); }
.hero-chip.cat-deposit .chip-bar-fill { background: linear-gradient(90deg, #d4af6a, #f5d98a); }

.chip-percent {
  margin-top: 8px;
  font-size: 12px;
  color: #8a93ad;
  letter-spacing: 1px;
}

/* 表格 */
.table-wrap {
  background: #121829;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  overflow: hidden;
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
  background: rgba(255, 255, 255, 0.15);
}

.table-header {
  display: grid;
  grid-template-columns: 110px 1.3fr 150px 200px 130px 140px 1.2fr 120px;
  align-items: center;
  padding: 12px 20px;
  font-size: 11px;
  letter-spacing: 3px;
  color: #8a93ad;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.015);
  min-width: 1080px;
}

.row {
  display: grid;
  grid-template-columns: 110px 1.3fr 150px 200px 130px 140px 1.2fr 120px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.2s;
  animation: fadeUp 0.4s ease both;
  min-width: 1080px;
}

.row:hover { background: rgba(255, 255, 255, 0.025); }
.row.row-even { background: rgba(255, 255, 255, 0.012); }

.col { min-width: 0; }
.align-right { text-align: right; }
.subtle { color: #8a93ad; font-size: 13px; }

/* 合计 */
.summary {
  padding: 16px 20px;
  background: linear-gradient(
    90deg,
    rgba(212, 175, 106, 0.08),
    rgba(212, 175, 106, 0.01)
  );
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary-main {
  display: grid;
  grid-template-columns: auto auto 1fr 220px 80px;
  align-items: center;
  gap: 14px;
}

.summary-label { color: #8a93ad; font-size: 13px; letter-spacing: 1px; }

.summary-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 20px;
  font-weight: 700;
  color: #f5d98a;
  letter-spacing: 0.5px;
  text-align: right;
  overflow-wrap: anywhere;
}

.summary-bar {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.summary-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #d4af6a, #f5d98a);
}

.summary-percent {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  color: #c8cfe2;
  text-align: right;
}

.summary-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  padding-top: 10px;
}

.mini-sum {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8a93ad;
  letter-spacing: 0.5px;
}

.mini-sum b {
  color: #e9ecf5;
  font-family: "JetBrains Mono", monospace;
  font-weight: 600;
  margin-left: 2px;
}

.mini-sum .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5b6478;
}
.mini-sum .dot.cat-deposit { background: #d4af6a; }
.mini-sum .dot.cat-invest { background: #4fd1a5; }
.mini-sum .dot.cat-other { background: #7aa6ff; }

.pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #c8cfe2;
  background: rgba(255, 255, 255, 0.03);
}

.pill.cat-deposit { color: #f5d98a; border-color: rgba(212, 175, 106, 0.4); background: rgba(212, 175, 106, 0.1); }
.pill.cat-invest { color: #8fe7c2; border-color: rgba(79, 209, 165, 0.35); background: rgba(79, 209, 165, 0.08); }
.pill.cat-other { color: #b3ceff; border-color: rgba(122, 166, 255, 0.35); background: rgba(122, 166, 255, 0.08); }

.total-pill {
  color: #f5d98a;
  border-color: rgba(212, 175, 106, 0.4);
  background: rgba(212, 175, 106, 0.12);
  font-weight: 700;
}

.name { font-size: 14px; color: #e9ecf5; font-weight: 500; }
.name-sub {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #8a93ad;
  margin-top: 2px;
}

.value {
  font-family: "JetBrains Mono", monospace;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.value.pos { color: #4fd1a5; }
.value.neg { color: #ff6b7a; }
.value.neutral { color: #e9ecf5; }

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
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  min-width: 60px;
  text-align: right;
}
.share-num.pos { color: #4fd1a5; }
.share-num.neg { color: #ff6b7a; }
.share-num.neutral { color: #8a93ad; }

.link {
  background: transparent;
  border: none;
  color: #c8cfe2;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
  font-family: inherit;
}

.link:hover { color: #f5d98a; background: rgba(212, 175, 106, 0.08); }
.link.danger:hover { color: #ff6b7a; background: rgba(255, 107, 122, 0.08); }

.empty {
  padding: 60px 20px;
  text-align: center;
}

.empty-glyph {
  font-size: 48px;
  color: #8a93ad;
  opacity: 0.6;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.empty-text {
  margin-top: 8px;
  color: #8a93ad;
  letter-spacing: 2px;
  font-size: 14px;
  margin-bottom: 18px;
}

.spinner {
  width: 34px;
  height: 34px;
  margin: 0 auto 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: #d4af6a;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

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
  .col-date, .col-price, .col-note { display: none; }
  .input, .select { width: 100%; }
  .action-bar { flex-direction: column; align-items: stretch; }
  .action-left, .action-right { justify-content: flex-start; }
}
</style>
