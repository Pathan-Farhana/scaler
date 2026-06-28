from typing import Dict, Set
from fastapi import WebSocket
import json
import asyncio


class ConnectionManager:
    def __init__(self):
        # user_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # conversation_id -> set of user_ids
        self.conversation_members: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections and bool(self.active_connections[user_id])

    async def send_to_user(self, user_id: str, event: str, data: dict):
        if user_id in self.active_connections:
            message = json.dumps({"event": event, "data": data})
            dead = set()
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.active_connections[user_id].discard(ws)

    async def broadcast_to_users(self, user_ids: list[str], event: str, data: dict):
        tasks = [self.send_to_user(uid, event, data) for uid in user_ids]
        await asyncio.gather(*tasks, return_exceptions=True)


manager = ConnectionManager()
