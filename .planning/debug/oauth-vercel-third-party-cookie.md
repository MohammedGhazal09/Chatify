---
status: fixed
trigger: "Logging in with Google, GitHub, Discord works for the owner on Vercel hosting, but not for other visitors."
created: 2026-06-14
updated: 2026-06-28
---

# Debug Session: OAuth Vercel Third Party Cookie

## Symptoms

- Expected behavior: Any valid Google, GitHub, or Discord user can complete OAuth from `https://chatify-ten-rho.vercel.app/` and land in an authenticated Chatify session.
- Actual behavior: OAuth works for the owner but fails for other visitors.
- Error messages: No user-facing provider/browser error was provided.
- Timeline: Reported against the current Vercel deployment.
- Reproduction: Open the hosted Vercel app and try Google, GitHub, or Discord login from a browser/account outside the owner's known-good environment.

## Current Focus

- hypothesis: The providers complete OAuth, but production traffic mixes Vercel frontend and Render backend origins, so the access-token cookie becomes a third-party cookie for other visitors.
- test: Inspect checked-in OAuth callback URLs, frontend login URLs, Vercel rewrites, and live redirect headers; patch production traffic to use a same-origin Vercel proxy.
- expecting: OAuth initiation, callbacks, HTTP API requests, and Socket.IO handshakes resolve through the Vercel origin unless explicitly opted out.
- next_action: Apply focused deployment-origin patch and run frontend/backend regression checks.

## Evidence

- 2026-06-14: Live `https://chatify-ckmn.onrender.com/api/auth/google` redirects to Google with `redirect_uri=https://chatify-ckmn.onrender.com/api/auth/google/callback`.
- 2026-06-14: Live `https://chatify-ten-rho.vercel.app/api/auth/google` returns the SPA HTML, proving Vercel currently rewrites `/api/auth/google` to `/index.html`.
- 2026-06-14: `Frontend/Chatify/src/pages/login/login.tsx` builds OAuth URLs from `VITE_BACKEND_URL`, while `signup.tsx` uses `/api/auth/...`.
- 2026-06-14: `Frontend/Chatify/vercel.json` only has a catch-all SPA rewrite, so no API or Socket.IO traffic is proxied before the frontend fallback.
- 2026-06-14: `Backend/Chatify/Config/passport.mjs` hard-codes the production OAuth callback base to Render.
- 2026-06-14: After the same-origin proxy patch was deployed, live Google OAuth sends `redirect_uri=https://chatify-ten-rho.vercel.app/api/auth/google/callback`, which Google rejects with `redirect_uri_mismatch` because the provider app is still registered for the Render callback.
- 2026-06-14: Production resolver check now emits provider callback base `https://chatify-ckmn.onrender.com` and final cookie handoff base `https://chatify-ten-rho.vercel.app`.
- 2026-06-14: OAuth handoff review found that a signed URL token alone could be replayed or used for session swap if leaked. The finalizer now requires the original first-party state cookie and consumes a one-time database handoff record before setting `accessToken`.
- 2026-06-14: Live `https://chatify-ten-rho.vercel.app/api/auth/google` still returns the old Vercel callback redirect before deployment of this backend fix.
- 2026-06-28: Commit `59c5e72` regressed `resolveOAuthCallbackBaseURL()` to fall back to `FRONTEND_ORIGIN`; live Google initiation then emitted `redirect_uri=https://chatify-ten-rho.vercel.app/api/auth/google/callback`, which does not match the registered Render callback.

## Eliminated

- hypothesis: The issue is one provider-specific OAuth route.
  evidence: Google, GitHub, and Discord share the same callback/cookie/origin pattern.

## Resolution

- root_cause: Production OAuth originally mixed `chatify-ten-rho.vercel.app` with `chatify-ckmn.onrender.com`, so Render-domain auth cookies were not reliably first-party for Vercel visitors. The first same-origin callback patch fixed the cookie target but broke provider authorization because Google/GitHub/Discord still had the Render callback registered.
- fix: Keep provider callbacks on the registered backend origin by default, then redirect through a short-lived OAuth handoff to `https://chatify-ten-rho.vercel.app/api/auth/oauth/finalize`. The handoff is bound to the OAuth `state` cookie that was set on the Vercel origin, backed by a one-time MongoDB record, and consumed before the finalizer sets the first-party Vercel `accessToken` cookie.
- verification: `npm run test -- auth/oauth-config.test.mjs auth/auth.lifecycle.test.mjs`; production resolver check: `callback=https://chatify-ckmn.onrender.com`, `finalize=https://chatify-ten-rho.vercel.app`. Rechecked on 2026-06-28 with 19 tests passing and the default callback fallback restored to Render.
- files_changed: `Backend/Chatify/Utils/oauthConfig.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Routes/authRouter.mjs`, `Backend/Chatify/test/auth/oauth-config.test.mjs`, `Backend/Chatify/test/auth/auth.lifecycle.test.mjs`, plus the prior Vercel same-origin proxy/frontend resolver changes.
