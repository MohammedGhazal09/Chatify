---
phase: 4
slug: messenger-ui-reconstruction
status: complete
review_type: ui
created: 2026-06-09
overall_score: 18/24
needs_visual_review: true
---

# Phase 04 UI Review

## Summary

Phase 04 delivered the right messenger structure: split shell, responsive drawer, conversation pane, composer, message states, action menu, and component-level tests. The UI is usable and aligned with the Phase 04 direction, but it is not yet polished enough to call the messenger baseline visually complete.

The main gaps are token drift in message status color, text glyphs where proper icons are expected, loading states that do not meet the skeleton contract, mobile viewport fragility, broad motion declarations, and missing authenticated desktop/mobile visual inspection.

## Skills Used

| Skill | How it was used |
| --- | --- |
| `gsd-ui-review` | Structured this artifact as the retroactive 6-pillar Phase 04 UI audit. |
| `find-skills` | Selected relevant installed support skills for the review instead of installing duplicates. |
| `accessibility` | Checked labels, dialog focus behavior, state announcements, and keyboard affordances. |
| `design-taste-frontend` | Evaluated messenger density, visual hierarchy, control polish, and application-surface fit. |
| `frontend-design-ui-ux` | Checked flows, states, responsive behavior, and implementation handoff coverage. |
| `web-design-guidelines` | Cross-checked against current Vercel web interface guidance, including labels, focus states, semantic buttons, reduced motion, and avoiding `transition: all`. |

External guideline source reviewed: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Evidence Reviewed

| Artifact | Result |
| --- | --- |
| `.planning/phases/04-messenger-ui-reconstruction/04-UI-SPEC.md` | Used as the design contract. |
| `.planning/phases/04-messenger-ui-reconstruction/04-01-SUMMARY.md` | Component extraction completed. |
| `.planning/phases/04-messenger-ui-reconstruction/04-02-SUMMARY.md` | Messenger state polish completed. |
| `.planning/phases/04-messenger-ui-reconstruction/04-03-SUMMARY.md` | Regression coverage completed. |
| `.planning/phases/04-messenger-ui-reconstruction/04-SMOKE.md` | Tests/lint/build passed; authenticated visual inspection skipped. |
| `.planning/phases/04-messenger-ui-reconstruction/04-REVIEW-FIX.md` | Accessibility review findings were remediated. |
| `Frontend/Chatify/src/pages/chat/components/*` | Source inspected for UI contract adherence. |
| `Frontend/Chatify/src/components/MessageStatus.tsx` | Source inspected for status token adherence. |
| `Frontend/Chatify/src/pages/chat/chat.css` | Source inspected for scrollbar, motion, and responsive behavior. |

## Scorecard

| Pillar | Score | Assessment |
| --- | ---: | --- |
| Copywriting | 3/4 | Core empty/error/recovery copy is concise, but loading/pending text still uses rough punctuation and text glyphs reduce polish. |
| Visuals | 3/4 | Messenger structure is strong, but control glyphs and skipped browser review keep the visual finish below production quality. |
| Color | 3/4 | Main palette follows the UI spec, but message receipt colors drift to default slate/blue tokens. |
| Typography | 3/4 | Compact type scale is respected, but visible ASCII punctuation and text placeholders weaken typographic finish. |
| Spacing | 3/4 | Most dimensions are stable and 4px-based, but the root `h-screen` shell is fragile on mobile browser chrome. |
| Experience Design | 3/4 | States and keyboard affordances are mostly covered; skeleton loading, explicit motion, and visual smoke are still missing. |

Overall: **18/24**

## Findings

### UI-01 - Message receipt colors drift from the semantic palette

**Pillar:** Color  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/components/MessageStatus.tsx:52`, `:54`, `:56`, `:58`

`MessageStatus` uses `text-slate-600`, `text-slate-700`, and `text-blue-800` instead of the Phase 04 semantic tokens. The UI spec reserves `#38BDF8` for read receipts and defines success/info/warning/destructive status colors explicitly. On the dark message bubble surface, the current dark blue read color can look muted instead of intentionally stateful.

**Recommendation:** Replace status classes with explicit design-token classes. Use `#A8B3AF` or `#6F7B77` for sent, `#22C55E` or a muted success treatment for delivered, and `#38BDF8` for read. Add or update a component test that asserts each status renders the expected semantic class.

### UI-02 - Several controls use raw text glyphs instead of proper icons

**Pillar:** Visuals  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx:81`, `MessageComposer.tsx:50`, `MessageComposer.tsx:76`, `MessageList.tsx:168`, `ChatSidebar.tsx:97`, `NewChatDialog.tsx:107`, `MessageActionMenu.tsx:82`

The implementation uses visible text glyphs such as `...`, `x`, `+`, and `Down` for icon controls. The UI spec says `lucide-react` is preferred for new controls, and the implementation already uses lucide icons in the conversation header. Text glyphs make the messenger feel unfinished and can vary visually across fonts.

**Recommendation:** Use `MoreHorizontal`, `X`, `SmilePlus` or `Plus`, and `ArrowDown` from `lucide-react`, with `aria-hidden="true"` inside already labelled buttons. Keep the current accessible names and focus rings.

### UI-03 - Initial loading states do not meet the skeleton-row contract

**Pillar:** Experience Design  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx:154`, `MessageList.tsx:69`, `MessageList.tsx:87`, `LazyEmojiPicker.tsx:27`, `MessageComposer.tsx:99`, `MessageList.tsx:130`, `NewChatDialog.tsx:143`

The UI spec requires initial loading to use skeleton rows in the sidebar and message list, not bare loading text. Current loading and pending states rely on text-only labels such as `Loading chats...`, `Loading messages...`, `Loading...`, `Sending...`, `Saving...`, and `Adding...`. This is functional, but it creates a less stable and less polished messenger baseline.

**Recommendation:** Add small skeleton row components for chat list and message list loading. For transient button labels, use a consistent pending pattern with a spinner/icon plus concise text, and replace three-period ellipses with the single ellipsis character where loading text remains.

### UI-04 - The root chat shell uses `h-screen`, which is fragile on mobile

**Pillar:** Spacing  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx:13`

The shell uses `h-screen` for the fixed messenger layout. On mobile browsers, `100vh` can include hidden browser chrome and can cause the composer or newest message to sit under the viewport edge. This is risky for the Phase 04 requirement that the composer remains anchored and does not cover the newest message.

**Recommendation:** Use a dynamic viewport height class such as `h-[100dvh]` or `min-h-[100dvh]`, with safe-area padding where needed for the composer. Verify at a 390px mobile viewport with the drawer open and closed.

### UI-05 - Motion declarations are broader than the contract allows

**Pillar:** Experience Design  
**Severity:** Low  
**Evidence:** `Frontend/Chatify/src/pages/chat/chat.css:23`, `chat.css:55`, `Frontend/Chatify/src/pages/chat/components/MessageList.tsx:164`

The scrollbar thumbs use `transition: all 0.3s ease`, and the scroll-to-bottom button uses `transition-all`. The UI spec allows short functional motion and already includes reduced-motion handling, but broad transitions can animate unintended properties and make later layout changes harder to reason about.

**Recommendation:** Replace broad transitions with explicit properties, such as `background-color`, `border-color`, `box-shadow`, `opacity`, or `transform`. Keep the existing `prefers-reduced-motion` override.

### UI-06 - Authenticated desktop and mobile visual smoke were skipped

**Pillar:** Visuals  
**Severity:** Medium  
**Evidence:** `.planning/phases/04-messenger-ui-reconstruction/04-SMOKE.md:21`, `:36`, `:47`, `:48`

The documented automated checks passed, but the UI was not visually inspected in an authenticated chat state at 1440px or 390px. This limits confidence in spacing, overflow, drawer behavior, action menu placement, and composer anchoring in the actual rendered app.

**Recommendation:** Seed or reuse a local authenticated account with at least one direct chat, one longer conversation, one failed optimistic message, and one unread chat. Run a manual browser smoke at 1440px and 390px, or add a minimal fixture-driven Playwright route if Phase 5 approves browser automation.

## Positive Notes

- Component extraction materially improved reviewability and separated `ChatShell`, `ChatSidebar`, `ConversationPane`, `MessageList`, `MessageComposer`, `MessageBubble`, `MessageActionMenu`, and `NewChatDialog`.
- Accessibility remediation landed before this UI audit: icon labels, message action semantics, and dialog focus handling are in a much better place.
- The dominant palette, bubble tones, empty/error states, and failed-send recovery copy largely match the Phase 04 UI spec.
- Component tests cover the highest-risk state transitions and interactions, including failed sends, action menus, drawer controls, and dialog focus.

## Recommended Fix Order

1. Replace raw text glyph controls with lucide icons and update related tests.
2. Align `MessageStatus` colors to the Phase 04 semantic palette.
3. Add sidebar/message-list skeleton loading rows and clean up loading punctuation.
4. Switch the root chat shell from `h-screen` to dynamic viewport sizing and verify mobile composer anchoring.
5. Replace broad motion declarations with explicit transition properties.
6. Run authenticated desktop and mobile visual smoke and append screenshots or notes to `04-SMOKE.md`.

## Completion Criteria For UI Remediation

- `npm test` passes from `Frontend/Chatify`.
- `npm run lint` passes from `Frontend/Chatify`.
- `npm run build` passes from `Frontend/Chatify`.
- Static search finds no Phase 04 chat controls using visible `...`, `x`, `+`, or `Down` as icon substitutes.
- Static search finds no Phase 04 chat CSS using `transition: all` or Tailwind `transition-all` on newly reviewed surfaces.
- Message receipt colors use Phase 04 semantic tokens.
- `04-SMOKE.md` documents authenticated 1440px and 390px visual checks, or documents a fresh concrete blocker.

