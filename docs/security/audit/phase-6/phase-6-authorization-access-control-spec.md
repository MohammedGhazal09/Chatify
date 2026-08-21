# Security Audit Phase 6 — Authorization and Access Control Specification

## Purpose

Phase 6 converts the authorization invariants from the Phase 2 threat model into explicit, fail-closed runtime controls and deterministic evidence. It covers object-level, function-level, role-level, membership, administrator, integration, storage-adjacent, and Socket.IO room authorization after Phase 5 has established a verified authenticated identity and active session.

This phase is stacked on the exact Phase 5 commit `49e3cb8bd7bd8970d5e57ac2394f51b2dbfd28a1`. It must not modify `main` or any Phase 1–5 branch.

## Security objectives

1. Every Phase 1 HTTP route and every client-to-server Socket.IO listener has one explicit authorization contract. A new or renamed surface that is absent from the committed contract fails the phase.
2. User-supplied identifiers never confer authority. Chat, message, attachment, saved-message, invite, space, moderation, integration, session, and profile resources are re-authorized against current server-side state at the operation that uses them.
3. Inaccessible private objects use an opaque not-found response where existence itself is sensitive. Malformed identifiers do not bypass the same authorization boundary.
4. Group-manager actions require the current group administrator to remain a current member of the standard group. A stale `groupAdmin` field is not sufficient authority.
5. Space membership and role changes are fail-closed. Only the owner may grant administrator authority or remove an administrator. Space administrators may manage ordinary members but may not grant peer authority, remove the owner, or remove peer administrators.
6. Space membership mutations re-check actor authority in the atomic database mutation so a concurrent demotion or removal cannot leave stale authorization in effect.
7. Message reads and conversation actions require current membership and visibility. Editing and deleting for everyone remain author-only. Attachment access remains derived from the stored attachment → message → chat relationship rather than a client-supplied chat identifier.
8. Integration application operations require current application ownership. Installing, rotating, or using a runtime credential also requires current authority over the installation target. Losing target-manager authority permanently revokes the runtime installation and produces only sanitized audit metadata.
9. Administrator routes load the current role from the database on every request. A role claim from a token, request body, query, or stale in-memory object is never sufficient.
10. Moderation review, enforcement history, assignment, appeal review, and operational summaries remain administrator-only, while appeals and requester privacy operations remain bound to the authenticated subject.
11. Every sensitive client-to-server Socket.IO event derives the actor from the verified handshake, validates bounded payloads, and re-authorizes current chat/message/call state. Room identifiers, claimed user identifiers, and previous room membership confer no authority.
12. Presence and public-profile disclosures remain relationship-scoped and block-aware. Ordinary user serialization does not expose private role fields, provider identifiers, hashes, storage identifiers, or unrelated peer PII.
13. Deterministic Phase 6 JSON and Markdown evidence is generated from the exact Phase 1 inventory, the reviewed authorization contract, and source controls. Drift, stale mappings, missing controls, or failing runtime regressions blocks the phase.

## Compatibility constraints

- Keep Express, MongoDB/Mongoose, Socket.IO, the existing route paths, cookie names, response envelopes, models, and frontend API contracts.
- Add no runtime or development dependencies.
- Preserve existing public-profile, contact, conversation, message, invite, space, moderation, integration, and administrator functionality except where Phase 6 intentionally removes stale or excessive authority.
- Do not modify `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Do not rely on token role claims or client-supplied user IDs.
- Use Node.js `24.19.0` and npm `11.17.0` exactly in permanent CI.

## Authorization classes

The committed Phase 6 contract assigns every surface one of these identities and resource scopes:

- `public`: no authenticated identity; only health, readiness, CSRF issuance, OAuth initiation/callback, and bounded authentication exchanges.
- `session-self`: the active authenticated subject may act only on their own account, session, preferences, privacy requests, and private organization state.
- `relationship`: the active subject may read only users with a current shared-chat relationship and no active block boundary.
- `chat-member`: current chat membership is required at use time.
- `chat-manager`: current standard-group membership and `groupAdmin` authority are both required.
- `message-member`: authorization derives from the stored message or attachment relationship to a current member chat.
- `message-author`: the stored message sender must equal the authenticated subject.
- `space-member`: current membership in the exact space is required.
- `space-manager`: current owner/admin membership is required.
- `space-owner`: current owner membership is required for administrator-role changes.
- `invite-manager`: current group-admin or space-manager authority is required for management; possession of a valid active token is required for join.
- `integration-owner`: current application ownership is required.
- `integration-target-manager`: current application ownership plus current target-manager authority is required.
- `integration-runtime`: a hashed active runtime credential whose app and target authority remain current is required.
- `moderation-self`: the enforcement or appeal must belong to the authenticated subject.
- `admin`: a current database-backed administrator role is required.
- `socket-identity`, `socket-chat-member`, `socket-message-member`, and `socket-call-participant`: the verified socket subject plus current stored resource state is required.

## Required implementation boundaries

### Central authorization decisions

Create `Backend/Chatify/Utils/authorizationAccess.mjs` with pure, reusable decisions:

- `SPACE_ROLE_MUTATIONS`
- `assertSpaceRoleAssignmentAllowed({ space, actorId, requestedRole }): void`
- `assertSpaceMemberRemovalAllowed({ space, actorId, targetMember }): void`
- `buildSpaceAuthorityFilter({ actorId, permission }): object`
- `assertCurrentGroupAdmin({ chat, actorId }): void`

The helper must use server-loaded role and membership state, return no private data, and use opaque errors for private resources.

### Space role containment

`addSpaceMember` must calculate the requested role once, reject administrator grants from non-owners, and perform the insertion with an atomic filter that still contains the actor’s required role, excludes the target, and enforces the member cap.

`removeSpaceMember` must reject owner removal, reject peer-admin removal by a non-owner, and perform the removal with an atomic filter that still contains the actor’s required role. Channel membership and socket rooms are updated only after the space mutation succeeds.

### Integration target authority

Extend `Backend/Chatify/Utils/integrationPermissions.mjs` with:

- `assertIntegrationTargetAuthority({ targetType, targetId, userId }): Promise<object>`
- `assertIntegrationInstallationAuthority({ installation, userId }): Promise<object>`
- `revokeIntegrationForLostTargetAuthority(installation): Promise<void>`

Standard-group targets must require both current membership and current `groupAdmin` equality. Space targets must require a current owner/admin membership entry. Token rotation must re-check target authority. Runtime authentication must revoke and deny an installation when its installer no longer controls the target or the target no longer exists.

### Surface authorization contract

Create `scripts/security/phase6-authorization-contract.json`. It must contain an exact entry for every `entryPoints.httpRoutes` item and every client-to-server listener in `entryPoints.socketEvents` from the Phase 1 inventory. Each entry records identity class, resource class, mutation state, private-object concealment, and evidence paths. Duplicate, missing, stale, or under-classified entries fail closed.

### Deterministic evidence and automation

Create:

- `scripts/security/lib/authorization-policy.mjs`
- `scripts/security/lib/phase6-reproduction.mjs`
- `scripts/security/phase6-authorization-policy.mjs`
- `scripts/security/phase6-reproduce.mjs`
- `scripts/security/__tests__/phase6-authorization-policy.test.mjs`
- `scripts/security/__tests__/phase6-reproduction.test.mjs`
- `docs/security/audit/phase-6/authorization-policy.json`
- `docs/security/audit/phase-6/authorization-policy.md`
- `docs/security/audit/phase-6/README.md`
- `.github/workflows/security-phase-6-authorization-access-control.yml`

Add root scripts `security:phase6:test`, `security:phase6:generate`, `security:phase6:check`, and `security:phase6:reproduce`.

Phase 1 and Phase 3 must exclude the generated Phase 6 policy files from their repository/history digests, with regressions proving downstream evidence cannot recursively make earlier phases stale.

## Required runtime regressions

The Phase 6 focused backend suite must prove:

- a space administrator cannot add a new administrator;
- a space administrator cannot remove another administrator, while the owner can;
- a concurrent loss of space authority prevents a stale membership mutation;
- a stale standard-group `groupAdmin` who is no longer a member cannot install an integration;
- a runtime integration token is rejected and the installation is revoked after the installer loses target-manager authority;
- a removed target manager cannot rotate the installation token;
- an ordinary user cannot read administrator diagnostics, and an existing session loses access immediately after database demotion;
- foreign chat, message, invite, space, and installation identifiers do not grant read or mutation authority;
- message author-only operations remain author-only and attachment authorization follows the stored relationship;
- a socket cannot use a claimed user ID, stale room membership, foreign message ID, or foreign call session to act as another user;
- every existing client-to-server listener has a named authorization contract and a new listener fails the deterministic gate.

## Phase exit gate

Phase 6 is complete only when all of the following are true on one immutable branch head:

- Phase 1–6 unit and policy tests pass.
- Phase 1–6 generated evidence checks are current.
- The focused Phase 6 authorization regression suite and inherited chat, message, space, invite, integration, moderation, administrator, privacy, and socket authorization suites pass.
- The complete backend test suite passes.
- The complete frontend test, lint, and production-build suite passes.
- The operations guard and Phase 4 live supply-chain gates pass.
- The permanent foundation and Phase 1–6 workflows complete successfully on the exact head.
- No temporary source-export, finalizer, materialization, force-push, or self-deleting workflow remains in the proposed tree.
- The pull request remains stacked on `security/phase-5-authentication-session` and is not merged automatically.
