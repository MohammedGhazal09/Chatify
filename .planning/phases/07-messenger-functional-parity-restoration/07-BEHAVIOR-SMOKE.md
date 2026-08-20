# Phase 07 Behavior Smoke Evidence

## Scope

Phase 07 behavior smoke verifies that the Phase 06 reference-style messenger UI is backed by runtime state and supported product behavior instead of static demo data.

Evidence uses production-shaped mocked API responses, Phase 07-specific fixture identities, semantic browser interactions, and after-interaction screenshots across desktop/mobile and light/dark variants.

## Command Outcomes

All commands were run from `Frontend/Chatify` on 2026-06-12.

| Command | Outcome |
| --- | --- |
| `npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts src/pages/chat/components/ChatSidebar.test.tsx` | Passed, 2 files and 5 tests. |
| `npm run test:ui -- --grep "functional parity"` | Passed, 5 Playwright tests. |
| `npm test` | Passed, 22 files and 72 tests. |
| `npm run lint` | Passed. |
| `npm run build` | Passed, TypeScript build and Vite production build completed. |
| `npm run test:ui` | Passed, 13 Playwright tests. |
| `rg -n "phase06\|PHASE06_\|Phase06VisualFixture\|chatVisualSmoke" Frontend/Chatify/e2e/chat-functional-parity.spec.ts Frontend/Chatify/e2e/fixtures/phase07BehaviorFixture.ts Frontend/Chatify/e2e/pages/chatPage.ts Frontend/Chatify/src/pages/chat --glob "!**/*.test.*"` | No matches. |

## Browser Workflows Covered

| Evidence | Viewport | Theme | Workflow |
| --- | --- | --- | --- |
| `07-ui-desktop-light-after-search.png` | 1440 x 900 | Light | Selected chat restore, conversation search, no-results search, message search minimum guidance, message search success, jump to highlighted message, send success, retry failed send, dismiss failed send, disabled unsupported controls, unavailable file/media/pin sections, no fake file chip, overflow/composer stability. |
| `07-ui-mobile-dark-after-retry.png` | 390 x 844 | Dark | Initial selected chat render, post-render realtime typing update, failed-send retry, failed-send dismiss, mobile drawer open, drawer conversation search, mobile conversation selection, overflow/composer stability. |
| `07-ui-desktop-dark-after-search.png` | 1440 x 900 | Dark | URL selected chat restore, desktop conversation selection, message search success, disabled call control, overflow stability. |
| `07-ui-mobile-light-after-drawer.png` | 390 x 844 | Light | Mobile drawer open, overlay visibility, conversation search, filtered selection, drawer close through selection, overflow stability. |

Additional Playwright coverage in `chat-functional-parity.spec.ts` verifies invalid selected-chat fallback, exact-email new-chat continuation, and `chatify:auth-expired` cleanup redirecting to `/login` and hiding private conversation content.

## Realtime Proof

Socket event behavior remains covered at hook level by `src/hooks/useChatSocket.test.tsx`, including message create/status/edit/reaction/delete, unread counts, typing, presence, socket-ready, and reconnect invalidation paths.

The browser-visible realtime proof starts from a rendered mobile dark conversation, then updates `presenceStore` through `page.evaluate` after initial render. The UI must change from no typing row to `Relay Node is typing` before the test continues.

## Fixture Isolation

Phase 07 behavior fixtures live under `Frontend/Chatify/e2e/fixtures/phase07BehaviorFixture.ts` and use non-Phase-06 identities, chat ids, messages, unread counts, search results, presence, typing, and continuation email data.

The production runtime still has no Phase 06 fixture shortcut or `chatVisualSmoke` bypass according to the source search listed above.

## Notes

- Screenshots are captured only after user interactions, not first paint.
- Functional Playwright tests do not abort `**/socket.io/**` as their behavior proof path.
- File sharing, media sharing, pinned messages, calls, video, voice, and conversation action controls remain intentionally unavailable or disabled until Phase 08 implements real data-backed surfaces.
