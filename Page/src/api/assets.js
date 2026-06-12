import axios from "axios";

const http = axios.create({
  baseURL: "http://129.226.164.152:8088/api",
  timeout: 10000,
});

export function listAssets() {
  return http.get("/assets").then((r) => r.data);
}

export function createAsset(payload) {
  return http.post("/assets", payload).then((r) => r.data);
}

export function updateAsset(id, payload) {
  return http.put(`/assets/${id}`, payload).then((r) => r.data);
}

export function deleteAsset(id) {
  return http.delete(`/assets/${id}`).then((r) => r.data);
}

// 按日期查询资产快照
export function getSnapshot(date) {
  return http.get("/assets/snapshot", { params: { date } }).then((r) => r.data);
}

// 已录入过快照的所有日期（降序）
export function listSnapshotDates() {
  return http.get("/assets/dates").then((r) => r.data);
}

// 批量保存某天快照
export function saveBatchSnapshot(date, assets) {
  return http
    .post("/assets/batch-snapshot", { assets }, { params: { date } })
    .then((r) => r.data);
}

// 按日期区间查询趋势
export function getSnapshots({ start, end, granularity }) {
  return http
    .get("/assets/snapshots", { params: { start, end, granularity } })
    .then((r) => r.data);
}

// 单项资产历史
export function getAssetHistory(id, { start, end } = {}) {
  return http
    .get(`/assets/${id}/history`, { params: { start, end } })
    .then((r) => r.data);
}

// 区间变化聚合
export function getChanges({ start, end }) {
  return http
    .get("/assets/changes", { params: { start, end } })
    .then((r) => r.data);
}

// 生成模拟快照数据
export function generateMock({
  days_before = 30,
  days_after = 30,
  force = false,
} = {}) {
  return http
    .post("/assets/generate-mock", null, {
      params: { days_before, days_after, force },
    })
    .then((r) => r.data);
}
