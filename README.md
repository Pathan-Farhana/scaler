# Signal Clone — Fullstack Messaging Platform

A functional clone of Signal Messenger built with Next.js (TypeScript) frontend and FastAPI (Python) backend, featuring real-time WebSocket messaging, group chats, message reactions, image attachments, and disappearing messages.

---

## 🚀 Live Demo

- **Frontend:** https://your-app.vercel.app  
- **Backend API:** https://your-api.onrender.com  
- **API Docs:** https://your-api.onrender.com/docs

---

## 🔐 Demo Accounts

| Name | Phone | Password |
|------|-------|----------|
| Alice Johnson | +1234567890 | password123 |
| Bob Smith | +1234567891 | password123 |
| Carol White | +1234567892 | password123 |
| David Brown | +1234567893 | password123 |
| Eva Martinez | +1234567894 | password123 |

> OTP for registration is always **123456**

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Database | SQLite with SQLAlchemy (async) |
| Real-time | WebSockets (native FastAPI) |
| Auth | JWT (python-jose) + bcrypt |
| State | Zustand |
| Deployment | Vercel (frontend) + Render (backend) |

---

## ✅ Features Implemented

### Core
- **Authentication** — Phone-based registration with mock OTP (123456), JWT sessions, persistent login
- **Conversations** — Sorted by recency, unread badges, last-message preview, online indicators
- **Direct Messaging** — Real-time 1:1 messaging with typing indicators, delivery/read receipts
- **Group Messaging** — Create groups, add/remove members, admin controls
- **Real-time** — WebSocket connection with auto-reconnect, online/offline broadcast

### Bonus
- **Message Reactions** — 6 emoji reactions, toggle on/off, reaction counts
- **Image Attachments** — Upload and send images, preview in chat
- **File Attachments** — Send any file type with name and size display
- **Disappearing Messages** — Set timers: 5s, 30s, 1m, 5m, 1h, 1d
- **Reply-to** — Quote any message when replying
- **Message Delete** — Delete your own messages (soft delete)
- **Profile Editing** — Update name, about, and avatar
- **Search** — Search users by name or phone number

### Signal UX
- Chat list with avatar, last message, timestamp, unread count
- Message bubbles with tails (sent/received)
- Typing indicator (animated dots)
- Date separators in chat
- Message status icons (✓ sent, ✓✓ delivered, blue ✓✓ read)
- Online presence indicators
- Conversation info panel with member management
- Settings panel with profile editor
- Emoji picker in message input
- Mobile-responsive layout

---

## 🗄️ Database Schema

```
users
  id (PK, UUID)
  phone_number (UNIQUE)
  username (UNIQUE, nullable)
  display_name
  avatar_url
  about
  hashed_password
  is_online
  last_seen
  created_at

contacts
  id (PK, UUID)
  owner_id (FK → users)
  contact_user_id (FK → users)
  nickname
  created_at

conversations
  id (PK, UUID)
  type (direct | group)
  name
  avatar_url
  description
  created_by (FK → users)
  created_at
  updated_at

conversation_members
  id (PK, UUID)
  conversation_id (FK → conversations)
  user_id (FK → users)
  is_admin
  joined_at
  last_read_at
  muted

messages
  id (PK, UUID)
  conversation_id (FK → conversations)
  sender_id (FK → users)
  content
  message_type (text | image | file | system)
  status (sending | sent | delivered | read)
  reply_to_id (FK → messages, self-ref)
  file_url
  file_name
  file_size
  disappears_at
  is_deleted
  edited_at
  created_at

message_reactions
  id (PK, UUID)
  message_id (FK → messages)
  user_id (FK → users)
  emoji
  created_at

message_read_receipts
  id (PK, UUID)
  message_id (FK → messages)
  user_id (FK → users)
  read_at
```

---

## 🔌 API Overview

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send mock OTP |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?q=` | Search users |
| GET | `/api/users/{id}` | Get user by ID |
| PATCH | `/api/users/me` | Update profile |
| POST | `/api/users/me/avatar` | Upload avatar |
| GET | `/api/users/me/contacts` | List contacts |
| POST | `/api/users/me/contacts` | Add contact |
| DELETE | `/api/users/me/contacts/{id}` | Remove contact |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations/` | List conversations |
| GET | `/api/conversations/{id}` | Get conversation |
| POST | `/api/conversations/direct` | Create direct chat |
| POST | `/api/conversations/group` | Create group |
| PATCH | `/api/conversations/group/{id}` | Update group |
| POST | `/api/conversations/group/{id}/members` | Add member |
| DELETE | `/api/conversations/group/{id}/members/{uid}` | Remove member |
| POST | `/api/conversations/{id}/read` | Mark as read |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/{convId}/messages` | List messages (paginated) |
| POST | `/api/messages/{convId}/messages` | Send text message |
| POST | `/api/messages/{convId}/messages/upload` | Send file/image |
| DELETE | `/api/messages/{convId}/messages/{id}` | Delete message |
| POST | `/api/messages/{convId}/messages/{id}/react` | React to message |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `WS /ws/?token={jwt}` | Real-time connection |

**WS Events (client → server):**
- `typing.start` → `{ conversation_id }`
- `typing.stop` → `{ conversation_id }`
- `ping` → keepalive

**WS Events (server → client):**
- `message.new` → new message object
- `message.deleted` → `{ message_id, conversation_id }`
- `message.reaction` → `{ message_id, emoji, user_id, action }`
- `typing.start` / `typing.stop` → `{ user_id, conversation_id }`
- `user.online` / `user.offline` → `{ user_id }`

---

## 🏗️ Architecture Overview

```
signal-clone/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, startup
│   │   ├── database.py      # SQLAlchemy async engine
│   │   ├── config.py        # Settings (JWT secret, OTP)
│   │   ├── models.py        # All SQLAlchemy ORM models
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── seed.py          # Database seeder
│   │   ├── routers/
│   │   │   ├── auth.py      # Authentication endpoints
│   │   │   ├── users.py     # User & contact endpoints
│   │   │   ├── conversations.py
│   │   │   ├── messages.py
│   │   │   └── websocket.py # WS connection handler
│   │   ├── services/
│   │   │   └── websocket_manager.py  # Connection pool
│   │   └── utils/
│   │       └── auth.py      # JWT + password utilities
│   ├── requirements.txt
│   └── render.yaml
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx       # Redirect to /auth or /chat
    │   │   ├── auth/page.tsx  # Login/register flow
    │   │   └── chat/page.tsx  # Main app shell
    │   ├── components/
    │   │   ├── chat/
    │   │   │   ├── ConversationList.tsx
    │   │   │   ├── ChatWindow.tsx
    │   │   │   ├── ChatHeader.tsx
    │   │   │   ├── MessageBubble.tsx
    │   │   │   ├── MessageInput.tsx
    │   │   │   ├── ConversationInfo.tsx
    │   │   │   ├── NewChatModal.tsx
    │   │   │   └── NewGroupModal.tsx
    │   │   ├── layout/
    │   │   │   ├── Settings.tsx
    │   │   │   └── EmptyState.tsx
    │   │   └── ui/
    │   │       └── Avatar.tsx
    │   ├── hooks/
    │   │   └── useWebSocket.ts
    │   ├── lib/
    │   │   └── api.ts         # Axios client + all API calls
    │   ├── store/
    │   │   ├── authStore.ts   # Zustand auth state
    │   │   └── chatStore.ts   # Zustand chat + WS event handler
    │   └── types/
    │       └── index.ts       # TypeScript interfaces
    └── package.json
```

---

## 🛠️ Local Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The database is auto-created and seeded on first run.  
API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local if needed (default points to localhost:8000)
npm run dev
```

App runs at: http://localhost:3000

---

## 🚢 Deployment

### Backend (Render)
1. Create a new **Web Service** on Render
2. Connect your GitHub repo, set root to `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Set env var: `SECRET_KEY=<random-string>`

### Frontend (Vercel)
1. Import the repo on Vercel
2. Set root to `frontend/`
3. Set env vars:
   - `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`
   - `NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com`

---

## 📝 Assumptions & Notes

- **Encryption** is mocked/simulated — messages are stored in plaintext in SQLite. Real E2E encryption (X3DH + Double Ratchet) would require significant additional implementation.
- **OTP** is always `123456` — real SMS verification is not implemented.
- **File storage** uses the local filesystem (`uploads/` directory). For production, use S3 or similar.
- **SQLite** is used for simplicity. For production, switch to PostgreSQL.
- Voice/video calls, Stories, and Linked Devices are placeholder UI ("Coming Soon").
- The seeded database has 7 users, 5 direct conversations, and 3 group chats with realistic message history.
