# Phase 47 Context

## Codebase Findings

- Spaces already have permanent `joinCode` support in `Backend/Chatify/Models/spaceModel.mjs`, `Backend/Chatify/Controller/spaceController.mjs`, `Backend/Chatify/Utils/spaceAccess.mjs`, and `Frontend/Chatify/src/pages/chat/components/SpacesSidebar.tsx`.
- Permanent space join codes are manager-visible and join through `/api/space/join`.
- Group conversations have `groupAdmin`, 3-to-10 member validation, and no current self-serve invite flow.
- Space management already has owner/admin checks through `canManageSpace`.
- Chat and space joins already use `joinUserToChat`, `emitToUserSockets`, and public member serialization helpers.
- The frontend already has APIs/hooks for chat, spaces, and query-cache updates.

## Locked Decisions

- Keep existing space `joinCode` behavior for backward compatibility during Phase 47.
- Add a new invite-link model rather than overloading `joinCode`.
- Store only `tokenHash`; return the raw invite URL only in create responses.
- Scope invite links to `group` and `space`.
- Reject direct chats and encrypted conversations.
- Group invite creation requires `groupAdmin`.
- Space invite creation requires owner/admin `canManageSpace`.
- Default expiry is 7 days; supported expiry presets are 1, 7, and 30 days.
- Supported max-use presets are 1, 5, 10, or unlimited, still bounded by the target member cap.
- Already-member joins return success with `alreadyMember: true` so links are recoverable rather than hostile.
- Link join route is protected at `/invite/:token`.

## Deferred

- Unauthenticated invite preview.
- Automatic return to an invite after login.
- Invite email/SMS sending.
- QR codes.
- Custom role grants.
- Vanity links or custom slugs.
- Admin analytics for invites.
- Full audit log UI.

## Recommended Implementation Shape

1. Backend invite model, utilities, controller, router, and tests.
2. Frontend invite API/hooks, management UI in group/space surfaces, join route, and tests.
3. Visual QA and traceability closeout.
