# Phase 21: Username-Based Contact Discovery - Specification

**Created:** 2026-06-18
**Ambiguity score:** 0.09 (gate: <= 0.20)
**Requirements:** 7 locked

## Goal

Users can start or continue direct conversations by exact username instead of email, and chat discovery no longer searches or renders private email addresses.

## Background

Phase 20 added normalized unique usernames, mandatory username setup, public identity serializers, and email privacy guardrails. Direct chat creation still accepts `targetEmail` in `Backend/Chatify/Controller/chatController.mjs`; frontend chat state, `CreateChatPayload`, `NewChatDialog`, `ChatSidebar`, and `chat.tsx` still use email-oriented names, validation, copy, and payloads. Phase 21 replaces that discovery input with username while preserving direct-chat idempotency through `directKey`.

## Requirements

1. **Direct chat by username**: Direct chat creation must accept `targetUsername` and stop accepting `targetEmail` as the chat-start identifier.
   - Current: `POST /api/chat/create-new-chat` requires `targetEmail`, validates email, and looks up users by email.
   - Target: The endpoint requires `targetUsername`, normalizes and validates it with the Phase 20 username helper, resolves by username, and rejects email-only payloads without email lookup.
   - Acceptance: Backend tests prove valid username creates a direct chat, repeated username starts return the existing chat, invalid/missing usernames fail, and `targetEmail` payloads do not create chats.

2. **Exact username lookup**: Authenticated clients must have an exact username lookup for discovery surfaces and Phase 22 member picking.
   - Current: No exact username lookup endpoint exists.
   - Target: A protected exact lookup endpoint returns minimal public identity for one valid username: `_id`, `username`, `firstName`, `lastName`, `profilePic`, and `identityMark`; never `email`.
   - Acceptance: Backend tests prove lookup success, invalid username rejection, missing user handling, self lookup handling, and no email fields.

3. **Privacy-safe failure behavior**: Discovery failures must not reveal private email existence or suggest email search.
   - Current: Direct chat errors and UI copy mention email.
   - Target: Errors mention username only and use stable generic failure copy for missing/self-target or invalid lookup states.
   - Acceptance: Backend and frontend tests prove no discovery response or UI error copy contains email.

4. **Frontend username dialog**: The chat sidebar and new-chat dialog must collect username instead of email.
   - Current: `NewChatDialog` labels, input type, placeholder, props, and submit state are email-oriented.
   - Target: Dialog label/copy/placeholder/input validation use username, with loading, invalid, self, missing, and generic failure states.
   - Acceptance: Frontend component tests prove username copy renders, invalid usernames fail client-side, and submit sends `targetUsername`.

5. **Cache and selection behavior**: Existing chat cache behavior must continue after username start-chat.
   - Current: `useCreateChat` updates chat query cache and the page selects the returned chat.
   - Target: The mutation still inserts or updates the returned chat, selects it, closes the dialog, and clears username state.
   - Acceptance: Existing and new frontend tests prove repeated start-chat keeps one direct conversation and updates UI state.

6. **Email leak guardrails**: Runtime chat discovery surfaces must not render email copy or email fallback identifiers.
   - Current: Runtime chat files still include email-specific new-chat copy.
   - Target: Chat runtime discovery copy and payload types do not include `targetEmail`, email input labels, email placeholders, or email fallback identity values.
   - Acceptance: Fixture leak guard or focused search proves email is absent from discovery/runtime surfaces except auth/reset/account contexts.

7. **Verification evidence**: Phase 21 must leave executable backend/frontend/privacy evidence.
   - Current: Phase 20 evidence proves username foundation but not username chat discovery.
   - Target: Phase 21 records commands, outcomes, and privacy search classification in `21-VERIFICATION.md`.
   - Acceptance: Verification includes backend direct-chat/lookup tests, frontend dialog/cache tests, lint/build, and focused email-search evidence.

## Boundaries

**In scope:**
- Exact username direct-chat creation.
- Exact username lookup endpoint with public identity response.
- Frontend new-chat dialog and state rename from email to username.
- Chat discovery copy, validation, and privacy guardrails.
- Backend/frontend tests and verification artifact.

**Out of scope:**
- Broad public username directory/autocomplete — requires enumeration/rate-limit design later.
- Username login — email remains account auth infrastructure.
- Group member picker — Phase 22 consumes the lookup but owns group UI.
- Username changes — Phase 20 explicitly deferred rename policy.
- Production smoke claims — still governed by existing release blockers.

## Constraints

- Reuse Phase 20 username validation and public identity serialization patterns.
- Preserve direct chat `directKey` idempotency and conversation controls.
- Do not overwrite unrelated local work in `Frontend/Chatify/src/pages/chat/chat.tsx`; make narrow edits only where username discovery requires it.
- Keep email in auth, reset, OAuth, and account settings only.
- Do not use subagents.

## Acceptance Criteria

- [ ] `POST /api/chat/create-new-chat` accepts `targetUsername` and no longer creates chats from `targetEmail`.
- [ ] Exact username lookup returns public identity only and no email.
- [ ] Missing, invalid, self-target, and duplicate direct-chat cases are covered by backend tests.
- [ ] New-chat UI uses username labels, helper/error copy, validation, and payloads.
- [ ] Direct chat idempotency still returns one chat for repeated username submits.
- [ ] Discovery/runtime email search finds no email-oriented chat-start copy or payload contract.
- [ ] `21-VERIFICATION.md` records backend tests, frontend tests, lint/build, and privacy search evidence.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.94 | 0.75 | PASS | Direct username discovery replaces email start-chat. |
| Boundary Clarity | 0.92 | 0.70 | PASS | Exact lookup only; groups and autocomplete deferred. |
| Constraint Clarity | 0.88 | 0.65 | PASS | Reuses Phase 20 username/privacy contract. |
| Acceptance Criteria | 0.91 | 0.70 | PASS | Criteria map to tests and searches. |
| **Ambiguity** | 0.09 | <=0.20 | PASS | Ready for discussion/planning. |

## Interview Log

Auto-selected recommended decisions from the active GSD pipeline.

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | Should discovery support email during transition? | No; reject email payloads for chat start to avoid privacy leakage. |
| 2 | Simplifier | Should this include autocomplete? | No; exact username lookup only. |
| 3 | Boundary Keeper | Should groups be included now? | No; Phase 22 owns group member selection. |
| 4 | Failure Analyst | What invalidates this phase? | Email remains searchable/rendered in chat discovery or direct chat idempotency regresses. |

---

*Phase: 21-username-based-contact-discovery*
*Spec created: 2026-06-18*
*Next step: $gsd-discuss-phase 21*
