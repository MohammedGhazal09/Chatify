---
status: fixed
trigger: "Logging in with Google, GitHub, Discord works for the owner on Vercel hosting, but not for other visitors."
created: 2026-06-14
updated: 2026-06-14
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

## Eliminated

- hypothesis: The issue is one provider-specific OAuth route.
  evidence: Google, GitHub, and Discord share the same callback/cookie/origin pattern.

## Resolution

- root_cause: Production OAuth and API traffic mixed `chatify-ten-rho.vercel.app` with `chatify-ckmn.onrender.com`. Login initiated directly against Render in one path, `/api/auth/...` was swallowed by the Vercel SPA fallback in another path, Passport hard-coded callback URLs to Render, and cookies set on Render were then used from the Vercel app as third-party cookies.
- fix: Added a production same-origin URL resolver for HTTP, OAuth, and Socket.IO; added Vercel rewrites for `/api/*` and `/socket.io/*` before the SPA fallback; made backend OAuth callback origin configurable and default to `FRONTEND_ORIGIN`; updated the production acceptance gate to accept either direct backend or same-origin proxy traffic.
- verification: `npm run test -- apiOrigin.test.ts axios.test.ts useChatSocket.test.tsx`; `npm run test -- auth/oauth-config.test.mjs`; `npm run test:e2e:prod -- --grep "production smoke config|matches production traffic"`; `npm run lint`; `npm run build`.
- files_changed: `Frontend/Chatify/src/api/apiOrigin.ts`, `Frontend/Chatify/src/api/axios.ts`, `Frontend/Chatify/src/pages/login/login.tsx`, `Frontend/Chatify/src/pages/signup/signup.tsx`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, `Frontend/Chatify/vercel.json`, `Backend/Chatify/Utils/oauthConfig.mjs`, `Backend/Chatify/Config/passport.mjs`, focused regression tests, and Phase 14 production acceptance helpers.
