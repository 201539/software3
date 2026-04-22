from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TraceCreate(BaseModel):
    run_id: int
    sample_id: int | None = None
    step_index: int
    phase: str
    decision: str | None = None
    observation: str | None = None
    state_snapshot: dict | None = None
    tool_calls: dict | None = None


class TraceResponse(TraceCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class ToolCallLogCreate(BaseModel):
    run_id: int
    sample_id: int | None = None
    tool_name: str
    input_payload: dict
    output_payload: dict | None = None
    success: bool
    error_type: str | None = None
    duration_ms: int


class ToolCallLogResponse(ToolCallLogCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
