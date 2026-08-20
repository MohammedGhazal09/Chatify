# Phase 51 Research

## Code Probes

- `Frontend/Chatify/src/App.tsx` currently registers `/admin/moderation` and `/admin/delivery-health`, but no `/admin` route.
- `Frontend/Chatify/src/pages/admin` contains `AdminModeration.tsx` and `AdminDeliveryHealth.tsx`.
- `Frontend/Chatify/src/hooks/useModerationReports.ts` provides `useModerationOpsSummary()`.
- `Frontend/Chatify/src/hooks/useDeliveryHealth.ts` provides `useDeliveryHealth(windowKey)`.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` contains the current admin shortcut.
- `Frontend/Chatify/src/i18n/locales.ts` already contains English/Arabic admin namespaces.

## Risks

- Calling admin APIs for non-admin users would create avoidable 403 noise. Existing hooks are admin-enabled, but the hub should still render non-admin before relying on data.
- Adding raw report or conversation details to the hub would weaken privacy posture. Use counts and statuses only.
- A separate visual style could make admin pages feel inconsistent. Reuse chat theme primitives.

## Recommendation

Create `AdminHub.tsx` with focused tests and a Playwright spec. Do not refactor existing admin pages unless the hub needs shared primitives.
