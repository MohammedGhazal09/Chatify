# Phase 20: Username Identity And Privacy Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution work.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 20-username-identity-and-privacy-foundation
**Areas discussed:** Username storage and validation, API contract, signup and setup gate, public identity and email privacy, UI direction, verification

---

## Username Storage And Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Strict normalized handle | 3-24 lowercase characters, starts with letter/number, allows letters/numbers/underscore/dot, separator limits, reserved names | yes |
| Loose display handle | Accept broader characters and casing, then resolve collisions later | |
| Generated handles for existing users | Derive handles from existing names, emails, or ids | |

**User's choice:** Approved recommendation through the active goal.
**Notes:** Strict normalized handles support privacy-safe discovery and avoid email-derived public identifiers.

---

## API Contract

| Option | Description | Selected |
|--------|-------------|----------|
| User-route PATCH endpoint | Add `PATCH /api/user/username`, protected by auth and CSRF | yes |
| Auth-route mutation | Put username setup under auth routes | |
| Account settings mutation only | Only allow username changes from settings after chat loads | |

**User's choice:** Approved recommendation through the active goal.
**Notes:** The user route matches existing account/identity ownership. The endpoint is first-time setup only and returns the account-safe current user.

---

## Signup And Existing-User Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Require signup username and gate missing users | New local signup requires username; existing/OAuth users without username must complete setup before chat | yes |
| Optional username until discovery | Let users enter chat and ask later when discovery is used | |
| Auto-generate usernames | Generate handles for older users to avoid a setup gate | |

**User's choice:** Approved recommendation through the active goal.
**Notes:** Mandatory setup prevents later username discovery and group flows from depending on private email.

---

## Public Identity And Email Privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-only email | Auth/account/reset contexts may return email to owner; public identity/contact/presence surfaces do not | yes |
| Hide email everywhere | Remove email from all frontend-visible responses, including owner account state | |
| Keep current payloads | Continue returning email where existing user-shaped objects include it | |

**User's choice:** Approved recommendation through the active goal.
**Notes:** Owner-only email preserves login/reset/account functionality while moving public discovery away from email.

---

## UI Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Auth-style field and setup surface | Add username to signup and add a focused mandatory setup page using existing auth visual language | yes |
| Chat-modal setup | Display username setup as a modal over chat | |
| Marketing-style onboarding | Create a larger explanatory onboarding page | |

**User's choice:** Approved recommendation through the active goal.
**Notes:** A route-level setup surface is refresh-safe and avoids exposing chat before the required identity step is complete.

---

## Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Backend, frontend, and privacy checks | Add focused model/route/auth tests, frontend validation/route tests, and email-exposure searches | yes |
| Backend-only evidence | Prove persistence and signup only | |
| Manual verification only | Rely on local manual testing | |

**User's choice:** Approved recommendation through the active goal.
**Notes:** The phase is security and privacy sensitive, so tests and explicit search evidence are required before Phase 21.

---

## Agent Discretion

- Exact helper/component filenames may follow local patterns.
- The implementation may add the smallest missing test setup necessary for Phase 20 evidence.

## Deferred Ideas

- Username-based direct chat creation belongs to Phase 21.
- Group conversations and username-selected member picking belong to Phase 22.
- Username login, username changes, public directory/autocomplete, moderation/admin tooling, and broader v2 platform features are deferred.
