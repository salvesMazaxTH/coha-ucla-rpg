# Technology Stack

**Analysis Date:** 2026-03-25

## Languages

**Primary:**

- JavaScript (ES Modules) - All logic (server, client, shared)

**Secondary:**

- None detected

## Runtime

**Environment:**

- Node.js >=18 (server)

**Package Manager:**

- npm/pnpm (pnpm-lock.yaml present)
- Lockfile: present

## Frameworks

**Core:**

- Express 5.x - HTTP server
- Socket.IO 4.x - Real-time communication

**Testing:**

- None detected (manual test script only)

**Build/Dev:**

- nodemon - Dev server reload

## Key Dependencies

**Critical:**

- express - HTTP server
- socket.io - WebSocket communication

**Infrastructure:**

- None detected

## Configuration

**Environment:**

- No .env detected; config is hardcoded or via JS files
- Key configs: editMode, team size, timeouts (in `src/server.js`)

**Build:**

- No build step; pure JS/ESM
- Config files: `package.json`, `pnpm-lock.yaml`

## Platform Requirements

**Development:**

- Node.js >=18, browser

**Production:**

- Node.js server, static file hosting for client

---

_Stack analysis: 2026-03-25_
