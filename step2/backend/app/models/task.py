"""任务实体模型。

对应 task 表，记录用户提交的任务定义与生命周期状态。
"""

from datetime import datetime

from sqlalchemy import DateTime, Enum, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# 任务状态：可与前端状态标签直接映射
TASK_STATUS = ("pending", "running", "success", "failed", "degraded")


class Task(Base):
    """任务主表。"""

    __tablename__ = "task"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_type: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    input_payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(Enum(*TASK_STATUS, name="task_status_enum"), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
