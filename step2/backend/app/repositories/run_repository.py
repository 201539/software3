"""运行实例数据访问层。"""

from sqlalchemy.orm import Session

from app.models.run import Run


class RunRepository:
    """Run 实体仓储。"""

    @staticmethod
    def create(db: Session, run: Run) -> Run:
        """创建运行实例。"""
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    @staticmethod
    def get_by_id(db: Session, run_id: str) -> Run | None:
        """按主键查询运行实例。"""
        return db.get(Run, run_id)

    @staticmethod
    def save(db: Session, run: Run) -> Run:
        """保存运行实例更新。"""
        db.add(run)
        db.commit()
        db.refresh(run)
        return run
