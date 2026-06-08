# 变更记录 (CHANGELOG)

本文件记录家庭资产管理系统的重要变更。按「版本 · 日期」倒序维护。

格式参考：
- `新增` 新功能
- `优化` 现有功能改进 / 性能 / 体验
- `修复` Bug 修复
- `变更` 配置 / 接口 / 结构的非兼容调整

---

## v0.3.0 - 2026-06-09

- `新增` `Server/seed.js` 初始数据脚本，写入参考表格中的 19 条资产记录（存款 10 条、投资资产 7 条、其他资产 2 条，合计 ¥7,995,885.74）。
- `变更` 根目录新增 `.gitignore`，排除 `node_modules/`、`Server/data/*.db*`、日志与环境文件，避免把依赖和数据库数据提交进仓库。

## v0.2.0 - 2026-06-09

- `新增` 前端工程 `Page/`，基于 **Vue 3 + Vite + Element Plus**：
  - `Page/src/main.js` / `Page/src/App.vue` — 应用入口与主布局。
  - `Page/src/pages/AssetTable.vue` — 资产列表、搜索、筛选、分类小计、总计、占比、负值高亮。
  - `Page/src/components/AssetForm.vue` — 新增 / 编辑弹窗，带字段校验。
  - `Page/src/utils/format.js` — 金额 / 百分比格式化工具函数。
  - `Page/src/api/assets.js` — 基于 axios 的后端 API 封装。
  - `Page/vite.config.js` — 配置 dev proxy：`/api → http://localhost:3000`。
  - `Page/package.json` — 依赖声明与 `dev` 启动脚本。
- `优化` 负值条目在表格中以红色显示，便于识别负债（如信用卡、外部借款）。

## v0.1.0 - 2026-06-09

- `新增` 后端工程 `Server/`，基于 **Node.js + Express + SQLite (better-sqlite3)**：
  - `Server/src/app.js` — 应用入口，监听 `:3000`，装载路由与错误处理。
  - `Server/src/db/index.js` — SQLite 连接与自动建表（`assets` 表）。
  - `Server/src/routes/assets.js` — 资产条目 CRUD API：
    - `GET    /api/assets`       列出全部
    - `GET    /api/assets/:id`   单条详情
    - `POST   /api/assets`       新增
    - `PUT    /api/assets/:id`   更新
    - `DELETE /api/assets/:id`   删除
  - `Server/src/middleware/error.js` — 统一错误响应中间件。
  - `Server/package.json` — 依赖声明与 `dev` 启动脚本。
  - `Server/.gitignore` — 忽略 `node_modules/` 与数据库文件。
- `新增` API 健康检查端点 `GET /api/health`。

## v0.0.1 - 2026-06-09

- 仓库初始化（`initial` commit），搭建 Page / Server 目录骨架。
