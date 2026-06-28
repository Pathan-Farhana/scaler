from sqlalchemy import select
from datetime import datetime, timedelta
import random

from app.database import AsyncSessionLocal
from app.models import (
    User, Conversation, ConversationMember, Message,
    ConversationType, MessageType, MessageStatus, Contact
)
from app.utils.auth import hash_password


SEED_USERS = [
    {"phone_number": "+1234567890", "display_name": "Alice Johnson", "username": "alice", "about": "Living my best life 🌟"},
    {"phone_number": "+1234567891", "display_name": "Bob Smith", "username": "bob", "about": "Privacy matters."},
    {"phone_number": "+1234567892", "display_name": "Carol White", "username": "carol", "about": "Hey there! I am using Signal."},
    {"phone_number": "+1234567893", "display_name": "David Brown", "username": "david", "about": "Available"},
    {"phone_number": "+1234567894", "display_name": "Eva Martinez", "username": "eva", "about": "Coffee ☕ | Code 💻 | Music 🎵"},
    {"phone_number": "+1234567895", "display_name": "Frank Lee", "username": "frank", "about": "Signal for life."},
    {"phone_number": "+1234567896", "display_name": "Grace Kim", "username": "grace", "about": "Busy but always here 🙂"},
]

DIRECT_MESSAGES = [
    # Alice <-> Bob
    [
        ("bob", "Hey Alice! Did you see the news today?"),
        ("alice", "Just woke up, what happened?"),
        ("bob", "The big tech conference was announced for next month!"),
        ("alice", "Oh wow, are you going?"),
        ("bob", "Thinking about it! Want to come together?"),
        ("alice", "Definitely! Let's book early."),
        ("bob", "I'll send you the link 🔗"),
        ("alice", "Perfect, thanks Bob!"),
    ],
    # Alice <-> Carol
    [
        ("carol", "Alice, are you free this weekend?"),
        ("alice", "Saturday works for me! What did you have in mind?"),
        ("carol", "Maybe brunch and then a walk in the park?"),
        ("alice", "That sounds lovely 🌸"),
        ("carol", "Great! I'll book us a table at Café Bloom"),
        ("alice", "Yesss that place is amazing"),
        ("carol", "See you at 10am then!"),
    ],
    # Alice <-> David
    [
        ("alice", "David, did you finish the report?"),
        ("david", "Almost done, just reviewing the last section"),
        ("alice", "No rush, take your time"),
        ("david", "Should be done by EOD"),
        ("alice", "👍"),
    ],
    # Bob <-> Eva
    [
        ("eva", "Bob! The deployment is done 🎉"),
        ("bob", "Finally! Any issues?"),
        ("eva", "Smooth as butter. All green ✅"),
        ("bob", "You're a legend Eva"),
        ("eva", "Haha thanks, all in a day's work 😄"),
        ("bob", "Let's celebrate Friday?"),
        ("eva", "I'm in! 🍕"),
    ],
    # Carol <-> Frank
    [
        ("frank", "Carol, can you review my PR when you get a chance?"),
        ("carol", "On it! Give me 20 mins"),
        ("frank", "No hurry, thanks!"),
        ("carol", "Left some comments, overall looks great though"),
        ("frank", "Awesome, will address them now"),
    ],
]

GROUP_DATA = [
    {
        "name": "Dev Team 🚀",
        "description": "Engineering discussions and updates",
        "creator": "alice",
        "members": ["alice", "bob", "carol", "david", "eva"],
        "messages": [
            ("alice", "Good morning team! Daily standup in 15 mins"),
            ("bob", "On my way ☕"),
            ("carol", "Ready!"),
            ("david", "Be there in 5"),
            ("eva", "Joining now"),
            ("alice", "Sprint planning is Thursday — please update your tickets by Wednesday EOD"),
            ("bob", "Will do 👍"),
            ("carol", "What's our velocity target for this sprint?"),
            ("alice", "Aiming for 42 points based on last sprint"),
            ("eva", "Sounds achievable. I'll have the auth refactor done by Tuesday"),
            ("david", "I'll finish the DB migration today"),
            ("bob", "Nice! I'll start on the WebSocket improvements then"),
        ],
    },
    {
        "name": "Weekend Hikers 🏔️",
        "description": "Planning our next adventure",
        "creator": "carol",
        "members": ["carol", "frank", "grace", "bob"],
        "messages": [
            ("carol", "Who's in for this Saturday's hike?"),
            ("frank", "Me! Which trail?"),
            ("grace", "I'm in too 🙋"),
            ("bob", "Count me in!"),
            ("carol", "Thinking Blue Ridge Summit — 8 miles, moderate difficulty"),
            ("frank", "Perfect, I've been wanting to do that one"),
            ("grace", "Should we carpool? I can drive 3 people"),
            ("carol", "Great idea! Meet at the parking lot at 7am?"),
            ("bob", "7am works. I'll bring the snacks 🥜"),
            ("frank", "I'll handle water and first aid kit"),
            ("grace", "This is gonna be so fun 🌄"),
        ],
    },
    {
        "name": "Book Club 📚",
        "description": "Monthly reads and discussions",
        "creator": "eva",
        "members": ["eva", "alice", "grace", "david"],
        "messages": [
            ("eva", "This month's pick: Project Hail Mary by Andy Weir"),
            ("alice", "Oh I've been meaning to read that!"),
            ("grace", "Started it last night — already hooked 😍"),
            ("david", "Is it similar to The Martian?"),
            ("eva", "Same author, same vibe but even better IMO"),
            ("alice", "Discussion meeting on the 28th?"),
            ("eva", "Yes! Video call at 7pm"),
            ("grace", "Can't wait, I have so many thoughts already"),
        ],
    },
]


async def seed_database():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            return

        print("🌱 Seeding database...")

        # Create users
        users = {}
        for data in SEED_USERS:
            user = User(
                phone_number=data["phone_number"],
                display_name=data["display_name"],
                username=data["username"],
                about=data["about"],
                hashed_password=hash_password("password123"),
            )
            db.add(user)
            await db.flush()
            users[data["username"]] = user

        # Create contacts (mutual)
        for u1_key in list(users.keys())[:4]:
            for u2_key in list(users.keys())[:4]:
                if u1_key != u2_key:
                    c = Contact(owner_id=users[u1_key].id, contact_user_id=users[u2_key].id)
                    db.add(c)

        # Create direct conversations
        pairs = [
            ("alice", "bob"),
            ("alice", "carol"),
            ("alice", "david"),
            ("bob", "eva"),
            ("carol", "frank"),
        ]

        for i, (u1_key, u2_key) in enumerate(pairs):
            conv = Conversation(
                type=ConversationType.direct,
                created_by=users[u1_key].id,
                updated_at=datetime.utcnow() - timedelta(hours=i),
            )
            db.add(conv)
            await db.flush()

            m1 = ConversationMember(conversation_id=conv.id, user_id=users[u1_key].id, is_admin=True, last_read_at=datetime.utcnow())
            m2 = ConversationMember(conversation_id=conv.id, user_id=users[u2_key].id, is_admin=True, last_read_at=datetime.utcnow() - timedelta(minutes=5))
            db.add_all([m1, m2])
            await db.flush()

            msg_data = DIRECT_MESSAGES[i] if i < len(DIRECT_MESSAGES) else []
            base_time = datetime.utcnow() - timedelta(hours=i + 2)
            for j, (sender_key, content) in enumerate(msg_data):
                msg = Message(
                    conversation_id=conv.id,
                    sender_id=users[sender_key].id,
                    content=content,
                    message_type=MessageType.text,
                    status=MessageStatus.read,
                    created_at=base_time + timedelta(minutes=j * 2),
                )
                db.add(msg)

        # Create group conversations
        for i, group_data in enumerate(GROUP_DATA):
            conv = Conversation(
                type=ConversationType.group,
                name=group_data["name"],
                description=group_data["description"],
                created_by=users[group_data["creator"]].id,
                updated_at=datetime.utcnow() - timedelta(hours=i + 1),
            )
            db.add(conv)
            await db.flush()

            for j, member_key in enumerate(group_data["members"]):
                if member_key in users:
                    is_admin = member_key == group_data["creator"]
                    member = ConversationMember(
                        conversation_id=conv.id,
                        user_id=users[member_key].id,
                        is_admin=is_admin,
                        last_read_at=datetime.utcnow() - timedelta(minutes=j * 2),
                    )
                    db.add(member)

            await db.flush()

            base_time = datetime.utcnow() - timedelta(hours=i + 3)
            for j, (sender_key, content) in enumerate(group_data["messages"]):
                if sender_key in users:
                    msg = Message(
                        conversation_id=conv.id,
                        sender_id=users[sender_key].id,
                        content=content,
                        message_type=MessageType.text,
                        status=MessageStatus.read,
                        created_at=base_time + timedelta(minutes=j * 3),
                    )
                    db.add(msg)

        await db.commit()
        print("✅ Database seeded successfully!")
        print("📱 Login with: +1234567890 / password123 (Alice)")
        print("📱 Login with: +1234567891 / password123 (Bob)")
