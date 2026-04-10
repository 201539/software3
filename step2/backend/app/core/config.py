"""配置模块。

使用 pydantic-settings 统一读取环境变量，
并通过 get_settings() 提供单例配置对象，避免重复解析。
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置对象。

    所有字段都可通过环境变量覆盖，字段名使用小写下划线风格。
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 应用基础配置
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # MySQL 配置
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_db: str = "myclaw"
    mysql_user: str = "root"
    mysql_password: str = "your_password"

    # Redis 配置
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379

    # Celery 配置
    celery_broker_url: str = "redis://127.0.0.1:6379/0"
    celery_result_backend: str = "redis://127.0.0.1:6379/1"

    @property
    def sqlalchemy_database_uri(self) -> str:
        """生成 SQLAlchemy 连接串。"""
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}?charset=utf8mb4"
        )


@lru_cache
def get_settings() -> Settings:
    """返回缓存后的配置对象（进程级单例）。"""
    return Settings()
