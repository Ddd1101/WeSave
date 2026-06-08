<script setup>
import { reactive, ref, watch, computed } from 'vue';
import { createAsset, updateAsset } from '../api/assets.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  record: { type: Object, default: null },
});
const emit = defineEmits(['update:visible', 'saved']);

const isEdit = computed(() => !!props.record && !!props.record.id);
const title = computed(() => (isEdit.value ? '编辑资产' : '新增资产'));

const defaultForm = () => ({
  id: null,
  category: '存款',
  name: '',
  value: '',
  purchase_date: '',
  purchase_price: '',
  remark: '',
});

const form = reactive(defaultForm());
const errors = reactive({});
const saving = ref(false);

const categoryOptions = [
  { value: '存款', hint: '现金 / 储蓄卡 / 支付宝余额' },
  { value: '投资资产', hint: '股票 / 基金 / 投资黄金' },
  { value: '其他资产', hint: '首饰 / 借款 / 其他' },
];

watch(
  () => props.visible,
  (v) => {
    if (v) {
      Object.assign(form, defaultForm());
      Object.keys(errors).forEach((k) => delete errors[k]);
      if (props.record) {
        const r = props.record;
        form.id = r.id || null;
        form.category = r.category || '存款';
        form.name = r.name || '';
        form.value = r.value === null || r.value === undefined || r.value === '' ? '' : String(r.value);
        form.purchase_date = r.purchase_date || '';
        form.purchase_price =
          r.purchase_price === null || r.purchase_price === undefined || r.purchase_price === '' ? '' : String(r.purchase_price);
        form.remark = r.remark || '';
      }
    }
  },
  { immediate: true },
);

function validate() {
  Object.keys(errors).forEach((k) => delete errors[k]);
  if (!form.category) errors.category = '请选择资产类别';
  if (!form.name || !String(form.name).trim()) errors.name = '请输入资产名称';
  const valueStr = String(form.value ?? '').trim();
  if (valueStr === '' || Number.isNaN(Number(valueStr))) {
    errors.value = '当前价值必须为数字';
  }
  const ppStr = String(form.purchase_price ?? '').trim();
  if (ppStr !== '' && Number.isNaN(Number(ppStr))) {
    errors.purchase_price = '购买价格必须为数字';
  }
  // 日期格式宽松：支持 YYYY / YYYY-MM / YYYY-MM-DD
  const pd = String(form.purchase_date ?? '').trim();
  if (pd !== '' && !/^\d{4}(-\d{1,2}(-\d{1,2})?)?$/.test(pd)) {
    errors.purchase_date = '日期格式应为 YYYY 或 YYYY-MM 或 YYYY-MM-DD';
  }
  return Object.keys(errors).length === 0;
}

async function submit() {
  if (!validate()) return;
  const payload = {
    category: form.category,
    name: String(form.name).trim(),
    value: Number(form.value),
    purchase_date: String(form.purchase_date ?? '').trim() || null,
    purchase_price: String(form.purchase_price ?? '').trim() === '' ? null : Number(form.purchase_price),
    remark: String(form.remark ?? '').trim() || null,
  };
  try {
    saving.value = true;
    if (isEdit.value) await updateAsset(form.id, payload);
    else await createAsset(payload);
    emit('saved');
    emit('update:visible', false);
  } catch (e) {
    errors._server = e?.response?.data?.error || e.message || '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

function close() {
  emit('update:visible', false);
}
</script>

<template>
  <transition name="modal">
    <div v-if="visible" class="modal-root" @click.self="close">
      <div class="modal">
        <div class="modal-head">
          <div>
            <div class="eyebrow">{{ isEdit ? 'EDIT ASSET' : 'NEW ASSET' }} · 家庭账本</div>
            <h3 class="modal-title">{{ title }}</h3>
          </div>
          <button class="icon-close" @click="close" aria-label="关闭">×</button>
        </div>

        <div class="modal-body">
          <!-- 资产类别 -->
          <div class="field">
            <label class="label">资产类别</label>
            <div class="seg">
              <button
                v-for="opt in categoryOptions"
                :key="opt.value"
                class="seg-item"
                :class="{ active: form.category === opt.value }"
                @click="form.category = opt.value"
              >
                <span class="seg-value">{{ opt.value }}</span>
                <span class="seg-hint">{{ opt.hint }}</span>
              </button>
            </div>
            <p v-if="errors.category" class="error">{{ errors.category }}</p>
          </div>

          <!-- 资产名称 -->
          <div class="field">
            <label class="label">资产名称</label>
            <input
              v-model="form.name"
              class="field-input"
              placeholder="例如：公共账户 / 华为股票E"
            />
            <p v-if="errors.name" class="error">{{ errors.name }}</p>
          </div>

          <div class="field-row">
            <!-- 当前价值 -->
            <div class="field">
              <label class="label">当前价值（元）</label>
              <div class="field-input money">
                <span class="prefix">¥</span>
                <input
                  type="text"
                  inputmode="decimal"
                  v-model="form.value"
                  placeholder="0.00"
                />
              </div>
              <p v-if="errors.value" class="error">{{ errors.value }}</p>
            </div>

            <!-- 购买价格 -->
            <div class="field">
              <label class="label">购买价格（可选）</label>
              <div class="field-input money">
                <span class="prefix">¥</span>
                <input
                  type="text"
                  inputmode="decimal"
                  v-model="form.purchase_price"
                  placeholder="可留空"
                />
              </div>
              <p v-if="errors.purchase_price" class="error">{{ errors.purchase_price }}</p>
            </div>
          </div>

          <!-- 购买日期 -->
          <div class="field">
            <label class="label">购买日期（可选，支持 2023 / 2023-06 / 2023-06-09）</label>
            <input
              type="text"
              v-model="form.purchase_date"
              placeholder="例如 2023 或 2023-06 或 2023-06-09"
              class="field-input"
            />
            <p v-if="errors.purchase_date" class="error">{{ errors.purchase_date }}</p>
          </div>

          <!-- 备注 -->
          <div class="field">
            <label class="label">备注（可选）</label>
            <textarea
              v-model="form.remark"
              class="field-input textarea"
              rows="2"
              placeholder="例如：工行工资卡 / 5万股"
            />
          </div>

          <p v-if="errors._server" class="error server">{{ errors._server }}</p>
        </div>

        <div class="modal-foot">
          <button class="btn ghost" @click="close">取消</button>
          <button class="btn primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="mini-spinner" />
            <span>{{ isEdit ? '保存修改' : '添加到账本' }}</span>
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
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 8, 16, 0.65);
  backdrop-filter: blur(6px);
}

.modal {
  width: 100%;
  max-width: 560px;
  background: linear-gradient(180deg, #131a2b 0%, #0e1322 100%);
  border: 1px solid rgba(212, 175, 106, 0.22);
  border-radius: 18px;
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  overflow: hidden;
  position: relative;
}

.modal::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(closest-side at 90% -10%, rgba(212, 175, 106, 0.18), transparent 60%),
    radial-gradient(closest-side at -10% 110%, rgba(79, 209, 165, 0.08), transparent 60%);
  pointer-events: none;
}

.modal-head {
  position: relative;
  padding: 22px 26px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 4px;
  color: #8a93ad;
  text-transform: uppercase;
}

.modal-title {
  margin: 6px 0 0;
  font-family: 'Noto Serif SC', serif;
  font-weight: 600;
  font-size: 22px;
  color: #f5d98a;
  letter-spacing: 2px;
}

.icon-close {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: #c8cfe2;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-close:hover {
  color: #f5d98a;
  border-color: rgba(212, 175, 106, 0.35);
  background: rgba(212, 175, 106, 0.08);
}

.modal-body {
  position: relative;
  padding: 22px 26px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.label {
  font-size: 12px;
  letter-spacing: 2px;
  color: #8a93ad;
  text-transform: uppercase;
}

.field-input {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e9ecf5;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  font-family: inherit;
}

.field-input::placeholder {
  color: #5b6478;
}

.field-input:focus {
  border-color: rgba(212, 175, 106, 0.55);
  background: rgba(212, 175, 106, 0.05);
  box-shadow: 0 0 0 4px rgba(212, 175, 106, 0.1);
}

.field-input.textarea {
  resize: vertical;
  min-height: 64px;
}

.field-input.money {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
}

.field-input.money .prefix {
  color: #d4af6a;
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
}

.field-input.money input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e9ecf5;
  padding: 12px 0;
  font-size: 14px;
  font-family: 'JetBrains Mono', monospace;
}

/* 类别分段选择器 */
.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.seg-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #c8cfe2;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.seg-item:hover {
  border-color: rgba(212, 175, 106, 0.3);
  background: rgba(212, 175, 106, 0.05);
}

.seg-item.active {
  background: linear-gradient(135deg, rgba(212, 175, 106, 0.18), rgba(212, 175, 106, 0.05));
  border-color: rgba(212, 175, 106, 0.55);
  color: #f5d98a;
  box-shadow: 0 6px 20px -8px rgba(212, 175, 106, 0.5);
}

.seg-value {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
}

.seg-hint {
  font-size: 11px;
  color: #8a93ad;
  letter-spacing: 0.5px;
}

.error {
  color: #ff8a96;
  font-size: 12px;
  margin: 0;
  letter-spacing: 0.5px;
}

.error.server {
  padding: 10px 12px;
  background: rgba(255, 107, 122, 0.08);
  border: 1px solid rgba(255, 107, 122, 0.25);
  border-radius: 10px;
  color: #ff8a96;
}

.modal-foot {
  position: relative;
  padding: 18px 26px 22px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  color: #c8cfe2;
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.btn.primary {
  background: linear-gradient(135deg, #d4af6a, #b98644);
  color: #1a1206;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-weight: 600;
  box-shadow: 0 10px 24px -10px rgba(212, 175, 106, 0.5);
}

.btn.primary:hover {
  box-shadow: 0 14px 30px -10px rgba(212, 175, 106, 0.7);
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mini-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(26, 18, 6, 0.3);
  border-top-color: #1a1206;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 进场动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(12px) scale(0.97);
  opacity: 0;
}

/* 原生 date/number 在暗色模式的微调 */
input[type='date']::-webkit-calendar-picker-indicator {
  filter: invert(1);
  opacity: 0.7;
  cursor: pointer;
}

input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

@media (max-width: 600px) {
  .field-row { grid-template-columns: 1fr; }
  .seg { grid-template-columns: 1fr; }
}
</style>
