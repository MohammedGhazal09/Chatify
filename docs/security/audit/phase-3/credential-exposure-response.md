# Credential Exposure Response Procedure

## Purpose

This procedure governs every suspected credential, token, private key, authenticated URI, or signing secret discovered in Chatify source, Git history, CI output, retained artifacts, screenshots, logs, or provider configuration. Its first priority is containment. Repository cleanup does not replace revocation or rotation.

## Safety rules

- Do not paste the candidate into issues, pull requests, chat, terminals with command history, ticketing systems, or audit documents.
- Do not replay a candidate against an API, database, OAuth provider, SMTP service, TURN relay, or production endpoint to test whether it works.
- Refer to a finding only by the sanitized Phase 3 candidate ID, detector, file location, and provider or secret name.
- Restrict provider-console and deployment access to authorized responders.
- Preserve only metadata needed for investigation. Never add the raw value or a value hash to committed evidence.

## Initial triage

1. Record the candidate ID, detector, scope, path, line, first-seen commit, last-seen commit, reporter, and discovery time.
2. Identify the likely owner from the variable name, surrounding component, deployment environment, and provider account inventory.
3. Classify it as one of:
   - confirmed live credential;
   - previously valid but already revoked;
   - synthetic or documented placeholder;
   - public identifier or non-secret value;
   - unresolved candidate requiring an authorized owner.
4. Treat private keys, production database credentials, JWT or CSRF signing material, OAuth client secrets, deployment credentials, and administrator-capable tokens as urgent until disproved.
5. Use the Phase 3 allowlist only for a proven false positive or intentionally synthetic fixture. An entry requires the exact candidate ID, an owner, a specific rationale, and an expiry date.

## Provider-side validation

Validate ownership and status through the owning provider's credential inventory and audit logs. Do not use the discovered value itself. Confirm:

- the credential or key identifier;
- environment and account ownership;
- creation, last-use, restriction, and revocation state;
- permissions and reachable assets;
- suspicious use since the first possible exposure;
- whether copies exist in deployment variables, CI secrets, logs, artifacts, forks, releases, or backups.

If provider metadata cannot prove that a candidate is harmless, rotate it.

## Immediate containment

1. Revoke or disable the exposed credential where the provider supports immediate revocation.
2. Block the affected integration, deployment, database identity, OAuth client, or signing operation when rotation cannot be completed atomically.
3. Restrict network access and permissions for the affected identity.
4. Preserve sanitized provider audit records and timestamps.
5. For suspected account or signing compromise, invalidate dependent sessions before restoring normal traffic.

## Rotation order

Rotate in an order that prevents a newly issued credential from being written back to an exposed location:

1. Remove the value from source, history-writing automation, logs, fixtures, screenshots, artifacts, and documentation.
2. Create a replacement in the authorized provider or secret manager.
3. Update protected deployment configuration without printing the value.
4. Deploy the replacement through an approved immutable artifact.
5. Verify service health and authorized functionality.
6. Revoke the old credential if it was not revoked during containment.
7. Review provider logs again after the old credential is unusable.

## Chatify-specific actions

| Secret class | Required response |
| --- | --- |
| `SECRET_JWT_KEY` | Replace the key, deploy all API and Socket.IO instances together, invalidate all access and refresh sessions, and require reauthentication. |
| `CSRF_SECRET` | Replace the key, deploy all API instances together, invalidate existing CSRF cookies, and verify state-changing requests reject pre-rotation tokens. |
| `PASSWORD_RESET_SECRET` | Replace the key, delete or invalidate outstanding password-reset records, and notify users if reset links or codes may have been exposed. |
| `TWO_FACTOR_ENCRYPTION_KEY` | Treat as potential disclosure of stored TOTP seeds. Rotate through a planned re-encryption or forced 2FA re-enrollment process; do not overwrite it without a recovery design. |
| MongoDB credential or authenticated URI | Disable or rotate the database user, review authentication/query logs, restrict network access, and verify backups and connection strings. |
| OAuth client secret | Rotate in the provider console, update protected deployment variables, verify exact redirect URIs, and review account-linking and callback activity. |
| Brevo or email credential | Revoke and rotate, inspect sending activity and templates, and disable notification workers during containment if necessary. |
| VAPID private key | Replace the key pair, update server and frontend public-key configuration, and expect existing subscriptions to require renewal. |
| TURN credential | Rotate or expire the credential, review relay usage and cost, restrict relay policy, and update all call clients. |
| GitHub, CI, or deployment token | Revoke immediately, inspect repository, workflow, environment, artifact, and deployment activity, and review all credentials accessible to the token. |
| TLS, SSH, or other private key | Revoke the certificate or key authorization, issue a new key pair, and inspect authentication or certificate-transparency evidence as applicable. |

## Session and dependent-secret invalidation

A rotation is incomplete until dependent authorization state is addressed:

- revoke all Chatify refresh-session families when JWT signing material may be compromised;
- terminate already-connected Socket.IO sessions after authentication-key compromise;
- invalidate reset, OAuth handoff, invitation, integration, and unsubscribe tokens when their protecting material is affected;
- rotate downstream credentials exposed to a compromised CI or deployment identity;
- clear browser, CDN, service-worker, and proxy caches that may contain authenticated responses or tokens.

## Repository and artifact cleanup

1. Remove the value from the current tree and add a regression test or scanner rule.
2. Scan all reachable branches, tags, pull-request refs, and deleted blobs again.
3. Inspect GitHub Actions logs and artifacts, release assets, package artifacts, screenshots, test reports, forks, and mirrors.
4. Rewrite Git history only after rotation and only when the operational benefit exceeds the coordination risk. History rewriting does not revoke a credential and cannot erase existing clones or caches.
5. Record which locations cannot be purged and the compensating controls applied.

## Verification

Run from a full-history checkout:

```bash
npm run security:phase3:test
npm run security:phase3:generate
npm run security:phase3:check
npm run security:phase3:reproduce
```

Then verify through authorized provider consoles that:

- the old credential is disabled;
- the replacement is restricted and functioning;
- unexpected use has stopped;
- relevant sessions and dependent tokens are invalidated;
- CI and deployment logs contain no credential values;
- the Phase 3 report contains no unsuppressed candidates.

## Incident record and closure

The incident record must contain the candidate ID, affected systems and time window, containment and rotation timestamps, provider-log conclusions, user or regulatory notification decisions, residual locations, regression controls, owner, and closure approval. It must not contain the credential value.
