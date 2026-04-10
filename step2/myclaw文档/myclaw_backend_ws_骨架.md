# MyClaw 后端骨架（FastAPI + Celery + Redis + MySQL + WebSocket）

> 目标：提供一个可直接落地的后端最小骨架，支持“异步任务执行 + WebSocket 实时状态推送”。

---

## 1. 技术栈定稿

- Python: `3.12.2`
- Web 框架: `FastAPI`
- 异步任务队列: `Celery + Redis`
- 数据库: `MySQL`
- ORM: `SQLAlchemy`
- 实时推送: `WebSocket`

---

## 2. 推荐目录结构（最小可用）

```text
backend/
  app/
    main.py
    core/
      config.py
      database.py
      websocket_manager.py
    models/
      task.py
      run.py
      step_trace.py
      tool_call_log.py
    schemas/
      task.py
      run.py
      ws.py
    api/
      task_api.py
      run_api.py
      ws_api.py
    services/
      task_service.py
      run_service.py
      trace_service.py
    workers/
      celery_app.py
      task_worker.py
  requirements.txt
  .env.example
```

---

## 3. 数据表骨架（MySQL）

## 3.1 `task`
- `id` (PK)
- `task_type` (varchar)
- `title` (varchar)
- `input_payload` (json)
- `status` (pending/running/success/failed/degraded)
- `created_at`
- `updated_at`

## 3.2 `run`
- `id` (PK)
- `task_id` (FK)
- `trace_id` (varchar, unique)
- `status`
- `start_time`
- `end_time`
- `final_summary` (text)

## 3.3 `step_trace`
- `id` (PK)
- `run_id` (FK)
- `step_index` (int)
- `phase` (plan/act/observe/reflect/replan/deliver)
- `decision` (text)
- `observation` (text)
- `created_at`

## 3.4 `tool_call_log`
- `id` (PK)
- `run_id` (FK)
- `tool_name` (varchar)
- `input_payload` (json)
- `output_payload` (json)
- `success` (bool)
- `error_type` (varchar, nullable)
- `duration_ms` (int)
- `created_at`

---

## 4. API 接口（按 6 类任务可直接落地）

> 说明：保留通用任务/运行接口，同时补充 6 个任务方向的专用创建接口（都可复用统一执行链路 `POST /api/tasks/{task_id}/run`）。

## 4.1 通用任务接口

### 4.1.1 创建任务（通用）
- `POST /api/tasks`
- 用途：按 `task_type` 创建任意任务。

**Request Body（通用）**
```json
{
  "task_type": "web_health_check",
  "title": "首页与登录页巡检",
  "input_payload": {},
  "priority": "normal",
  "timeout_ms": 30000,
  "retry_policy": {
    "max_retries": 2,
    "backoff_ms": 1500
  }
}
```

**Response 201**
```json
{
  "task_id": "task_001",
  "task_type": "web_health_check",
  "status": "pending",
  "created_at": "2026-04-10T12:00:00Z"
}
```

### 4.1.2 任务列表
- `GET /api/tasks?task_type=&status=&page=1&page_size=20`

### 4.1.3 任务详情
- `GET /api/tasks/{task_id}`

## 4.2 六类任务专用创建接口（对应 `myclaw.md` 102-125）

### 4.2.1 网页巡检与可用性检查（Web Health Check）
- `POST /api/tasks/web-health-check`

**Request Body**
```json
{
  "title": "门户站点基础巡检",
  "base_url": "https://example.com",
  "pages": ["/", "/login", "/dashboard"],
  "required_selectors": {
    "/": ["#nav", "#login-btn"],
    "/login": ["input[name='username']", "button[type='submit']"]
  },
  "timeout_ms": 15000
}
```

### 4.2.2 业务流程回归验证（Scenario Regression）
- `POST /api/tasks/scenario-regression`

**Request Body**
```json
{
  "title": "登录-查询-提交主链路回归",
  "scenario_name": "core_flow_v1",
  "steps": [
    {"name": "login", "action": "fill_and_click"},
    {"name": "search", "action": "input_and_enter"},
    {"name": "submit", "action": "click"}
  ],
  "assertions": [
    {"step": "login", "expect": "text:欢迎"},
    {"step": "submit", "expect": "text:提交成功"}
  ],
  "retry_policy": {"max_retries": 2, "backoff_ms": 1000}
}
```

### 4.2.3 表单自动填写与校验（Form Automation）
- `POST /api/tasks/form-automation`

**Request Body**
```json
{
  "title": "报名表单自动提交",
  "form_url": "https://example.com/form",
  "field_mapping": {
    "name": "张三",
    "student_id": "20260001",
    "email": "zhangsan@example.com"
  },
  "validation_rules": {
    "email": "email",
    "student_id": "regex:^\\d{8}$"
  },
  "submit_selector": "button[type='submit']"
}
```

### 4.2.4 网页信息采集与结构化（Web Extraction）
- `POST /api/tasks/web-extraction`

**Request Body**
```json
{
  "title": "课程公告采集",
  "seed_urls": ["https://example.com/news"],
  "extract_schema": {
    "title": "css:.item-title",
    "publish_time": "css:.item-time",
    "url": "css:a@href"
  },
  "pagination_rule": {"type": "next_button", "selector": ".next"},
  "max_pages": 5
}
```

### 4.2.5 CI/CD 结果网页巡检（DevOps Web Ops）
- `POST /api/tasks/cicd-inspection`

**Request Body**
```json
{
  "title": "GitLab pipeline 失败分析",
  "platform": "gitlab",
  "project_url": "https://gitlab.example.com/group/proj",
  "pipeline_id": "18273",
  "focus_jobs": ["build", "unit_test", "e2e_test"]
}
```

### 4.2.6 发布前冒烟检查与门禁（Release Gate）
- `POST /api/tasks/release-gate`

**Request Body**
```json
{
  "title": "v1.3.0 发布门禁",
  "release_version": "v1.3.0",
  "smoke_suite": ["login_smoke", "order_smoke", "payment_smoke"],
  "pass_threshold": 0.95,
  "rollback_policy": "auto_create_rollback_ticket"
}
```

## 4.3 运行接口（统一）

### 4.3.1 启动任务
- `POST /api/tasks/{task_id}/run`
- 用途：创建 `run` 并投递到 Celery。

**Response 202**
```json
{
  "run_id": "run_001",
  "task_id": "task_001",
  "trace_id": "trace_001",
  "status": "running",
  "started_at": "2026-04-10T12:01:00Z"
}
```

### 4.3.2 查询运行摘要
- `GET /api/runs/{run_id}`

### 4.3.3 查询步骤轨迹
- `GET /api/runs/{run_id}/trace`

### 4.3.4 查询工具调用日志
- `GET /api/runs/{run_id}/tool-calls`

### 4.3.5 手动重试（可选）
- `POST /api/runs/{run_id}/retry`

## 4.4 结果接口（按任务方向统一输出）

### 4.4.1 获取最终结果
- `GET /api/runs/{run_id}/result`
- 用途：返回与任务类型对应的结构化字段（例如 `page_results`、`failed_steps`、`records`、`gate_decision` 等）。

### 4.4.2 导出结果
- `GET /api/runs/{run_id}/export?format=json|csv`

## 4.5 WebSocket 接口
- `GET /ws/runs/{run_id}`（WebSocket）
  - 前端连接后，后端按事件推送状态。

## 4.6 标准化响应 Schema（联调建议）

### 4.6.1 通用响应包络

**成功响应（同步接口）**
```json
{
  "code": "OK",
  "message": "success",
  "request_id": "req_20260410_001",
  "data": {}
}
```

**失败响应（同步接口）**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "invalid input_payload",
  "request_id": "req_20260410_002",
  "error": {
    "type": "validation",
    "detail": "field 'pages' is required",
    "retryable": false,
    "suggestion": "补充 pages 后重试"
  }
}
```

**异步启动响应（run）**
```json
{
  "code": "ACCEPTED",
  "message": "run queued",
  "request_id": "req_20260410_003",
  "data": {
    "task_id": "task_001",
    "run_id": "run_001",
    "trace_id": "trace_001",
    "status": "running"
  }
}
```

### 4.6.2 状态枚举
- `task.status`: `pending | running | success | failed | degraded | cancelled`
- `run.status`: `queued | running | success | failed | degraded | cancelled`
- `phase`: `plan | act | observe | reflect | replan | deliver`

### 4.6.3 各关键接口响应结构

#### A) `POST /api/tasks` 与 6 类专用创建接口

**Response 201**
```json
{
  "code": "OK",
  "message": "task created",
  "request_id": "req_20260410_004",
  "data": {
    "task_id": "task_001",
    "task_type": "web_health_check",
    "status": "pending",
    "created_at": "2026-04-10T12:00:00Z"
  }
}
```

#### B) `GET /api/tasks/{task_id}`

**Response 200**
```json
{
  "code": "OK",
  "message": "success",
  "request_id": "req_20260410_005",
  "data": {
    "task_id": "task_001",
    "task_type": "scenario_regression",
    "title": "登录-查询-提交主链路回归",
    "input_payload": {},
    "status": "running",
    "created_at": "2026-04-10T12:00:00Z",
    "updated_at": "2026-04-10T12:02:00Z"
  }
}
```

#### C) `GET /api/runs/{run_id}`

**Response 200**
```json
{
  "code": "OK",
  "message": "success",
  "request_id": "req_20260410_006",
  "data": {
    "run_id": "run_001",
    "task_id": "task_001",
    "trace_id": "trace_001",
    "status": "running",
    "start_time": "2026-04-10T12:01:00Z",
    "end_time": null,
    "metrics": {
      "tool_call_total": 3,
      "tool_call_success_rate": 0.67,
      "retry_count": 1
    },
    "final_summary": null
  }
}
```

#### D) `GET /api/runs/{run_id}/trace`

**Response 200**
```json
{
  "code": "OK",
  "message": "success",
  "request_id": "req_20260410_007",
  "data": {
    "run_id": "run_001",
    "trace": [
      {
        "step_index": 1,
        "phase": "plan",
        "decision": "先检查登录页可访问性",
        "observation": "计划生成成功",
        "created_at": "2026-04-10T12:01:05Z"
      }
    ]
  }
}
```

#### E) `GET /api/runs/{run_id}/tool-calls`

**Response 200**
```json
{
  "code": "OK",
  "message": "success",
  "request_id": "req_20260410_008",
  "data": {
    "run_id": "run_001",
    "tool_calls": [
      {
        "tool_name": "playwright.click",
        "success": false,
        "error_type": "ELEMENT_NOT_FOUND",
        "duration_ms": 1220,
        "created_at": "2026-04-10T12:01:20Z"
      }
    ]
  }
}
```

#### F) `GET /api/runs/{run_id}/result`

**Response 200（示例：release_gate）**
```json
{
  "code": "OK",
  "message": "success",
  "request_id": "req_20260410_009",
  "data": {
    "run_id": "run_001",
    "task_type": "release_gate",
    "task_status": "success",
    "gate_decision": "allow",
    "suite_pass_rate": 0.97,
    "critical_failures": [],
    "rollback_advice": "无需回滚"
  }
}
```

### 4.6.4 分任务类型结果字段映射
- `web_health_check`：`page_results`, `missing_selectors`, `screenshots`, `summary`
- `scenario_regression`：`step_pass_rate`, `failed_steps`, `evidence`, `fix_suggestion`
- `form_automation`：`submitted_data_snapshot`, `validation_errors`, `receipt_info`, `retry_count`
- `web_extraction`：`records`, `record_count`, `duplicate_count`, `quality_report`
- `cicd_inspection`：`pipeline_status`, `failed_jobs`, `error_digest`, `priority_fix_list`
- `release_gate`：`gate_decision`, `suite_pass_rate`, `critical_failures`, `rollback_advice`

## 4.7 错误码表（建议）

### 4.7.1 通用错误码
| code | HTTP | 场景 | retryable |
|---|---:|---|---|
| `VALIDATION_ERROR` | 400 | 请求参数缺失/格式错误 | false |
| `UNAUTHORIZED` | 401 | 未登录或 token 失效 | false |
| `FORBIDDEN` | 403 | 无权限访问任务/运行 | false |
| `NOT_FOUND` | 404 | task/run 不存在 | false |
| `CONFLICT` | 409 | 幂等冲突/重复启动 run | false |
| `TOO_MANY_REQUESTS` | 429 | 限流触发 | true |
| `INTERNAL_ERROR` | 500 | 未分类后端异常 | true |
| `DEPENDENCY_UNAVAILABLE` | 503 | Redis/MySQL/外部平台不可用 | true |

### 4.7.2 执行域错误码（Agent + Tool）
| code | HTTP | 场景 | retryable |
|---|---:|---|---|
| `RUN_ALREADY_FINISHED` | 409 | 已结束 run 不可再次推进 | false |
| `RUN_TIMEOUT` | 504 | 整体运行超时 | true |
| `PLAN_GENERATION_FAILED` | 500 | 计划生成失败 | true |
| `TOOL_CALL_FAILED` | 500 | 工具调用失败（兜底） | true |
| `ELEMENT_NOT_FOUND` | 422 | 页面元素不存在 | true |
| `NAVIGATION_TIMEOUT` | 504 | 页面导航超时 | true |
| `ASSERTION_FAILED` | 422 | 断言不通过 | true |
| `TARGET_UNREACHABLE` | 502 | 目标系统不可达 | true |
| `MAX_RETRIES_EXCEEDED` | 409 | 超过重试上限 | false |
| `DEGRADED_COMPLETION` | 200 | 降级完成（部分目标未达成） | false |

### 4.7.3 错误响应示例
```json
{
  "code": "ELEMENT_NOT_FOUND",
  "message": "required selector missing on /login",
  "request_id": "req_20260410_010",
  "error": {
    "type": "tool",
    "detail": "selector '#login-btn' not found within 8000ms",
    "retryable": true,
    "suggestion": "检查页面版本是否变更，或更新 required_selectors"
  }
}
```

---

## 5. WebSocket 事件协议（建议）

所有消息统一结构：

```json
{
  "event": "run.status",
  "run_id": "xxx",
  "trace_id": "xxx",
  "timestamp": "2026-04-10T12:00:00Z",
  "data": {}
}
```

### 5.1 事件类型
1. `run.started`
2. `run.status`
3. `run.step`
4. `run.tool_call`
5. `run.retry`
6. `run.failed`
7. `run.succeeded`

### 5.2 示例

`run.step`:

```json
{
  "event": "run.step",
  "run_id": "run_001",
  "trace_id": "trace_001",
  "timestamp": "2026-04-10T12:00:10Z",
  "data": {
    "step_index": 2,
    "phase": "observe",
    "message": "登录页元素检测完成"
  }
}
```

---

## 6. 任务执行链路（Celery + WS）

1. 前端调用 `POST /api/tasks/{task_id}/run`
2. 后端创建 `run` 记录，状态 `running`
3. 后端提交 Celery 任务（`task_worker.execute_run(run_id)`）
4. Worker 执行阶段：
   - Plan
   - Act（工具调用）
   - Observe
   - Reflect（按需）
   - Re-plan（按需）
   - Deliver
5. 每个阶段写 DB + 推送 WS 事件
6. 完成后更新 run 状态，推送 `run.succeeded` 或 `run.failed`

---

## 7. 核心代码骨架（伪代码级）

## 7.1 `websocket_manager.py`

```python
class WSManager:
    def __init__(self):
        self.connections = {}  # run_id -> set(websocket)

    async def connect(self, run_id, websocket):
        await websocket.accept()
        self.connections.setdefault(run_id, set()).add(websocket)

    def disconnect(self, run_id, websocket):
        if run_id in self.connections:
            self.connections[run_id].discard(websocket)

    async def broadcast(self, run_id, message: dict):
        for ws in list(self.connections.get(run_id, [])):
            await ws.send_json(message)
```

## 7.2 `task_worker.py`

```python
@celery_app.task(bind=True, max_retries=2)
def execute_run(self, run_id: str):
    publish(run_id, "run.started", {...})
    try:
        plan = do_plan(run_id)
        publish(run_id, "run.step", {"phase": "plan"})

        for step in plan:
            result = call_tool(step)
            publish(run_id, "run.tool_call", result)

            if not result["success"]:
                publish(run_id, "run.retry", {"reason": result["error"]})
                # reflect + retry / replan

        publish(run_id, "run.succeeded", {"summary": "..."})
    except Exception as e:
        publish(run_id, "run.failed", {"error": str(e)})
        raise
```

---

## 8. 环境变量骨架（`.env.example`）

```env
APP_ENV=dev
APP_HOST=0.0.0.0
APP_PORT=8000

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DB=myclaw
MYSQL_USER=root
MYSQL_PASSWORD=your_password

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

---

## 9. `requirements.txt` 建议

```txt
fastapi
uvicorn[standard]
sqlalchemy
pymysql
alembic
pydantic
python-dotenv
celery
redis
```

---

## 10. 第一阶段开发顺序（建议）

1. 起 FastAPI + MySQL + SQLAlchemy 基础 CRUD
2. 打通 `POST /tasks` 与 `POST /tasks/{id}/run`
3. 接入 Celery + Redis，任务可后台执行
4. 实现 WebSocket 连接与 `run.status` 推送
5. 补 `run.step` / `run.tool_call` / `run.failed|succeeded` 事件
6. 前端接入 WebSocket 实时显示状态

---

## 11. 验收标准（骨架完成）

满足以下即算骨架可用：
- 能创建任务并启动执行；
- Celery Worker 能异步跑任务；
- 前端能通过 WebSocket看到状态实时变化；
- 运行日志与步骤轨迹可落库；
- 任务结束能给出结构化结果。