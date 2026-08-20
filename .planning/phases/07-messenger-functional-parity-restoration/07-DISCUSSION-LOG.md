# Phase 07: Messenger Functional Parity Restoration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 07-messenger-functional-parity-restoration
**Areas discussed:** Fixture isolation and test data, targeted runtime restoration, unsupported controls and right rail honesty, composer and message actions, realtime/search/navigation verification, theme/mobile/evidence/backend boundaries

---

## Fixture Isolation And Test Data

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Runtime smoke branch | Remove `chatVisualSmoke=phase06` from production runtime; keep behind a dev/test guard | Remove from production runtime |
| Fixture location | Move Playwright fixtures to `Frontend/Chatify/e2e/fixtures/` and reusable component fixtures to `Frontend/Chatify/src/test/`; keep colocated with production components | Test-only fixture locations |
| Phase 6 smoke evidence | Keep historical screenshots only; replace current smoke with behavior-first Phase 7 tests; keep current fixture-driven smoke as-is | Keep historical evidence and replace current behavior proof |
| Runtime guard | Add a static guard for Phase 6 fixture identifiers; rely on code review only | Add static guard |

**User's choice:** Approved recommendations.
**Notes:** The code scan found `chat.tsx` branching on `chatVisualSmoke=phase06` and `chat-ui-smoke.spec.ts` importing `Phase06VisualFixture` from production source.

---

## Targeted Runtime Restoration

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Refactor scope | Repair targeted seams; rewrite the chat page from scratch | Repair targeted seams |
| State ownership | Preserve TanStack Query/Zustand/Socket.IO boundaries; move durable behavior into presentational components | Preserve current ownership boundaries |

**User's choice:** Approved recommendations.
**Notes:** Existing hooks/components already cover many real behaviors. The discussion intentionally avoided turning Phase 7 into a broad rewrite.

---

## Unsupported Controls And Right Rail Honesty

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Unsupported controls | Keep only if truly disabled or hide; keep presentational controls with enabled styling | Honest disabled or hidden |
| Attachment and voice controls | Keep disabled and honest; implement real attachment/voice behavior | Keep disabled and honest |
| Pinned messages | Show real/empty/hidden/unavailable only; reuse latest messages as fake pins | No fake pins |
| Shared files/media | Show zero/empty/hidden/unavailable only; keep static fake files/media tiles | No fake shared assets |
| Security rows | Map to real auth/membership/socket state; keep static `Verified`/`Secure` copy | Map to real or neutral state |

**User's choice:** Approved recommendations.
**Notes:** The current `ChatContextRail` hardcodes shared files, shared media, pinned fallback counts, and security claims.

---

## Composer And Message Actions

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Composer coverage | Full text send lifecycle coverage; minimal happy-path smoke | Full supported lifecycle coverage |
| Message action coverage | Cover reply/edit/copy/delete/reactions in component tests plus one E2E representative; cover every action permutation in Playwright | Component-heavy coverage with representative E2E |

**User's choice:** Approved recommendations.
**Notes:** Composer tests must cover success, failed send, retry with same `clientMessageId`, dismiss, empty/offline/session disabled states, and 1000-character boundary.

---

## Realtime, Search, And Navigation Verification

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Realtime proof | Expand hook/component tests plus one browser visible update path; require live socket-only E2E | Controlled hook/component plus one browser path |
| Socket aborting | Allow only in visual-only tests; abort sockets in all Playwright tests | Abort only in visual-only tests |
| Search/navigation Playwright scope | Cover sidebar search, no results, message search, jump/highlight, URL restore, invalid fallback, mobile drawer, new-chat continuation; keep visual-only smoke | Focused behavior workflow coverage |

**User's choice:** Approved recommendations.
**Notes:** This locks behavior-first tests without making Phase 7 depend on a brittle live backend/socket environment.

---

## Theme, Mobile, Evidence, And Backend Boundaries

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Theme/mobile matrix | Deepest behavior path on desktop light and mobile dark plus lighter four-variant smoke; exhaustive matrix in Phase 7 | Focused behavior matrix |
| Evidence artifacts | Screenshots after interactions under the Phase 7 directory; first-paint screenshots only | Interaction-after screenshots |
| Backend scope | Avoid backend changes unless a current supported workflow has a proven contract bug; add media/file/pin APIs now | Frontend parity restoration first |

**User's choice:** Approved recommendations.
**Notes:** Phase 8 owns media/files/detail data contracts. Phase 9 owns the exhaustive quality gate.

---

## Agent Discretion

- Exact fixture helper filenames and test split are left to the planner/executor.
- Exact disabled-control removal versus honest-disabled rendering can be chosen per component.
- Exact right-rail empty-state copy can be chosen during implementation.
- Exact Playwright grouping can be chosen as long as behavior happens before screenshots.

## Deferred Ideas

- Real attachments, shared files/media, pinned messages, previews, downloads, and detail panels belong to Phase 8.
- Exhaustive interaction/accessibility/keyboard/visual acceptance belongs to Phase 9.
- Calls, video, voice messages, favorite conversations, groups, notifications, admin/moderation, and end-to-end encryption remain out of Phase 7.
