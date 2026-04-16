"""轨迹服务。"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.step_trace import StepTrace
from app.models.tool_call_log import ToolCallLog
from app.repositories.trace_repository import TraceRepository


class TraceService:
    @staticmethod
    def add_step(
        db: Session,
        run_id: str,
        step_index: int,
        phase: str,
        decision: str | None = None,
        observation: str | None = None,
    ) -> StepTrace:
        step = StepTrace(
            run_id=run_id,
            step_index=step_index,
            phase=phase,
            decision=decision,
            observation=observation,
        )
        return TraceRepository.create_step(db, step)

    @staticmethod
    def add_tool_call(
        db: Session,
        run_id: str,
        tool_name: str,
        input_payload: dict,
        output_payload: dict | None,
        success: bool,
        error_type: str | None,
        duration_ms: int,
    ) -> ToolCallLog:
        log = ToolCallLog(
            run_id=run_id,
            tool_name=tool_name,
            input_payload=input_payload,
            output_payload=output_payload,
            success=success,
            error_type=error_type,
            duration_ms=duration_ms,
        )
        return TraceRepository.create_tool_call(db, log)


def utc_now():
    return datetime.now(timezone.utc)
