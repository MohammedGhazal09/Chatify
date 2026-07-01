---
phase: 54
created: 2026-07-01
---

# Phase 54 Context

Phase 30 deferred bots and integrations until scoped permissions, audit trails, revocation, signed runtime identity, rate limits, and abuse controls exist. Phases 38 and 47 later added bounded spaces and invite links, which provide a conservative target model for installing integrations.

Relevant existing code:

- `Backend/Chatify/Models/spaceModel.mjs`
- `Backend/Chatify/Models/chatModel.mjs`
- `Backend/Chatify/Routes/spaceRouter.mjs`
- `Backend/Chatify/Routes/adminRouter.mjs`
- `Frontend/Chatify/src/pages/admin/AdminHub.tsx`

Implementation recommendation: build permission and audit primitives first and expose only a read-only runtime manifest. Message read/write and webhook execution should be separate future phases because they need content privacy, moderation, rate-limit, and abuse-report wiring.
