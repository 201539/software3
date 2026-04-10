"""全局异常处理器注册。"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppException
from app.schemas.common import ApiResponse


def _request_id(request: Request) -> str | None:
    """从请求上下文读取 request_id。"""
    return getattr(request.state, "request_id", None)


def register_exception_handlers(app: FastAPI) -> None:
    """注册全局异常处理器。"""

    @app.exception_handler(AppException)
    async def handle_app_exception(request: Request, exc: AppException):
        payload = ApiResponse(code=exc.code, message=exc.message, data=None, request_id=_request_id(request)).model_dump()
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_exception(request: Request, exc: RequestValidationError):
        payload = ApiResponse(
            code="validation_error",
            message="请求参数校验失败",
            data={"errors": exc.errors()},
            request_id=_request_id(request),
        ).model_dump()
        return JSONResponse(status_code=422, content=payload)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else "http_error"
        payload = ApiResponse(code=detail, message="请求失败", data=None, request_id=_request_id(request)).model_dump()
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(Exception)
    async def handle_unknown_exception(request: Request, __: Exception):
        payload = ApiResponse(code="internal_error", message="服务器内部错误", data=None, request_id=_request_id(request)).model_dump()
        return JSONResponse(status_code=500, content=payload)
