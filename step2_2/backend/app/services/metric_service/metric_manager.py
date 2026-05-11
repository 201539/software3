from app.models.metric import MetricDefinition
from app.repositories.metric_repository import MetricRepository
from app.schemas.metric import MetricCreate


class MetricManager:
    def __init__(self, metric_repository: MetricRepository) -> None:
        self.metric_repository = metric_repository

    def list_methods(self):
        return self.metric_repository.list_methods()

    def list_metrics(self):
        return self.metric_repository.list_metrics()

    def get_metric(self, metric_id: int):
        return self.metric_repository.get_metric_by_id(metric_id)

    def create_metric(self, payload: MetricCreate) -> MetricDefinition:
        metric = MetricDefinition(
            metric_code=payload.metric_code,
            name=payload.name,
            metric_type=payload.metric_type,
            dimension=payload.dimension,
            description=payload.description,
            calc_mode=payload.calc_mode,
            config_schema=payload.config_schema,
            enabled=payload.enabled,
        )
        return self.metric_repository.create_metric(metric)

    def update_metric(self, metric_id: int, payload: MetricCreate):
        metric = self.metric_repository.get_metric_by_id(metric_id)
        if metric is None:
            return None
        metric.metric_code = payload.metric_code
        metric.name = payload.name
        metric.metric_type = payload.metric_type
        metric.dimension = payload.dimension
        metric.description = payload.description
        metric.calc_mode = payload.calc_mode
        metric.config_schema = payload.config_schema
        metric.enabled = payload.enabled
        return self.metric_repository.update_metric(metric)

    def list_results(self, run_id: int, sample_id: int | None = None):
        return self.metric_repository.list_results(run_id=run_id, sample_id=sample_id)
