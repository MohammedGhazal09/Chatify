# Phase 51 Context

## Existing Admin Surfaces

- `/admin/moderation` is implemented by `Frontend/Chatify/src/pages/admin/AdminModeration.tsx`.
- `/admin/delivery-health` is implemented by `Frontend/Chatify/src/pages/admin/AdminDeliveryHealth.tsx`.
- Both pages use `user?.role === "admin"` for frontend gating and rely on protected backend APIs for real authority.
- Chat sidebar currently has a compact admin shortcut that points directly to `/admin/moderation`.

## Constraints

- Keep this phase frontend-only unless a backend gap is discovered.
- Reuse existing `useModerationOpsSummary` and `useDeliveryHealth` hooks.
- Keep admin hub copy aggregate-only and privacy-safe.
- Preserve the chat visual system by reusing `chat.css`, `useChatTheme`, and existing CSS variables.
- Use Playwright fallback for Hercules-style visual evidence because subagents are not allowed.

## Recommendation

Make `/admin` the default admin route and leave the existing admin pages as focused tools linked from the hub.
