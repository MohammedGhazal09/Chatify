# Real-Time-Chat-App
A robust real-time chat application developed with the MERN stack (MongoDB, Express.js, React, Node.js) and WebSockets for instant communication. Features secure user authentication, persistent one-on-one private chats, and real-time online status. Demonstrates strong skills in full-stack development, API design, and real-time data handling.

## Operations

Use the root scripts for repeatable local checks:

- `npm run quality` - backend tests, frontend tests, frontend lint, and frontend build.
- `npm run smoke:local` - local Playwright smoke suite from the frontend package.
- `npm run smoke:prod` - production Playwright smoke suite from the frontend package.
- `npm run evidence:production` - fresh release evidence gate; exits nonzero without configured production/local/TURN smoke environment.
- `npm run ops:check` - operational documentation and privacy guard checks.

Runbooks live in `docs/operations/`:

- `local-startup.md`
- `deployment-verification.md`
- `production-smoke.md`
- `ci-quality-gates.md`
- `incident-triage.md`
- `rollback.md`
- `credential-rotation.md`
