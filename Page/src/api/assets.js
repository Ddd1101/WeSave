import axios from "axios";

const http = axios.create({
  baseURL: "/api",
  timeout: 8000,
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
