from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class DatasetCreate(BaseModel):
    dataset_code: str
    name: str
    description: str | None = None
    source_type: str
    version: str
    status: str


class DatasetResponse(DatasetCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sample_count: int
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class DatasetSampleCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sample_code: str
    input_payload: dict
    expected_output: dict | None = None
    reference_context: dict | None = None
    ground_truth: dict | None = None
    sample_type: str
    # 请求 JSON 可用 metadata；勿对响应模型使用会映射到 ORM 属性名 metadata 的 alias（会与 SQLAlchemy DeclarativeAPI.metadata 冲突）
    sample_metadata: dict | None = Field(
        default=None,
        validation_alias=AliasChoices("metadata", "sample_metadata"),
    )


class DatasetSampleUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sample_code: str | None = None
    input_payload: dict | None = None
    expected_output: dict | None = None
    reference_context: dict | None = None
    ground_truth: dict | None = None
    sample_type: str | None = None
    sample_metadata: dict | None = Field(
        default=None,
        validation_alias=AliasChoices("metadata", "sample_metadata"),
    )


class DatasetSampleResponse(BaseModel):
    """与 Create 分离：仅按 ORM 属性 sample_metadata 做 from_attributes，再序列化为 JSON 字段 metadata。"""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    dataset_id: int
    sample_code: str
    input_payload: dict
    expected_output: dict | None = None
    reference_context: dict | None = None
    ground_truth: dict | None = None
    sample_type: str
    sample_metadata: dict | None = Field(default=None, serialization_alias="metadata")
    created_at: datetime
    updated_at: datetime


class DatasetSampleImportRequest(BaseModel):
    samples: list[DatasetSampleCreate]
