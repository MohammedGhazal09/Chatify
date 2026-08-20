---
phase: 21
plan: 21-01
status: completed
completed_at: 2026-06-18
commit: 73de80a
---

# 21-01 Summary: Backend Username Direct-Chat Contract

## Completed

- Changed `POST /api/chat/create-new-chat` from `targetEmail` to `targetUsername`.
- Reused the shared backend `validateUsername` helper for normalization and validation.
- Preserved direct-chat `directKey` idempotency, membership population, latest-message projection, and socket notification behavior.
- Added protected exact lookup at `GET /api/user/lookup/:username`.
- Kept lookup responses on the public identity serializer so email and private profile image storage fields are not exposed.
- Replaced backend direct-chat tests with username payload coverage and added explicit legacy `targetEmail` rejection.

## Verification

- `cd Backend/Chatify; npm test -- --run test/chat/chat.direct.test.mjs test/user/user.identity.test.mjs test/security/csrf.test.mjs test/message/message.pagination.test.mjs`
- Result: 4 files passed, 23 tests passed.

## Notes

- Missing target usernames and invalid username syntax return validation errors.
- Missing users and self-target direct chats use the same generic start-chat failure copy to avoid exposing account existence details.
