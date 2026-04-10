"""应用入口模块。

职责：
1. 创建 FastAPI 实例；
2. 在启动阶段初始化数据库表（当前为 create_all，后续建议迁移到 Alembic）；
3. 注册中间件、异常处理器和业务路由。
"""

from fastapi import FastAPI

from app.api.run_api import router as run_router
from app.api.task_api import router as task_router
from app.api.ws_api import router as ws_router
from app.core.database import Base, engine
from app.core.exception_handlers import register_exception_handlers
from app.core.middleware import register_middlewares

app = FastAPI(title="MyClaw Backend", version="0.1.0")
register_middlewares(app)
register_exception_handlers(app)


@app.on_event("startup")
def on_startup() -> None:
    """应用启动钩子。

    当前阶段直接自动建表，方便快速联调。
    生产环境建议：关闭 create_all，改用 Alembic 迁移管理。
    """
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    """健康检查接口。"""
    return {"status": "ok"}


# 路由注册（按业务域拆分，便于后续扩展）
app.include_router(task_router)
app.include_router(run_router)
app.include_router(ws_router)
