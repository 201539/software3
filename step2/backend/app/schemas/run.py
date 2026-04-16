"""运行相关响应 Schema。"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

# 运行状态
RunStatus = Literal["pending", "running", "success", "failed", "degraded"]


class RunStartOut(BaseModel):
    """启动运行接口返回模型。"""

    run_id: str
    task_id: str
    trace_id: str
    status: RunStatus
    started_at: datetime


class RunSummaryOut(BaseModel):
    """运行摘要模型。"""

    run_id: str
    task_id: str
    trace_id: str
    status: RunStatus
    start_time: datetime
    end_time: datetime | None
    final_summary: str | None


class RunResultOut(BaseModel):
    """运行结果模型（结构化）。"""

    run_id: str
    task_id: str
    trace_id: str
    status: RunStatus
    result_json: dict[str, Any] | None


class StepTraceOut(BaseModel):
    """步骤轨迹模型。"""

    step_index: int
    phase: str
    decision: str | None
    observation: str | None
    created_at: datetime


class ToolCallOut(BaseModel):
    """工具调用日志模型。"""

    tool_name: str
    input_payload: dict[str, Any]
    output_payload: dict[str, Any] | None
    success: bool
    error_type: str | None
    duration_ms: int
    created_at: datetime
