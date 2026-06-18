# Phase 24: Group Message Sender Names And Group Voice/Video Calls - UI Review

**Reviewed:** 2026-06-18
**Review type:** Inline UI audit against `24-UI-SPEC.md`
**Overall:** 22/24

## Scores

| Pillar | Score | Notes |
|--------|-------|-------|
| Copywriting | 4/4 | Sender fallback and unavailable group call copy are concrete and user-safe. |
| Visuals | 4/4 | Sender label is visually subordinate to message content and uses existing message column layout. |
| Color | 4/4 | Sender labels use muted text; call icons keep existing accent treatment. |
| Typography | 4/4 | Sender labels use compact metadata typography and truncate within the message column. |
| Spacing | 4/4 | Label spacing uses the existing bubble stack without adding nested cards or layout shifts. |
| Experience Design | 2/4 | Component-rendered tests cover the changed UI, but no authenticated full-browser group chat session was available in this run. |

## Reviewed Surfaces

- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx`
- `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx`
- `Frontend/Chatify/src/hooks/useCallController.ts`
- `Frontend/Chatify/src/pages/chat/chat.tsx`

## Findings

No phase-scoped UI findings to fix.

## Evidence

- `npm test -- MessageBubble.test.tsx useCallController.test.tsx` passed and rendered the sender-label and group-call availability surfaces in focused tests.
- `npm run lint` passed.
- `npm run build` passed.
- Code review confirms header and detail call buttons already expose disabled reasons through `title`, disabled state, and screen-reader text where applicable.

## Not Run

- Real authenticated browser review of a seeded group conversation was not run because no local backend/test accounts/group fixture were configured for this execution.
- Production UI review was not run and is not claimed.
