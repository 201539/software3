"""运行实例模型。

对应 run 表，每次任务启动都会生成一条 run，
用于记录本次执行状态、开始结束时间与总结。
"""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

RUN_STATUS = ("pending", "running", "success", "failed", "degraded")


class Run(Base):
    """任务运行实例。"""

    __tablename__ = "run"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("task.id"), index=True)
    trace_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    status: Mapped[str] = mapped_column(Enum(*RUN_STATUS, name="run_status_enum"), default="running")
    start_time: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    final_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
