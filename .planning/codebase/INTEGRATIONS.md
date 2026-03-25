# External Integrations

**Analysis Date:** 2026-03-25

## APIs & External Services

**Game Networking:**

- Socket.IO - Real-time multiplayer communication
  - SDK/Client: `socket.io`, `socket.io-client`
  - Auth: Username only (no password)

## Data Storage

**Databases:**

- None (in-memory only)
  - Connection: Not applicable
  - Client: Not applicable

**File Storage:**

- Local filesystem only (assets, portraits)

**Caching:**

- None

## Authentication & Identity

**Auth Provider:**

- Custom (username only, no password)
  - Implementation: Slot assignment on connect

## Monitoring & Observability

**Error Tracking:**

- None

**Logs:**

- Console logs, combat logs (manual)

## CI/CD & Deployment

**Hosting:**

- Node.js server, static file hosting

**CI Pipeline:**

- None detected

## Environment Configuration

**Required env vars:**

- None detected (all config in code)

**Secrets location:**

- Not applicable

## Webhooks & Callbacks

**Incoming:**

- None

**Outgoing:**

- None

---

_Integration audit: 2026-03-25_
