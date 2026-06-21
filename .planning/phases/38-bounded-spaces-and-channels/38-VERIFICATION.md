# Phase 38 Verification

## Backend Focused

Command:

```powershell
npm test -- test/space/space.contract.test.mjs test/space/space.membership.test.mjs test/space/space.messaging.test.mjs test/space/space.socket.test.mjs test/notification/notification.outbox.test.mjs test/moderation/moderation.report.test.mjs test/moderation/abuse-report.test.mjs test/chat/chat.group.test.mjs test/message/message.mutations.test.mjs
```

Result:

- Passed: 9 files
- Passed: 39 tests

## Frontend Focused

Command:

```powershell
npm test -- spaceApi.test.ts useSpaceQueries.test.tsx SpacesSidebar.test.tsx SpaceCreateDialog.test.tsx ConversationPane.test.tsx useChatSocket.test.tsx ChatSidebar.test.tsx
```

Result:

- Passed: 7 files
- Passed: 64 tests

## Frontend Quality

Commands:

```powershell
npm run lint -- --quiet
npm run build
```

Result:

- Lint passed.
- Build passed with `tsc -b` and Vite production build.

## Operations

Command:

```powershell
npm run ops:check
```

Result:

- `npm run ops:check` passed.

## Traceability

Command:

```powershell
node C:\Users\saieh\.codex\get-shit-done\bin\gsd-tools.cjs query verify phase-completeness 38
```

Result:

- Passed with 4 plans, 4 summaries, no incomplete plans, no orphan summaries, no errors, and no warnings.
