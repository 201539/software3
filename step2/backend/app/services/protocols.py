"""Service 协议定义（面向接口编程）。"""

from typing import Protocol

from sqlalchemy.orm import Session

from app.models.run import Run
from app.models.task import Task
from app.schemas.task import TaskCreate


class TaskServiceProtocol(Protocol):
    def create_task(self, db: Session, payload: TaskCreate) -> Task: ...
    def list_tasks(
        self,
        db: Session,
        task_type: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ) -> list[Task]: ...
    def get_task(self, db: Session, task_id: str) -> Task | None: ...


class RunServiceProtocol(Protocol):
    def create_run(self, db: Session, task: Task) -> Run: ...
    def get_run(self, db: Session, run_id: str) -> Run | None: ...
    def list_trace(self, db: Session, run_id: str): ...
    def list_tool_calls(self, db: Session, run_id: str): ...
