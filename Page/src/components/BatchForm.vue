<script setup>
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  getSnapshot,
  listSnapshotDates,
  saveBatchSnapshot,
} from "../api/assets.js";
import { todayStr, formatDate, formatCurrency } from "../utils/format.js";

const props = defineProps({
  visible: { type: Boolean, default: false },
  initialDate: { type: String, default: "" },
  defaultCategory: { type: String, default: "存款" },
});

const emit = defineEmits(["update:visible", "saved"]);

const categoryOptions = ["存款", "投资资产", "其他资产"];

const date = ref(todayStr());
const formAssets = ref([]);
const saving = ref(false);
const errors = ref({});
const latestDate = ref("");
const latestTotal = ref(0);

function emptyRow() {
  return {
    id: null,
    category: props.defaultCategory || "存款",
    name: "",
    value: "",
    purchase_date: "",
    purchase_price: "",
    remark: "",
  };
}

function close() {
  emit("update:visible", false);
}

async function open() {
  date.value = props.initialDate || todayStr();
  errors.value = {};
  // 先取已有的快照日期，决定用哪个作为预填数据
  try {
    const data = await listSnapshotDates();
    const list = (data && data.dates) || [];
    // 优先用最近的日期作为预填；若无历史，则取主表 GET /assets
    if (list.length > 0) {
      latestDate.value = list[0];
    } else {
      latestDate.value = "";
    }
  } catch (e) {
    latestDate.value = "";
  }
  await resetToLatest();
}

async function resetToLatest() {
  try {
    if (latestDate.value) {
      const snap = await getSnapshot(latestDate.value);
      latestTotal.value = snap.total || 0;
      formAssets.value = (snap.assets || []).map((a) => ({
        id: a.id || null,
        category: a.category || "存款",
        name: a.name || "",
        value: formatInputValue(a.value),
        purchase_date: a.purchase_date || "",
        purchase_price:
          a.purchase_price != null && a.purchase_price !== ""
            ? formatInputValue(a.purchase_price)
            : "",
        remark: a.remark || "",
      }));
    } else {
      // 无历史数据，提供一行空模板
      latestTotal.value = 0;
      formAssets.value = [emptyRow()];
    }
  } catch (e) {
    latestTotal.value = 0;
    formAssets.value = [emptyRow()];
    ElMessage.warning("获取最新快照失败，已重置为空表单");
  }
}

function formatInputValue(v) {
  const num = Number(v);
  if (!Number.isFinite(num)) return "";
  // 避免科学计数法 & 去除多余 0
  if (Number.isInteger(num)) return String(num);
  return String(Math.round(num * 100) / 100);
}

function addRow() {
  formAssets.value.push(emptyRow());
}

function removeRow(index) {
  if (formAssets.value.length <= 1) return;
  formAssets.value.splice(index, 1);
}

const currentTotal = computed(() => {
  let sum = 0;
  for (const a of formAssets.value) {
    const num = Number(a.value);
    if (Number.isFinite(num)) sum += num;
  }
  return sum;
});

const diffHint = computed(() => {
  if (!latestTotal.value) return null;
  const diff = currentTotal.value - Number(latestTotal.value);
  if (Math.abs(diff) < 0.005) return "与预填总值一致";
  return `${diff >= 0 ? "较预填 +" : "较预填 -"}${formatCurrency(
    Math.abs(diff)
  )}`;
});

function validate() {
  errors.value = {};
  const errs = {};
  const seen = new Set();
  formAssets.value.forEach((a, i) => {
    if (!a.category || !String(a.category).trim()) {
      errs[i] = errs[i] || {};
      errs[i].category = "请选择类别";
    }
    if (!a.name || !String(a.name).trim()) {
      errs[i] = errs[i] || {};
      errs[i].name = "请输入名称";
    } else {
      const key = `${String(a.category).trim()}|${String(a.name).trim()}`;
      if (seen.has(key)) {
        errs[i] = errs[i] || {};
        errs[i].name = "该分类下名称重复";
      }
      seen.add(key);
    }
    const num = Number(a.value);
    if (a.value === "" || a.value === null || !Number.isFinite(num)) {
      errs[i] = errs[i] || {};
      errs[i].value = "请输入有效数字";
    }
    const pp = a.purchase_price;
    if (pp !== "" && pp !== null && pp !== undefined) {
      const ppNum = Number(pp);
      if (!Number.isFinite(ppNum)) {
        errs[i] = errs[i] || {};
        errs[i].purchase_price = "购买价格须为数字";
      }
    }
    const pd = String(a.purchase_date ?? "").trim();
    if (pd !== "" && !/^\d{4}(-\d{1,2}(-\d{1,2})?)?$/.test(pd)) {
      errs[i] = errs[i] || {};
      errs[i].purchase_date = "格式：2023 / 2023-06 / 2023-06-09";
    }
  });
  errors.value = errs;
  return Object.keys(errs).length === 0;
}

async function submit() {
  if (!validate()) {
    ElMessage.error("表单有错误，请检查红色提示");
    return;
  }
  saving.value = true;
  try {
    const payload = formAssets.value.map((a) => ({
      id: a.id || null,
      category: String(a.category).trim(),
      name: String(a.name).trim(),
      value: Number(a.value),
      purchase_date: a.purchase_date || null,
      purchase_price:
        a.purchase_price !== "" &&
        a.purchase_price !== null &&
        a.purchase_price !== undefined
          ? Number(a.purchase_price)
          : null,
      remark: a.remark || null,
    }));
    const res = await saveBatchSnapshot(date.value, payload);
    ElMessage.success(`已保存 ${res.assets.length} 项，${formatDate(res.date)} 总额 ${formatCurrency(res.total)}`);
    emit("saved", res);
    close();
  } catch (e) {
    const msg =
      (e && e.response && e.response.data && e.response.data.error) ||
      e.message ||
      "保存失败";
    errors.value = { _server: msg };
    ElMessage.error(msg);
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) open();
  }
);
</script>

<template>
  <transition name="modal">
    <div v-if="visible" class="modal-root" @click.self="close">
      <div class="modal">
        <div class="modal-head">
          <div>
            <div class="eyebrow">BATCH ENTRY · 按日批量录入</div>
            <h3 class="modal-title">录入 {{ formatDate(date) }} 的资产快照</h3>
          </div>
          <button class="icon-close" @click="close" aria-label="关闭">×</button>
        </div>

        <div class="modal-body">
          <div class="date-control">
            <label class="label">录入日期</label>
            <div class="date-input-group">
              <input type="date" v-model="date" class="field-input" />
              <button class="btn ghost small" @click="resetToLatest">
                重置为最新预填
              </button>
            </div>
            <p class="hint">
              已使用
              <span v-if="latestDate">{{ formatDate(latestDate) }}（总值 {{ formatCurrency(latestTotal) }}）</span>
              <span v-else>空表单</span>
              预填
              <span v-if="diffHint" class="diff">· {{ diffHint }}</span>
            </p>
          </div>

          <div class="assets-table">
            <div class="table-header">
              <div class="th col-index">#</div>
              <div class="th col-category">类别</div>
              <div class="th col-name">资产名称</div>
              <div class="th col-value">当前价值</div>
              <div class="th col-price">购买价格</div>
              <div class="th col-date">购买日期</div>
              <div class="th col-remark">备注</div>
              <div class="th col-action">操作</div>
            </div>

            <div class="table-body">
              <div
                v-for="(item, index) in formAssets"
                :key="index"
                class="table-row"
                :class="{ 'row-error': errors[index] }"
              >
                <div class="col col-index">{{ index + 1 }}</div>
                <div class="col col-category">
                  <select v-model="item.category" class="field-input">
                    <option v-for="opt in categoryOptions" :key="opt" :value="opt">
                      {{ opt }}
                    </option>
                  </select>
                  <div v-if="errors[index] && errors[index].category" class="err-text">
                    {{ errors[index].category }}
                  </div>
                </div>
                <div class="col col-name">
                  <input
                    v-model="item.name"
                    class="field-input"
                    placeholder="资产名称"
                  />
                  <div v-if="errors[index] && errors[index].name" class="err-text">
                    {{ errors[index].name }}
                  </div>
                </div>
                <div class="col col-value">
                  <div class="field-input money">
                    <span class="prefix">¥</span>
                    <input
                      type="text"
                      inputmode="decimal"
                      v-model="item.value"
                      placeholder="0.00"
                    />
                  </div>
                  <div v-if="errors[index] && errors[index].value" class="err-text">
                    {{ errors[index].value }}
                  </div>
                </div>
                <div class="col col-price">
                  <div class="field-input money">
                    <span class="prefix">¥</span>
                    <input
                      type="text"
                      inputmode="decimal"
                      v-model="item.purchase_price"
                      placeholder="可选"
                    />
                  </div>
                  <div v-if="errors[index] && errors[index].purchase_price" class="err-text">
                    {{ errors[index].purchase_price }}
                  </div>
                </div>
                <div class="col col-date">
                  <input
                    v-model="item.purchase_date"
                    class="field-input"
                    placeholder="2023 / 2023-06 / 2023-06-09"
                  />
                  <div v-if="errors[index] && errors[index].purchase_date" class="err-text">
                    {{ errors[index].purchase_date }}
                  </div>
                </div>
                <div class="col col-remark">
                  <input v-model="item.remark" class="field-input" placeholder="备注" />
                </div>
                <div class="col col-action">
                  <button
                    class="link danger"
                    @click="removeRow(index)"
                    :disabled="formAssets.length <= 1"
                  >
                    删除
                  </button>
                </div>
              </div>

              <div class="table-footer-row">
                <button class="btn ghost add-row" @click="addRow">
                  <span class="plus">＋</span> 添加资产行
                </button>
              </div>
            </div>
          </div>

          <div class="footer-summary">
            <div>
              共 <b>{{ formAssets.length }}</b> 项 · 总额
              <b class="total">{{ formatCurrency(currentTotal) }}</b>
            </div>
            <p v-if="errors._server" class="error server">{{ errors._server }}</p>
          </div>
        </div>

        <div class="modal-foot">
          <button class="btn ghost" @click="close">取消</button>
          <button class="btn primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="mini-spinner" />
            <span>保存为 {{ formatDate(date) }} 快照</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-root {
  position: fixed;
  inset: 0;
  background: rgba(3, 7, 16, 0.65);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal {
  background: #121829;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  width: min(1080px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.6);
}

.modal-head {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  background: linear-gradient(180deg, rgba(212, 175, 106, 0.06), transparent);
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 3px;
  color: #8a93ad;
  text-transform: uppercase;
}

.modal-title {
  margin: 6px 0 0;
  font-size: 20px;
  color: #f5d98a;
  font-weight: 600;
}

.icon-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #c8cfe2;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  font-size: 18px;
  cursor: pointer;
}
.icon-close:hover {
  background: rgba(255, 255, 255, 0.05);
}

.modal-body {
  padding: 18px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.date-control {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  letter-spacing: 2px;
  color: #8a93ad;
  text-transform: uppercase;
}

.date-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.field-input {
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e9ecf5;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
}

.field-input:focus {
  border-color: rgba(212, 175, 106, 0.55);
  background: rgba(212, 175, 106, 0.08);
  box-shadow: 0 0 0 3px rgba(212, 175, 106, 0.12);
}

.field-input.money {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 38px;
  width: 100%;
}

.field-input.money .prefix {
  color: #d4af6a;
  font-family: "Noto Serif SC", serif;
  font-size: 13px;
}

.field-input.money input {
  background: transparent;
  border: none;
  color: #e9ecf5;
  outline: none;
  width: 100%;
  font-size: 14px;
  font-family: "JetBrains Mono", monospace;
}

.hint {
  margin: 0;
  color: #8a93ad;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.hint .diff {
  color: #4fd1a5;
  margin-left: 6px;
}

.assets-table {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  min-height: 260px;
  background: rgba(0, 0, 0, 0.15);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.table-header {
  display: grid;
  grid-template-columns: 48px 130px 1.3fr 140px 130px 170px 1fr 80px;
  align-items: center;
  padding: 12px 14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015));
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  letter-spacing: 2px;
  color: #8a93ad;
  text-transform: uppercase;
  flex: 0 0 auto;
}

.table-body {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(212, 175, 106, 0.4) rgba(255, 255, 255, 0.03);
}

.table-body::-webkit-scrollbar {
  width: 10px;
}
.table-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(212, 175, 106, 0.3), rgba(212, 175, 106, 0.45));
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.table-body::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(212, 175, 106, 0.5), rgba(212, 175, 106, 0.7));
  background-clip: padding-box;
  border: 2px solid transparent;
}
.table-body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 5px;
}

.table-row {
  display: grid;
  grid-template-columns: 48px 130px 1.3fr 140px 130px 170px 1fr 80px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  gap: 8px;
  transition: background 0.15s ease;
}
.table-row:hover {
  background: rgba(212, 175, 106, 0.04);
}

.table-footer-row {
  padding: 12px 14px;
}

.table-row.row-error {
  background: rgba(255, 107, 122, 0.07);
}

.col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.col-index {
  color: #d4af6a;
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  text-align: center;
  font-weight: 600;
}

.err-text {
  color: #ff858f;
  font-size: 11px;
  letter-spacing: 0.3px;
  padding-left: 2px;
}

.add-row {
  justify-content: center;
  width: 100%;
}

.footer-summary {
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  color: #c8cfe2;
  font-size: 13px;
}

.footer-summary .total {
  color: #f5d98a;
  font-family: "JetBrains Mono", monospace;
  font-size: 15px;
  margin-left: 4px;
}

.error.server {
  color: #ff6b7a;
  margin: 6px 0 0;
  font-size: 12px;
}

.modal-foot {
  padding: 14px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: rgba(0, 0, 0, 0.2);
}

.btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
  color: #c8cfe2;
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s, border-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
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
}

.btn.ghost {
  background: transparent;
}

.btn.small {
  padding: 7px 12px;
  font-size: 12px;
}

.plus {
  font-family: "JetBrains Mono", monospace;
  font-weight: 700;
}

.link {
  background: transparent;
  border: none;
  color: #c8cfe2;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}

.link:hover {
  color: #f5d98a;
  background: rgba(212, 175, 106, 0.08);
}

.link.danger:hover {
  color: #ff6b7a;
  background: rgba(255, 107, 122, 0.08);
}

.mini-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(26, 18, 6, 0.3);
  border-top-color: #1a1206;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(12px) scale(0.98);
  opacity: 0;
}

@media (max-width: 820px) {
  .table-header,
  .table-row {
    grid-template-columns: 36px 90px 1fr 100px 100px 110px 1fr 60px;
    gap: 6px;
    padding: 10px;
  }
  .modal-foot {
    padding: 12px;
  }
}
</style>
