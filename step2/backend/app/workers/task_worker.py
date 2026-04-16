"""任务执行 Worker（Celery）。

当前实现：
- 支持按 task_type 分发执行；
- 已接入 web_health_check 真实巡检逻辑；
- 其他类型暂走 mock 链路（便于渐进式扩展）。
"""

import json
from datetime import datetime, timezone
from time import perf_counter, sleep
from typing import Any

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.error_codes import RUN_NOT_FOUND, TASK_NOT_FOUND
from app.repositories.run_repository import RunRepository
from app.repositories.task_repository import TaskRepository
from app.services.scenario_regression.scenario_regression_service import ScenarioRegressionService
from app.services.traces.trace_service import TraceService
from app.services.web_health_check.web_health_check_service import WebHealthCheckService
from app.workers.celery_app import celery_app


def _ws_event(event: str, run_id: str, trace_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """构造统一 WS 事件格式。"""
    return {
        "event": event,
        "run_id": run_id,
        "trace_id": trace_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }


def _execute_mock_pipeline(db: Session, run_id: str) -> dict[str, Any]:
    """默认 mock 执行流程（其他 task_type 占位）。"""
    phases = ["plan", "act", "observe", "deliver"]
    for idx, phase in enumerate(phases, start=1):
        start = perf_counter()
        TraceService.add_step(
            db,
            run_id=run_id,
            step_index=idx,
            phase=phase,
            decision=f"execute phase: {phase}",
            observation=f"phase {phase} completed",
        )
        TraceService.add_tool_call(
            db,
            run_id=run_id,
            tool_name=f"mock_{phase}_tool",
            input_payload={"phase": phase},
            output_payload={"ok": True},
            success=True,
            error_type=None,
            duration_ms=int((perf_counter() - start) * 1000),
        )
        sleep(0.2)

    return {"task_status": "success", "summary": "Mock execution finished successfully."}


def _execute_web_health_check(db: Session, run_id: str, input_payload: dict[str, Any]) -> dict[str, Any]:
    """执行 Web Health Check 并记录轨迹与工具日志。"""
    TraceService.add_step(
        db,
        run_id=run_id,
        step_index=1,
        phase="plan",
        decision="解析页面巡检配置",
        observation="已读取 base_url/pages/required_selectors",
    )

    start = perf_counter()
    result = WebHealthCheckService.execute(input_payload)
    duration_ms = int((perf_counter() - start) * 1000)
    success = result.get("task_status") == "success"

    TraceService.add_tool_call(
        db,
        run_id=run_id,
        tool_name="web_health_check_http",
        input_payload=input_payload,
        output_payload=result,
        success=success,
        error_type=None if success else "health_check_failed",
        duration_ms=duration_ms,
    )

    summary = result.get("summary", "")
    TraceService.add_step(
        db,
        run_id=run_id,
        step_index=2,
        phase="observe",
        decision="汇总页面可达性与元素检查结果",
        observation=summary,
    )

    TraceService.add_step(
        db,
        run_id=run_id,
        step_index=3,
        phase="deliver",
        decision="输出结构化巡检结果",
        observation=summary,
    )

    return result


@celery_app.task(bind=True, max_retries=2)
def execute_run(_self, run_id: str):
    """执行 run 主流程。"""
    db: Session = SessionLocal()
    try:
        run = RunRepository.get_by_id(db, run_id)
        if not run:
            return {"ok": False, "error": RUN_NOT_FOUND, "run_id": run_id}

        task = TaskRepository.get_by_id(db, run.task_id)
        if not task:
            run.status = "failed"
            run.end_time = datetime.now(timezone.utc)
            run.final_summary = TASK_NOT_FOUND
            RunRepository.save(db, run)
            return {"ok": False, "error": TASK_NOT_FOUND, "run_id": run_id}

        if task.task_type == "web_health_check":
            result = _execute_web_health_check(db, run_id=run.id, input_payload=task.input_payload)
        elif task.task_type == "scenario_regression":
            result = ScenarioRegressionService.execute(db, run_id=run.id, input_payload=task.input_payload)
        else:
            result = _execute_mock_pipeline(db, run_id=run.id)

        run.status = "success" if result.get("task_status") == "success" else "failed"
        run.end_time = datetime.now(timezone.utc)
        run.final_summary = json.dumps(result, ensure_ascii=False)
        run.result_json = result
        RunRepository.save(db, run)

        event_name = "run.succeeded" if run.status == "success" else "run.failed"
        return {
            "ok": run.status == "success",
            "event": _ws_event(event_name, run.id, run.trace_id, {"summary": result.get("summary", "")}),
        }
    except Exception as exc:
        run = RunRepository.get_by_id(db, run_id)
        if run:
            run.status = "failed"
            run.end_time = datetime.now(timezone.utc)
            run.final_summary = str(exc)
            RunRepository.save(db, run)
        raise
    finally:
        db.close()
