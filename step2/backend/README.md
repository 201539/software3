# MyClaw Backend（Step2）

本目录是 MyClaw 后端服务的最小可运行实现（FastAPI + Celery + Redis + MySQL）。

## 1. 环境准备

- Python 3.12+
- MySQL（本地或容器）
- Redis（本地或容器）

安装依赖：

```bash
pip install -r requirements.txt
```

配置环境变量：

```bash
cp .env.example .env
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env
```

---

## 2. 启动服务

在 `step2/backend` 目录执行。

### 2.1 启动 API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2.2 启动 Celery Worker

```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=info
```

---

## 3. 统一响应格式

所有 HTTP 接口统一返回结构：

```json
{
  "code": "ok",
  "message": "success",
  "data": {},
  "request_id": "req_abc123"
}
```

说明：
- `request_id` 来自请求头 `X-Request-Id`（透传），若未传则后端自动生成；
- 响应头也会带 `X-Request-Id`，用于日志排查。

---

## 4. 分页响应格式（以任务列表为例）

接口：`GET /api/tasks?page=1&page_size=20`

示例响应：

```json
{
  "code": "ok",
  "message": "success",
  "data": {
    "items": [
      {
        "task_id": "task_001",
        "task_type": "web_health_check",
        "status": "pending",
        "created_at": "2026-04-10T12:00:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "page_size": 20,
      "total": 53,
      "total_pages": 3
    }
  },
  "request_id": "req_abc123"
}
```

---

## 5. Web Health Check（已接入真实执行）

当 `task_type=web_health_check` 时，worker 会执行真实网页巡检逻辑：
- 访问目标页面；
- 校验页面是否可达；
- 校验关键 CSS 选择器是否存在；
- 生成结构化结果并写入 `run.final_summary`（JSON 字符串）。

推荐 payload 示例（开发联调可设置 `verify_ssl: false`）：

```json
{
  "task_type": "web_health_check",
  "title": "首页与登录页巡检",
  "input_payload": {
    "base_url": "https://example.com",
    "pages": ["/", "/login"],
    "required_selectors": {
      "/": ["#nav", "#login-btn"],
      "/login": ["input[name='username']", "button[type='submit']"]
    },
    "timeout_ms": 15000,
    "verify_ssl": false
  }
}
```

---

## 6. 主要接口示例

### 5.1 创建任务

`POST /api/tasks`

请求体：

```json
{
  "task_type": "web_health_check",
  "title": "首页巡检",
  "input_payload": {
    "base_url": "https://example.com",
    "pages": ["/", "/login"]
  }
}
```

### 5.2 启动运行

`POST /api/tasks/{task_id}/run`

### 5.3 查询运行摘要

`GET /api/runs/{run_id}`

---

## 6. 最小测试运行

当前已提供最小主链路测试：
- 创建任务（验证统一响应 + request_id）
- 启动 run（验证主链路返回）

运行：

```bash
pytest -q
```

如果报错 `No module named 'fastapi'`，先安装依赖：

```bash
pip install -r requirements.txt
```

---

## 7. 目录说明（核心）

- `app/api/`：接口层（HTTP / WebSocket）
- `app/services/`：业务编排层
- `app/repositories/`：数据访问层
- `app/models/`：ORM 实体
- `app/schemas/`：请求/响应模型
- `app/core/`：配置、中间件、异常处理、错误码
- `app/workers/`：Celery worker
- `tests/`：测试
