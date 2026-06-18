---
phase: 22
status: drafted
created_at: 2026-06-18
---

# Phase 22 Research

## Code Findings

- The chat model already supports group flags and admin metadata.
- Message authorization appears member-based, so group chats can reuse existing message contracts if membership is populated correctly.
- Socket join/call code already differentiates group chats for call rejection.
- Frontend display helpers already use `chatName` for group titles and member counts in headers/details.
- The main missing pieces are:
  - backend group creation contract,
  - frontend group creation form,
  - test coverage for cap/privacy/error cases,
  - leak guard extension for group email privacy.

## Recommended Implementation Path

1. Add group creation controller and backend tests.
2. Add typed group creation API/mutation and dialog group mode.
3. Verify group list/header/detail surfaces render without emails.
4. Add source guard patterns and focused tests.

## Risk Notes

- Do not mutate `createChat` into a mixed direct/group endpoint; it would make direct chat regression harder to reason about.
- Do not add username autocomplete in this phase.
- Do not enable group calls from existing direct call controls.
