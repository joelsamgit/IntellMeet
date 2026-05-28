# 🤖 IntellMeet — AI-Powered Enterprise Meeting Platform

A production-grade full-stack meeting platform built with React 19, TypeScript, and AI intelligence.

## 🚀 Features
- Real-time video meetings with WebRTC
- AI-powered meeting summaries & transcription
- Smart action item extraction
- Team collaboration & Kanban board
- Analytics & productivity insights
- Real-time chat with Socket.io
- Live presence, typing indicators, and meeting notifications

## 🛠️ Tech Stack
- **Frontend:** React 19, TypeScript, Vite
- **UI:** Tailwind CSS v3, shadcn/ui
- **State:** Zustand, TanStack Query
- **Real-time:** Socket.io client
- **Charts:** Recharts

## Realtime setup

The meeting room page expects the backend Socket.io server at `VITE_SOCKET_URL` and falls back to the current hostname on port `5000`.

- `VITE_API_URL` defaults to `http://localhost:5000/api`
- `VITE_SOCKET_URL` should point to the Socket.io origin, for example `http://localhost:5000`

The meeting room now handles:

- room join/leave and presence updates
- real-time chat and typing indicators
- offer/answer/ICE signaling for WebRTC peers
- screen-share and media-state signaling
- AI transcription upload on leave
- **Forms:** React Hook Form + Zod

## ⚙️ Setup

### Prerequisites
- Node.js v18+
- npm v9+

### Installation
```bash
# Clone the repo
git clone https://github.com/joelsamgit/IntellMeet.git

# Enter the folder
cd intellmeet-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

## 📁 Project Structure
