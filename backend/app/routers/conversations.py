from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database import get_db
from app.models import Conversation, ConversationMember, Message, User, ConversationType
from app.schemas import (
    ConversationOut, CreateDirectConversationRequest,
    CreateGroupRequest, UpdateGroupRequest, MemberOut, AddGroupMemberRequest, MessageOut, UserOut
)
from app.utils.auth import get_current_user

router = APIRouter()


async def build_conversation_out(conv: Conversation, current_user_id: str, db: AsyncSession) -> ConversationOut:
    # Get members with users
    members_result = await db.execute(
        select(ConversationMember).where(ConversationMember.conversation_id == conv.id)
        .options(selectinload(ConversationMember.user))
    )
    members = members_result.scalars().all()

    # Last message
    last_msg_result = await db.execute(
        select(Message).where(
            Message.conversation_id == conv.id,
            Message.is_deleted == False
        ).order_by(Message.created_at.desc()).limit(1)
        .options(selectinload(Message.sender), selectinload(Message.reactions).selectinload(Message.reactions.and_(True)))
    )
    last_msg = last_msg_result.scalar_one_or_none()

    # Unread count
    my_membership = next((m for m in members if m.user_id == current_user_id), None)
    unread = 0
    if my_membership and my_membership.last_read_at:
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conv.id,
                Message.sender_id != current_user_id,
                Message.created_at > my_membership.last_read_at,
                Message.is_deleted == False,
            )
        )
        unread = unread_result.scalar() or 0
    elif my_membership and not my_membership.last_read_at:
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conv.id,
                Message.sender_id != current_user_id,
                Message.is_deleted == False,
            )
        )
        unread = unread_result.scalar() or 0

    # For direct convos, use the other person's name
    display_name = conv.name
    display_avatar = conv.avatar_url
    if conv.type == ConversationType.direct:
        other = next((m.user for m in members if m.user_id != current_user_id), None)
        if other:
            display_name = other.display_name
            display_avatar = other.avatar_url

    member_outs = []
    for m in members:
        member_outs.append(MemberOut(
            user_id=m.user_id,
            user=UserOut.model_validate(m.user),
            is_admin=m.is_admin,
            joined_at=m.joined_at,
            last_read_at=m.last_read_at,
            muted=m.muted,
        ))

    last_message_out = None
    if last_msg:
        sender_out = UserOut.model_validate(last_msg.sender) if last_msg.sender else None
        last_message_out = MessageOut(
            id=last_msg.id,
            conversation_id=last_msg.conversation_id,
            sender_id=last_msg.sender_id,
            sender=sender_out,
            content=last_msg.content,
            message_type=last_msg.message_type,
            status=last_msg.status,
            reply_to_id=last_msg.reply_to_id,
            reply_to=None,
            file_url=last_msg.file_url,
            file_name=last_msg.file_name,
            file_size=last_msg.file_size,
            disappears_at=last_msg.disappears_at,
            is_deleted=last_msg.is_deleted,
            reactions=[],
            created_at=last_msg.created_at,
            edited_at=last_msg.edited_at,
        )

    return ConversationOut(
        id=conv.id,
        type=conv.type,
        name=display_name,
        avatar_url=display_avatar,
        description=conv.description,
        created_by=conv.created_by,
        members=member_outs,
        last_message=last_message_out,
        unread_count=unread,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get("/", response_model=list[ConversationOut])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(ConversationMember.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
    )
    convs = result.scalars().unique().all()
    out = []
    for conv in convs:
        out.append(await build_conversation_out(conv, current_user.id, db))
    return out


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    member_ids = [m.user_id for m in conv.members]
    if current_user.id not in member_ids:
        raise HTTPException(403, "Not a member")

    return await build_conversation_out(conv, current_user.id, db)


@router.post("/direct", response_model=ConversationOut)
async def create_direct(
    req: CreateDirectConversationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if direct conversation already exists between these two users
    existing = await db.execute(
        select(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(
            Conversation.type == ConversationType.direct,
            ConversationMember.user_id == current_user.id,
        )
        .options(selectinload(Conversation.members))
    )
    for conv in existing.scalars().unique().all():
        other_ids = {m.user_id for m in conv.members}
        if req.user_id in other_ids and current_user.id in other_ids and len(other_ids) == 2:
            return await build_conversation_out(conv, current_user.id, db)

    # Create new
    conv = Conversation(type=ConversationType.direct, created_by=current_user.id)
    db.add(conv)
    await db.flush()

    m1 = ConversationMember(conversation_id=conv.id, user_id=current_user.id, is_admin=True)
    m2 = ConversationMember(conversation_id=conv.id, user_id=req.user_id, is_admin=True)
    db.add_all([m1, m2])
    await db.commit()

    result = await db.execute(
        select(Conversation).where(Conversation.id == conv.id)
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
    )
    conv = result.scalar_one()
    return await build_conversation_out(conv, current_user.id, db)


@router.post("/group", response_model=ConversationOut)
async def create_group(
    req: CreateGroupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = Conversation(
        type=ConversationType.group,
        name=req.name,
        description=req.description,
        created_by=current_user.id,
    )
    db.add(conv)
    await db.flush()

    members = [ConversationMember(conversation_id=conv.id, user_id=current_user.id, is_admin=True)]
    for uid in req.member_ids:
        if uid != current_user.id:
            members.append(ConversationMember(conversation_id=conv.id, user_id=uid, is_admin=False))
    db.add_all(members)
    await db.commit()

    result = await db.execute(
        select(Conversation).where(Conversation.id == conv.id)
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
    )
    conv = result.scalar_one()
    return await build_conversation_out(conv, current_user.id, db)


@router.patch("/group/{conversation_id}", response_model=ConversationOut)
async def update_group(
    conversation_id: str,
    req: UpdateGroupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    member = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not member or not member.is_admin:
        raise HTTPException(403, "Admin only")

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(conv, field, value)
    await db.commit()
    await db.refresh(conv)
    return await build_conversation_out(conv, current_user.id, db)


@router.post("/group/{conversation_id}/members")
async def add_member(
    conversation_id: str,
    req: AddGroupMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.members))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Not found")

    me = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not me or not me.is_admin:
        raise HTTPException(403, "Admin only")

    if any(m.user_id == req.user_id for m in conv.members):
        raise HTTPException(400, "Already a member")

    db.add(ConversationMember(conversation_id=conversation_id, user_id=req.user_id))
    await db.commit()
    return {"ok": True}


@router.delete("/group/{conversation_id}/members/{user_id}")
async def remove_member(
    conversation_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.members))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Not found")

    me = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not me or (not me.is_admin and user_id != current_user.id):
        raise HTTPException(403, "Not allowed")

    target = next((m for m in conv.members if m.user_id == user_id), None)
    if not target:
        raise HTTPException(404, "Member not found")

    await db.delete(target)
    await db.commit()
    return {"ok": True}


@router.post("/{conversation_id}/read")
async def mark_read(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member:
        member.last_read_at = datetime.utcnow()
        await db.commit()
    return {"ok": True}
