"""WebSocket 接口层。

当前实现为最小可用版本：
- 建立连接后推送一次连接成功事件；
- 持续监听客户端消息用于维持连接；
- 断开时自动清理连接。
"""

from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import ws_manager

router = APIRouter(tags=["ws"])


@router.websocket("/ws/runs/{run_id}")
async def ws_run_stream(websocket: WebSocket, run_id: str):
    """订阅指定 run 的实时事件流。"""
    await ws_manager.connect(run_id, websocket)
    try:
        await ws_manager.broadcast(
            run_id,
            {
                "event": "run.status",
                "run_id": run_id,
                "trace_id": "pending",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {"message": "ws connected"},
            },
        )
        while True:
            # 当前仅做心跳占位；后续可支持前端指令（暂停/恢复/取消等）
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(run_id, websocket)
