# Phase 45 Discussion Log

## Decisions

- Recommended and selected: TOTP plus backup codes, local accounts only.
- Recommended and selected: no cookies are issued at password login when 2FA is enabled.
- Recommended and selected: preserve existing access/refresh session mechanics after second-factor success.
- Recommended and selected: store login challenges in MongoDB with hashed challenge tokens and TTL expiry.
- Recommended and selected: encrypt TOTP secrets and hash backup codes.
- Recommended and selected: add 2FA controls to the existing Settings Security section.

## Alternatives Considered

- SMS OTP: rejected for delivery complexity and weaker security.
- Email OTP: rejected for account takeover blast radius and overlap with password reset.
- WebAuthn/passkeys: deferred because it needs a dedicated UX/recovery design.
- OAuth-account 2FA in Chatify: deferred because provider-owned MFA is clearer and safer for this phase.
- Adding a TOTP dependency: deferred to avoid package churn; helper tests will cover the local implementation.

## Recommendation For Future Phases

Add WebAuthn/passkeys as a separate phase after TOTP is stable. It should include recovery policy, device naming, attestation policy, and account lockout handling.
