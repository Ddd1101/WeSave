# 变更记录 (CHANGELOG)

本文件记录家庭资产管理系统的重要变更。按「版本 · 日期」倒序维护。

---

## v0.3.0 - 2026-06-09

- `新增` Server/seed.js 初始数据脚本，写入参考表格中的 19 条资产记录。
- `变更` 仓库根目录新增 .gitignore，排除 node_modules/ 与 Server/data/*.db* 等非源码文件。

## v0.2.0 - 2026-06-09

- `新增` 前端工程 Page/（Vue 3 + Vite + Element Plus），提供资产列表、搜索筛选、CRUD 弹窗与数据可视化。
- `优化` 负值条目以红色高亮。

## v0.1.0 - 2026-06-09

- `新增` 后端工程 Server/（Node.js + Express + SQLite），提供 /api/assets 与 /api/health 接口。

## v0.0.1 - 2026-06-09

- 仓库初始化，搭建 Page / Server 目录骨架。
