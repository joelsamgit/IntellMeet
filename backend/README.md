# IntellMeet Backend

Production-oriented REST API for **IntellMeet** (authentication, users, meetings, teams, tasks, notifications, chat, sockets, and AI meeting helpers). Built to match the existing Vite + React frontend in this repo.

## Frontend alignment

| Frontend | Backend |
|----------|---------|
| `VITE_API_URL` default `http://localhost:5000/api` | All routes mounted under `/api` |
| `POST /auth/login`, `POST /auth/signup` | Same paths; `POST /auth/register` is an alias for signup |
| Login/signup response `{ user, token }` | Access JWT in JSON; refresh token in **HTTP-only** cookie `refreshToken` (path `/api/auth`) |
| `withCredentials: true` | CORS `credentials: true` and `CLIENT_URL` origin |
| `Authorization: Bearer <token>` | Required on protected routes |

Meeting list/detail payloads follow `frontend/src/types/index.ts` (`startTime`, `hostId`, `participants`, `actionItems`, etc.).

## Tech stack

Node.js (ESM), Express, Socket.IO, MongoDB + Mongoose, JWT access tokens, opaque refresh tokens (hashed in DB), bcrypt, Redis (cache + session + token blacklist), Cloudinary (avatars + attachments), optional Groq summaries/action extraction, Helmet, express-rate-limit, cookie-parser, cors, multer, express-validator.

## Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis (optional: set `REDIS_DISABLED=true` in `.env` to skip; caching and access-token blacklist are degraded)
- OpenAI API key for Whisper/GPT meeting analysis
- Hugging Face API key for sentiment and inference
- Cloudinary account (optional until you configure uploads)
- Groq API key (optional; summary/action endpoints use a simple local fallback without it)

## Setup

```bash
cd backend
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_ACCESS_SECRET, and optionally Redis + Cloudinary + Groq
npm install
npm run dev
```

API base: `http://localhost:5000/api`  
Health: `GET http://localhost:5000/api/health`

## Environment variables

See `.env.example` for descriptions. **Never commit real secrets**; keep them in `.env` (ignored by git).

For AI summaries/action items, set:

```bash
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant
```

## API overview

### Auth (`/api/auth`)

- `POST /register` — same body as signup  
- `POST /signup` — `{ name, email, password }` → `{ user, token }` + refresh cookie  
- `POST /login` — `{ email, password }`  
- `POST /logout` — Bearer required; clears refresh cookie + server session  
- `POST /refresh-token` — uses refresh cookie → new access + refresh  
- `POST /forgot-password` — `{ email }` (in dev, reset URL is logged and may be returned)  
- `POST /reset-password` — `{ email, token, password }`  
- `PUT /change-password` — Bearer + `{ currentPassword, newPassword }`

### Users (`/api/users`, Bearer)

- `GET /profile`  
- `PUT /profile` — `{ name?, bio?, email? }`  
- `POST /avatar` — `multipart/form-data` field `avatar`  
- `GET /all` — **admin only**

### Meetings (`/api/meetings`, Bearer)

- `POST /create` — body includes `title`, `scheduledTime` (ISO), optional `description`, `participantIds`, `status`  
- `GET /` — meetings where user is host or participant (admins see all)  
- `GET /:id` — MongoDB `_id` or `meetingCode`  
- `PUT /:id`, `DELETE /:id` — host or admin  

### Teams (`/api/teams`, Bearer)

Full CRUD: `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

### Tasks (`/api/tasks`, Bearer)

Full CRUD: `POST /`, `GET /?teamId=`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

### Notifications (`/api/notifications`, Bearer)

- `GET /` — maps `isRead` → `read` in JSON for the UI  
- `PATCH /:id/read`  
- `POST /mark-all-read`

### Chat (`/api/chat`, Bearer)

- `GET /meetings/:meetingId/messages?limit=50` — list meeting chat history  
- `POST /meetings/:meetingId/messages` — `{ message, attachments? }`

### AI meeting helpers (`/api/ai`, Bearer)

- `POST /meetings/:meetingId/transcribe` — `{ text | transcript }` placeholder endpoint for transcript ingestion  
- `POST /meetings/:meetingId/summary` — stores and returns `{ summary }`  
- `POST /meetings/:meetingId/action-items` — extracts action items into the meeting  
- `POST /meetings/:meetingId/tasks` — creates task records from provided or stored action items

### Upload (`/api/upload`, Bearer)

- `POST /attachment` — field `file`; optional `meetingId` (form field) to append to meeting `attachments`

## Socket.IO events

Connect to the API server URL with auth:

```js
io("http://localhost:5000", {
  auth: { token: accessToken },
  withCredentials: true,
});
```

Client emits:

- `meeting:join` / `meeting:leave` — `{ meetingId }`
- `chat:send` — `{ meetingId, message, attachments? }`
- `signal:offer`, `signal:answer`, `signal:ice-candidate` — WebRTC signaling payloads with `{ meetingId, to, ... }`
- `screen-share:start` / `screen-share:stop` — `{ meetingId }`

Client listens:

- `participants:update`, `participant:joined`, `participant:left`
- `chat:message`
- `signal:offer`, `signal:answer`, `signal:ice-candidate`
- `screen-share:started`, `screen-share:stopped`
- `notification:new`

## Roles

- **admin** — first registered user becomes admin; others default to **member**  
- Admins may list all users and all meetings; members are scoped to their data where applicable  

## Security notes

- Passwords hashed with bcrypt (cost 12)  
- Refresh tokens are never stored in plain text (SHA-256 hash in DB)  
- Access token `jti` can be blacklisted in Redis after logout  
- Helmet + rate limiting + input validation on write routes  

## Scripts

- `npm run dev` — `node --watch src/server.js`  
- `npm start` — `node src/server.js`

## Implemented additions from our side

This section documents the realtime meeting, chat, notification, task, team/workspace, and AI helper work added on top of the original backend setup.

### Realtime Socket.IO layer

Socket.IO is initialized from `src/server.js` through `src/services/socket.service.js`. Clients connect to the backend root URL, not the `/api` URL:

```js
io("http://localhost:5000", {
  auth: { token: accessToken },
  withCredentials: true,
});
```

The socket middleware validates the access JWT, loads the user, joins a per-user notification room, and then allows meeting-scoped events only if the user can access that meeting.

Implemented events:

- `meeting:join` — joins `meeting:{meetingId}` and broadcasts participant updates.
- `meeting:leave` — leaves the meeting room and broadcasts participant updates.
- `chat:send` — creates a persisted chat message and emits `chat:message`.
- `signal:offer`, `signal:answer`, `signal:ice-candidate` — forwards WebRTC signaling payloads to the target socket id.
- `screen-share:start` — broadcasts `screen-share:started` and creates screen-share notifications.
- `screen-share:stop` — broadcasts `screen-share:stopped`.
- `disconnect` — removes the user from live participant maps.

Useful listener events:

- `participants:update`
- `participant:joined`
- `participant:left`
- `chat:message`
- `signal:offer`
- `signal:answer`
- `signal:ice-candidate`
- `screen-share:started`
- `screen-share:stopped`
- `notification:new`

### Chat system

Chat is implemented with:

- Model: `src/models/Chat.js`
- Controller: `src/controllers/chat.controller.js`
- Routes: `src/routes/chat.routes.js`
- Validators: `src/validators/chat.validators.js`

REST endpoints:

- `GET /api/chat/meetings/:meetingId/messages?limit=50`
- `POST /api/chat/meetings/:meetingId/messages`

Socket endpoint:

- `chat:send`

Chat messages are stored with meeting id, sender id, message text, optional attachments, timestamps, and soft-delete fields.

### Notifications

Notifications are implemented with:

- Model: `src/models/Notification.js`
- Service: `src/services/notification.service.js`
- Controller: `src/controllers/notification.controller.js`
- Routes: `src/routes/notification.routes.js`

REST endpoints:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/mark-all-read`

Realtime notifications are emitted to `user:{userId}` as:

```text
notification:new
```

Notifications are currently created for task assignment, action-item task creation, meeting summary completion, and screen-share start events.

### AI meeting helpers with Groq

AI helpers are implemented with:

- Service: `src/services/ai.service.js`
- Controller: `src/controllers/ai.controller.js`
- Routes: `src/routes/ai.routes.js`
- Validators: `src/validators/ai.validators.js`

Environment variables:

```bash
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant
```

REST endpoints:

- `POST /api/ai/meetings/:meetingId/transcribe`
- `POST /api/ai/meetings/:meetingId/summary`
- `POST /api/ai/meetings/:meetingId/action-items`
- `POST /api/ai/meetings/:meetingId/tasks`

Notes:

- `summary` calls Groq and stores the result on the meeting.
- `action-items` calls Groq and appends extracted action items to the meeting.
- `tasks` converts provided or stored action items into `Task` documents.
- `transcribe` is currently a transcript-ingestion placeholder. It accepts `text` or `transcript`; it does not transcribe uploaded audio yet.
- If `GROQ_API_KEY` is missing or Groq fails, summary/action extraction falls back to local lightweight logic.

### Task management

Task management is implemented with:

- Model: `src/models/Task.js`
- Controller: `src/controllers/task.controller.js`
- Routes: `src/routes/task.routes.js`
- Validators: `src/validators/task.validators.js`

REST endpoints:

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

Tasks support title, description, assignee, team, priority, status, due date, creator, and assignment notifications.

### Team/workspace APIs

The project uses `Team` as the workspace-style model.

Implemented with:

- Model: `src/models/Team.js`
- Controller: `src/controllers/team.controller.js`
- Routes: `src/routes/team.routes.js`
- Validators: `src/validators/team.validators.js`

REST endpoints:

- `POST /api/teams`
- `GET /api/teams`
- `GET /api/teams/:id`
- `PUT /api/teams/:id`
- `DELETE /api/teams/:id`

Teams support members and embedded project records. Task APIs can be scoped by `teamId`.

### Data model additions

Added or extended models for this feature set:

- `Chat` — persistent meeting messages.
- `Notification` — user notifications with read state and optional meeting/task links.
- `Task` — task and action-item management.
- `Team` — workspace/team grouping with members and projects.
- `Meeting` — stores `summary`, `actionItems`, attachments, participants, and meeting metadata.

### Quick smoke tests

Health:

```bash
curl http://localhost:5000/api/health
```

Socket.IO handshake:

```bash
curl "http://localhost:5000/socket.io/?EIO=4&transport=polling"
```

AI summary:

```bash
curl -X POST http://localhost:5000/api/ai/meetings/MEETING_ID/summary \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transcript":"We discussed login bugs. Rahul will fix auth. Priya needs to prepare the UI demo."}'
```

Action items:

```bash
curl -X POST http://localhost:5000/api/ai/meetings/MEETING_ID/action-items \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transcript":"Rahul needs to fix auth. Priya should prepare the UI demo. Send report tomorrow."}'
```

Chat message:

```bash
curl -X POST http://localhost:5000/api/chat/meetings/MEETING_ID/messages \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from backend chat"}'
```

Task creation:

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Manual task","priority":"high","status":"todo"}'
```

Team/workspace creation:

```bash
curl -X POST http://localhost:5000/api/teams \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dev Team","projects":[{"name":"IntellMeet"}]}'
```

### Known remaining work

- Replace the transcription placeholder with real audio/video transcription.
- Add a Socket.IO Redis adapter or Redis pub/sub if multiple backend instances need to share realtime events.
- Add automated tests for socket auth/events, AI helper endpoints, task creation from action items, and notification delivery.
- Confirm frontend event payloads match the socket event names documented above.
