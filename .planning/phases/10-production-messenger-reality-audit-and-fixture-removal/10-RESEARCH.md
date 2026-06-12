# Phase 10 Research

## RESEARCH COMPLETE

Phase 10 should be planned as a production-truth gate, not as another visual/static UI pass. The user-reported failures are mostly about false confidence: the rail cannot close, production detail data looks static, actions are not clearly supported or unsupported, and message delivery status can claim delivery while the recipient does not receive the message until refresh.

The Phase 10 spec and context intentionally draw a boundary: fix fixture/static UI behavior and production auditability now; document the duplicate-send and cross-client delivery defects as a baseline for Phase 10.1 rather than repairing transport semantics inside Phase 10.

## Inputs Read

- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-SPEC.md`
- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-CONTEXT.md`
- `.planning/phases/09-messenger-interaction-quality-gate/09-BEHAVIOR-GATE.md`
- `Frontend/Chatify/src/pages/chat/chat.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailDrawer.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx`
- `Frontend/Chatify/src/hooks/useChatQueries.ts`
- `Frontend/Chatify/src/api/messageApi.ts`
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts`
- `Frontend/Chatify/e2e/chat-quality-gate.spec.ts`
- `Frontend/Chatify/e2e/pages/chatPage.ts`
- `Frontend/Chatify/playwright.config.ts`
- `C:/Users/saieh/.agents/skills/webapp-testing/SKILL.md`
- `C:/Users/saieh/.agents/skills/accessibility/SKILL.md`
- `C:/Users/saieh/.agents/skills/tanstack-query/SKILL.md`
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md`

## Findings

### 1. Existing Playwright evidence is local and mocked

`Frontend/Chatify/playwright.config.ts` starts a local Vite server at `http://127.0.0.1:4177`. `Frontend/Chatify/e2e/pages/chatPage.ts` installs `page.route` mocks for auth, chats, messages, shared assets, pinned messages, attachments, search, unread counts, and mark-read. This is useful for deterministic UI regression testing, but it cannot certify production behavior.

Recommendation: add a separate Phase 10 production smoke path. It should run only when `CHATIFY_PRODUCTION_SMOKE=1`, `CHATIFY_PROD_FRONTEND_URL`, `CHATIFY_PROD_BACKEND_URL`, and the two smoke-account credential pairs are present. It must not call `page.route` for Chatify auth/chat/message/attachment/socket traffic.

### 2. The desktop rail is static as a visibility surface

`ChatContextRail.tsx` renders an always-open `aside` on `xl` and has no close button, Escape handling, open state, or focus return. `chat.tsx` already owns a details button ref and drawer state for mobile, so the correct repair path is controlled state in `chat.tsx`, not local hidden state inside the rail.

Recommendation: add `isDetailRailOpen`, close/open handlers, and pass `onClose` plus the shared detail props into `ChatContextRail`. The desktop rail should close from a visible close button, close on Escape, return focus to the header details button, and reopen from the same header button.

### 3. Mobile drawer is closer to the target but needs explicit parity proof

`ConversationDetailDrawer.tsx` already closes by button, Escape, and backdrop and focuses its close button when opened. `chat.tsx` has `closeDetailDrawer`, which returns focus to the header details button. Existing Phase 09 e2e asserts focus return for mobile, but Phase 10 needs production/static-leak context and parity with desktop rail behavior.

Recommendation: keep the mobile drawer implementation and add tests that prove close paths and focus return still work after Phase 10 rail changes.

### 4. Detail data has a server-truth path, but production proof is missing

`ConversationDetailContent.tsx` receives `pinnedMessages`, `sharedFiles`, and `sharedMedia` from props and renders loading, error, empty, and data states. `chat.tsx` wires those props from `usePinnedMessages` and `useSharedAssets`, which are backed by `messageApi`. This is the right structure, but production can still appear static if smoke tests never hit live endpoints.

Recommendation: preserve the server-backed data path and add production smoke assertions plus runtime leak guards. Do not hard-code example rows to satisfy the UI.

### 5. Unsupported controls must stay honest

Call, video, favorite, voice, and more actions are not implemented as live workflows. Some controls are disabled with unavailable titles; search, pinned-message jump, unpin, attachment preview/download, file attachment, emoji, send, retry, dismiss, edit, delete, reaction, and theme controls are supported workflows.

Recommendation: do not create fake modals for unsupported features in Phase 10. Keep unsupported controls disabled or explicitly unavailable, and test the supported workflows that already have backend/query/socket contracts.

### 6. Runtime fixture guard exists and should be expanded

`fixtureLeakGuard.test.ts` already blocks Phase 06/07/09 fixture identifiers, fake reference file names, private storage terms, and living visual fixture terms in runtime chat source files. It excludes test/spec files, which is correct.

Recommendation: expand it after the Phase 10 production audit with any newly found leaked fixture terms. Keep it scoped to production chat runtime source and CSS so tests can continue using deterministic fixtures.

### 7. The delivery defect belongs to a follow-up reliability phase

The user reported duplicate outgoing messages and recipient pages not receiving live messages until refresh despite delivered checkmarks. Phase 10 context says these defects must be reproduced and documented, not fixed. A separate `10.1-production-message-delivery-reliability-repair` directory already exists in the worktree, which supports the handoff direction.

Recommendation: Phase 10 production smoke should capture the exact live delivery baseline and append it to `10-PRODUCTION-AUDIT.md`, including whether duplicate sends and stale recipient delivery are reproduced. Phase 10.1 should own socket/message transport fixes.

## Threat Model

- T-10-01: Production smoke credentials leak through screenshots, logs, or committed artifacts.
- T-10-02: Mocked route evidence is mistaken for production truth.
- T-10-03: Static fixture names or fake media rows ship in runtime UI.
- T-10-04: Conversation detail surfaces expose private storage internals or data from a chat where the user is not a member.
- T-10-05: UI claims secure delivery, realtime delivery, or supported call/video behavior that the app cannot provide.
- T-10-06: Delivery-baseline testing mutates or destroys user data.

Mitigations: env-only credentials, no committed secrets, no production route mocks, runtime fixture guard, membership-backed API calls, honest disabled controls, non-destructive smoke accounts, and redacted audit artifacts.

## Validation Architecture

| Layer | Purpose | Command |
|-------|---------|---------|
| Vitest component and guard tests | Prove rail/drawer behavior, unsupported controls, server-backed detail rendering, and fixture guard coverage | `cd Frontend/Chatify; npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts src/pages/chat/components/ChatContextRail.test.tsx src/pages/chat/components/ConversationDetailDrawer.test.tsx src/pages/chat/components/ConversationHeader.test.tsx src/pages/chat/components/ChatShell.test.tsx` |
| Local Playwright regression | Prove supported workflows, mobile parity, detail surfaces, and screenshot evidence with deterministic local mocks | `cd Frontend/Chatify; npm run test:ui -- --grep "Phase 10 production messenger reality"` |
| Production smoke | Prove live Vercel/Render behavior with no Chatify route mocks | `cd Frontend/Chatify; $env:CHATIFY_PRODUCTION_SMOKE='1'; npm run test:ui -- --grep "Phase 10 production smoke"` |
| Frontend quality | Prove TypeScript, lint, and build stay clean | `cd Frontend/Chatify; npm run lint; npm run build` |

The production smoke command must skip or record a blocked audit when required env vars are missing. It must not silently fall back to mocked fixtures.

## Planning Recommendation

Use three executable plans:

1. `10-01-PLAN.md`: add the production smoke/audit harness and no-mock guardrails.
2. `10-02-PLAN.md`: repair desktop rail close/reopen behavior and prove mobile drawer parity without adding fake unsupported features.
3. `10-03-PLAN.md`: expand fixture/static leak guard coverage and complete final production audit evidence, including delivery-defect handoff to Phase 10.1.
