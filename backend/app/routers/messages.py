from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import Optional
import uuid, os, aiofiles

from app.database import get_db
from app.models import (
    Message, ConversationMember, Conversation, User,
    MessageReaction, MessageReadReceipt, MessageType, MessageStatus
)
from app.schemas import MessageOut, SendMessageRequest, ReactToMessageRequest, UserOut, ReactionOut
from app.utils.auth import get_current_user
from app.services.websocket_manager import manager

router = APIRouter()


async def build_message_out(msg: Message, db: AsyncSession) -> MessageOut:
    reactions_result = await db.execute(
        select(MessageReaction).where(MessageReaction.message_id == msg.id)
        .options(selectinload(MessageReaction.user))
    )
    reactions = reactions_result.scalars().all()

    reply_out = None
    if msg.reply_to_id:
        reply_result = await db.execute(
            select(Message).where(Message.id == msg.reply_to_id)
            .options(selectinload(Message.sender))
        )
        reply_msg = reply_result.scalar_one_or_none()
        if reply_msg:
            sender_out = UserOut.model_validate(reply_msg.sender) if reply_msg.sender else None
            reply_out = MessageOut(
                id=reply_msg.id,
                conversation_id=reply_msg.conversation_id,
                sender_id=reply_msg.sender_id,
                sender=sender_out,
                content=reply_msg.content,
                message_type=reply_msg.message_type,
                status=reply_msg.status,
                reply_to_id=None,
                reply_to=None,
                file_url=reply_msg.file_url,
                file_name=reply_msg.file_name,
                file_size=reply_msg.file_size,
                disappears_at=reply_msg.disappears_at,
                is_deleted=reply_msg.is_deleted,
                reactions=[],
                created_at=reply_msg.created_at,
                edited_at=reply_msg.edited_at,
            )

    sender_out = UserOut.model_validate(msg.sender) if msg.sender else None
    reaction_outs = [
        ReactionOut(id=r.id, emoji=r.emoji, user_id=r.user_id, user=UserOut.model_validate(r.user))
        for r in reactions
    ]

    return MessageOut(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender=sender_out,
        content=msg.content,
        message_type=msg.message_type,
        status=msg.status,
        reply_to_id=msg.reply_to_id,
        reply_to=reply_out,
        file_url=msg.file_url,
        file_name=msg.file_name,
        file_size=msg.file_size,
        disappears_at=msg.disappears_at,
        is_deleted=msg.is_deleted,
        reactions=reaction_outs,
        created_at=msg.created_at,
        edited_at=msg.edited_at,
    )


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: str,
    before: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify membership
    mem_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    if not mem_result.scalar_one_or_none():
        raise HTTPException(403, "Not a member")

    query = select(Message).where(
        Message.conversation_id == conversation_id,
    ).options(selectinload(Message.sender)).order_by(Message.created_at.desc()).limit(limit)

    if before:
        before_msg_result = await db.execute(select(Message).where(Message.id == before))
        before_msg = before_msg_result.scalar_one_or_none()
        if before_msg:
            query = query.where(Message.created_at < before_msg.created_at)

    result = await db.execute(query)
    messages = result.scalars().all()
    messages = list(reversed(messages))

    out = []
    for msg in messages:
        out.append(await build_message_out(msg, db))
    return out


@router.post("/{conversation_id}/messages", response_model=MessageOut)
async def send_message(
    conversation_id: str,
    req: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mem_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    if not mem_result.scalar_one_or_none():
        raise HTTPException(403, "Not a member")

    disappears_at = None
    if req.disappear_after_seconds:
        disappears_at = datetime.utcnow() + timedelta(seconds=req.disappear_after_seconds)

    msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=req.content,
        message_type=req.message_type,
        status=MessageStatus.sent,
        reply_to_id=req.reply_to_id,
        disappears_at=disappears_at,
    )
    db.add(msg)

    # Update conversation updated_at
    conv_result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = conv_result.scalar_one()
    conv.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(msg)

    # Load sender
    user_result = await db.execute(select(User).where(User.id == msg.sender_id))
    msg.sender = user_result.scalar_one()

    msg_out = await build_message_out(msg, db)

    # Broadcast via WebSocket to all members
    members_result = await db.execute(
        select(ConversationMember).where(ConversationMember.conversation_id == conversation_id)
    )
    member_ids = [m.user_id for m in members_result.scalars().all()]
    await manager.broadcast_to_users(member_ids, "message.new", msg_out.model_dump(mode="json"))

    return msg_out


@router.post("/{conversation_id}/messages/upload", response_model=MessageOut)
async def send_file_message(
    conversation_id: str,
    file: UploadFile = File(...),
    reply_to_id: Optional[str] = Form(None),
    disappear_after_seconds: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mem_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    if not mem_result.scalar_one_or_none():
        raise HTTPException(403, "Not a member")

    ext = os.path.splitext(file.filename or "")[1].lower()
    filename = f"msg_{uuid.uuid4().hex}{ext}"
    path = f"uploads/{filename}"

    content = await file.read()
    async with aiofiles.open(path, "wb") as f:
        await f.write(content)

    is_image = ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    msg_type = MessageType.image if is_image else MessageType.file

    disappears_at = None
    if disappear_after_seconds:
        disappears_at = datetime.utcnow() + timedelta(seconds=disappear_after_seconds)

    msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        message_type=msg_type,
        file_url=f"/uploads/{filename}",
        file_name=file.filename,
        file_size=len(content),
        status=MessageStatus.sent,
        reply_to_id=reply_to_id,
        disappears_at=disappears_at,
    )
    db.add(msg)

    conv_result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = conv_result.scalar_one()
    conv.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(msg)

    user_result = await db.execute(select(User).where(User.id == msg.sender_id))
    msg.sender = user_result.scalar_one()

    msg_out = await build_message_out(msg, db)

    members_result = await db.execute(
        select(ConversationMember).where(ConversationMember.conversation_id == conversation_id)
    )
    member_ids = [m.user_id for m in members_result.scalars().all()]
    await manager.broadcast_to_users(member_ids, "message.new", msg_out.model_dump(mode="json"))

    return msg_out


@router.delete("/{conversation_id}/messages/{message_id}")
async def delete_message(
    conversation_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message).where(Message.id == message_id, Message.conversation_id == conversation_id)
        .options(selectinload(Message.sender))
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "Not your message")

    msg.is_deleted = True
    msg.content = None
    await db.commit()

    members_result = await db.execute(
        select(ConversationMember).where(ConversationMember.conversation_id == conversation_id)
    )
    member_ids = [m.user_id for m in members_result.scalars().all()]
    await manager.broadcast_to_users(member_ids, "message.deleted", {"message_id": message_id, "conversation_id": conversation_id})

    return {"ok": True}


@router.post("/{conversation_id}/messages/{message_id}/react")
async def react_to_message(
    conversation_id: str,
    message_id: str,
    req: ReactToMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check existing reaction from this user with same emoji
    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == req.emoji,
        )
    )
    existing_reaction = existing.scalar_one_or_none()

    if existing_reaction:
        # Toggle off
        await db.delete(existing_reaction)
        await db.commit()
        action = "removed"
    else:
        reaction = MessageReaction(message_id=message_id, user_id=current_user.id, emoji=req.emoji)
        db.add(reaction)
        await db.commit()
        action = "added"

    # Broadcast
    members_result = await db.execute(
        select(ConversationMember).where(ConversationMember.conversation_id == conversation_id)
    )
    member_ids = [m.user_id for m in members_result.scalars().all()]
    await manager.broadcast_to_users(member_ids, "message.reaction", {
        "message_id": message_id,
        "conversation_id": conversation_id,
        "emoji": req.emoji,
        "user_id": current_user.id,
        "action": action,
    })
    return {"ok": True, "action": action}


@router.post("/{conversation_id}/messages/{message_id}/read")
async def mark_message_read(
    conversation_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(MessageReadReceipt).where(
            MessageReadReceipt.message_id == message_id,
            MessageReadReceipt.user_id == current_user.id,
        )
    )
    if not existing.scalar_one_or_none():
        receipt = MessageReadReceipt(message_id=message_id, user_id=current_user.id)
        db.add(receipt)
        await db.commit()
    return {"ok": True}
