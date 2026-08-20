# Phase 32 UI Spec

## Surface

Update the existing Settings modal notification section. Do not add a landing page or new navigation surface.

## Controls

- Keep `Sound` as a local toggle.
- Keep `Browser alerts` as the current local browser permission toggle for active browser sessions.
- Add `Push notifications` as a server-backed opt-in toggle.
- Add `Email notifications` as a server-backed opt-in toggle.
- Keep muted conversation count visible and driven by the synchronized muted chat IDs.

## States

- Loading: disable server-backed push/email toggles and show concise loading copy in the notification section.
- Saving: keep the clicked toggle disabled until the request settles.
- Error: show a short inline error that the preference could not be saved; retain the previous effective value.
- Unsupported push: if PushManager/service worker support or public VAPID key is absent, show unavailable guidance and keep the push toggle disabled.
- Browser permission denied: preserve existing blocked guidance.

## Copy Rules

- Do not show message text, attachment names, or sender email in notification settings.
- Explain privacy in user-facing copy with short operational language: external notifications use generic copy unless previews are explicitly supported in a later phase.
- Keep labels compact and scannable inside the existing modal density.

## Accessibility

- Toggles must expose `aria-pressed` and clear accessible labels.
- Error and save states must be reachable by screen readers through existing modal flow.
- Text must fit in the modal at mobile widths without overlapping controls.
