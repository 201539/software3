"""任务服务层。

负责任务领域业务编排：
- 生成业务 ID；
- 规范输入载荷结构；
- 调用 Repository 完成持久化。
"""

import uuid

from sqlalchemy.orm import Session

from app.models.task import Task
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate


class TaskService:
    """Task 业务服务。"""

    @staticmethod
    def create_task(db: Session, payload: TaskCreate) -> Task:
        """创建任务并写入数据库。"""
        task = Task(
            id=f"task_{uuid.uuid4().hex[:12]}",
            task_type=payload.task_type,
            title=payload.title,
            input_payload={
                **payload.input_payload,
                "priority": payload.priority,
                "timeout_ms": payload.timeout_ms,
                "retry_policy": payload.retry_policy.model_dump(),
            },
            status="pending",
        )
        return TaskRepository.create(db, task)

    @staticmethod
    def list_tasks(db: Session, task_type: str | None, status: str | None, page: int, page_size: int):
        """分页查询任务，返回 (items, total)。"""
        return TaskRepository.list_tasks(db, task_type=task_type, status=status, page=page, page_size=page_size)

    @staticmethod
    def get_task(db: Session, task_id: str) -> Task | None:
        """按 ID 查询任务。"""
        return TaskRepository.get_by_id(db, task_id)
