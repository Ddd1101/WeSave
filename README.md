# WeSave 家庭资产管理系统

## 项目结构

```
WeSave/
├── Page/          # 前端项目 (Vue 3 + Vite)
├── Server/        # 后端项目 (Express + SQLite)
├── nginx.conf     # Nginx 配置文件
└── manage.sh      # 服务管理脚本
```

## 部署架构

- **前端**: 80 端口 (Nginx 静态文件服务)
- **后端**: 8088 端口 (Node.js Express API)

## 快速开始

### 1. 安装依赖

```bash
# 前端依赖
cd Page && npm install

# 后端依赖
cd ../Server && npm install
```

### 2. 构建前端

```bash
cd Page
npm run build
```

### 3. 启动服务

```bash
# 使用管理脚本启动
./manage.sh start
```

## 管理脚本

`manage.sh` 提供了便捷的服务管理功能：

```bash
./manage.sh start      # 启动前端和后端服务
./manage.sh stop       # 停止所有服务
./manage.sh restart    # 重启所有服务
./manage.sh status     # 查看服务状态
./manage.sh logs server    # 查看后端日志
./manage.sh logs nginx     # 查看 Nginx 日志
```

## 访问地址

- **前端页面**: http://129.226.164.152
- **后端 API**: http://129.226.164.152:8088/api
- **健康检查**: http://129.226.164.152:8088/api/health

## 技术栈

### 前端
- Vue 3
- Vite
- Element Plus
- ECharts
- Axios

### 后端
- Express
- SQLite (better-sqlite3)
- CORS
- Body-parser

## 开发模式

```bash
# 启动后端开发服务器
cd Server && npm run dev

# 启动前端开发服务器
cd Page && npm run dev
```

前端开发服务器默认运行在 5173 端口，会自动代理 API 请求到后端。
