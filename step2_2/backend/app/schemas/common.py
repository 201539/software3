from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = 1
    page_size: int = 20


class PageResponse(BaseModel, Generic[T]):
    """分页响应；必须标注元素类型，否则 ORM 实例无法被 Pydantic 序列化为 JSON。"""

    items: list[T]
    page: int
    page_size: int
    total: int


class WebSocketEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event: str
    run_id: int
    status: str | None = None
    progress: float | None = None
    current_step: int | None = None
    message: str | None = None
    updated_at: str | None = None
