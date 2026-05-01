# External Integrations

**Analysis Date:** 2026-04-21

## APIs & External Services

**Realtime Transport:**
- Socket.IO - Multiplayer events between browser and server.
  - SDK/Client: `socket.io` server + `/socket.io/socket.io.js` client script.
  - Auth: None (local session only).

**Third-Party Assets:**
- Google Fonts (Montserrat) via `fonts.googleapis.com`.
- Boxicons CDN via `unpkg.com`.
- Three.js CDN via `cdnjs.cloudflare.com` + `unpkg.com` importmap.
- Eruda debugging overlay via `cdn.jsdelivr.net`.

## Data Storage

**Databases:**
- None (all state is in-memory).

**File Storage:**
- Local `public/assets/` for images, audio, and VFX resources.

**Caching:**
- None.

## Authentication & Identity

**Auth Provider:**
- None (no login/authentication system).

## Monitoring & Observability

**Error Tracking:**
- None.

**Analytics:**
- None.

**Logs:**
- Console output only.

## CI/CD & Deployment

**Hosting:**
- Not specified; typical deployment is Node.js server hosting static `public/`.

**CI Pipeline:**
- None detected.

## Environment Configuration

**Development:**
- No required env vars detected.

**Staging/Production:**
- Not specified.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

---

*Integration audit: 2026-04-21*
*Update when adding/removing external services*