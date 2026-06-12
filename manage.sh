#!/bin/bash

# WeSave 项目部署管理脚本
# 前端: 80 端口 (nginx)
# 后端: 8088 端口 (node)

PROJECT_DIR="/root/workplace_shop/WeSave"
SERVER_DIR="$PROJECT_DIR/Server"
NGINX_CONF="$PROJECT_DIR/nginx.conf"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印信息函数
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查后端进程
check_backend() {
    if pgrep -f "node.*src/app.js" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# 检查 nginx 进程
check_nginx() {
    if pgrep nginx > /dev/null; then
        return 0
    else
        return 1
    fi
}

# 启动服务
start() {
    print_info "启动服务..."
    
    # 启动后端 (8088 端口)
    if check_backend; then
        print_warn "后端服务已在运行"
    else
        print_info "启动后端服务 (端口 8088)..."
        cd "$SERVER_DIR"
        nohup node src/app.js > "$PROJECT_DIR/server.log" 2>&1 &
        sleep 2
        if check_backend; then
            print_info "后端服务启动成功"
        else
            print_error "后端服务启动失败，请查看日志: $PROJECT_DIR/server.log"
        fi
    fi
    
    # 启动 nginx (80 端口)
    if check_nginx; then
        print_warn "nginx 已在运行"
    else
        print_info "启动 nginx (端口 80)..."
        nginx -c "$NGINX_CONF"
        sleep 1
        if check_nginx; then
            print_info "nginx 启动成功"
        else
            print_error "nginx 启动失败"
        fi
    fi
    
    echo ""
    print_info "服务状态:"
    status
}

# 停止服务
stop() {
    print_info "停止服务..."
    
    # 停止后端
    if check_backend; then
        print_info "停止后端服务..."
        pkill -f "node.*src/app.js"
        sleep 1
        if ! check_backend; then
            print_info "后端服务已停止"
        else
            print_error "后端服务停止失败"
        fi
    else
        print_warn "后端服务未运行"
    fi
    
    # 停止 nginx
    if check_nginx; then
        print_info "停止 nginx..."
        nginx -s stop
        sleep 1
        if ! check_nginx; then
            print_info "nginx 已停止"
        else
            print_error "nginx 停止失败"
        fi
    else
        print_warn "nginx 未运行"
    fi
}

# 重启服务
restart() {
    print_info "重启服务..."
    stop
    sleep 1
    start
}

# 查看状态
status() {
    echo "===================="
    if check_backend; then
        echo -e "后端服务: ${GREEN}运行中${NC} (端口 8088)"
    else
        echo -e "后端服务: ${RED}未运行${NC}"
    fi
    
    if check_nginx; then
        echo -e "nginx:    ${GREEN}运行中${NC} (端口 80)"
    else
        echo -e "nginx:    ${RED}未运行${NC}"
    fi
    echo "===================="
}

# 查看日志
logs() {
    if [ "$1" == "server" ]; then
        if [ -f "$PROJECT_DIR/server.log" ]; then
            tail -f "$PROJECT_DIR/server.log"
        else
            print_error "后端日志文件不存在"
        fi
    elif [ "$1" == "nginx" ]; then
        tail -f /var/log/nginx/error.log
    else
        print_info "用法: $0 logs [server|nginx]"
    fi
}

# 主函数
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs "$2"
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "命令说明:"
        echo "  start   - 启动前端 (80) 和后端 (8088) 服务"
        echo "  stop    - 停止所有服务"
        echo "  restart - 重启所有服务"
        echo "  status  - 查看服务状态"
        echo "  logs    - 查看日志 (server|nginx)"
        exit 1
        ;;
esac
