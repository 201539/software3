"""WebSocket 事件数据模型。"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class WSEvent(BaseModel):
    """统一 WS 消息结构。

    所有事件都应遵循该结构：
    - event: 事件类型（如 run.started / run.step / run.failed）
    - run_id: 运行实例 ID
    - trace_id: 跟踪链路 ID
    - timestamp: 事件发生时间
    - data: 业务负载
    """

    event: str
    run_id: str
    trace_id: str
    timestamp: datetime
    data: dict[str, Any]
