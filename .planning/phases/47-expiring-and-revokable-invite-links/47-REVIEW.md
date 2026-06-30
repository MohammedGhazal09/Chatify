# Phase 47 Code Review

## Scope

- `Backend/Chatify/Models/inviteLinkModel.mjs`
- `Backend/Chatify/Utils/inviteLinks.mjs`
- `Backend/Chatify/Controller/inviteLinkController.mjs`
- `Backend/Chatify/Routes/inviteLinkRouter.mjs`
- `Backend/Chatify/app.mjs`
- `Backend/Chatify/test/helpers/authAgent.mjs`
- `Backend/Chatify/test/invite/invite-links.test.mjs`
- `Frontend/Chatify/src/types/invite.ts`
- `Frontend/Chatify/src/api/inviteApi.ts`
- `Frontend/Chatify/src/hooks/useInviteLinks.ts`
- `Frontend/Chatify/src/pages/invite/InviteJoin.tsx`
- `Frontend/Chatify/src/pages/chat/components/InviteLinksDialog.tsx`
- `Frontend/Chatify/src/pages/chat/components/InviteLinksDialog.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.test.tsx`
- `Frontend/Chatify/src/pages/chat/chat.tsx`

## Findings

### Fixed: Max-use invite joins could race

- Severity: Warning
- Area: `Backend/Chatify/Controller/inviteLinkController.mjs`
- Issue: Invite active state was checked before a new member joined, but `useCount` was incremented afterward on the document. Concurrent joins against a one-use invite could both observe the link as active and exceed `maxUses`.
- Fix: Replaced document increment with atomic invite-use claiming and rollback of the member add if the claim fails.
- Regression: Added concurrent two-user group invite test.
- Verification: `cd Backend/Chatify; npm test -- test/invite/invite-links.test.mjs test/chat/chat.group.test.mjs test/space/space.messaging.test.mjs` passed.

## No Remaining Findings

- Token hashing and serialization keep raw tokens out of list/revoke responses.
- Management checks preserve group admin and space owner/admin boundaries.
- Direct chats and encrypted conversations remain excluded.
- Frontend invite state stays behind typed API/hooks and existing route guards.

## Recommendations

- Keep max-use values preset-based for now. Add custom values only after product demand, because presets make abuse and support behavior easier to reason about.
