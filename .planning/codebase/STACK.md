# Technology Stack

**Analysis Date:** 2026-04-21

## Languages

**Primary:**
- JavaScript (ES Modules) - Server (`src/server.js`) and shared engine (`shared/`)

**Secondary:**
- CSS - UI styling (`public/styles/`)
- HTML - Single-page client (`public/index.html`)
- TypeScript (tooling only) - Listed in devDependencies; no TS sources in repo

## Runtime

**Environment:**
- Node.js >= 18 (server/runtime requirement in `package.json`)
- Browser runtime (client uses ES modules + DOM APIs)

**Package Manager:**
- npm (lockfiles: `package-lock.json`, `pnpm-lock.yaml`)

## Frameworks

**Core:**
- Express 5.2 - HTTP server (`src/server.js`)
- Socket.IO 4.8 - Real-time multiplayer events (`src/server.js`, `public/js/main.js`)

**Testing:**
- None configured (no test runner or scripts in `package.json`)

**Build/Dev:**
- nodemon 3.1 - dev reload (`npm run dev`)
- TypeScript 6.x - tooling only (no build pipeline configured)

## Key Dependencies

**Critical:**
- express ^5.2.1 - HTTP server and static asset hosting
- socket.io ^4.8.3 - Real-time game events

**Infrastructure:**
- Node.js built-ins (`http`, `fs`, `path`) used for server runtime

## Configuration

**Environment:**
- No env config files detected; configuration lives in code (e.g., `editMode` in `src/server.js`)

**Build:**
- `jsconfig.json` for editor tooling
- No bundler or transpiler config present

## Platform Requirements

**Development:**
- Any OS with Node.js 18+
- Browser supporting ES modules

**Production:**
- Node.js server serving `public/` and `shared/` assets

---

*Stack analysis: 2026-04-21*
*Update after major dependency changes*