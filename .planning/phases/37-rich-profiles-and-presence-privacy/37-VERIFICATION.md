# Phase 37 Verification

## Backend Focused

Command:

```powershell
npm test -- user.profile.test.mjs socket.presence-reconnect.test.mjs socket.blocking.test.mjs
```

Result:

- Passed: 3 files
- Passed: 15 tests

## Frontend Profile And Privacy

Command:

```powershell
npm test -- SettingsModal.test.tsx useProfileImageMutation.test.tsx presenceStore.test.ts
```

Result:

- Passed: 3 files
- Passed: 28 tests

## Frontend Conversation And Realtime

Command:

```powershell
npm test -- ConversationDetailContent.test.tsx ConversationHeader.test.tsx presenceStore.test.ts useChatSocket.test.tsx
```

Result:

- Passed: 4 files
- Passed: 33 tests

## Frontend Combined Focused

Command:

```powershell
npm test -- SettingsModal.test.tsx useProfileImageMutation.test.tsx presenceStore.test.ts ConversationDetailContent.test.tsx ConversationHeader.test.tsx useChatSocket.test.tsx
```

Result:

- Passed: 6 files
- Passed: 59 tests

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
node C:\Users\saieh\.codex\get-shit-done\bin\gsd-tools.cjs query verify phase-completeness 37
```

Result:

- Passed with 4 plans, 4 summaries, no errors, and no warnings.
