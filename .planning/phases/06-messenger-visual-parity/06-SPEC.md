# Phase 06: Messenger Visual Parity - Specification

**Created:** 2026-06-12
**Ambiguity score:** 0.09 (gate: <= 0.20)
**Requirements:** 10 locked

## Goal

Chatify's `/chat` surface changes from the existing dark-first functional messenger into a reference-matched desktop and mobile messenger with verified light and dark variants that preserve existing message, search, presence, and session behavior.

## Background

Phase 04 and Phase 05 produced a componentized messenger baseline with `ChatShell`, `ChatSidebar`, `ConversationPane`, `ConversationHeader`, `MessageList`, `MessageComposer`, search states, selected-chat restoration, session cleanup, and Playwright smoke coverage. The current implementation is still presentation-misaligned with the four supplied reference images: it is dark-first with hard-coded color classes, has no full desktop right context rail, renders profile photos when `profilePic` is present, uses a drawer/hamburger style mobile primary header, and does not have light/dark visual parity screenshots for the target desktop and mobile designs.

The trigger for this phase is the user's approved reference set: desktop light, desktop dark, mobile light, and mobile dark Chatify messaging screens. These references are the source of truth for visual parity. The phase is not a backend feature pass and must not weaken the Phase 03 canonical message-state contract or the Phase 05 search/presence/session baseline.

## Requirements

1. **Reference fidelity**: The four supplied images MUST be treated as the visual source of truth for Phase 06.
   - Current: `06-UI-SPEC.md` names the reference images, but no implementation or screenshot check proves the app matches them.
   - Target: Desktop light, desktop dark, mobile light, and mobile dark outputs are implemented as pixel-close reference matches within normal browser/font rendering tolerance.
   - Acceptance: A visual smoke artifact captures all four variants and documents any intentional deviations; no variant is accepted on loose resemblance alone.

2. **Desktop three-column shell**: The desktop messenger MUST match the reference information architecture with left conversation rail, center conversation pane, and right context rail.
   - Current: `ChatShell` renders a left sidebar plus conversation section; there is no desktop right rail with profile, actions, pinned messages, files, media, and security sections.
   - Target: At desktop reference widths, the chat surface renders a stable three-column shell with the same section order and visual hierarchy as the desktop light and dark references.
   - Acceptance: Desktop light and dark screenshots at `1440x900` or wider show all three rails without horizontal overflow, clipped text, or overlapping controls.

3. **Mobile primary conversation**: The mobile messenger MUST match the reference single-column conversation screen.
   - Current: The mobile primary view uses the existing drawer-oriented shell and header affordances rather than the reference back-button, identity tile, compact actions, message rhythm, and bottom composer treatment.
   - Target: Mobile light and dark primary conversation screens show the reference safe-area header, abstract identity tile, contact title/status, call/search/more actions, date divider, message stream, typing row, composer, and secure-session footer.
   - Acceptance: Mobile light and dark screenshots at `390x844` and/or `430x932` show a single-column conversation with no visible sidebar chrome in the primary view and no composer overlap on the newest message.

4. **Theme system**: Light and dark variants MUST be token-driven and testable through both an explicit app control and system/default theme behavior.
   - Current: Chat components use hard-coded dark Tailwind color values such as `#101113`, `#181C20`, and `#14B8A6`, with no verified light theme variant.
   - Target: Shared semantic tokens drive surfaces, text, borders, own/other bubbles, status colors, and accents for both light and dark themes; an app-level control can force a theme for verification while system preference remains supported as the default path.
   - Acceptance: Switching between light and dark changes tokens and surfaces without changing selected chat, message order, search state, presence state, layout semantics, or available actions.

5. **Abstract identity only**: Chat avatar, identity, media, and placeholder surfaces MUST use abstract non-living visuals only.
   - Current: `ChatSidebar` and `ConversationHeader` render `profilePic` image URLs when present, which can display human or other living imagery.
   - Target: Chat-specific identity surfaces render geometric tiles, monograms, encrypted-pattern marks, file icons, or neutral abstract thumbnails; profile photos and living imagery are not rendered in the chat UI.
   - Acceptance: Static inspection and screenshots show no human, face, hand, body, animal, plant, mascot, profile-photo, or realistic-avatar imagery in Phase 06 chat surfaces.

6. **Desktop context rail semantics**: The right rail MUST preserve the reference section semantics without adding new backend feature scope.
   - Current: The current chat UI has no right context rail and no attached product behavior for pinned messages, shared files, or shared media.
   - Target: Desktop renders the reference-style context rail with abstract profile tile, action strip, pinned messages, shared files, shared media, and conversation security sections using existing data, fixture data for visual smoke, or local presentational placeholders where backend data does not exist.
   - Acceptance: The right rail appears in desktop light and dark screenshots, existing search/session behavior still works, and no new backend API is required for pinned/file/media sections in this phase.

7. **Message stream parity**: The message list MUST match the reference rhythm and visible message states.
   - Current: The app has functional message bubbles, loading states, failed-send recovery, message search mode, and typing/status indicators, but the bubble shape, spacing, date divider, retry surface, attachment chip, and mobile rhythm do not match the references.
   - Target: The rendered message stream includes reference-aligned sent and received bubbles, timestamps, read/delivered marks, retry state, typing indicator, date divider, and abstract file chip without changing message data ownership.
   - Acceptance: Fixture-backed screenshots show received, sent, read, retrying/failed, typing, and file-chip states in the same visual positions and hierarchy as the references.

8. **Composer parity**: The desktop and mobile composers MUST match the reference input and secure-session treatment.
   - Current: `MessageComposer` renders a dark textarea block with send text and helper copy; it does not match the rounded input row, circular send action, attachment/microphone controls, or secure-session footer in the references.
   - Target: The composer renders the reference attachment control, private-message input, auxiliary controls, circular send action, safe-area handling, and secure-session status in both themes and viewports.
   - Acceptance: Desktop and mobile screenshots show the composer anchored correctly, the secure-session status visible, and the newest message unobscured at target viewport sizes.

9. **Behavior preservation**: Phase 03 and Phase 05 chat behavior MUST remain intact while visual parity changes land.
   - Current: The baseline includes TanStack Query-owned message state, socket presence/typing integration, sidebar search, message search, selected-chat restoration, New chat continuation, and session-expired cleanup.
   - Target: Visual refactoring preserves existing message merge/retry behavior, search behavior, selected-chat restoration, presence/typing scope, session cleanup, and route behavior.
   - Acceptance: Existing frontend tests and Playwright smoke paths for Phase 04/05 continue to pass after the visual parity changes.

10. **Visual verification evidence**: Completion MUST include automated or repeatable visual evidence for all four variants.
    - Current: Existing smoke coverage captures Phase 05 desktop search and mobile drawer states, not the four Phase 06 reference variants.
    - Target: A fixture-backed visual smoke path captures desktop light, desktop dark, mobile light, and mobile dark parity screenshots with stable data and deterministic theme selection.
    - Acceptance: Phase completion records passing `npm test`, `npm run test:ui`, `npm run lint`, and `npm run build` from `Frontend/Chatify`, plus links or paths to the four screenshot artifacts.

## Boundaries

**In scope:**
- Desktop light and dark visual parity for the reference three-column messenger shell.
- Mobile light and dark visual parity for the reference single-column conversation screen.
- Token-driven theme plumbing with explicit app control and system/default behavior.
- Chat-specific abstract identity tiles, abstract thumbnails, and file/media placeholders.
- Localized UI component refactors needed to match the references.
- Presentational right context rail sections that do not require new backend APIs.
- Fixture-backed screenshot/smoke verification for the four variants.
- Preservation of existing Phase 03 and Phase 05 behavior.

**Out of scope:**
- Backend API changes - this phase is visual parity, not a data contract phase.
- New real calling, video, mute, pinned-message, attachment, shared-media, or file-upload product features - reference controls may be presentational or reuse existing behavior only.
- Group chat expansion - v2 platform scope.
- End-to-end encryption implementation - deferred v2/security design scope; this phase may show existing secure-session copy only.
- Native mobile apps - web-responsive surface only.
- Global redesign outside `/chat` - keep scope limited to the messenger UI.
- Living imagery, profile photos, mascot art, or realistic avatars - explicitly banned by the visual contract.

## Constraints

- Keep the existing React/Vite, TanStack Query, Zustand, Tailwind, Socket.IO client, and npm package layout.
- Keep frontend transport behind existing API modules and hooks; pages/components must not add ad hoc backend calls for visual-only sections.
- Use the same component/data flow for light and dark variants.
- Use fixture data for visual parity smoke checks so screenshots are deterministic.
- Full desktop visual checks target `1440x900` or wider; mobile checks target `390x844` and/or `430x932`.
- The mobile primary conversation must not show drawer/sidebar chrome unless the user explicitly opens a navigation affordance.
- Theme changes must not clear selected chat, message search, sidebar search, composer text, presence state, or current conversation messages.
- Every icon-only control must keep an accessible name and keyboard path.

## Acceptance Criteria

- [ ] Desktop light screenshot shows the reference-style left conversation rail, center thread, right context rail, composer, and security/status sections.
- [ ] Desktop dark screenshot shows the same structure as desktop light with dark tokens and no layout drift.
- [ ] Mobile light screenshot shows the reference-style safe-area header, message stream, typing row, composer, and secure-session footer.
- [ ] Mobile dark screenshot shows the same structure as mobile light with dark tokens and no pure-black/neon treatment.
- [ ] Theme switching can force light and dark modes for verification and does not change chat behavior or selected state.
- [ ] Chat identity and media surfaces render only abstract non-living visuals.
- [ ] Existing Phase 04/05 frontend tests and smoke flows still pass.
- [ ] `cd Frontend/Chatify; npm test` passes.
- [ ] `cd Frontend/Chatify; npm run test:ui` passes.
- [ ] `cd Frontend/Chatify; npm run lint` passes.
- [ ] `cd Frontend/Chatify; npm run build` passes.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.94  | 0.75  | Met    | The target is pixel-close parity to four named reference variants. |
| Boundary Clarity    | 0.92  | 0.70  | Met    | Visual work is in scope; backend and new product features are excluded. |
| Constraint Clarity  | 0.86  | 0.65  | Met    | Theme, viewport, fixture, no-living-imagery, and behavior-preservation constraints are locked. |
| Acceptance Criteria | 0.88  | 0.70  | Met    | Verification requires four screenshots and existing frontend checks. |
| **Ambiguity**       | 0.09  | <=0.20 | Met    | Gate passed after user accepted all recommendations. |

Status: Met = meets minimum, Below = below minimum and planner treats as assumption.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | How strict is reference parity? | Pixel-close parity; screenshots are the visual contract, not loose inspiration. |
| 1 | Researcher | Should verification use live data or stable fixtures? | Use seeded/fixture data for parity checks; live production data remains supported. |
| 2 | Simplifier | What is the minimum viable visual target? | Four variants: desktop light, desktop dark, mobile light, mobile dark. |
| 2 | Simplifier | How should theme be controlled? | Support both explicit app control for verification and system/default behavior through the same tokens. |
| 3 | Boundary Keeper | What is the desktop layout boundary? | Reference-width desktop keeps the full three-column shell; smaller collapse behavior stays responsive. |
| 3 | Boundary Keeper | What is the mobile primary view? | Match the single-column screenshots without visible sidebar chrome in the primary conversation view. |
| 4 | Failure Analyst | What visual content is forbidden? | All living imagery is banned; use abstract geometric identity and media placeholders everywhere in chat. |
| 4 | Failure Analyst | What would make verification reject the output? | Broad resemblance, missing right rail, missing mobile parity, light/dark layout drift, living imagery, or broken existing behavior. |
| 5 | Seed Closer | What code movement is allowed? | Localized UI refactors and token plumbing are allowed; backend and route expansion are out of scope. |
| 5 | Seed Closer | What proves completion? | Side-by-side or equivalent screenshots for all four variants plus passing frontend tests, UI smoke, lint, and build. |

---

*Phase: 06-messenger-visual-parity*
*Spec created: 2026-06-12*
*Next step: $gsd-discuss-phase 6 - implementation decisions (how to build what's specified above)*
