# Phase 52 Discussion Log

## Decision

Use a local recovery key rather than server key escrow.

## Rationale

- Existing encryption is browser-local AES-GCM with secrets stored in localStorage by chat id.
- Server escrow would require a new threat model, backup encryption design, rotation story, and account compromise analysis.
- A local recovery key closes the immediate cross-device usability gap without making the backend able to decrypt message text.

## Recommended Defaults

- Recovery key format: versioned text wrapper over the existing base64 256-bit secret.
- Display: masked status by default; copy action only, no always-visible raw secret.
- Import: textarea/input in the encrypted conversation detail panel.
- Validation: strict version, chat id binding, base64 decode, 32-byte key length.
- Attachment posture: continue blocking encrypted attachments until encrypted upload is intentionally implemented.

## Risks

- A copied recovery key can decrypt the conversation. UI must make that explicit.
- Browser clipboard APIs can fail in non-secure or test contexts, so the UI should show a clear failure state.
- Importing the wrong key can make encrypted messages fail to decrypt. The key format should bind to the current chat id to catch obvious mistakes.
