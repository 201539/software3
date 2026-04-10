"""任务数据访问层（Repository）。

只负责数据库读写，不承载业务编排逻辑。
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.task import Task


class TaskRepository:
    """Task 实体仓储。"""

    @staticmethod
    def create(db: Session, task: Task) -> Task:
        """创建任务。"""
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_by_id(db: Session, task_id: str) -> Task | None:
        """按主键查询任务。"""
        return db.get(Task, task_id)

    @staticmethod
    def list_tasks(
        db: Session,
        task_type: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Task], int]:
        """分页查询任务列表，支持按类型与状态过滤。

        返回值：
        - 第一个元素：当前页数据
        - 第二个元素：符合条件的总条数
        """
        stmt = select(Task)
        if task_type:
            stmt = stmt.where(Task.task_type == task_type)
        if status:
            stmt = stmt.where(Task.status == status)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.scalar(count_stmt) or 0

        page_stmt = stmt.order_by(Task.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        return db.scalars(page_stmt).all(), total
