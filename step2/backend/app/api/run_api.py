"""运行接口层。

统一返回 ApiResponse，错误由 AppException + 全局异常处理器转换。
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.error_codes import RUN_NOT_FOUND, TASK_NOT_FOUND
from app.core.exceptions import AppException
from app.schemas.common import ApiResponse, success_response
from app.schemas.run import RunResultOut, RunStartOut, RunSummaryOut, StepTraceOut, ToolCallOut
from app.services.runs.run_service import RunService
from app.services.tasks.task_service import TaskService
from app.workers.task_worker import execute_run

router = APIRouter(tags=["runs"])


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


@router.post("/api/tasks/{task_id}/run", response_model=ApiResponse[RunStartOut], status_code=202)
def start_run(task_id: str, request: Request, db: Session = Depends(get_db)):
    """启动任务执行，异步投递到 Celery。"""
    task = TaskService.get_task(db, task_id)
    if not task:
        raise AppException(code=TASK_NOT_FOUND, message="任务不存在", status_code=404)

    run = RunService.create_run(db, task)
    execute_run.delay(run.id)

    data = RunStartOut(
        run_id=run.id,
        task_id=run.task_id,
        trace_id=run.trace_id,
        status=run.status,
        started_at=run.start_time,
    )
    return success_response(data, request_id=_request_id(request))


@router.get("/api/runs/{run_id}", response_model=ApiResponse[RunSummaryOut])
def get_run(run_id: str, request: Request, db: Session = Depends(get_db)):
    """查询运行摘要。"""
    run = RunService.get_run(db, run_id)
    if not run:
        raise AppException(code=RUN_NOT_FOUND, message="运行实例不存在", status_code=404)

    data = RunSummaryOut(
        run_id=run.id,
        task_id=run.task_id,
        trace_id=run.trace_id,
        status=run.status,
        start_time=run.start_time,
        end_time=run.end_time,
        final_summary=run.final_summary,
    )
    return success_response(data, request_id=_request_id(request))


@router.get("/api/runs/{run_id}/result", response_model=ApiResponse[RunResultOut])
def get_run_result(run_id: str, request: Request, db: Session = Depends(get_db)):
    """查询结构化运行结果。"""
    run = RunService.get_run(db, run_id)
    if not run:
        raise AppException(code=RUN_NOT_FOUND, message="运行实例不存在", status_code=404)

    data = RunResultOut(
        run_id=run.id,
        task_id=run.task_id,
        trace_id=run.trace_id,
        status=run.status,
        result_json=run.result_json,
    )
    return success_response(data, request_id=_request_id(request))


@router.get("/api/runs/{run_id}/trace", response_model=ApiResponse[list[StepTraceOut]])
def get_trace(run_id: str, request: Request, db: Session = Depends(get_db)):
    """查询步骤轨迹。"""
    run = RunService.get_run(db, run_id)
    if not run:
        raise AppException(code=RUN_NOT_FOUND, message="运行实例不存在", status_code=404)

    traces = RunService.list_trace(db, run_id)
    data = [
        StepTraceOut(
            step_index=t.step_index,
            phase=t.phase,
            decision=t.decision,
            observation=t.observation,
            created_at=t.created_at,
        )
        for t in traces
    ]
    return success_response(data, request_id=_request_id(request))


@router.get("/api/runs/{run_id}/tool-calls", response_model=ApiResponse[list[ToolCallOut]])
def get_tool_calls(run_id: str, request: Request, db: Session = Depends(get_db)):
    """查询工具调用日志。"""
    run = RunService.get_run(db, run_id)
    if not run:
        raise AppException(code=RUN_NOT_FOUND, message="运行实例不存在", status_code=404)

    logs = RunService.list_tool_calls(db, run_id)
    data = [
        ToolCallOut(
            tool_name=l.tool_name,
            input_payload=l.input_payload,
            output_payload=l.output_payload,
            success=l.success,
            error_type=l.error_type,
            duration_ms=l.duration_ms,
            created_at=l.created_at,
        )
        for l in logs
    ]
    return success_response(data, request_id=_request_id(request))


@router.post("/api/runs/{run_id}/retry", response_model=ApiResponse[dict], status_code=202)
def retry_run(run_id: str, request: Request, db: Session = Depends(get_db)):
    """手动重试：重新投递当前 run。"""
    run = RunService.get_run(db, run_id)
    if not run:
        raise AppException(code=RUN_NOT_FOUND, message="运行实例不存在", status_code=404)

    execute_run.delay(run.id)
    return success_response({"run_id": run_id, "status": "queued"}, message="run_requeued", request_id=_request_id(request))
