"""Repository 协议定义（可替换实现的抽象契约）。"""

from typing import Protocol

from sqlalchemy.orm import Session

from app.models.run import Run
from app.models.step_trace import StepTrace
from app.models.task import Task
from app.models.tool_call_log import ToolCallLog


class TaskRepositoryProtocol(Protocol):
    def create(self, db: Session, task: Task) -> Task: ...
    def get_by_id(self, db: Session, task_id: str) -> Task | None: ...
    def list_tasks(
        self,
        db: Session,
        task_type: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ) -> list[Task]: ...


class RunRepositoryProtocol(Protocol):
    def create(self, db: Session, run: Run) -> Run: ...
    def get_by_id(self, db: Session, run_id: str) -> Run | None: ...
    def save(self, db: Session, run: Run) -> Run: ...


class TraceRepositoryProtocol(Protocol):
    def create_step(self, db: Session, step: StepTrace) -> StepTrace: ...
    def create_tool_call(self, db: Session, tool_call: ToolCallLog) -> ToolCallLog: ...
    def list_steps_by_run(self, db: Session, run_id: str) -> list[StepTrace]: ...
    def list_tool_calls_by_run(self, db: Session, run_id: str) -> list[ToolCallLog]: ...
