from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    phone_number: str
    display_name: str
    password: str
    otp: str = "123456"

class LoginRequest(BaseModel):
    phone_number: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class OTPRequest(BaseModel):
    phone_number: str

class OTPVerify(BaseModel):
    phone_number: str
    otp: str


# ── User ──────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: str
    phone_number: str
    username: Optional[str]
    display_name: str
    avatar_url: Optional[str]
    about: Optional[str]
    is_online: bool
    last_seen: Optional[datetime]

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    about: Optional[str] = None
    avatar_url: Optional[str] = None


# ── Contact ───────────────────────────────────────────────────────────────────

class ContactOut(BaseModel):
    id: str
    contact_user: UserOut
    nickname: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class AddContactRequest(BaseModel):
    phone_number: str
    nickname: Optional[str] = None


# ── Message ───────────────────────────────────────────────────────────────────

class MessageStatus(str, Enum):
    sending = "sending"
    sent = "sent"
    delivered = "delivered"
    read = "read"

class MessageType(str, Enum):
    text = "text"
    image = "image"
    file = "file"
    system = "system"

class ReactionOut(BaseModel):
    id: str
    emoji: str
    user_id: str
    user: UserOut

    class Config:
        from_attributes = True

class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: Optional[str]
    sender: Optional[UserOut]
    content: Optional[str]
    message_type: MessageType
    status: MessageStatus
    reply_to_id: Optional[str]
    reply_to: Optional["MessageOut"]
    file_url: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    disappears_at: Optional[datetime]
    is_deleted: bool
    reactions: List[ReactionOut] = []
    created_at: datetime
    edited_at: Optional[datetime]

    class Config:
        from_attributes = True

class SendMessageRequest(BaseModel):
    content: Optional[str] = None
    message_type: MessageType = MessageType.text
    reply_to_id: Optional[str] = None
    disappear_after_seconds: Optional[int] = None

class ReactToMessageRequest(BaseModel):
    emoji: str


# ── Conversation ──────────────────────────────────────────────────────────────

class ConversationType(str, Enum):
    direct = "direct"
    group = "group"

class MemberOut(BaseModel):
    user_id: str
    user: UserOut
    is_admin: bool
    joined_at: datetime
    last_read_at: Optional[datetime]
    muted: bool

    class Config:
        from_attributes = True

class ConversationOut(BaseModel):
    id: str
    type: ConversationType
    name: Optional[str]
    avatar_url: Optional[str]
    description: Optional[str]
    created_by: Optional[str]
    members: List[MemberOut] = []
    last_message: Optional[MessageOut] = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CreateDirectConversationRequest(BaseModel):
    user_id: str

class CreateGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    member_ids: List[str]

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None

class AddGroupMemberRequest(BaseModel):
    user_id: str


# ── WebSocket ─────────────────────────────────────────────────────────────────

class WSEventType(str, Enum):
    message_new = "message.new"
    message_updated = "message.updated"
    message_deleted = "message.deleted"
    message_reaction = "message.reaction"
    typing_start = "typing.start"
    typing_stop = "typing.stop"
    user_online = "user.online"
    user_offline = "user.offline"
    message_read = "message.read"
    conversation_updated = "conversation.updated"

class WSMessage(BaseModel):
    event: WSEventType
    data: dict


MessageOut.model_rebuild()
