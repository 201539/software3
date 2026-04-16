"""任务服务。"""

import uuid

from sqlalchemy.orm import Session

from app.models.task import Task
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate


class TaskService:
    """Task 业务服务。"""

    @staticmethod
    def create_task(db: Session, payload: TaskCreate) -> Task:
        task = Task(
            id=f"task_{uuid.uuid4().hex[:12]}",
            task_type=payload.task_type,
            title=payload.title,
            input_payload=payload.input_payload,
            status="pending",
        )
        return TaskRepository.create(db, task)

    @staticmethod
    def list_tasks(
        db: Session,
        task_type: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ):
        return TaskRepository.list_tasks(db, task_type=task_type, status=status, page=page, page_size=page_size)

    @staticmethod
    def get_task(db: Session, task_id: str) -> Task | None:
        return TaskRepository.get_by_id(db, task_id)
