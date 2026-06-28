from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
import uuid, os, aiofiles

from app.database import get_db
from app.models import User, Contact
from app.schemas import UserOut, UserUpdate, ContactOut, AddContactRequest
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/search", response_model=list[UserOut])
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User).where(
            or_(
                User.phone_number.contains(q),
                User.display_name.ilike(f"%{q}%"),
                User.username.ilike(f"%{q}%"),
            )
        ).where(User.id != current_user.id).limit(20)
    )
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex}{ext}"
    path = f"uploads/{filename}"
    async with aiofiles.open(path, "wb") as f:
        content = await file.read()
        await f.write(content)
    current_user.avatar_url = f"/uploads/{filename}"
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ── Contacts ──────────────────────────────────────────────────────────────────

@router.get("/me/contacts", response_model=list[ContactOut])
async def get_contacts(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Contact).where(Contact.owner_id == current_user.id)
    )
    contacts = result.scalars().all()
    out = []
    for c in contacts:
        user_res = await db.execute(select(User).where(User.id == c.contact_user_id))
        c.contact_user = user_res.scalar_one()
        out.append(c)
    return out


@router.post("/me/contacts", response_model=ContactOut)
async def add_contact(
    req: AddContactRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_res = await db.execute(select(User).where(User.phone_number == req.phone_number))
    target = user_res.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found with that phone number")
    if target.id == current_user.id:
        raise HTTPException(400, "Cannot add yourself")

    # Check existing
    existing = await db.execute(
        select(Contact).where(Contact.owner_id == current_user.id, Contact.contact_user_id == target.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Contact already exists")

    contact = Contact(owner_id=current_user.id, contact_user_id=target.id, nickname=req.nickname)
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    contact.contact_user = target
    return contact


@router.delete("/me/contacts/{contact_id}")
async def remove_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.owner_id == current_user.id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    await db.delete(contact)
    await db.commit()
    return {"ok": True}
