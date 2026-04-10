"""运行服务层。

负责任务运行实例（run）的业务编排：
- 创建 run 并推进任务状态；
- 查询轨迹与工具调用日志。
"""

import uuid

from sqlalchemy.orm import Session

from app.models.run import Run
from app.models.task import Task
from app.repositories.run_repository import RunRepository
from app.repositories.trace_repository import TraceRepository


class RunService:
    """Run 业务服务。"""

    @staticmethod
    def create_run(db: Session, task: Task) -> Run:
        """为指定任务创建一次运行实例。"""
        run = Run(
            id=f"run_{uuid.uuid4().hex[:12]}",
            task_id=task.id,
            trace_id=f"trace_{uuid.uuid4().hex[:16]}",
            status="running",
        )
        task.status = "running"
        return RunRepository.create(db, run)

    @staticmethod
    def get_run(db: Session, run_id: str) -> Run | None:
        """按 ID 查询运行实例。"""
        return RunRepository.get_by_id(db, run_id)

    @staticmethod
    def list_trace(db: Session, run_id: str):
        """查询运行轨迹。"""
        return TraceRepository.list_steps_by_run(db, run_id)

    @staticmethod
    def list_tool_calls(db: Session, run_id: str):
        """查询运行工具调用日志。"""
        return TraceRepository.list_tool_calls_by_run(db, run_id)
