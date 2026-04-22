from app.models.report import EvaluationReport
from app.repositories.report_repository import ReportRepository
from app.schemas.report import ReportCreate


class ReportManager:
    def __init__(self, report_repository: ReportRepository) -> None:
        self.report_repository = report_repository

    def list_reports(self, run_id: int):
        return self.report_repository.list_by_run_id(run_id)

    def get_report(self, report_id: int):
        return self.report_repository.get_by_id(report_id)

    def create_report(self, payload: ReportCreate) -> EvaluationReport:
        report = EvaluationReport(
            run_id=payload.run_id,
            report_title=payload.report_title,
            report_summary=payload.report_summary,
            report_path=payload.report_path,
            report_format=payload.report_format,
        )
        return self.report_repository.create(report)
