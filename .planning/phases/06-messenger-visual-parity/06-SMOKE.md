# Phase 06 Smoke Evidence

**Date:** 2026-06-12T14:38:30+03:00
**Scope:** Messenger visual parity for light/dark desktop and mobile Chatify messaging UI, using coded non-person fixtures and abstract-only identity/media/file surfaces.

## Automated Verification

| Check | Result | Evidence |
| --- | --- | --- |
| `cd Frontend/Chatify; npm test` | Pass | 22 test files, 68 tests passed under Vitest/jsdom. |
| `cd Frontend/Chatify; npm run test:ui` | Pass | 8 Playwright tests passed with route-intercepted authenticated Phase 06 fixtures. |
| `cd Frontend/Chatify; npm run lint` | Pass | ESLint completed with no reported problems. |
| `cd Frontend/Chatify; npm run build` | Pass | `tsc -b && vite build` completed successfully. |
| `git diff --check` | Pass | No whitespace errors. |
| `Test-Path .planning/phases/06-messenger-visual-parity/06-ui-*.png` | Pass | All four required screenshot artifacts exist. |
| `rg -n "profilePic\|<img\|avatar" Frontend/Chatify/src/pages/chat/components -g "!*.test.tsx" -g "!Phase06VisualFixture.ts"` | Pass | No matches; chat identity component source uses abstract identity tiles only. |
| `rg -n "axios\|fetch\\(\|/api/\|messageApi\|chatApi" Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.ts` | Pass | No matches; right rail and visual fixture remain presentational. |

## Screenshot Evidence

| Variant | Viewport | Path |
| --- | --- | --- |
| Desktop light | 1440 x 900 | `.planning/phases/06-messenger-visual-parity/06-ui-desktop-light.png` |
| Desktop dark | 1440 x 900 | `.planning/phases/06-messenger-visual-parity/06-ui-desktop-dark.png` |
| Mobile light | 390 x 844 | `.planning/phases/06-messenger-visual-parity/06-ui-mobile-light.png` |
| Mobile dark | 390 x 844 | `.planning/phases/06-messenger-visual-parity/06-ui-mobile-dark.png` |

## Playwright Assertions Covered

- `data-chat-theme="light|dark"` is forced through the Phase 06 theme override.
- Desktop shows left conversation list, center conversation pane, and right context rail.
- Mobile primary view hides sidebar and right rail until the drawer opens.
- Header Search and right-rail Search open the same in-conversation message-search mode.
- Composer is visible, safe-area aware, and the bottom message can clear the composer dock.
- Icon-only controls expose accessible names: Open conversations, Call, Search messages, More conversation actions, Send message, and presentational attachment/microphone controls.
- Visual fixture renders received, sent/read, edited, retrying/sending, failed-send recovery, file chip, typing, secure-session, pinned, files, media, and security states.
- Chat identity surfaces contain no rendered profile photo `<img>` elements.
- Desktop and mobile pages do not introduce horizontal overflow.

## Fixture Notes

- Fixtures use coded labels only: `AX-7F3C`, `IN-8B21`, `DS-4C9A`, `PR-0E6F`, `PM-3D12`, `QA-77AA`, and `Cipher Node`.
- Fixture users intentionally include fake `profilePic` URLs to prove chat identity surfaces ignore profile-photo inputs.
- Shared media and file visuals are abstract/presentational and do not add upload, download, call, video, or backend behavior.
- The normal chat route is used for smoke. The query flag `chatVisualSmoke=phase06` disables Socket.IO connection attempts only for deterministic screenshot capture; REST/auth/chat/message behavior still flows through route interception against production components.

## Intentional Deviations

- Pixel-diff thresholds remain deferred. Phase 06 uses deterministic screenshots plus layout, accessibility, no-overflow, no-profile-image, and search-reuse assertions as approved in the plan.
- Mobile screenshots are captured at the bottom of the conversation so retrying/failed/file-chip/composer states are visible in one deterministic viewport.

## Result

Phase 06 visual smoke passed and all four screenshot artifacts were generated.
