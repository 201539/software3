"""Run 仓库层。"""

from sqlalchemy.orm import Session

from app.models.run import Run


class RunRepository:
    """Run 数据访问。"""

    @staticmethod
    def create(db: Session, run: Run) -> Run:
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    @staticmethod
    def get_by_id(db: Session, run_id: str) -> Run | None:
        return db.get(Run, run_id)

    @staticmethod
    def save(db: Session, run: Run) -> Run:
        db.add(run)
        db.commit()
        db.refresh(run)
        return run
