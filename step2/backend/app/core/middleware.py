"""中间件定义。

当前提供 request_id 中间件：
- 每个请求生成（或透传）request_id；
- 写入 request.state，供业务代码与异常处理读取；
- 回写到响应头 X-Request-Id，便于客户端与日志关联。
"""

import uuid

from fastapi import FastAPI, Request


def register_middlewares(app: FastAPI) -> None:
    """注册应用中间件。"""

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-Id") or f"req_{uuid.uuid4().hex[:16]}"
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response
