"""配置模块。

使用 pydantic-settings 统一读取环境变量，
并通过 get_settings() 提供单例配置对象，避免重复解析。
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置对象。

    所有字段都可通过环境变量覆盖，字段名使用小写下划线风格。
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", populate_by_name=True)

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

    # 豆包（LLM）配置
    # 说明：
    # - 默认 use_llm=False，不会影响现有任务流程；
    # - 接入后可按任务开关调用 LLM 做结果总结与建议生成。
    llm_use_doubao: bool = Field(default=False, alias="LLM_USE_DOUBAO")
    llm_doubao_base_url: str = Field(default="https://ark.cn-beijing.volces.com/api/v3", alias="LLM_DOUBAO_BASE_URL")
    llm_doubao_api_key: str = Field(default="", alias="LLM_DOUBAO_API_KEY")
    llm_doubao_model: str = Field(default="", alias="LLM_DOUBAO_MODEL")
    llm_request_timeout_ms: int = Field(default=20000, alias="LLM_REQUEST_TIMEOUT_MS")

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
