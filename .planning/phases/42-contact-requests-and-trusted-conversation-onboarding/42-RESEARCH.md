# Phase 42 Research - Contact Requests And Trusted Conversation Onboarding

## Findings

- Existing direct chat creation already centralizes username validation, block checks, direct chat lookup, chat creation, public serialization, and socket fanout in `Backend/Chatify/Controller/chatController.mjs`.
- Existing contacts are inferred from shared chats, so pending requests need their own endpoint and cannot reuse `getAllUsers`.
- Mongoose partial unique indexes are already used for direct chat keys and can also enforce one pending request per requester/recipient pair.
- The chat route test helpers auto-attach CSRF tokens for unsafe `/api/chat` methods, so request routes should live under the chat router.
- Frontend direct-chat cache behavior lives in `useCreateChat`; request-specific mutations should use the same TanStack Query invalidation style.
- `NewChatDialog` already owns direct username entry and can switch copy/CTA without adding a new dependency.

## Risks

- Replacing immediate chat creation will break existing tests unless they are updated to accept first or seed trust.
- Encrypted direct chat creation has device-local key behavior. New-contact encrypted onboarding should be deferred rather than silently creating unreadable encrypted chats.
- A UI-only gate would be bypassable through direct API calls.
- Public identity serialization must be reused to avoid email leaks.

## Recommendation

Add the smallest backend-enforced request lifecycle for standard direct conversations, then update the chat UI to send and manage requests. Keep existing direct chat continuation and group/space behavior untouched.
