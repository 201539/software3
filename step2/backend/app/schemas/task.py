"""任务相关请求/响应 Schema。

设计原则：
- 通过 Literal 收敛可选值，减少脏数据；
- 输入与输出模型分离，便于后续演进字段；
- 命名与数据库状态字段保持一致，降低映射成本。
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# 支持的任务类型（与文档 6 大方向对齐）
TaskType = Literal[
    "web_health_check",
    "scenario_regression",
    "form_automation",
    "web_extraction",
    "cicd_inspection",
    "release_gate",
]

# 任务状态（任务与运行实例状态保持同构，便于前端复用）
TaskStatus = Literal["pending", "running", "success", "failed", "degraded"]


class RetryPolicy(BaseModel):
    """重试策略。"""

    max_retries: int = 2
    backoff_ms: int = 1000


class TaskCreate(BaseModel):
    """创建任务输入模型（通用）。"""

    task_type: TaskType
    title: str = Field(min_length=1, max_length=255)
    input_payload: dict[str, Any] = Field(default_factory=dict)
    priority: Literal["low", "normal", "high"] = "normal"
    timeout_ms: int = 30000
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)


class TaskOut(BaseModel):
    """任务简要输出模型。"""

    task_id: str
    task_type: TaskType
    status: TaskStatus
    created_at: datetime


class TaskDetail(TaskOut):
    """任务详情输出模型。"""

    title: str
    input_payload: dict[str, Any]
    updated_at: datetime
