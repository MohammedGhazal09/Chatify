# Phase 06: Messenger Visual Parity - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 06 turns Chatify's existing `/chat` surface into a reference-matched messenger UI for desktop light, desktop dark, mobile light, and mobile dark variants. It is a presentation, theme, component-structure, and visual-verification phase on top of the Phase 03 canonical message-state contract and the Phase 05 search, continuation, presence, and session baseline. It does not add backend APIs or new product features for calls, attachments, audio, pinned messages, shared media, or profile management.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `06-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `06-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Desktop light and dark visual parity for the reference three-column messenger shell.
- Mobile light and dark visual parity for the reference single-column conversation screen.
- Token-driven theme plumbing with explicit app control and system/default behavior.
- Chat-specific abstract identity tiles, abstract thumbnails, and file/media placeholders.
- Localized UI component refactors needed to match the references.
- Presentational right context rail sections that do not require new backend APIs.
- Fixture-backed screenshot/smoke verification for the four variants.
- Preservation of existing Phase 03 and Phase 05 behavior.

**Out of scope (from SPEC.md):**
- Backend API changes - this phase is visual parity, not a data contract phase.
- New real calling, video, mute, pinned-message, attachment, shared-media, or file-upload product features - reference controls may be presentational or reuse existing behavior only.
- Group chat expansion - v2 platform scope.
- End-to-end encryption implementation - deferred v2/security design scope; this phase may show existing secure-session copy only.
- Native mobile apps - web-responsive surface only.
- Global redesign outside `/chat` - keep scope limited to the messenger UI.
- Living imagery, profile photos, mascot art, or realistic avatars - explicitly banned by the visual contract.

</spec_lock>

<decisions>
## Implementation Decisions

### Theme Control And Token Plumbing
- **D-01:** Add production theme control through the existing Settings modal, not a prominent chat toolbar control.
- **D-02:** Add a deterministic test override for visual smoke, using URL and/or localStorage so Playwright can force `light` and `dark` without user clicks.
- **D-03:** Persist theme preference under a per-user localStorage key, with system preference as the default fallback when no explicit preference exists.
- **D-04:** Implement chat theme styling through CSS variables on a chat root element, then consume those variables through Tailwind arbitrary values/classes and small local CSS where Tailwind cannot express the rule cleanly.
- **D-05:** Do not create separate light and dark component trees. Theme must change tokens and surfaces only, not layout semantics or data flow.

### Desktop Context Rail And Presentational Controls
- **D-06:** Build the desktop right rail as a presentational context panel with abstract profile tile, action strip, pinned messages, shared files, shared media, and conversation security sections.
- **D-07:** The right rail may use existing chat/message data, derived local data, or fixture-only placeholder data for visual smoke. It must not require new backend APIs in Phase 06.
- **D-08:** Wire the right-rail Search control to the existing Phase 05 in-conversation message search behavior.
- **D-09:** Keep Call, Video, Profile, Mute, and More-style controls presentational unless an existing behavior already exists. They must have accessible names and must not imply completed backend product scope.

### Responsive Layout Collapse
- **D-10:** Render the full three-column desktop shell at `>=1280px`.
- **D-11:** Below the full desktop breakpoint, collapse the right rail before collapsing the conversation list.
- **D-12:** Below the existing mobile boundary, keep the primary view as the reference-style single-column conversation and expose the conversation list through the drawer affordance.
- **D-13:** The mobile back arrow opens the conversation list drawer. It must not clear the selected chat or navigate away from `/chat`.

### Abstract Identity And Media Surfaces
- **D-14:** Replace all chat-surface profile photo rendering with deterministic abstract geometric identity tiles.
- **D-15:** Conversation list rows may include initials as a secondary cue, but the primary visual identity should be a geometric/encrypted-pattern tile rather than a plain avatar circle.
- **D-16:** Ignore `profilePic` image URLs in chat UI surfaces for Phase 06. Do not blur, crop, transform, or otherwise render user-supplied profile photos in chat.
- **D-17:** Shared media and file placeholders must use abstract tiles, document icons, file badges, or non-living interface/material previews only.

### Mobile Conversation Behavior
- **D-18:** Mobile implementation should be hybrid: strict reference rhythm for the shell, safe-area header, identity tile, message bubbles, composer, and secure-session footer; flexible enough to handle real message counts and live state.
- **D-19:** The mobile primary conversation must not show sidebar chrome unless the user opens the drawer.
- **D-20:** The composer must stay above the safe area and must not cover the newest message or secure-session footer.

### Message States, Composer, And Search
- **D-21:** Phase 06 visual smoke fixtures must show the reference states: received message, sent/read message, retrying or failed outgoing state, typing row, file chip, secure-session status, date divider, and visible read/delivery marks.
- **D-22:** Implement the file chip as a fixture-only/presentational visual surface in this phase. Do not add real attachment upload or download behavior.
- **D-23:** Keep reference attachment and microphone controls presentational/disabled with accessible names; the existing text send behavior remains the functional send path.
- **D-24:** Keep the existing emoji picker behavior, but make it visually subordinate to the reference composer treatment. On desktop it may remain an auxiliary action; on mobile it must not crowd the primary send path.
- **D-25:** The redesigned header Search icon toggles the existing in-conversation search mode. The right-rail Search action triggers the same mode. Do not add a second search implementation.

### Motion, Accessibility, And Verification
- **D-26:** Motion should be subtle and functional only: short transitions, hover/focus/pressed feedback, and reduced-motion support. Do not add decorative or continuous animation.
- **D-27:** Icon-only controls must keep accessible names, visible focus rings, keyboard access, and non-color-only state cues.
- **D-28:** Write Phase 06 visual evidence screenshots under `.planning/phases/06-messenger-visual-parity/`.
- **D-29:** Initial visual verification should use Playwright screenshots plus stable layout/user-visible assertions. Add pixel-diff thresholds only if recurring visual drift makes that necessary.
- **D-30:** Completion remains blocked on frontend `npm test`, `npm run test:ui`, `npm run lint`, and `npm run build` from `Frontend/Chatify`, plus the four visual screenshot artifacts.

### Component Strategy And Artifact Handling
- **D-31:** Add focused components rather than rewriting `chat.tsx` or heavily expanding existing components. Recommended targets include a chat theme/root provider, `AbstractIdentityTile`, `ChatContextRail`, a secure composer shell/treatment, and visual fixture helpers.
- **D-32:** Keep `Frontend/Chatify/src/pages/chat/chat.tsx` as the orchestration layer. Avoid moving durable query/socket behavior into presentational components.
- **D-33:** Update this `06-CONTEXT.md` as the authoritative downstream decision file and keep `06-DISCUSSION-LOG.md` as human-only audit history.

### Agent Discretion
- The planner may choose exact component filenames and prop shapes as long as they preserve existing route, query, socket, and UI state contracts.
- The planner may choose exact token names, CSS variable names, and theme hook names as long as theme state is deterministic and testable.
- The planner may choose exact fixture copy and abstract tile patterns as long as the four reference states are represented and no living imagery appears.
- The planner may choose whether screenshot smoke lives in the existing `chat-ui-smoke.spec.ts` or a new Phase 06-specific Playwright file, as long as the suite remains deterministic and focused.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/06-messenger-visual-parity/06-SPEC.md` - locked Phase 06 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/phases/06-messenger-visual-parity/06-UI-SPEC.md` - visual and interaction contract for the four reference variants.
- `.planning/phases/06-messenger-visual-parity/06-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/ROADMAP.md` - phase ordering and Phase 06 plan slots.
- `.planning/REQUIREMENTS.md` - UI-01 through UI-06 and TEST-03 traceability.
- `.planning/PROJECT.md` - project value, brownfield constraints, repository hygiene, and collaboration preference.
- `.planning/STATE.md` - current project state and prior phase continuity notes.

### Prior Phase Contracts
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - canonical message state, idempotency, status, unread, and visibility contracts.
- `.planning/phases/04-messenger-ui-reconstruction/04-CONTEXT.md` - componentized messenger UI and accessibility/state decisions.
- `.planning/phases/04-messenger-ui-reconstruction/04-UI-SPEC.md` - prior messenger UI design contract that Phase 06 refines.
- `.planning/phases/05-messenger-baseline-completion/05-CONTEXT.md` - conversation search, message search, selected-chat restoration, presence, and auth-loss cleanup decisions.

### Codebase Maps
- `.planning/codebase/CONVENTIONS.md` - frontend TypeScript, Tailwind, naming, import, and linting conventions.
- `.planning/codebase/STRUCTURE.md` - current frontend/backend directory layout and where new frontend components belong.
- `.planning/codebase/STACK.md` - React/Vite/Tailwind/Playwright dependencies and script expectations; verify live package scripts because this map predates later additions.

### Frontend Code To Scout
- `Frontend/Chatify/src/pages/chat/chat.tsx` - chat route orchestration, selected chat state, search toggles, message actions, send flow, and session cleanup.
- `Frontend/Chatify/src/pages/chat/chat.css` - current scrollbars, motion helpers, highlight animation, and reduced-motion handling.
- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx` - current two-column dark shell that Phase 06 must upgrade to token-driven responsive rails.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - current left rail, local conversation search, new chat dialog, and user identity rendering.
- `Frontend/Chatify/src/pages/chat/components/ChatListItem.tsx` - conversation row structure, unread/status indicators, and active styling.
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx` - center pane composition, message search mode, connection/session states, and composer integration.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - header identity, presence, search/export actions, and mobile drawer trigger.
- `Frontend/Chatify/src/pages/chat/components/MessageList.tsx` - date divider, loading/error/empty states, scrolling, and message list layout.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - bubble states, timestamps, message status, failed-send recovery, reactions, and action menu integration.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - current composer behavior, emoji picker, send disabled states, and send error handling.
- `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx` - existing selected-conversation message search UI to preserve.
- `Frontend/Chatify/src/pages/chat/hooks/useChatViewState.ts` - transient UI state hooks where theme/search/drawer interactions may connect.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - durable chat/message state, mutations, and message search query contract.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - socket presence, typing, and realtime message event integration.
- `Frontend/Chatify/src/store/presenceStore.ts` - online and typing maps that must remain intact.
- `Frontend/Chatify/src/components/OnlineStatus.tsx` - presence text/dot formatting to restyle through tokens.
- `Frontend/Chatify/src/components/MessageStatus.tsx` - sent/delivered/read icon behavior to restyle through tokens.
- `Frontend/Chatify/src/components/TypingIndicator.tsx` - typing row behavior to restyle into reference bubble treatment.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - existing deterministic Playwright route-interception smoke pattern to extend for Phase 06 screenshots.
- `Frontend/Chatify/playwright.config.ts` - visual smoke server/viewport execution configuration.
- `Frontend/Chatify/package.json` - frontend scripts: `test`, `test:ui`, `lint`, and `build`.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/redesign-existing-projects/SKILL.md` - brownfield redesign without breaking existing behavior.
- `C:/Users/saieh/.agents/skills/frontend-design/SKILL.md` - production-grade frontend design guidance.
- `C:/Users/saieh/.agents/skills/design-taste-frontend/SKILL.md` - token, density, motion, and layout discipline.
- `C:/Users/saieh/.agents/skills/accessibility/SKILL.md` - WCAG-oriented keyboard, contrast, focus, and accessible-name guidance.
- `C:/Users/saieh/.agents/skills/e2e-testing-patterns/SKILL.md` - deterministic Playwright smoke guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Frontend/Chatify/src/pages/chat/chat.tsx`: Keep as the state orchestration layer. It already owns selected chat, drawer state, search state, send/retry, auth loss, message action menu, and socket integration.
- `ChatShell`: Reuse as the shell entry point, but upgrade it from dark-only two-column layout to tokenized responsive three-column shell.
- `ChatSidebar` and `ChatListItem`: Reuse local conversation search, selected-chat handling, unread counts, and New chat integration; replace profile-photo/round-avatar rendering with abstract identity tiles.
- `ConversationPane`: Reuse the central composition and message search branching; pass new context-rail/search hooks rather than creating a second search state.
- `ConversationHeader`: Reuse presence/title/search integration, but restyle into the reference header with back/drawer, identity tile, and compact icon actions.
- `MessageList` and `MessageBubble`: Reuse message ordering, date dividers, edit/retry/action behavior, status rendering, and highlighted-message handling while replacing hard-coded dark bubble styles with tokenized reference bubbles.
- `MessageComposer`: Reuse send/emoji/reply/disabled/error behavior, but rebuild the visual shell into the reference rounded input row, circular send action, auxiliary controls, and secure-session footer.
- `MessageSearchResults`: Preserve Phase 05 selected-conversation search behavior and trigger it from both center header and right rail.
- `OnlineStatus`, `MessageStatus`, and `TypingIndicator`: Reuse state derivation and semantics; restyle through chat tokens and reference-specific layout.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`: Extend or split from the existing fixture route-interception pattern to create four deterministic Phase 06 screenshots.

### Established Patterns
- Frontend transport stays behind API modules and hooks; visual-only rail sections must not add direct Axios calls.
- TanStack Query owns durable chat/message state; local UI state belongs in `chat.tsx`, focused hooks, or presentational component props.
- Socket presence and typing are centralized in `useChatSocket.ts` and `presenceStore`; Phase 06 must not add component-local socket listeners.
- Current chat UI is Tailwind-heavy with small `chat.css` helpers; Phase 06 should keep that pattern but replace hard-coded color literals with semantic CSS variables.
- React 19, TypeScript strict mode, ESLint, Vitest, and Playwright are already present in the frontend package.
- Existing tests use semantic role/name queries and deterministic mocked data. Continue that pattern.

### Integration Points
- Add a chat theme state/control path near the chat route shell or a focused hook, with Settings modal integration and test override support.
- Add `AbstractIdentityTile` near chat components or shared components, depending on reuse, and replace `profilePic` rendering in chat surfaces only.
- Add `ChatContextRail` under `Frontend/Chatify/src/pages/chat/components` and render it from `ChatShell` at desktop widths.
- Add fixture helpers for Phase 06 visual smoke data either inside `Frontend/Chatify/e2e` or a colocated test utility.
- Update `chat.css` for theme variables, scrollbars, reduced motion, safe-area composer behavior, and optional dark-mode background micro-patterns.
- Update existing component tests where markup/roles change, and add coverage for theme forcing, abstract identity rendering, and preserved search/session behavior.

</code_context>

<specifics>
## Specific Ideas

- The four supplied images remain the visual source of truth for the phase.
- Desktop must read as a secure professional messenger with left conversation rail, center conversation pane, and right context rail.
- Mobile must read as a single secure conversation screen with safe-area header, message stream, typing bubble, composer, and secure-session footer.
- Use a quiet teal/jade accent with neutral light/dark surfaces. Dark mode should be charcoal/graphite, not pure black.
- Geometric encrypted-pattern identity tiles are preferred over circular avatars or profile photos.
- The fixture message content may follow the reference copy around socket reconnect, message states, retry logic, and secure session status.
- The UI should feel quiet and trustworthy, not decorative, marketing-like, or motion-heavy.

</specifics>

<deferred>
## Deferred Ideas

- Real call, video, mute, profile, pinned-message, shared-file, shared-media, attachment, audio-recording, and file-download features remain deferred to future product phases.
- Backend support for pinned messages, uploaded files, shared media, or end-to-end encryption remains out of scope for Phase 06.
- Pixel-diff visual regression can be added later if screenshot drift repeatedly escapes Playwright layout assertions.
- External skill installation was not required for this discussion because the relevant design, accessibility, E2E, and brownfield redesign skills were already available locally.

</deferred>

---

*Phase: 06-messenger-visual-parity*
*Context gathered: 2026-06-12*
