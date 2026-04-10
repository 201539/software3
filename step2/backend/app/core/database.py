"""数据库基础设施模块。

职责：
1. 创建 SQLAlchemy Engine 与 Session 工厂；
2. 定义 ORM 基类 Base；
3. 提供 FastAPI 依赖注入 get_db。
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# pool_pre_ping=True: 避免连接长时间空闲后失效导致的 "MySQL server has gone away"
engine = create_engine(settings.sqlalchemy_database_uri, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""



def get_db() -> Generator[Session, None, None]:
    """FastAPI 数据库会话依赖。

    每个请求创建一个 Session，请求结束自动关闭。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
