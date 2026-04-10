"""轨迹与工具调用日志数据访问层。"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.step_trace import StepTrace
from app.models.tool_call_log import ToolCallLog


class TraceRepository:
    """StepTrace / ToolCallLog 仓储。"""

    @staticmethod
    def create_step(db: Session, step: StepTrace) -> StepTrace:
        """写入单条步骤轨迹。"""
        db.add(step)
        db.commit()
        db.refresh(step)
        return step

    @staticmethod
    def create_tool_call(db: Session, tool_call: ToolCallLog) -> ToolCallLog:
        """写入单条工具调用日志。"""
        db.add(tool_call)
        db.commit()
        db.refresh(tool_call)
        return tool_call

    @staticmethod
    def list_steps_by_run(db: Session, run_id: str) -> list[StepTrace]:
        """按 run_id 查询步骤轨迹。"""
        stmt = (
            select(StepTrace)
            .where(StepTrace.run_id == run_id)
            .order_by(StepTrace.step_index.asc(), StepTrace.created_at.asc())
        )
        return db.scalars(stmt).all()

    @staticmethod
    def list_tool_calls_by_run(db: Session, run_id: str) -> list[ToolCallLog]:
        """按 run_id 查询工具调用日志。"""
        stmt = select(ToolCallLog).where(ToolCallLog.run_id == run_id).order_by(ToolCallLog.created_at.asc())
        return db.scalars(stmt).all()
