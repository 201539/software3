from app.models.trace import EvaluationTrace, ToolCallLog
from app.repositories.trace_repository import TraceRepository
from app.schemas.trace import TraceCreate, ToolCallLogCreate


class TraceManager:
    def __init__(self, trace_repository: TraceRepository) -> None:
        self.trace_repository = trace_repository

    def list_traces(self, run_id: int, sample_id: int | None = None):
        return self.trace_repository.list_traces(run_id=run_id, sample_id=sample_id)

    def get_trace(self, trace_id: int):
        return self.trace_repository.get_trace_by_id(trace_id)

    def create_trace(self, payload: TraceCreate) -> EvaluationTrace:
        trace = EvaluationTrace(
            run_id=payload.run_id,
            sample_id=payload.sample_id,
            step_index=payload.step_index,
            phase=payload.phase,
            decision=payload.decision,
            observation=payload.observation,
            state_snapshot=payload.state_snapshot,
            tool_calls=payload.tool_calls,
        )
        return self.trace_repository.create_trace(trace)

    def list_tool_calls(self, run_id: int, sample_id: int | None = None):
        return self.trace_repository.list_tool_calls(run_id=run_id, sample_id=sample_id)

    def create_tool_call(self, payload: ToolCallLogCreate) -> ToolCallLog:
        tool_call = ToolCallLog(
            run_id=payload.run_id,
            sample_id=payload.sample_id,
            tool_name=payload.tool_name,
            input_payload=payload.input_payload,
            output_payload=payload.output_payload,
            success=payload.success,
            error_type=payload.error_type,
            duration_ms=payload.duration_ms,
        )
        return self.trace_repository.create_tool_call(tool_call)
