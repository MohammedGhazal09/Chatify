# Phase 21: Username-Based Contact Discovery - Context

**Gathered:** 2026-06-18
**Status:** Ready for UI design and planning

<domain>
## Phase Boundary

Phase 21 replaces direct-chat discovery by email with exact username discovery. It builds the backend contract, frontend dialog/copy/payload changes, and privacy tests needed before Phase 22 group member selection.
</domain>

<spec_lock>
`21-SPEC.md` locks 7 requirements. Downstream work must not reintroduce email chat discovery or broad username directory behavior.
</spec_lock>

<decisions>
## Implementation Decisions

### Username Lookup And Direct Chat
- **D-21-01:** Use exact username lookup only. Do not add autocomplete, search-as-you-type, or a public directory.
- **D-21-02:** Keep `POST /api/chat/create-new-chat` as the direct-chat creation endpoint, but replace `targetEmail` with `targetUsername`.
- **D-21-03:** Reject email-only payloads without an email database lookup. Error copy should refer to username, not email.
- **D-21-04:** Add a protected exact lookup endpoint under the user route surface, recommended as `GET /api/user/lookup/:username`.
- **D-21-05:** Lookup and direct-chat target resolution use the Phase 20 `validateUsername` normalization contract.
- **D-21-06:** Success payloads return public identity only. Owner account/auth endpoints remain the only place email is expected.

### UI And State
- **D-21-07:** Rename frontend chat-start state and props from email to username where touched by this phase.
- **D-21-08:** New-chat dialog uses username label, text input, `ahmed.musa` style placeholder, username helper/error copy, and no email wording.
- **D-21-09:** Client-side validation should use the mirrored username validator to prevent obviously invalid requests.
- **D-21-10:** On success, keep current behavior: select returned chat, close dialog, clear input/error, and leave cache handling in `useCreateChat`.

### Privacy And Verification
- **D-21-11:** Runtime chat discovery files must not contain email-oriented start-chat copy or `targetEmail` payload contracts after this phase.
- **D-21-12:** Focused searches should classify remaining email references as auth/reset/account or unrelated pre-existing contexts only.
- **D-21-13:** Tests must prove invalid username, missing username, self-target, repeated direct chat, and no email in lookup/chat responses.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/phases/21-username-based-contact-discovery/21-SPEC.md` - locked requirements.
- `.planning/phases/20-username-identity-and-privacy-foundation/20-VERIFICATION.md` - username/privacy foundation evidence.
- `Backend/Chatify/Utils/usernameValidation.mjs` - backend username normalization and validation.
- `Backend/Chatify/Controller/chatController.mjs` - direct chat creation.
- `Backend/Chatify/Controller/userController.mjs` - public identity serializers and lookup route.
- `Frontend/Chatify/src/utils/usernameValidation.ts` - frontend username validation.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - route-level chat orchestration and start-chat submission.
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx` - dialog UI.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - sidebar props/copy.
</canonical_refs>

<code_context>
## Existing Integration Points

- Backend direct chat currently validates `targetEmail` and resolves `User.findOne({ email })`.
- Direct chat idempotency is already protected by member-id `directKey`; preserve it.
- Frontend `CreateChatPayload` currently uses `targetEmail`.
- `chat.tsx` owns the new-chat input state, client validation, mutation call, and success/error behavior.
- `ChatSidebar` passes the input state to `NewChatDialog`.
- `NewChatDialog` owns visible labels, placeholder, input type, focus trap, and error rendering.
</code_context>

<deferred>
## Deferred Ideas

- Broad username directory/autocomplete.
- Group member picker and group creation.
- Username login.
- Username rename policy.
</deferred>

---

*Phase: 21-username-based-contact-discovery*
*Context gathered: 2026-06-18*
