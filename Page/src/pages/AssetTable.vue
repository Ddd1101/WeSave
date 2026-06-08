<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
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

const total = computed(() => filteredRows.value.reduce((s, r) => s + Number(r.value || 0), 0));

const percentOf = (row) => {
  const base = Math.abs(total.value);
  if (base === 0) return 0;
  return (Number(row.value || 0) / base) * 100;
};

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

function valueClass(row) {
  const v = Number(row.value);
  if (Number.isNaN(v)) return '';
  return v < 0 ? 'neg-value' : '';
}

onMounted(load);
</script>

<template>
  <div>
    <el-card shadow="never" style="margin-bottom:16px;">
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
        <el-button type="primary" @click="handleAdd">+ 新增资产</el-button>
        <el-button @click="load">刷新</el-button>
        <el-input
          v-model="keyword"
          placeholder="按名称 / 备注 / 类别搜索"
          clearable
          style="width:260px;"
        />
        <el-select
          v-model="categoryFilter"
          placeholder="按类别筛选"
          clearable
          style="width:180px;"
        >
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <div style="margin-left:auto;font-size:15px;">
          总资产：
          <span style="font-weight:700;color:#409eff;font-size:18px;">{{ formatCurrency(total) }}</span>
          <span style="margin-left:8px;color:#909399;">（共 {{ filteredRows.length }} 条）</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="filteredRows" border stripe style="width:100%;" v-loading="loading">
        <el-table-column prop="category" label="资产类别" width="140" />
        <el-table-column prop="name" label="资产名称" min-width="160" />
        <el-table-column label="当前价值" width="160" align="right">
          <template #default="{ row }">
            <span :class="valueClass(row)">{{ formatCurrency(row.value) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="购买日期" width="140">
          <template #default="{ row }">{{ formatDate(row.purchase_date) }}</template>
        </el-table-column>
        <el-table-column label="购买价格" width="140" align="right">
          <template #default="{ row }">
            <span v-if="row.purchase_price !== null && row.purchase_price !== undefined">
              {{ formatCurrency(row.purchase_price) }}
            </span>
            <span v-else style="color:#c0c4cc;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="占比" width="120" align="right">
          <template #default="{ row }">
            <span :class="valueClass(row)">{{ formatPercent(percentOf(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>

        <template #summary>
          <tr>
            <td colspan="2" style="text-align:right;font-weight:600;">合计</td>
            <td style="text-align:right;font-weight:600;color:#409eff;">{{ formatCurrency(total) }}</td>
            <td colspan="3" style="text-align:right;color:#909399;">
              分类小计：
              <span
                v-for="(sum, cat, index) in groupSummary"
                :key="cat"
                style="margin-left:8px;"
              >
                {{ cat }}: {{ formatCurrency(sum) }}
              </span>
            </td>
            <td style="text-align:right;font-weight:600;">100.00%</td>
            <td></td>
          </tr>
        </template>
      </el-table>
    </el-card>

    <AssetForm
      v-model:visible="formVisible"
      :record="editingItem"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.neg-value {
  color: #f56c6c;
}
</style>
