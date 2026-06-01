# IntellMeet Backend

REST API + real-time Socket.IO server for the IntellMeet platform.
Covers auth, users, meetings, teams, tasks, notifications, chat, WebRTC signaling, and AI post-meeting processing.

**Base URL:** `http://localhost:5000/api`  
**Socket URL:** `http://localhost:5000` (not `/api`)  
**Health check:** `GET /api/health` → `{ ok: true }`

---

## Quick start

```bash
cp .env.example .env   # fill in MONGODB_URI, JWT_ACCESS_SECRET, GROQ_API_KEY
npm install
npm run dev
```

---

## Auth

Every protected route requires:
```
Authorization: Bearer <accessToken>
```

Access token lifetime is set by `JWT_ACCESS_EXPIRES` in `.env` (code default `15m`). Use the refresh endpoint to get a new one — the server sets and reads the refresh token via an HTTP-only cookie automatically.

Always call APIs with `credentials: "include"` (or `withCredentials: true` in axios) so the refresh cookie is sent.

### Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/auth/signup` | — | `{ name, email, password }` | `{ user, token }` + sets `refreshToken` cookie |
| POST | `/api/auth/register` | — | same as signup | same |
| POST | `/api/auth/login` | — | `{ email, password }` | `{ user, token }` + sets `refreshToken` cookie |
| POST | `/api/auth/refresh-token` | cookie | — | `{ token }` + rotates cookie |
| POST | `/api/auth/logout` | Bearer | — | `{ message }` + clears cookie |
| POST | `/api/auth/forgot-password` | — | `{ email }` | `{ message }` |
| POST | `/api/auth/reset-password` | — | `{ email, token, password }` | `{ message }` |
| PUT | `/api/auth/change-password` | Bearer | `{ currentPassword, newPassword }` | `{ message }` |

**User object shape** (returned on login/signup):
```json
{
  "_id": "...",
  "name": "Rahul",
  "email": "rahul@example.com",
  "avatar": "https://...",
  "role": "admin | member",
  "bio": "..."
}
```

---

## Users

All routes require Bearer token.

| Method | Path | Body / Params | Notes |
|--------|------|---------------|-------|
| GET | `/api/users/profile` | — | Returns logged-in user |
| PUT | `/api/users/profile` | `{ name?, bio?, email? }` | Updates profile |
| POST | `/api/users/avatar` | `multipart/form-data` field: `avatar` | Uploads to Cloudinary |
| GET | `/api/users/all` | — | Admin only |

---

## Meetings

All routes require Bearer token.

| Method | Path | Body / Params | Notes |
|--------|------|---------------|-------|
| POST | `/api/meetings/create` | `{ title, scheduledTime (ISO), description?, participantIds?, status? }` | Creates meeting, returns meeting object |
| GET | `/api/meetings` | — | Lists meetings where user is host or participant |
| GET | `/api/meetings/:id` | — | `:id` can be MongoDB `_id` or `meetingCode` |
| PUT | `/api/meetings/:id` | same fields as create | Host or admin only |
| DELETE | `/api/meetings/:id` | — | Host or admin only |

**Meeting object shape** (as returned by all meeting endpoints — see `src/utils/meetingSerializer.js`):
```json
{
  "_id": "...",
  "title": "Sprint Review",
  "meetingCode": "abc-123",
  "startTime": "2026-06-01T10:00:00.000Z",
  "endTime": "2026-06-01T11:00:00.000Z",
  "status": "scheduled | live | ended",
  "hostId": "64f...",
  "participants": [{ "_id": "...", "name": "...", "email": "...", "role": "...", "avatar": "..." }],
  "summary": "...",
  "recording": "https://...",
  "actionItems": [{ "_id": "...", "text": "...", "status": "pending | done", "assignee": { "_id": "...", "name": "..." }, "meetingId": "..." }]
}
```

> `summary`, `recording`, and `endTime` are omitted from the response when not set. `actionItems` is always present (empty array if none).  
> Note: `hostId` is a plain string ID — fetch the user separately via `GET /api/users/all` if you need the host's full profile.

---

## Teams

All routes require Bearer token.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/teams` | `{ name, members?, projects? }` | Creates team |
| GET | `/api/teams` | — | Teams the user belongs to |
| GET | `/api/teams/:id` | — | Single team |
| PUT | `/api/teams/:id` | `{ name?, members?, projects? }` | Update team |
| DELETE | `/api/teams/:id` | — | Delete team |

---

## Tasks

All routes require Bearer token.

| Method | Path | Body / Query | Notes |
|--------|------|--------------|-------|
| POST | `/api/tasks` | `{ title, description?, assignee?, team?, priority?, status?, dueDate? }` | Creates task, notifies assignee |
| GET | `/api/tasks` | `?teamId=` (optional) | Lists tasks; filter by team |
| GET | `/api/tasks/:id` | — | Single task |
| PUT | `/api/tasks/:id` | same fields as create | Update task |
| DELETE | `/api/tasks/:id` | — | Delete task |

`priority`: `"low" | "medium" | "high"`  
`status`: `"todo" | "in_progress" | "done"`

---

## Notifications

All routes require Bearer token.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/notifications` | Returns `{ notifications: [{ _id, type, message, read, meeting?, task?, createdAt }] }` |
| PATCH | `/api/notifications/:id/read` | Marks one as read |
| POST | `/api/notifications/mark-all-read` | Marks all as read |

Notifications are created automatically for: task assignment, action item tasks, meeting summary ready, and screen share start.

---

## Chat (REST)

All routes require Bearer token. For real-time chat use the socket event below.

| Method | Path | Body / Query | Notes |
|--------|------|--------------|-------|
| GET | `/api/chat/meetings/:meetingId/messages` | `?limit=50` | Fetch chat history |
| POST | `/api/chat/meetings/:meetingId/messages` | `{ message, attachments? }` | Post a message (persisted) |

---

## AI — Post-meeting pipeline

All routes require Bearer token. Uses **Groq** (`whisper-large-v3-turbo` for transcription, configurable model for summary/action items).

### One-shot endpoint (recommended for post-meeting flow)

**`POST /api/ai/meetings/:meetingId/process`**

Accepts an audio file **or** raw transcript text. Runs the full pipeline in one request:
transcribe → summarize → extract action items → saves to meeting → notifies participants.

```
multipart/form-data  field: audio  (mp3, wav, webm, flac, m4a, ogg — max 25 MB)
```
or
```json
{ "transcript": "raw text..." }
```

Response:
```json
{
  "transcript": "Rahul will fix auth...",
  "summary": "The team discussed...",
  "actionItems": [
    { "_id": "...", "text": "Fix auth bug", "status": "pending" }
  ]
}
```

Also marks the meeting `status: "ended"` and sets `endTime`.

### Individual endpoints

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/ai/meetings/:meetingId/transcribe` | `multipart audio` or `{ text }` | Returns `{ transcript }` only, does not persist |
| POST | `/api/ai/meetings/:meetingId/summary` | `{ transcript }` | Generates + saves summary, notifies participants |
| POST | `/api/ai/meetings/:meetingId/action-items` | `{ transcript }` | Extracts + appends action items to meeting |
| POST | `/api/ai/meetings/:meetingId/tasks` | `{ items? }` | Creates Task records from stored action items |

---

## File upload

Bearer token required.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/upload/attachment` | `multipart/form-data` field: `file`, optional field: `meetingId` | Uploads to Cloudinary; if `meetingId` provided, appends URL to meeting attachments |

---

## Socket.IO

Connect to the **root server URL** (not `/api`):

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: { token: accessToken },   // your JWT access token
  withCredentials: true,
});

socket.on("connected", ({ userId, socketId }) => {
  console.log("socket ready", socketId);
});
```

On connect the server joins you to your personal room `user:{userId}` for notifications.

---

### Meeting room events

#### Client → Server

```js
// Join a meeting room (must call before any other meeting events)
socket.emit("join-room", { meetingId }, (res) => {
  // res.success, res.participants, res.meeting
});

// Leave a meeting room
socket.emit("leave-room", { meetingId }, (res) => {});

// End the meeting (host only) — marks meeting ended in DB
socket.emit("end-meeting", { meetingId }, (res) => {
  // res.success
});

// Request mute for another user
socket.emit("mute-user", { meetingId, targetUserId });

// Raise / lower hand
socket.emit("raise-hand", { meetingId });
socket.emit("lower-hand", { meetingId });
```

#### Server → Client

```js
// Bootstrap: full participant list when you join
socket.on("room-participants", ({ meetingId, participants }) => {});

// Someone joined / left
socket.on("user-joined", ({ userId, user, socketId, participants, timestamp }) => {});
socket.on("user-left",   ({ userId, user, socketId, participants, timestamp }) => {});

// Host ended the meeting — navigate all participants away
socket.on("meeting-ended", ({ meetingId, endedBy, endedByName, timestamp }) => {});

// Host requested mute
socket.on("force-mute", ({ targetUserId, requestedBy, requestedByName }) => {});

socket.on("hand-raised", ({ userId, userName, timestamp }) => {});
socket.on("hand-lowered", ({ userId, timestamp }) => {});
```

**`participants` array shape:**
```json
[{ "userId": "...", "name": "Rahul", "socketId": "..." }]
```

---

### WebRTC signaling events

The server relays signaling payloads between peers. Use `socketId` values from `user-joined` / `room-participants` as `targetSocketId`.

#### Client → Server

```js
socket.emit("offer",         { targetSocketId, offer, meetingId });
socket.emit("answer",        { targetSocketId, answer, meetingId });
socket.emit("ice-candidate", { targetSocketId, candidate, meetingId });
socket.emit("renegotiate",   { targetSocketId, meetingId });

socket.emit("screen-share-start", { meetingId });
socket.emit("screen-share-stop",  { meetingId });

// Notify others of mic/camera state
socket.emit("media-state-change", { meetingId, audio: true, video: false });
```

#### Server → Client

```js
socket.on("offer",         ({ offer, from, fromUserId, fromUserName, meetingId }) => {});
socket.on("answer",        ({ answer, from, fromUserId, meetingId }) => {});
socket.on("ice-candidate", ({ candidate, from, fromUserId, meetingId }) => {});
socket.on("renegotiate",   ({ from, fromUserId, meetingId }) => {});

socket.on("screen-share-start", ({ userId, userName, socketId }) => {});
socket.on("screen-share-stop",  ({ userId, socketId }) => {});

socket.on("media-state-change", ({ userId, userName, socketId, audio, video }) => {});
```

---

### Chat events

Must be in the meeting room (`join-room` first).

#### Client → Server

```js
// Send a message (persisted to DB, broadcast to room)
socket.emit("send-message", { meetingId, content: "hello", type: "text", clientMessageId: "local-uuid" }, (res) => {
  // res.success, res.message
});

// Typing indicators
socket.emit("typing",      { meetingId });
socket.emit("stop-typing", { meetingId });

// React to a message
socket.emit("add-reaction", { meetingId, messageId, emoji: "👍" });
```

#### Server → Client

```js
socket.on("receive-message", ({ _id, meetingId, senderId, senderName, senderAvatar, text, type, timestamp, clientMessageId }) => {});

socket.on("typing",      ({ userId, userName }) => {});
socket.on("stop-typing", ({ userId }) => {});

socket.on("reaction-added", ({ messageId, userId, userName, emoji }) => {});
```

---

### Notification events

#### Server → Client

```js
// Fired automatically when any backend action creates a notification
socket.on("notification", ({ _id, type, message, read, createdAt }) => {});

// Fired after mark-notification-read socket call
socket.on("notification-read", ({ notificationId }) => {});
```

#### Client → Server (optional, prefer REST)

```js
socket.emit("send-notification",      { recipientId, type, message });
socket.emit("mark-notification-read", { notificationId });
```

---

### Collaboration events

#### Client → Server

```js
socket.emit("cursor-move",      { meetingId, x, y, element });
socket.emit("document-edit",    { meetingId, documentId, changes, version });
socket.emit("meeting-reaction", { meetingId, emoji: "🎉" });
socket.emit("whiteboard-draw",  { meetingId, drawData });
socket.emit("whiteboard-clear", { meetingId });
```

#### Server → Client

```js
socket.on("cursor-move",      ({ userId, userName, x, y, element }) => {});
socket.on("document-edit",    ({ userId, userName, documentId, changes, version, timestamp }) => {});
socket.on("meeting-reaction", ({ userId, userName, emoji, timestamp }) => {});
socket.on("whiteboard-draw",  ({ userId, userName, drawData }) => {});
socket.on("whiteboard-clear", ({ userId, userName }) => {});
```

---

## Post-meeting integration flow (recommended)

```
1. Host clicks "End meeting"
   → socket.emit("end-meeting", { meetingId })
   → all participants receive "meeting-ended" → navigate to summary page

2. Frontend stops MediaRecorder → gets audio Blob (webm/mp3/flac)

3. POST /api/ai/meetings/:meetingId/process
   with multipart audio field
   → { transcript, summary, actionItems }

4. Render summary + action items on the post-meeting dashboard
   (already persisted on the meeting, also available via GET /api/meetings/:id)

5. Optional: POST /api/ai/meetings/:meetingId/tasks
   to convert action items into Task records with assignees
```

---

## Roles

- **admin** — first registered user; can list all users and all meetings
- **member** — default for all subsequent registrations; scoped to their own data

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Yes | Secret for signing access tokens |
| `JWT_ACCESS_EXPIRES` | No | Token lifetime (code default `15m`) |
| `CLIENT_URL` | Yes | Comma-separated frontend origins for CORS |
| `GROQ_API_KEY` | Yes | Groq API key (transcription + summary + action items) |
| `GROQ_MODEL` | No | Groq chat model (default `llama-3.1-8b-instant`) |
| `CLOUDINARY_CLOUD_NAME` | For uploads | Cloudinary config |
| `CLOUDINARY_API_KEY` | For uploads | Cloudinary config |
| `CLOUDINARY_API_SECRET` | For uploads | Cloudinary config |
| `REDIS_URL` | No | Redis connection (default `redis://127.0.0.1:6379`) |
| `REDIS_DISABLED` | No | Set `true` to run without Redis |
| `MAX_FILE_MB` | No | Max upload size in MB (code default `10`, Groq cap is 25) |

## Scripts

```bash
npm run dev   # node --watch src/server.js
npm start     # node src/server.js
```
