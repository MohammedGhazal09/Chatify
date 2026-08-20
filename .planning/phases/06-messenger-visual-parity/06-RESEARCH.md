# Phase 06: Messenger Visual Parity - Research

**Created:** 2026-06-12
**Phase:** 06-messenger-visual-parity
**Research type:** Brownfield UI implementation research
**Confidence:** High

## Research Question

How should Chatify implement the approved desktop/mobile light/dark messenger references with the existing React/Vite/Tailwind chat architecture while preserving Phase 03 message behavior and Phase 05 search, selection, presence, and smoke coverage?

## Executive Summary

The recommended implementation is a three-slice frontend-only plan:

1. Add a token-driven chat theme root, deterministic abstract identity tiles, and the desktop three-column shell with a presentational right context rail.
2. Rework the selected-conversation surfaces for mobile and desktop message parity: header, date divider, bubbles, retry/failed/typing states, composer, and secure-session line.
3. Extend deterministic Playwright smoke fixtures to force light/dark themes, capture the four required screenshots, and prove existing chat behavior still works.

This keeps `Frontend/Chatify/src/pages/chat/chat.tsx` as the orchestration layer, avoids backend scope, and confines visual complexity to focused presentational components and CSS variables.

## Inputs Reviewed

- `.planning/phases/06-messenger-visual-parity/06-SPEC.md`
- `.planning/phases/06-messenger-visual-parity/06-CONTEXT.md`
- `.planning/phases/06-messenger-visual-parity/06-UI-SPEC.md`
- `.planning/phases/05-messenger-baseline-completion/05-01-PLAN.md`
- `.planning/phases/05-messenger-baseline-completion/05-02-SUMMARY.md`
- `Frontend/Chatify/package.json`
- `Frontend/Chatify/playwright.config.ts`
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`
- `Frontend/Chatify/src/pages/chat/chat.tsx`
- `Frontend/Chatify/src/pages/chat/chat.css`
- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatListItem.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageList.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx`
- `Frontend/Chatify/src/hooks/useChatQueries.ts`
- `Frontend/Chatify/src/hooks/useChatSocket.ts`
- `Frontend/Chatify/src/store/presenceStore.ts`
- `Frontend/Chatify/src/components/SettingsModal.tsx`

## Skills Used

- `gsd-plan-phase`: phase planning workflow, plan artifact requirements, coverage gates.
- `find-skills`: skill discovery requirement and selection of relevant local skills.
- `frontend-design-ui-ux`: UI handoff structure, states, flows, component contracts, accessibility.
- `redesign-existing-projects`: brownfield redesign discipline and scoped migration.
- `react-best-practices`: component boundaries, stable props, avoiding unnecessary re-renders and bundle bloat.
- `accessibility`: accessible icon buttons, focus, contrast, keyboard paths, live state cues.
- `e2e-testing-patterns`: deterministic Playwright fixtures, viewport checks, stable user-visible assertions.
- `vitest`: focused React component and hook test planning in the existing test harness.

No external skill installation is required because the relevant local skills are already available in this workspace/session.

## Current Stack Facts

- React: `19.1.0`
- Vite: `7.0.4`
- Tailwind CSS: `4.1.11`
- `@tailwindcss/vite`: `4.1.11`
- `lucide-react`: `0.536.0`
- TanStack Query: `5.90.4`
- Zustand: `5.0.8`
- Vitest: `4.1.8`
- Playwright: `1.60.0`
- React Testing Library: `16.3.2`
- `@testing-library/user-event`: `14.6.1`
- `@testing-library/jest-dom`: `6.9.1`
- jsdom: `29.1.1`

## Existing Architecture Findings

### Chat Orchestrator

`Frontend/Chatify/src/pages/chat/chat.tsx` already owns the behavior that must be preserved:

- selected chat state and safe selected-chat persistence
- sidebar search and message search state
- message input state
- optimistic send, retry, edit, delete, and reaction actions
- query cache and socket callback wiring
- auth-expired cleanup
- drawer and settings modal state

Recommendation: keep this file as orchestration and pass additional theme/search/right-rail props to focused components. Do not move socket/query behavior into visual components.

### Existing Component Boundary

The chat page is already split into:

- `ChatShell`
- `ChatSidebar`
- `ChatListItem`
- `ConversationPane`
- `ConversationHeader`
- `MessageList`
- `MessageBubble`
- `MessageComposer`
- `MessageSearchResults`
- `ChatStateView`

Recommendation: extend these boundaries and add focused components instead of introducing a large replacement page. The highest-value new components are `AbstractIdentityTile`, `ChatContextRail`, and `useChatTheme`.

### Theme State

Current chat UI is dark-first and hard-coded through Tailwind colors and `chat.css`. There is no light theme or root theme contract.

Recommendation: add a `useChatTheme` hook and root `data-chat-theme` contract. Use CSS variables on the chat root for surfaces, text, borders, accents, own/received bubbles, input surfaces, focus, and status colors. Use Tailwind arbitrary values like `bg-[var(--chat-panel)]` where clean, and keep geometry/scrollbar/pseudo-element rules in `chat.css`.

### Identity Rendering Risk

`ChatSidebar` and `ConversationHeader` currently render `profilePic` URLs when present. This violates the Phase 06 ban on profile photos and all living imagery.

Recommendation: create `AbstractIdentityTile` early and replace all chat-surface image rendering before taking screenshots. Tests should pass a fake `profilePic` URL and assert no avatar `<img>` is rendered in chat identity surfaces.

### Right Rail Scope

The current chat page has no desktop context rail. Phase 06 needs the reference right rail but must not add backend pinned/file/media product scope.

Recommendation: build `ChatContextRail` as presentational. Use existing selected chat/member/message data where safe, and deterministic local placeholder rows for visual sections. Only the Search action should wire to existing message search behavior.

### Message Search Reuse

Phase 05 already added selected-chat message search via `useMessageSearch` and `MessageSearchResults`. Header search toggles this mode.

Recommendation: do not add a second search implementation. Both center header Search and right rail Search should call the same existing toggle path.

### Playwright Baseline

`Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` already uses deterministic route interception for the chat UI. It currently captures Phase 05 states and uses human names in fixtures.

Recommendation: replace or extend Phase 05 fixtures for Phase 06 with coded non-person labels and no profile photos. Use URL/localStorage theme forcing, assert `data-testid="chat-root"` and layout visibility, then write four screenshots under `.planning/phases/06-messenger-visual-parity/`.

## Recommended Implementation Pattern

### Pattern 1: Root Theme Contract

Create a chat root such as:

```tsx
<div data-testid="chat-root" data-chat-theme={theme}>
  <ChatShell ... />
</div>
```

Theme resolution order:

1. deterministic URL/test override such as `?chatTheme=light|dark`
2. per-user persisted preference
3. system color-scheme preference
4. light fallback

The theme control belongs in the existing `SettingsModal`. The root must update only tokens and must not reset selected chat, search, composer text, messages, or presence state.

### Pattern 2: Abstract Identity Tile

Implement a deterministic non-image tile component with variants:

- `brand`
- `account`
- `conversation`
- `large`
- `media`
- `file`

Use stable ids/labels to choose a small pattern palette. Prefer CSS grid/linear-gradient/pseudo-element marks or simple div geometry. Do not use profile URLs, avatar services, human icons, realistic silhouettes, animal icons, plant motifs, or mascots.

### Pattern 3: Desktop Shell Before Mobile Refinement

Upgrade the shell in this order:

1. `ChatThemeRoot` and token CSS.
2. `AbstractIdentityTile` replacement.
3. `ChatShell` desktop grid and responsive rail collapse.
4. `ChatContextRail` presentational section.
5. Sidebar/header token cleanup.

This gives the later mobile/message work stable primitives and prevents duplicated light/dark styling.

### Pattern 4: Message And Composer Parity

After root and shell tokens exist, retheme:

- date divider with horizontal rules
- received, sent, read, retrying, and failed bubbles
- typing row
- presentational file chip fixture support
- composer dock with attachment, input, emoji/microphone, circular send, secure-session line

The existing text send path, retry path, emoji picker behavior, and search highlighting must remain intact.

### Pattern 5: Fixture-First Visual Evidence

Use Playwright route interception rather than live data. The visual fixture should contain:

- coded account and conversation labels
- incoming message
- outgoing read message
- retrying or failed outgoing state
- typing row
- date divider
- file chip
- secure-session status
- right rail sections
- no profile image URLs rendered as chat identity UI

Capture:

- `06-ui-desktop-light.png`
- `06-ui-desktop-dark.png`
- `06-ui-mobile-light.png`
- `06-ui-mobile-dark.png`

## Alternatives Considered

### New UI Library

Rejected. A new component library would add dependency and styling churn for a phase whose constraints are already specific and reference-driven. Existing React, Tailwind, CSS variables, lucide-react, and component tests are sufficient.

### Separate Light And Dark Component Trees

Rejected. This would double state and behavior risk, and directly violates D-05. Theme must be token-driven.

### Backend Pinned/File/Media APIs

Rejected. The right rail is in scope visually, but backend feature scope is explicitly out of scope. Presentational rows and deterministic fixtures are enough for this phase.

### Pixel-Diff Thresholds In First Pass

Deferred. D-29 recommends screenshots plus stable layout/user-visible assertions first. Pixel-diff can be introduced later only if repeated visual drift makes it necessary.

## Risks And Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `profilePic` rendering leaks into screenshots | Violates no-living-imagery contract | Replace identity rendering first and add tests/assertions for no chat avatar images |
| Theme change resets chat state | Breaks Phase 05 behavior | Keep theme state separate from selected chat/search/message state and verify with tests |
| Right rail becomes product scope creep | Backend/API expansion and delayed UI work | Make rail presentational; only Search wires to existing behavior |
| Mobile composer overlaps newest message | Fails mobile reference acceptance | Use stable bottom padding/safe-area rules and Playwright bounding-box assertions |
| Screenshot fixtures drift from real code paths | False confidence | Route-intercept API data but render the normal app route/components |
| Hard-coded dark classes remain | Light theme visual mismatch | Convert shared surfaces to semantic CSS variables and inspect for remaining hard-coded chat colors |
| Icon-only controls lose accessible names | Accessibility regression | Test key controls by role/name and enforce visible focus tokens |

## Verification Recommendation

During implementation:

- Run focused Vitest component/hook tests after each plan.
- Run `npm run lint` and `npm run build` after plan 01 and plan 02 because component prop changes may ripple.
- Run full `npm test`, `npm run test:ui`, `npm run lint`, and `npm run build` in plan 03.
- Add source inspection for forbidden profile image rendering in chat identity components.
- Confirm screenshots exist under `.planning/phases/06-messenger-visual-parity/`.

## Phase Breakdown Recommendation

1. `06-01`: Theme foundation, abstract identity, desktop shell, and context rail.
2. `06-02`: Mobile conversation, message stream, composer, and state surfaces.
3. `06-03`: Deterministic fixture smoke, screenshots, visual drift fixes, and evidence.

This split is safer than one large visual rewrite because every later slice depends on the same token and identity foundation, while visual evidence becomes its own blocking closure step.

## Sources

- Local repository source files listed in "Inputs Reviewed".
- Approved Phase 06 spec, discussion context, and UI design contract.
- Existing Phase 05 plan and summary artifacts.
- Local skills listed in "Skills Used".

## Research Validity

The research is based on the local repository state on 2026-06-12. It should be refreshed if frontend dependencies, the chat component structure, or the approved Phase 06 UI contract changes before execution.
