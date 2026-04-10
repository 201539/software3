"""通用响应模型。

统一返回格式：
- code: 业务状态码（如 ok / task_not_found / validation_error）
- message: 面向调用方的简要说明
- data: 业务数据载荷
- request_id: 请求链路标识，便于日志排障
"""

from math import ceil
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一 API 响应包装。"""

    code: str = "ok"
    message: str = "success"
    data: T | None = None
    request_id: str | None = None


class PageMeta(BaseModel):
    """分页元信息。"""

    page: int
    page_size: int
    total: int
    total_pages: int


class PageResponse(BaseModel, Generic[T]):
    """统一分页响应数据结构。"""

    items: list[T]
    meta: PageMeta


def build_page_response(items: list[T], page: int, page_size: int, total: int) -> PageResponse[T]:
    """构造分页响应。"""
    total_pages = ceil(total / page_size) if page_size > 0 else 0
    return PageResponse(items=items, meta=PageMeta(page=page, page_size=page_size, total=total, total_pages=total_pages))


def success_response(data: T | None = None, message: str = "success", request_id: str | None = None) -> ApiResponse[T]:
    """构造成功响应。"""
    return ApiResponse[T](code="ok", message=message, data=data, request_id=request_id)
