from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from sqlalchemy import select
from datetime import datetime
import json

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import User, ConversationMember
from app.services.websocket_manager import manager

router = APIRouter()


async def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            return None
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()
    except JWTError:
        return None


@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, user.id)

    # Mark user online
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user.id))
        u = result.scalar_one_or_none()
        if u:
            u.is_online = True
            await db.commit()

        # Notify conversation members user is online
        members_result = await db.execute(
            select(ConversationMember).where(ConversationMember.user_id == user.id)
        )
        conv_ids = [m.conversation_id for m in members_result.scalars().all()]

        # Get all unique users in those conversations
        if conv_ids:
            all_members_result = await db.execute(
                select(ConversationMember).where(
                    ConversationMember.conversation_id.in_(conv_ids),
                    ConversationMember.user_id != user.id,
                )
            )
            peer_ids = list({m.user_id for m in all_members_result.scalars().all()})
            await manager.broadcast_to_users(peer_ids, "user.online", {"user_id": user.id})

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                event = data.get("event")
                payload = data.get("data", {})

                if event == "typing.start":
                    conversation_id = payload.get("conversation_id")
                    if conversation_id:
                        async with AsyncSessionLocal() as db:
                            members_result = await db.execute(
                                select(ConversationMember).where(
                                    ConversationMember.conversation_id == conversation_id,
                                    ConversationMember.user_id != user.id,
                                )
                            )
                            member_ids = [m.user_id for m in members_result.scalars().all()]
                        await manager.broadcast_to_users(member_ids, "typing.start", {
                            "user_id": user.id,
                            "conversation_id": conversation_id,
                        })

                elif event == "typing.stop":
                    conversation_id = payload.get("conversation_id")
                    if conversation_id:
                        async with AsyncSessionLocal() as db:
                            members_result = await db.execute(
                                select(ConversationMember).where(
                                    ConversationMember.conversation_id == conversation_id,
                                    ConversationMember.user_id != user.id,
                                )
                            )
                            member_ids = [m.user_id for m in members_result.scalars().all()]
                        await manager.broadcast_to_users(member_ids, "typing.stop", {
                            "user_id": user.id,
                            "conversation_id": conversation_id,
                        })

                elif event == "ping":
                    await websocket.send_text(json.dumps({"event": "pong"}))

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, user.id)

        # Mark offline if no more connections
        if not manager.is_online(user.id):
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == user.id))
                u = result.scalar_one_or_none()
                if u:
                    u.is_online = False
                    u.last_seen = datetime.utcnow()
                    await db.commit()

                members_result = await db.execute(
                    select(ConversationMember).where(ConversationMember.user_id == user.id)
                )
                conv_ids = [m.conversation_id for m in members_result.scalars().all()]
                if conv_ids:
                    all_members_result = await db.execute(
                        select(ConversationMember).where(
                            ConversationMember.conversation_id.in_(conv_ids),
                            ConversationMember.user_id != user.id,
                        )
                    )
                    peer_ids = list({m.user_id for m in all_members_result.scalars().all()})
                    await manager.broadcast_to_users(peer_ids, "user.offline", {
                        "user_id": user.id,
                        "last_seen": datetime.utcnow().isoformat(),
                    })
