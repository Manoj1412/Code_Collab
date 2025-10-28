# Code Collab - Collaborative Code Editor MVP

A real-time collaborative code editor built with React, Monaco Editor, Socket.io, Node.js/Express, and MongoDB. Supports multiple languages (JS, Python via Pyodide, HTML/CSS), dark/light themes, chat, participants list, and anonymous access.

## Features
- Real-time code editing, cursor positions, typing indicators
- Run code client-side (JS in iframe, Python with Pyodide, HTML/CSS preview)
- Create/join rooms anonymously (username prompt on entry)
- Basic chat sidebar
- Auto-save snapshots to DB
- Theme toggle (light/dark)
- Secure: Input validation, rate-limiting on sockets

## Tech Stack
- **Frontend**: React 18, Monaco Editor, Socket.io-client, Tailwind CSS, Axios, React Router
- **Backend**: Node.js/Express, Socket.io, Mongoose/MongoDB, CORS, JWT (for future auth extension)
- **Database**: MongoDB (local or Atlas)
- **Other**: Pyodide (client-side Python), concurrent dev setup

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB (local install or use MongoDB Atlas for cloud)
  - Local: Download from [mongodb.com](https://www.mongodb.com/try/download/community), start with `mongod` (or via MongoDB Compass)
  - Atlas: Create free cluster at [cloud.mongodb.com](https://www.mongodb.com/atlas), get connection string, replace in `.env`

### 1. Clone/Setup Project
```
# In project root (Code_Collab)
npm install  # Installs concurrent
npm run install-all  # Installs server & client deps
```

### 2. Environment Setup
- Create `server/.env` (if not exists):
```
MONGO_URI=mongodb://localhost:27017/codecollab  # Or your Atlas URI: mongodb+srv://<user>:<pass>@cluster.mongodb.net/codecollab
JWT_SECRET=your_super_secret_jwt_key_change_for_production
PORT=5000
CLIENT_URL=http://localhost:3000
```
- For client, no env needed (uses localhost:5000 hardcoded).

### 3. Start Services
- **Backend** (with MongoDB running):
  ```
  cd server
  npm start  # Or npm run dev for nodemon
  ```
  - Should log: "MongoDB connected" and "Server running on port 5000"
  - If DB error: Ensure MongoDB is running (`mongod`) or update MONGO_URI.

- **Frontend**:
  ```
  cd client
  npm start  # Runs on http://localhost:3000
  ```

- **Concurrent (recommended)**:
  ```
  # From root
  npm run dev  # Starts both (install concurrently if needed)
  ```

### 4. Testing the App
- Open http://localhost:3000
- **Anonymous Access**: Click "Create New Room" → Enter username in prompt → Enters editor.
- **Join Room**: Enter existing Room ID + username.
- **In Editor**:
  - Edit code → See real-time sync (test in incognito tab: join same room).
  - Toggle theme (top-right).
  - Switch language (dropdown), write code, click "Run":
    - JS: Executes in sandbox, alerts output/errors.
    - Python: First run loads Pyodide (~10s), then `print("Hello")` alerts "Hello".
  - Chat: Type messages, see broadcasts.
  - Participants: Shows users with colored avatars.
- **API Test** (curl example for create room):
  ```
  curl -X POST http://localhost:5000/api/rooms/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","language":"python"}'
  ```
  - Response: `{ "roomId": "abc123", ... }`

### Troubleshooting
- **"Failed to create room"**: 
  - Check backend console: If "MongoDB connection error", start MongoDB or fix MONGO_URI.
  - Ensure backend running on :5000 (no port conflict).
  - CORS: If frontend can't reach backend, verify CLIENT_URL in .env.
- **Pyodide slow first load**: Normal; subsequent runs fast.
- **No real-time sync**: Ensure both tabs connect to same room; check socket console logs.
- **Build errors**: Run `npm run build` in client; fix ESLint if any.
- **Console warnings**: React Router/StrictMode - harmless for MVP.

### Deployment
- **Frontend (Vercel/Netlify)**: `cd client && npm run build`, deploy dist folder. Set API proxy to backend URL.
- **Backend (Heroku/Render)**: `cd server && git init`, push with Procfile (`web: node app.js`), set env vars.
- **DB**: Use MongoDB Atlas for production.
- Update client API URLs to production backend (e.g., in utils/api.js).

### Potential Extensions
- Full auth (login/register with JWT).
- File tree/explorer.
- Version history (load snapshots).
- More languages (add Monaco themes).
- Conflict resolution (OT library like ShareDB).

## File Structure
- `package.json`: Root concurrent scripts.
- `server/`: Backend (app.js, models/, routes/, sockets.js, .env).
- `client/`: Frontend (src/components/, src/context/, package.json).

Enjoy collaborating! For issues, check console logs or update deps.