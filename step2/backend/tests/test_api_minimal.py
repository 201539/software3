"""最小化 API 测试。

目标：
1. 验证 request_id 中间件生效；
2. 验证任务创建接口主链路可用；
3. 验证 run 启动接口主链路可用。

说明：
- 通过 monkeypatch 替换 Service/Worker，避免依赖真实数据库与 Celery。
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app


@dataclass
class _FakeTask:
    id: str
    task_type: str
    status: str
    created_at: datetime


@dataclass
class _FakeRun:
    id: str
    task_id: str
    trace_id: str
    status: str
    start_time: datetime


def _override_db():
    yield None


def test_create_task_with_request_id(monkeypatch):
    """创建任务：应返回统一响应并携带 request_id。"""

    def fake_create_task(_db, payload):
        return _FakeTask(
            id="task_test_001",
            task_type=payload.task_type,
            status="pending",
            created_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr("app.api.task_api.TaskService.create_task", fake_create_task)
    app.dependency_overrides[get_db] = _override_db

    client = TestClient(app)
    resp = client.post(
        "/api/tasks",
        json={"task_type": "web_health_check", "title": "测试任务", "input_payload": {}},
        headers={"X-Request-Id": "req_test_001"},
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["code"] == "ok"
    assert body["request_id"] == "req_test_001"
    assert resp.headers.get("X-Request-Id") == "req_test_001"

    app.dependency_overrides.clear()


def test_start_run_minimal(monkeypatch):
    """启动 run：应成功入队并返回运行实例信息。"""

    fake_task = _FakeTask(
        id="task_test_002",
        task_type="web_health_check",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )

    def fake_get_task(_db, _task_id):
        return fake_task

    def fake_create_run(_db, task):
        return _FakeRun(
            id="run_test_001",
            task_id=task.id,
            trace_id="trace_test_001",
            status="running",
            start_time=datetime.now(timezone.utc),
        )

    class _FakeExecuteRun:
        @staticmethod
        def delay(_run_id):
            return None

    monkeypatch.setattr("app.api.run_api.TaskService.get_task", fake_get_task)
    monkeypatch.setattr("app.api.run_api.RunService.create_run", fake_create_run)
    monkeypatch.setattr("app.api.run_api.execute_run", _FakeExecuteRun)
    app.dependency_overrides[get_db] = _override_db

    client = TestClient(app)
    resp = client.post("/api/tasks/task_test_002/run")

    assert resp.status_code == 202
    body = resp.json()
    assert body["code"] == "ok"
    assert body["data"]["run_id"] == "run_test_001"
    assert body["data"]["trace_id"] == "trace_test_001"
    assert body["request_id"].startswith("req_")

    app.dependency_overrides.clear()
