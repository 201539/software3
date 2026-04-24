from app.models.analysis import AnalysisResult
from app.repositories.analysis_repository import AnalysisRepository
from app.schemas.analysis import AnalysisCompareRequest


class AnalysisManager:
    def __init__(self, analysis_repository: AnalysisRepository) -> None:
        self.analysis_repository = analysis_repository

    def list_analyses(self):
        return self.analysis_repository.list_all()

    def get_analysis(self, analysis_id: int):
        return self.analysis_repository.get_by_id(analysis_id)

    def compare(self, payload: AnalysisCompareRequest) -> AnalysisResult:
        analysis_code = f"analysis_{len(payload.task_ids)}_{len(payload.metric_keys)}"
        title = "多任务对比分析"
        result_detail = {
            "task_ids": payload.task_ids,
            "metric_keys": payload.metric_keys,
            "comparison_mode": "multi_task",
            "dimension": ["effect", "safety", "performance"],
        }
        analysis = AnalysisResult(
            analysis_code=analysis_code,
            title=title,
            task_ids=payload.task_ids,
            metric_keys=payload.metric_keys,
            result_summary="已完成多任务对比分析",
            result_detail=result_detail,
        )
        return self.analysis_repository.create(analysis)
