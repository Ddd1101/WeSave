# 家庭资产管理系统 - 实施计划

## [ ] Task 1: 后端工程与数据库初始化
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 在 `Server/` 目录创建 `package.json`，添加 `express`、`better-sqlite3`、`cors`、`body-parser` 依赖，并配置启动脚本 `dev`。
  - 在 `Server/src/db/` 创建 SQLite 连接模块与初始化脚本（启动时若表不存在则建表）。
  - 表 `assets` 字段：`id INTEGER PRIMARY KEY AUTOINCREMENT`、`category TEXT NOT NULL`、`name TEXT NOT NULL`、`value REAL NOT NULL`（当前价值）、`purchase_date TEXT`（YYYY-MM-DD，可选）、`purchase_price REAL`（可选）、`remark TEXT`（可选）、`created_at TEXT DEFAULT CURRENT_TIMESTAMP`、`updated_at TEXT DEFAULT CURRENT_TIMESTAMP`。
- **Acceptance Criteria Addressed**: FR-2, FR-6, AC-6
- **Test Requirements**:
  - `programmatic` TR-1.1: 首次启动后端后，`Server/data/assets.db` 被创建，`assets` 表可用（可通过手工查询或 `node -e` 脚本验证）。
  - `programmatic` TR-1.2: 手动向表中插入一条记录后重启后端，记录仍存在。
- **Notes**: 数据库文件路径建议 `Server/data/assets.db`（`.gitignore` 忽略）。

## [ ] Task 2: 实现后端 REST API
- **Priority**: P0
- **Depends On**: Task 1
- **Description**:
  - `Server/src/routes/assets.js` 实现以下路由：
    - `GET /api/assets`：返回所有条目数组 `{ id, category, name, value, purchase_date, purchase_price, remark, created_at, updated_at }`。
    - `POST /api/assets`：校验 `category`、`name`、`value` 非空；`value`/`purchase_price` 为数字；插入后返回新记录。
    - `PUT /api/assets/:id`：更新指定记录的可写字段，刷新 `updated_at`。
    - `DELETE /api/assets/:id`：删除指定记录，返回成功状态。
  - `Server/src/app.js` 使用 Express + CORS，`listen` 于 `:3000`（或可配置）。
  - `Server/src/middleware/error.js` 提供统一错误响应（400/404/500）。
- **Acceptance Criteria Addressed**: FR-1, FR-6, FR-7, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-2.1: `curl`/Postman 调用 `POST /api/assets` 返回 201 并返回带 `id` 的对象。
  - `programmatic` TR-2.2: `GET /api/assets` 包含刚插入的条目。
  - `programmatic` TR-2.3: `PUT /api/assets/:id` 更新字段后，再 `GET` 返回更新后值。
  - `programmatic` TR-2.4: `DELETE /api/assets/:id` 删除后，`GET` 不再包含该条目。
  - `programmatic` TR-2.5: 缺失 `name` 或 `value` 时返回 400。

## [ ] Task 3: 前端工程脚手架
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 在 `Page/` 目录创建 Vue3 项目（推荐通过 Vite 脚手架），安装 `element-plus`、`axios`。
  - 目录结构：`src/pages/AssetTable.vue`（主页面）、`src/components/AssetForm.vue`（新增/编辑弹窗）、`src/api/assets.js`（Axios 封装）、`src/utils/format.js`（金额/百分比格式化）。
  - 开发时代理 `/api` 到 `http://localhost:3000`。
- **Acceptance Criteria Addressed**: FR-1, AC-1
- **Test Requirements**:
  - `programmatic` TR-3.1: `npm run dev` 启动前端并可在浏览器访问主页。
  - `human-judgment` TR-3.2: 页面使用中文，布局整洁、表格占据主要区域。

## [ ] Task 4: 资产列表与汇总表格
- **Priority**: P0
- **Depends On**: Task 2, Task 3
- **Description**:
  - `GET /api/assets` 拉取数据，以 Element Plus `el-table` 展示，并按 `category` 排序或分组显示。
  - 列：资产类别、资产名称、当前价值（`¥1,234.56` 格式）、购买日期、购买价格、备注、占比（%）。
  - 负值以红色/负号醒目显示。
  - 表格下方显示总资产金额。
  - 在 `format.js` 提供 `formatCurrency(value, digits=2)` 与 `formatPercent(value)` 工具函数。
- **Acceptance Criteria Addressed**: FR-3, FR-4, FR-5, AC-1, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: 给定 3 条存款 + 2 条投资资产数据，页面分类小计与总计通过手工计算一致。
  - `programmatic` TR-4.2: 某条目 `value=100`、总计 `=1000` 时占比显示为 `10.00%`。
  - `human-judgment` TR-4.3: 负值条目视觉上与正数区分清晰。

## [ ] Task 5: 新增 / 编辑 / 删除交互
- **Priority**: P0
- **Depends On**: Task 4
- **Description**:
  - 表格列尾部添加"编辑""删除"按钮；顶部添加"新增资产"按钮。
  - 使用 `AssetForm.vue` `el-dialog` 弹窗提供表单；字段验证：类别/名称/当前价值必填；购买日期用日期选择器；购买价格为数字；备注文本。
  - 提交后关闭弹窗并刷新列表；删除前弹确认框。
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-5.1: 新增后调用 `GET` 新条目出现，再次刷新仍存在。
  - `programmatic` TR-5.2: 编辑后字段正确更新，删除后条目消失。

## [ ] Task 6: 搜索与筛选
- **Priority**: P1
- **Depends On**: Task 4
- **Description**:
  - 顶部搜索框按资产名称/备注关键字实时过滤。
  - 分类下拉筛选支持从现有数据去重得到选项（或固定枚举：存款、投资资产、其他资产、全部）。
  - 过滤后小计/总计基于过滤后结果重新计算。
- **Acceptance Criteria Addressed**: FR-5, AC-7
- **Test Requirements**:
  - `human-judgment` TR-6.1: 输入关键字"工商银行"仅显示名称/备注包含该关键字的条目。
  - `human-judgment` TR-6.2: 切换类别到"投资资产"，表格仅显示投资资产，并重新计算小计。

## [ ] Task 7: 开发环境一体化启动与基础验证
- **Priority**: P1
- **Depends On**: Task 2, Task 5
- **Description**:
  - 在根目录或前后端独立脚本中提供一条命令即可启动前后端（或分别启动的清晰文档说明）。
  - 端到端走通完整流程：启动 → 录入 5 条示例数据 → 重启后端 → 数据仍在 → 删除 1 条 → 刷新后消失。
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-7.1: 重启后端后 `GET /api/assets` 返回数与重启前一致。
  - `human-judgment` TR-7.2: 流程顺畅、错误提示友好（新增失败/网络不可达时弹 `message.error`）。
