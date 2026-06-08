# 家庭资产管理系统 · 历史快照与图表增强计划

> 目标：支持按日查看历史资产快照、按分类/按项追踪变化，并增加多种图表可视化。

## 一、现状分析

当前系统仅维护一份"当前资产"的可变表 `assets`，任何增删改都会覆盖原值，无法回溯历史。用户需求包括：

1. 能按日期（精确到日）查看历史某一天的资产总貌；
2. 能查看每个分类、每项资产的价值变化曲线；
3. 增加饼图（构成）、折线图（趋势）、柱状图（分类对比）等可视化。

### 1.1 现有核心文件
- `Server/src/db/index.js` — SQLite 建表与连接
- `Server/src/routes/assets.js` — 现有 CRUD（`GET/POST/PUT/DELETE /api/assets`）
- `Server/seed.js` — 初始化数据
- `Page/src/api/assets.js` — 前端 API 封装
- `Page/src/pages/AssetTable.vue` — 主列表 + 汇总
- `Page/src/components/AssetForm.vue` — 新增/编辑表单
- `Page/src/App.vue` — 应用骨架（单页 tab 切换）

### 1.2 约束
- 不引入新依赖；图表使用原生 ECharts（通过 npm 安装 `echarts`，前端已有 Vue3 环境）
- 历史数据采用"快照 + 变更增量"双层：
  - 每次资产发生 **变更（新增/修改/删除）** 时记录一条 `asset_history`；
  - 提供 API 按日查询"某一天结束时的资产状况"；
  - 对历史空档（某一天无任何变更）以前最近的有效值向前填充（由 API 计算）。

## 二、数据库设计变更

位置：`Server/src/db/index.js` 与 `Server/seed.js`

### 2.1 新增表 `asset_history`

```sql
CREATE TABLE IF NOT EXISTS asset_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER,                       -- 原资产ID，被删时可为null保留快照
  action TEXT NOT NULL,                   -- create / update / delete / snapshot
  snapshot_date TEXT NOT NULL,            -- 'YYYY-MM-DD' 业务日期
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  purchase_date TEXT,
  purchase_price REAL,
  remark TEXT,
  change_amount REAL,                     -- 相对上一次 value 的增量
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_asset_history_date
  ON asset_history(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset
  ON asset_history(asset_id);
```

- `snapshot_date` 由服务器以本地时区计算"当日"（Node 使用 `YYYY-MM-DD` 本地字符串）。
- `change_amount` 用于可视化变化增量；第一次创建、删除时为 `null` 或原值取负处理。

### 2.2 `assets` 表不变
- 保留 `created_at / updated_at` 用于兜底计算；

### 2.3 初始化种子数据
- 在 `seed.js` 写入 assets 后，额外为每一项资产生成一条 `action='snapshot'` 的历史记录，`snapshot_date` 取当日日期（或用户手动回溯的起点日期）。
- 这一步确保"第一天"即有基线数据，图表不会空白。

## 三、后端 API 变更

位置：`Server/src/routes/assets.js`（扩展）；`Server/src/app.js`（注册路由）

### 3.1 历史记录钩子（写入 asset_history）
- 在 `POST /api/assets` 成功后插入一条 `action='create'` 历史记录；
- 在 `PUT /api/assets/:id` 成功后读取旧值 `old_value`，写入 `action='update'` 并计算 `change_amount = new_value - old_value`；
- 在 `DELETE /api/assets/:id` 成功前读取被删值，写入 `action='delete'` 并将 `change_amount` 记为 `0 - value`；
- `snapshot_date` 使用 Node 本地日期字符串。

### 3.2 新增接口：快照查询
- `GET /api/assets/snapshot?date=YYYY-MM-DD`
  - 返回某一天结束时"有效的资产列表"（即截止该日期最近一次状态）。
  - 逻辑：对每个 asset_id，按 `recorded_at <= date 23:59:59` 取最新非 delete 记录；如该 id 的最新状态为 delete，则从结果中剔除。
  - 同时汇总 `total` 与分类汇总 `by_category`。
  - 返回：
    ```json
    {
      "date": "2026-06-09",
      "assets": [ {id, category, name, value, purchase_date, purchase_price, remark} ... ],
      "total": 7280000.00,
      "by_category": [ { category: "存款", sum: 1200000 }, ... ]
    }
    ```

- `GET /api/assets/snapshots?start=YYYY-MM-DD&end=YYYY-MM-DD&granularity=day|month`
  - 返回时间范围内 **每日（或每月）** 聚合数据折线图所需 JSON：
    ```json
    {
      "granularity": "day",
      "dates": ["2026-06-01", "2026-06-02", ...],
      "totals": [6900000, 7000000, ...],
      "by_category": [
        { "category": "存款", "values": [1200000, 1250000, ...] },
        { "category": "投资资产", "values": [5500000, 5600000, ...] },
        ...
      ]
    }
    ```
  - 逻辑：对每日重复执行"按日快照"计算。为避免慢查询，未来可做"日终快照缓存表"；本期在应用层完成。

- `GET /api/assets/:id/history?start=&end=`
  - 某单项资产的历史 value 变化曲线，用于单资产趋势图。

### 3.3 新增接口：变化增量（用于柱状/瀑布图）
- `GET /api/assets/changes?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - 返回区间内所有 `change_amount` 聚合：
    ```json
    {
      "daily": [ { "date": "2026-06-08", "change": 23456.78 }, ... ],
      "by_category": [ { "category": "投资资产", "change": 50000 }, ... ],
      "top_items": [ { "name": "华为股票E", "change": 12000 }, ... ]
    }
    ```

### 3.4 删除策略
- 删除资产仅"软保留历史"：`assets` 表被删行的 id 在 `asset_history.asset_id` 仍可被查询，按日快照时会正确剔除。

## 四、前端页面变更

### 4.1 引入图表库
- 给 `Page/package.json` 增加依赖 `echarts`（^5.5.x）。执行 `npm i echarts`。
- 在 `Page/src/utils/` 中封装一个轻量 hook：`useChart(ref, option)` —— 负责 resize、销毁。

### 4.2 导航结构改造（App.vue）
- 顶栏增加 Tab 切换：
  - **当前资产**（保留现有 `AssetTable` 页面）
  - **历史快照**（新页面 `SnapshotTable`：按日期查询某一天的资产结构 + 饼图）
  - **趋势分析**（新页面 `Trends`：多条折线图 + 柱状图）
- 左侧保留品牌，右侧增加"查询日期"输入（只作用于后两个 Tab）。

### 4.3 页面一：历史快照（SnapshotTable.vue）
- 顶部：日期选择器（默认今天），"上一天 / 下一天 / 回到今天"快捷按钮
- 主体：
  1. Hero 汇总卡（与当前页一致，但反映所选日期值）
  2. **饼图**（构成占比）— 分类
  3. **条形图**（横向柱状图）— 各项资产价值排序 Top N
  4. 资产明细表格（只读，显示当天当时快照）
- 与"当前资产"页的主要区别：数据来自 `GET /api/assets/snapshot?date=`

### 4.4 页面二：趋势分析（Trends.vue）
- 顶部：起止日期（默认近 30 天）+ 粒度切换（日 / 月）
- 主体：
  1. **折线图 A**：净资产总额随时间变化
  2. **堆叠折线图 B**：各分类价值随时间变化（带图例点击切换）
  3. **柱状图 C**：每日净变化（变化增量瀑布视觉）
  4. **表格 D**：按分类汇总的区间变化，形如：
     | 分类 | 期初 | 期末 | 变化额 | 变化率 |
  5. **雷达图 E**（可选）：以分类为维度的期末值占比雷达（视觉增强）

### 4.5 交互增强
- 折线图 tooltip 格式化金额与变化额（"¥1,234,567（+¥12,345 / +1.01%）"）
- 图表的颜色映射沿用当前配色（gold / emerald / rose 等 CSS 变量），避免视觉割裂。

### 4.6 API 封装（assets.js 补充）
```js
export function getSnapshot(date) {
  return http.get(`/assets/snapshot`, { params: { date } }).then(r => r.data);
}
export function getSnapshots({ start, end, granularity }) {
  return http.get(`/assets/snapshots`, { params: { start, end, granularity } }).then(r => r.data);
}
export function getAssetHistory(id, { start, end } = {}) {
  return http.get(`/assets/${id}/history`, { params: { start, end } }).then(r => r.data);
}
export function getChanges({ start, end }) {
  return http.get(`/assets/changes`, { params: { start, end } }).then(r => r.data);
}
```

### 4.7 表单补充（AssetForm.vue）
- 在"编辑资产"场景下，增加可选字段 **"变更说明 / 原因"**（备注已足够，不新增字段），但会将编辑事件写入历史，可在 `Trends` 页展示为时间点标记。

## 五、文件级变更清单

| # | 文件 / 目录 | 变更类型 | 说明 |
|---|---|---|---|
| 1 | `Server/src/db/index.js` | 修改 | 新增 `asset_history` 建表语句与索引 |
| 2 | `Server/src/routes/assets.js` | 修改 | 变更钩子（post/put/delete 写 history）+ 新增 4 个快照 / 趋势 / 变更接口 |
| 3 | `Server/src/app.js` | 修改 | 无实际路径变更，健康检查保留 |
| 4 | `Server/seed.js` | 修改 | 种子数据写入后注入初始 snapshot 基线 |
| 5 | `Page/package.json` | 修改 | 增加 `echarts` 依赖 |
| 6 | `Page/src/api/assets.js` | 修改 | 增加 `getSnapshot / getSnapshots / getAssetHistory / getChanges` |
| 7 | `Page/src/utils/format.js` | 修改 | 增加 `formatSignedCurrency / formatSignedPercent`（用于变化增量显示） |
| 8 | `Page/src/utils/useChart.js` | 新增 | ECharts 实例化 + resize + unmount 的轻量工具函数 |
| 9 | `Page/src/pages/AssetTable.vue` | 修改 | 微调，仅保留"当前"语义；增加链接跳转到历史页查看"某项历史" |
| 10 | `Page/src/pages/SnapshotTable.vue` | 新增 | 按日期快照页 + 饼图 + 条形图 + 只读明细表 |
| 11 | `Page/src/pages/Trends.vue` | 新增 | 时间范围 + 多图表（折线/堆叠柱/瀑布）+ 汇总表 |
| 12 | `Page/src/components/AssetForm.vue` | 修改 | 保存成功后后端已自动记录，前端无额外工作 |
| 13 | `Page/src/App.vue` | 修改 | 顶栏增加 Tab 切换，右侧加入全局日期选择器 |

## 六、实施步骤（建议顺序）

1. **数据库层**：修改 `Server/src/db/index.js` 加入 `asset_history` 表与索引；
2. **种子数据**：在 `Server/seed.js` 里为每条种子资产写一条基线快照；
3. **路由写钩子**：改造 `POST / PUT / DELETE` 三个写操作都写入 history（注意 `change_amount` 计算）；
4. **快照查询 API**：实现 `GET /assets/snapshot`、`GET /assets/snapshots`、`GET /assets/:id/history`、`GET /assets/changes`；
5. **前端依赖**：`Page/` 目录执行 `npm i echarts`（或修改 `package.json` 后 `npm i`）；
6. **前端 utils 补齐**：添加 `useChart.js` 与 format 工具；
7. **前端 API 封装**：补充 `assets.js` 四个新方法；
8. **页面构建**：依次做 `SnapshotTable.vue` → `Trends.vue` → `App.vue` Tab 改造；
9. **视觉风格统一**：图表主题色跟随 CSS 变量 `--gold / --emerald / --rose / --ink-*`；
10. **本地联调**：确认 Node 与 Vite 同时启动，走 `/api` 代理，验证三个 Tab 各自连通；
11. **CHANGELOG 更新**：版本号迭代，记录"历史快照 + 图表增强"。

## 七、风险与注意事项

- **性能**：`snapshots` 接口按天查询，日数据量 ≤ 千条时无性能问题；若未来数据量大，可引入"日终快照缓存表"做物化视图，本期不做。
- **SQLite 日期**：统一使用 `YYYY-MM-DD` 字符串，避免时区漂移；服务器以本地时区生成。
- **历史空白期填充**：在 `snapshots` API 中对每日 value 做 forward-fill（用前一天的值），前端折线不会出现空洞；但首次无数据时返回空并显示友好提示。
- **依赖**：`echarts` 打包体积较大，但单页使用时可接受；如需按需加载后续可改为 `echarts/core` 手动注册。
- **向后兼容**：所有老接口不变，仅新增；已存在的前端页面不受影响。
