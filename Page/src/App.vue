<script setup>
import AssetTable from './pages/AssetTable.vue';
</script>

<template>
  <div style="min-height:100vh;background:#f5f7fa;">
    <el-container>
      <el-header style="background:#2c3e50;color:#fff;display:flex;align-items:center;padding:0 24px;">
        <span style="font-size:20px;font-weight:600;">家庭资产管理系统</span>
      </el-header>
      <el-main>
        <AssetTable />
      </el-main>
    </el-container>
  </div>
</template>
