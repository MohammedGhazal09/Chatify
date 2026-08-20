# Phase 52 UI Spec

## Surface

Add an encrypted recovery panel inside `ConversationDetailContent` under the current encrypted conversation notice or security section. This single component renders in both the desktop rail and mobile drawer.

## States

- Has secret:
  - Show status "Recovery key ready on this device".
  - Show "Copy recovery key" action.
  - Explain that anyone with the key can read this encrypted conversation.
- Missing secret:
  - Show status "This device needs the recovery key".
  - Show recovery-key input and "Import key" action.
  - Show that attachments remain unavailable.
- Import success:
  - Show success status and switch to has-secret state.
- Import failure:
  - Show inline error without clearing the user's pasted value.
- Non-encrypted conversation:
  - Do not render the recovery panel.

## Layout

- Use existing chat detail rail styling: compact bordered panel, 8px radius or existing `--chat-radius-md`.
- Avoid nested cards; use inline rows and a single panel.
- Buttons should use icons from lucide where useful.
- Text must wrap safely in the narrow mobile drawer.
- Recovery key text must not be shown in screenshots by default.

## Visual QA

- Desktop encrypted detail rail with recovery ready state.
- Mobile encrypted detail drawer with missing-secret import state.
- Encrypted composer with attachments/voice disabled remains unchanged and non-overlapping.
