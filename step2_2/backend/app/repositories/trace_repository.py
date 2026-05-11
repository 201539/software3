from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trace import EvaluationTrace, ToolCallLog
from app.repositories.base import BaseRepository


class TraceRepository(BaseRepository):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def list_traces(self, run_id: int, sample_id: int | None = None) -> list[EvaluationTrace]:
        stmt = select(EvaluationTrace).where(EvaluationTrace.run_id == run_id)
        if sample_id is not None:
            stmt = stmt.where(EvaluationTrace.sample_id == sample_id)
        return list(self.session.scalars(stmt).all())

    def get_trace_by_id(self, trace_id: int) -> EvaluationTrace | None:
        return self.session.get(EvaluationTrace, trace_id)

    def create_trace(self, trace: EvaluationTrace) -> EvaluationTrace:
        self.session.add(trace)
        self.session.commit()
        self.session.refresh(trace)
        return trace

    def list_tool_calls(self, run_id: int, sample_id: int | None = None) -> list[ToolCallLog]:
        stmt = select(ToolCallLog).where(ToolCallLog.run_id == run_id)
        if sample_id is not None:
            stmt = stmt.where(ToolCallLog.sample_id == sample_id)
        return list(self.session.scalars(stmt).all())

    def create_tool_call(self, tool_call: ToolCallLog) -> ToolCallLog:
        self.session.add(tool_call)
        self.session.commit()
        self.session.refresh(tool_call)
        return tool_call
