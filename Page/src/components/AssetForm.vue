<script setup>
import { reactive, ref, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { createAsset, updateAsset } from '../api/assets.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  record: { type: Object, default: null },
});
const emit = defineEmits(['update:visible', 'saved']);

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
});

const isEdit = computed(() => !!props.record && !!props.record.id);
const title = computed(() => (isEdit.value ? '编辑资产' : '新增资产'));

const defaultForm = () => ({
  id: null,
  category: '存款',
  name: '',
  value: null,
  purchase_date: '',
  purchase_price: null,
  remark: '',
});

const form = reactive(defaultForm());
const rules = {
  category: [{ required: true, message: '请选择资产类别', trigger: 'change' }],
  name: [{ required: true, message: '请输入资产名称', trigger: 'blur' }],
  value: [
    { required: true, message: '请输入当前价值', trigger: 'blur' },
    { type: 'number', message: '必须是数字', trigger: 'blur' },
  ],
  purchase_price: [{ type: 'number', message: '必须是数字', trigger: 'blur' }],
};

const categoryOptions = ['存款', '投资资产', '其他资产'];

watch(
  () => props.visible,
  (v) => {
    if (v) {
      Object.assign(form, defaultForm());
      if (props.record) {
        Object.assign(form, {
          id: props.record.id,
          category: props.record.category || '存款',
          name: props.record.name || '',
          value: props.record.value,
          purchase_date: props.record.purchase_date || '',
          purchase_price: props.record.purchase_price,
          remark: props.record.remark || '',
        });
      }
    }
  },
  { immediate: true }
);

const formRef = ref(null);

async function submit() {
  if (!formRef.value) return;
  try {
    const valid = await formRef.value.validate();
    if (!valid) return;
  } catch {
    return;
  }
  const payload = {
    category: form.category,
    name: form.name,
    value: Number(form.value),
    purchase_date: form.purchase_date || null,
    purchase_price:
      form.purchase_price === '' || form.purchase_price === null ? null : Number(form.purchase_price),
    remark: form.remark || null,
  };
  try {
    if (isEdit.value) {
      await updateAsset(form.id, payload);
      ElMessage.success('更新成功');
    } else {
      await createAsset(payload);
      ElMessage.success('新增成功');
    }
    emit('saved');
  } catch (e) {
    const msg = e?.response?.data?.error || e.message || '保存失败';
    ElMessage.error(msg);
  }
}

function close() {
  emit('update:visible', false);
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    width="480px"
    @close="close"
    destroy-on-close
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="92px">
      <el-form-item label="资产类别" prop="category">
        <el-select v-model="form.category" placeholder="选择类别" style="width:100%;">
          <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
        </el-select>
      </el-form-item>
      <el-form-item label="资产名称" prop="name">
        <el-input v-model="form.name" placeholder="例如：工商银行 / 华为股票E" />
      </el-form-item>
      <el-form-item label="当前价值" prop="value">
        <el-input-number v-model="form.value" :precision="2" :step="100" style="width:100%;" />
      </el-form-item>
      <el-form-item label="购买日期" prop="purchase_date">
        <el-date-picker
          v-model="form.purchase_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width:100%;"
        />
      </el-form-item>
      <el-form-item label="购买价格" prop="purchase_price">
        <el-input-number
          v-model="form.purchase_price"
          :precision="2"
          :step="100"
          placeholder="可留空"
          style="width:100%;"
        />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可留空" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>
