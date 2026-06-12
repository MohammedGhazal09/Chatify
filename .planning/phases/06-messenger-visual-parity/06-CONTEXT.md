# Phase 06: Messenger Visual Parity - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 06 locks Chatify's messenger surface to the supplied desktop and mobile light/dark reference screenshots. It is a presentation-focused phase on top of the Phase 3 canonical message-state contract and the Phase 5 baseline behavior. It does not expand backend contracts or introduce new messenger product scope.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `06-SPEC.md` for the full contract.

Downstream agents MUST read `06-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Shared messenger shell and theme tokens for the four reference variants.
- Desktop three-column layout parity.
- Mobile single-column layout parity.
- Light/dark theme parity without layout drift.
- Abstract identity tiles and state surfaces that mirror the supplied screenshots.
- Screenshot and smoke verification for desktop/mobile light/dark variants.

**Out of scope (from SPEC.md):**
- Backend API changes.
- New chat, search, or presence features.
- Group chats, attachments, notifications, moderation, or broad account-settings rewrites.
- Route restructuring or a second messenger surface.
- Decorative motion, marketing art, or social-feed patterns.

</spec_lock>

<decisions>
## Implementation Decisions

### Reference-Driven Parity
- **D-01:** The four supplied screenshots are the source of truth for this phase.
- **D-02:** Desktop and mobile must share one messenger system and one data flow; only tokens and layout constraints vary by viewport and theme.
- **D-03:** Light and dark variants must stay structurally identical and differ only in surface treatment, borders, shadows, and text/icon contrast.

### Layout Contract
- **D-04:** Desktop keeps the three-column messenger shell with left rail, center conversation pane, and right context rail.
- **D-05:** Mobile collapses into a single-column conversation view with a safe-area header, message stream, composer, and secure-session footer.
- **D-06:** The phase must preserve the existing chat route and current messenger behavior; do not add a second route or separate mobile app surface.

### Identity And Media
- **D-07:** Use abstract geometric tiles, monograms, or patterned placeholders only.
- **D-08:** Do not introduce human, animal, plant, or mascot imagery in avatars, attachments, or media previews.

### Verification
- **D-09:** Prove desktop/mobile light/dark parity with screenshot smoke or equivalent visual checks.
- **D-10:** Any visual drift must be fixed before the phase can be considered complete.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` - current phase ordering and the new visual-parity phase.
- `.planning/REQUIREMENTS.md` - UI-01 through UI-06 traceability.
- `.planning/PROJECT.md` - project constraints, collaboration preference, and repository hygiene.
- `.planning/phases/04-messenger-ui-reconstruction/04-CONTEXT.md` - prior messenger UI boundaries and componentization decisions.
- `.planning/phases/04-messenger-ui-reconstruction/04-UI-SPEC.md` - earlier messenger UI contract that Phase 06 refines.
- `.planning/phases/05-messenger-baseline-completion/05-CONTEXT.md` - search, presence, navigation, and session decisions that must remain intact.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - current chat route orchestration.
- `Frontend/Chatify/src/pages/chat/components/*` - existing messenger UI component surface.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - query and mutation integration.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - realtime presence and typing integration.
- `Frontend/Chatify/src/hooks/useAuthQuery.ts` - auth and logout integration.
- `Frontend/Chatify/src/store/presenceStore.ts` - presence and typing state cleanup target.

</canonical_refs>

<specifics>
## Specific Ideas

- The four supplied screenshots should be treated as the visual source of truth for desktop light, desktop dark, mobile light, and mobile dark.
- The desktop layout uses a left conversation rail, center message canvas, and right context rail.
- The mobile layout uses a single conversation canvas with a secure composer and no visible sidebars.
- The main visual variation between themes is surface depth, border contrast, and text contrast; the information architecture stays fixed.

</specifics>

<deferred>
## Deferred Ideas

- New chat features, groups, attachments, notifications, moderation, and broader account settings remain deferred.
- Layout experiments, brand refreshes, and motion-heavy treatments remain deferred unless they are required to hit parity.

</deferred>

---

*Phase: 06-messenger-visual-parity*
*Context gathered: 2026-06-11*
