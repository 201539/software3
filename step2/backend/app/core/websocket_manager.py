"""WebSocket 连接管理器。

按 run_id 管理连接集合，支持同一运行实例被多个前端页面同时订阅。
"""

from collections import defaultdict

from fastapi import WebSocket


class WSManager:
    """WebSocket 连接池管理。"""

    def __init__(self) -> None:
        # run_id -> websocket 集合
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, run_id: str, websocket: WebSocket) -> None:
        """建立并登记连接。"""
        await websocket.accept()
        self.connections[run_id].add(websocket)

    def disconnect(self, run_id: str, websocket: WebSocket) -> None:
        """断开并移除连接；若集合为空则清理键。"""
        if run_id in self.connections:
            self.connections[run_id].discard(websocket)
            if not self.connections[run_id]:
                self.connections.pop(run_id, None)

    async def broadcast(self, run_id: str, message: dict) -> None:
        """向指定 run_id 的所有订阅连接广播消息。"""
        for ws in list(self.connections.get(run_id, set())):
            await ws.send_json(message)


# 全局单例，供 API/服务层复用
ws_manager = WSManager()
