# Security Audit Phase 16 — Frontend and Browser Security

Phase 16 validates Chatify's browser-side confidentiality, integrity, navigation, API-client isolation, route guards, deployed browser policy, build disclosure, and security UX against the active React/Vite application.

## Implemented controls

### Untrusted rendering and script execution

- Active message, profile, moderation, attachment, and administrative UI surfaces rely on React text rendering rather than direct HTML injection.
- The application document no longer executes the unpinned third-party `cdnflow.co` script.
- The deployment content-security policy restricts scripts to the application origin and disables plugin/object execution and framing.

### Navigation and service origins

- Post-authentication redirects accept only normalized local application paths and reject external, protocol-relative, backslash, control-character, script/data URL, and authentication-loop destinations.
- Production API and Socket.IO origins must be credential-free HTTPS origins without paths, queries, or fragments.
- Development HTTP overrides are limited to loopback hosts; the existing `http://localhost:3000` backend fallback is preserved.
- OAuth URLs are derived from the validated API origin rather than concatenated from an unchecked environment value.

### Credentialed API-client containment

- Axios validates the resolved request URL and any per-request base URL before cookies or CSRF headers are attached.
- Requests must remain on the configured API origin and under `/api`; absolute cross-origin, protocol-relative, credentialed, malformed, and non-API targets fail before the adapter or network layer runs.
- Refresh-token recovery remains single-flight and existing CSRF handling remains regression-tested.

### Authentication state and route guards

- Authentication state remains in memory through the Zustand store; access and refresh tokens remain server-owned HttpOnly cookies rather than browser storage values.
- All administrative browser routes now require an authenticated user whose server-returned role is `admin`.
- The browser guard is defense in depth and does not replace the backend's administrator middleware.
- Username setup and public authentication route behavior remain unchanged and regression-tested.

### Deployed browser policy and build disclosure

The Vercel deployment applies:

- a restrictive content-security policy with `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'`;
- `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- same-origin opener/resource isolation;
- camera and microphone access limited to the application origin;
- HSTS for HTTPS deployments.

Production source maps are explicitly disabled in `vite.config.ts` and the production TypeScript/Vite build is a permanent phase gate.

## Permanent verification

The dedicated workflow is:

- `.github/workflows/security-phase-16-browser-security.yml`

It runs:

- `src/security/browserSecurity.test.ts`
- `src/security/browserPolicy.test.ts`
- `src/api/apiOrigin.test.ts`
- `src/api/axios.test.ts`
- `src/components/protectedRoute.test.tsx`
- `src/hooks/useAuthRedirect.test.tsx`
- full frontend ESLint
- the production TypeScript/Vite build
- the production high-severity dependency audit
- patch-hygiene validation

## Phase boundary and residual risks

- The content-security policy retains inline styles for the existing React/Tailwind UI and permits HTTPS image sources for provider profile images. Removing those compatibility allowances requires a dedicated UI/provider migration rather than an untested policy change.
- Client-side administrator routing is not an authorization boundary; backend route middleware remains authoritative.
- Service-worker scope, cache isolation, notification-click destinations, push subscription cleanup, and logout/deletion lifecycle are intentionally assigned to Phase 17.
- Browser extensions, compromised user devices, and provider-hosted OAuth pages remain outside the repository's control.
