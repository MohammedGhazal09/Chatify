# Phase 06: Messenger Visual Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 06-messenger-visual-parity
**Areas discussed:** Theme control and token plumbing, Desktop context rail and presentational controls, Responsive layout collapse, Abstract identity and media surfaces, Mobile conversation behavior, Message states, composer, and search behavior, Motion, accessibility, and verification, Component strategy and artifact handling

---

## Theme Control And Token Plumbing

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Theme control location | Settings modal only; small chat-sidebar control; hidden test-only URL/localStorage control | Settings modal plus test URL/localStorage override |
| Theme persistence | per-browser localStorage; per-user localStorage key; system only | per-user localStorage key with system default fallback |
| Token implementation | CSS variables on chat root; Tailwind dark classes everywhere; separate light/dark components | CSS variables on chat root, consumed through Tailwind arbitrary values/classes |

**User's choice:** Approved recommendations.
**Notes:** This keeps the production UI quiet while giving Playwright deterministic light/dark control and avoiding duplicated component trees.

---

## Desktop Context Rail And Presentational Controls

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Rail content source | presentational derived/fixture placeholders; hide sections without backend data; new backend APIs | presentational derived/fixture placeholders for Phase 6 |
| Rail action behavior | real only where existing behavior exists; all disabled; open placeholder panels | Search triggers existing message search; other unavailable actions stay presentational with accessible labels |

**User's choice:** Approved recommendations.
**Notes:** The reference requires the right rail, but Phase 06 excludes backend feature work.

---

## Responsive Layout Collapse

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Mobile back arrow | open conversation list drawer; clear selected chat; browser back | open conversation list drawer |
| Collapse breakpoint | lg and below; below 1200px; only mobile below md | full three-column at >=1280px; hide right rail first below that; drawer-style list below md |

**User's choice:** Approved recommendations.
**Notes:** This preserves the existing one-route chat model and protects narrower widths from overflow.

---

## Abstract Identity And Media Surfaces

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Abstract identity style | initial monograms; geometric encrypted-pattern tiles; mixed abstract library | deterministic geometric tiles with optional initials in list rows |
| Existing profilePic data | ignore completely in chat; show only outside chat; blur/process into abstract | ignore completely in chat surfaces |

**User's choice:** Approved recommendations.
**Notes:** This is the strongest way to enforce the no-living-imagery requirement in static inspection and screenshots.

---

## Mobile Conversation Behavior

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Mobile visual priority | strict screenshot rhythm; fully flexible live content; hybrid | hybrid: strict shell/composer/header/bubble rhythm, flexible message count |

**User's choice:** Approved recommendations.
**Notes:** The mobile layout must match the references while still surviving real chat data variation.

---

## Message States, Composer, And Search Behavior

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Required visual states | happy path only; all reference states; all current app edge states | all reference states: received, sent/read, retrying/failed, typing, file chip, secure session |
| File chip behavior | fixture-only fake file chip; derive from message text; skip file chip | fixture-only presentational file chip in visual smoke and rail |
| Attachment/mic buttons | presentational disabled; open placeholder toast; implement attachments/audio | presentational disabled with accessible names; send remains functional |
| Emoji picker | keep; hide on mobile; remove | keep as subordinate auxiliary action |
| Search UI behavior | inline expanding search bar; right-rail search only; overlay/search mode | header icon and right-rail Search both trigger existing in-conversation search mode |

**User's choice:** Approved recommendations.
**Notes:** This preserves Phase 05 behavior while matching the visible reference states.

---

## Motion, Accessibility, And Verification

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Motion level | almost none; subtle transitions; animated decorative motion | subtle transitions only, reduced-motion respected |
| Screenshot artifact location | Phase 6 folder; Playwright default output; both | `.planning/phases/06-messenger-visual-parity/` |
| Initial visual gate | manual screenshot review only; Playwright screenshots plus assertions; pixel-diff threshold | Playwright screenshots plus layout assertions first; pixel diff only if drift keeps recurring |

**User's choice:** Approved recommendations.
**Notes:** The product tone is secure and quiet; verification should be deterministic without becoming brittle too early.

---

## Component Strategy And Artifact Handling

| Decision | Options considered | Selected |
|----------|--------------------|----------|
| Component strategy | edit existing components heavily; add focused presentational components; rewrite chat page | add focused components such as theme root, abstract identity tile, context rail, secure composer shell, visual fixture helpers |
| Context artifact handling | overwrite with detailed decisions; append new decisions; leave it | overwrite/update `06-CONTEXT.md` and write discussion log |

**User's choice:** Approved recommendations.
**Notes:** This keeps `chat.tsx` as orchestration and gives downstream planning one authoritative context artifact.

---

## Supporting Skills

| Skill | Why it was selected |
|-------|---------------------|
| `redesign-existing-projects` | Brownfield visual upgrade without breaking functionality |
| `frontend-design` | Production-grade UI execution guidance |
| `design-taste-frontend` | Token, layout, motion, and density discipline |
| `accessibility` | Keyboard, accessible names, focus, contrast, and live-state requirements |
| `e2e-testing-patterns` | Deterministic Playwright smoke and screenshot guidance |

**Notes:** No external skill installation was required because suitable local skills were already available.

---

## Agent Discretion

- Exact component filenames and prop shapes.
- Exact CSS variable and token names.
- Exact abstract tile pattern generation.
- Whether Phase 06 visual smoke extends `chat-ui-smoke.spec.ts` or lives in a new focused Playwright file.

## Deferred Ideas

- Real call/video/mute/profile panels.
- Real attachment upload/download, audio recording, pinned messages, shared media, and file APIs.
- Pixel-diff visual regression unless recurring drift proves it necessary.
