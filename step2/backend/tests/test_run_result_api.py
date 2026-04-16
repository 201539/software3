"""run 结果接口最小测试。"""

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app


@dataclass
class _FakeRun:
    id: str
    task_id: str
    trace_id: str
    status: str
    result_json: dict


def _override_db():
    yield None


def test_get_run_result(monkeypatch):
    """结构化结果接口应返回 result_json。"""

    fake_run = _FakeRun(
        id="run_test_result_001",
        task_id="task_test_result_001",
        trace_id="trace_test_result_001",
        status="success",
        result_json={
            "task_status": "success",
            "summary": "所有页面可访问且关键元素存在",
            "llm_summary": "LLM summary here",
        },
    )

    def fake_get_run(_db, _run_id):
        return fake_run

    monkeypatch.setattr("app.api.run_api.RunService.get_run", fake_get_run)
    app.dependency_overrides[get_db] = _override_db

    client = TestClient(app)
    resp = client.get("/api/runs/run_test_result_001/result")

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "ok"
    assert body["data"]["run_id"] == "run_test_result_001"
    assert body["data"]["result_json"]["task_status"] == "success"
    assert body["data"]["result_json"]["llm_summary"] == "LLM summary here"

    app.dependency_overrides.clear()
