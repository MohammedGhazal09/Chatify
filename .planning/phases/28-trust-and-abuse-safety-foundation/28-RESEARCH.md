# Phase 28 Research

## Repository Findings

- `Backend/Chatify/Controller/chatController.mjs` already has reusable membership patterns for chat-scoped resources.
- `Backend/Chatify/Controller/messageController.mjs` already treats unauthorized messages as private resources.
- `Backend/Chatify/Middlewares/rateLimiters.mjs` centralizes route-specific rate limiters and skips them under `NODE_ENV=test`.
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.tsx` and `MessageActionMenu.tsx` are the smallest UI surfaces for report entry points.
- `Frontend/Chatify/src/pages/chat/chat.tsx` owns the selected chat, current user, and toast behavior needed to submit reports.

## Skills Applied

- `find-skills`: required by project instructions and used to identify relevant skills.
- `api-sec`: API authorization and object-boundary routing.
- `auth-sec`: admin authorization, session trust, and role boundary.
- `react-testing`: behavior-first component tests for the new report controls.
- `frontend-accessibility`: accessible names, menu semantics, and keyboard-preserving controls.

## Recommendation

Recommendation: keep moderation API routes separate from chat/message routes. This prevents report review permissions from leaking into normal chat permissions and makes future admin UI work easier to reason about.
