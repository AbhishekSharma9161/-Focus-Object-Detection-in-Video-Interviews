# Focus & Object Detection in Video Interviews (Next.js)

A Next.js (App Router) application that performs real-time proctoring during online interviews using TensorFlow.js models for face, focus, and object detection. Includes logging, basic API routes, and report generation.

## Tech Stack
- Frontend: Next.js 15 (App Router), React 18, TypeScript, TailwindCSS 3, Radix UI
- ML: TensorFlow.js, BlazeFace (face), Coco SSD (objects)
- UI Utils: React Query, Sonner, clsx, tailwind-merge
- Backend (to be added): Next Route Handlers + MongoDB (via `backend/`)

## Folder Structure
```
backend/                 # Express-based backend (MongoDB or file fallback)
  ├─ data/
  │  ├─ reports/         # JSON fallback storage
  │  └─ db.js            # Mongoose connection + schemas (ProctorReport)
  ├─ lib/
  │  └─ mongo.ts         # Native MongoDB driver helper (optional)
  ├─ routes/
  │  └─ proctor.ts       # REST endpoints (save/list/get/report events/summary/session)
  ├─ index.ts            # Express app wiring
  └─ node-build.ts       # Standalone server (Express 5-compatible)
frontend/                # Next.js app root
  ├─ public/             # Public assets
  ├─ src/
  │  ├─ app/             # App Router (routes + API)
  │  ├─ components/      # UI components (Radix-based)
  │  ├─ features/        # Proctoring features
  │  ├─ hooks/           # Reusable hooks
  │  └─ pages/           # Client page wrappers (Index.tsx)
  ├─ next.config.ts
  ├─ tsconfig.json
  └─ tailwind.config.ts
shared/                  # Shared types between frontend and backend
```

## Getting Started
1. Install dependencies
```bash
npm install
cd frontend && npm install
cd ..
```
2. Development
```bash
npm run dev  # Starts Next.js on http://localhost:3000
```
3. Backend (standalone, optional)
```bash
# Requires .env with MONGODB_URI and MONGODB_DB (proctor)
npx tsx backend/node-build.ts
# Serves API and SPA fallback; by default PORT=3001 (change in .env)
```

4. Build & Start (frontend)
```bash
npm run build
npm run start
```

## Features
- Real-time webcam capture with overlays
- Focus detection: looking away > 5s, no face > 10s, multiple faces heuristic
- Object detection: phone, books/notes, devices (coco-ssd)
- Audio detection heuristic (background audio spikes)
- Event logging with timestamps and in-UI toasts
- Report snapshot + PDF export

## Performance Tweaks
- Object detection cadence increased to ~600ms and lower score threshold for quicker detection.
- Attempt to use `lite_mobilenet_v2` for faster inference; falls back to `mobilenet_v2`.
- TF.js backend prefers WebGL when available.

## API Endpoints
The backend serves these under `/api` (via Express or Next.js route handlers):
- POST `/api/proctor/session` → create a session/report shell; returns `{ id }`
- POST `/api/proctor/session/:id/event` → append one event to the session
- POST `/api/proctor/report` → save the final report snapshot; returns `{ id }`
- GET `/api/proctor/reports` → list summaries of all reports
- GET `/api/proctor/reports/:id` → fetch full report (events, counts, score)
- GET `/api/proctor/reports/:id/events?type=PHONE_DETECTED` → filter events
- GET `/api/proctor/reports/:id/summary` → server-computed summary object

## Troubleshooting
- Hydration warnings are avoided by rendering the main page as a client component via dynamic import.
- If your editor reports problems from removed folders (e.g., `web/tsconfig.json`), remove that folder from the workspace and restart the TS server.

## Environment Setup

⚠️ **Security Notice**: The `.env` file has been removed from version control to protect sensitive credentials.

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your actual values:
```bash
MONGODB_URI=your_mongodb_connection_string_here
MONGODB_DB=proctor
PING_MESSAGE=ping
PORT=3000
```

3. **Never commit the `.env` file** - it's already included in `.gitignore`

## Deployment

For Netlify deployment, make sure to:
1. Set environment variables in your Netlify dashboard (not in the `.env` file)
2. The build should now pass without TypeScript/ESLint errors
3. Use the provided `netlify.toml` configuration

## License
MIT
