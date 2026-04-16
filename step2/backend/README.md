# MyClaw 后端（Step2）

本目录是 MyClaw 后端的最小可运行实现，当前技术栈为：
- FastAPI
- Celery + Redis
- MySQL + SQLAlchemy

---

## 1. 环境准备

- Python 3.12+
- MySQL（本地或容器）
- Redis（本地或容器）

安装依赖：

```bash
pip install -r requirements.txt
```

复制环境变量文件：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

---

## 2. 启动服务

请在 `step2/backend` 目录执行。

### 2.1 启动 API 服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2.2 启动 Celery Worker

```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=info --pool=solo
```

> Windows 下推荐使用 `--pool=solo`，更稳定。

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
- `request_id` 来自请求头 `X-Request-Id`（若存在则透传）；
- 若未提供 `X-Request-Id`，后端会自动生成；
- 响应头也会回写 `X-Request-Id`，便于日志排查。

---

## 4. 分页响应格式（任务列表示例）

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
- 生成结构化结果，并同时写入 `run.final_summary` 和 `run.result_json`。

### `final_summary` 和 `result_json` 的区别

- `final_summary`
  - 类型：`Text` 字符串
  - 作用：兼容旧逻辑，适合直接打印、日志查看
  - 当前内容：把最终结果序列化成 JSON 字符串保存
  - 适合：排查问题、兼容旧前端、快速查看

- `result_json`
  - 类型：`JSON` 结构化对象
  - 作用：给前端和后续统计分析直接消费
  - 当前内容：保存结构化巡检结果（例如 `task_status`、`page_results`、`missing_selectors`、`llm_summary`）
  - 适合：结果页展示、筛选统计、接口二次消费

### 推荐 payload 示例（开发联调可设置 `verify_ssl: false`）

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
    "verify_ssl": false,
    "use_llm": false
  }
}
```

---

## 6. 主要接口示例

### 6.1 创建任务

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

### 6.2 启动运行

`POST /api/tasks/{task_id}/run`

### 6.3 查询运行摘要

`GET /api/runs/{run_id}`

- 返回 `final_summary`：字符串形式的最终总结，适合快速查看与兼容旧逻辑
- 返回 `status`：运行状态（running/success/failed 等）

### 6.4 查询结构化结果

`GET /api/runs/{run_id}/result`

- 返回 `result_json`：结构化结果，适合前端渲染和统计分析
- 如果启用了 LLM，也会把 `llm_summary` 等字段一并带上

---

## 7. 最小测试

当前提供最小主链路测试：
- 创建任务（验证统一响应 + request_id）
- 启动 run（验证主链路返回）
- 查询 result（验证结构化结果返回）

运行命令：

```bash
pytest -q
```

若报错 `No module named 'fastapi'`，请先安装依赖：

```bash
pip install -r requirements.txt
```

---

## 8. 目录说明

- `app/api/`：接口层（HTTP / WebSocket）
- `app/services/`：业务编排层（按功能域拆分：`tasks/`、`runs/`、`traces/`、`llm/`、`web_health_check/`、`scenario_regression/`）
- `app/repositories/`：数据访问层
- `app/models/`：ORM 实体
- `app/schemas/`：请求/响应模型
- `app/core/`：配置、中间件、异常处理、错误码
- `app/workers/`：Celery Worker
- `tests/`：测试
