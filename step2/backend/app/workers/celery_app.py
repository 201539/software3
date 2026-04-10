"""Celery 应用配置模块。

职责：
- 初始化 Celery 实例；
- 统一配置序列化、时区与任务状态追踪策略。
"""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "myclaw_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.task_worker"],  # 显式注册任务模块，避免 worker 找不到任务
)

celery_app.conf.update(
    task_track_started=True,  # 追踪任务 started 状态
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)
