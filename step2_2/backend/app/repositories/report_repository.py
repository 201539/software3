from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.report import EvaluationReport
from app.repositories.base import BaseRepository


class ReportRepository(BaseRepository):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def list_by_run_id(self, run_id: int) -> list[EvaluationReport]:
        stmt = select(EvaluationReport).where(EvaluationReport.run_id == run_id)
        return list(self.session.scalars(stmt).all())

    def get_by_id(self, report_id: int) -> EvaluationReport | None:
        return self.session.get(EvaluationReport, report_id)

    def create(self, report: EvaluationReport) -> EvaluationReport:
        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        return report
