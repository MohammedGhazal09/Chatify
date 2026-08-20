# Chatify Security Audit — Phase 1 Repository Inventory

This document is generated deterministically from tracked repository files. Run `npm run security:phase1:generate` after changing audited surfaces and `npm run security:phase1:check` to detect drift.

## Method and boundaries

- Source selection: `git-index`.
- Tracked files inventoried: **1503**.
- Tracked bytes inventoried: **15857663**.
- Generated inventory files are excluded from their own input set.
- Secret-like example values are redacted; live environment values are never read.
- Runtime execution evidence is stored in the `GitHub Actions artifact: phase-1-reproduction-evidence` artifact rather than committed.

## Reproducibility baseline

| Working directory | Package | Version | Lockfile | Scripts |
| --- | --- | --- | --- | --- |
| Backend/Chatify | backend | 1.0.0 | Backend/Chatify/package-lock.json | start, test, test:watch |
| Frontend/Chatify | chatify | 0.0.0 | Frontend/Chatify/package-lock.json | build, dev, lint, preview, test, test:e2e:prod, test:ui |
| . | live-chat | 1.0.0 | none | bootstrap:backend, bootstrap:frontend, bootstrap:full, doctor, evidence:production, evidence:release-candidate, ops:check, quality, quality:backend, quality:frontend, quality:frontend:build, quality:frontend:lint, quality:frontend:test, security:phase1:check, security:phase1:generate, security:phase1:reproduce, security:phase1:test, smoke:local, smoke:prod, test |

### Clean install commands

| Working directory | Command | Lockfile |
| --- | --- | --- |
| Backend/Chatify | npm ci | Backend/Chatify/package-lock.json |
| Frontend/Chatify | npm ci | Frontend/Chatify/package-lock.json |

### Validation commands discovered

| Working directory | Script | Invocation | Implementation |
| --- | --- | --- | --- |
| . | doctor | npm run doctor | node scripts/security/phase1-doctor.mjs |
| . | evidence:production | npm run evidence:production | node scripts/production-evidence-check.mjs |
| . | evidence:release-candidate | npm run evidence:release-candidate | node scripts/production-evidence-check.mjs --phase=50 |
| . | ops:check | npm run ops:check | node scripts/ops-check.mjs |
| . | quality | npm run quality | npm run quality:backend && npm run quality:frontend |
| . | quality:backend | npm run quality:backend | npm --prefix Backend/Chatify test -- --run |
| . | quality:frontend | npm run quality:frontend | npm run quality:frontend:test && npm run quality:frontend:lint && npm run quality:frontend:build |
| . | quality:frontend:build | npm run quality:frontend:build | npm --prefix Frontend/Chatify run build |
| . | quality:frontend:lint | npm run quality:frontend:lint | npm --prefix Frontend/Chatify run lint |
| . | quality:frontend:test | npm run quality:frontend:test | npm --prefix Frontend/Chatify test -- --run |
| . | security:phase1:check | npm run security:phase1:check | node scripts/security/phase1-inventory.mjs --check |
| . | security:phase1:generate | npm run security:phase1:generate | node scripts/security/phase1-inventory.mjs --write |
| . | security:phase1:reproduce | npm run security:phase1:reproduce | node scripts/security/phase1-reproduce.mjs |
| . | security:phase1:test | npm run security:phase1:test | node --test scripts/security/__tests__/phase1-inventory.test.mjs |
| . | smoke:local | npm run smoke:local | npm --prefix Frontend/Chatify run test:ui -- |
| . | smoke:prod | npm run smoke:prod | npm --prefix Frontend/Chatify run test:e2e:prod -- |
| . | test | npm run test | npm run quality |
| Backend/Chatify | test | npm run test | vitest run --config vitest.config.mjs |
| Backend/Chatify | test:watch | npm run test:watch | vitest --config vitest.config.mjs |
| Frontend/Chatify | build | npm run build | tsc -b && vite build |
| Frontend/Chatify | lint | npm run lint | eslint . |
| Frontend/Chatify | test | npm run test | vitest run |
| Frontend/Chatify | test:e2e:prod | npm run test:e2e:prod | playwright test --config playwright.production.config.ts |
| Frontend/Chatify | test:ui | npm run test:ui | playwright test |

## Component inventory

| Category | Tracked files |
| --- | --- |
| backend | 177 |
| cli-and-operations | 2 |
| configuration | 3 |
| controllers | 12 |
| deployment | 1 |
| documentation-and-runbooks | 1011 |
| frontend | 251 |
| generated-or-development-only | 56 |
| lockfiles | 2 |
| middleware | 8 |
| models | 22 |
| other | 1 |
| package-manifests | 3 |
| routes | 10 |
| services | 5 |
| tests | 184 |
| text-source-or-config | 1308 |
| utilities | 31 |
| workflows | 1 |

Detailed paths and SHA-256 hashes are in `inventory.json`.

## HTTP entry points

| Method | Resolved path | Source | Middleware/handler tokens |
| --- | --- | --- | --- |
| GET | /api/auth/discord | Backend/Chatify/app.mjs:120 | discordAuth |
| GET | /api/auth/discord/callback | Backend/Chatify/app.mjs:121 | discordCallback |
| GET | /api/auth/github | Backend/Chatify/app.mjs:116 | githubAuth |
| GET | /api/auth/github/callback | Backend/Chatify/app.mjs:117 | githubCallback |
| GET | /api/auth/google | Backend/Chatify/app.mjs:112 | googleAuth |
| GET | /api/auth/google/callback | Backend/Chatify/app.mjs:113 | googleCallback |
| GET | /api/csrf-token | Backend/Chatify/app.mjs:123 | const, createCsrfToken, end, getCsrfCookieOptions, req, res, res.cookie, res.status, token, TOKEN, XSRF |
| GET | /api/health | Backend/Chatify/app.mjs:95 | buildHealthPayload, json, req, res, res.status |
| GET | /api/queue-status | Backend/Chatify/app.mjs:105 | queueStatus |
| GET | /api/ready | Backend/Chatify/app.mjs:99 | buildReadinessPayload, const, getReadinessHttpStatus, json, payload, req, res, res.status |
| GET | authorization | Backend/Chatify/Utils/integrationPermissions.mjs:125 |  |
| POST | https://api.brevo.com/v3/smtp/email | Backend/Chatify/Services/emailService.mjs:20 | accept, api, application, Content, headers, json, key, payload, process.env.BREVO_API_KEY, Type |
| GET | x-request-id | Backend/Chatify/Middlewares/requestLogger.mjs:5 |  |
| GET | x-xsrf-token | Backend/Chatify/Middlewares/csrfProtection.mjs:56 |  |

### Router mounts

| Prefix | Target | Source | Mount middleware |
| --- | --- | --- | --- |
| /api/admin | Backend/Chatify/Routes/adminRouter.mjs | Backend/Chatify/app.mjs:134 | csrfProtection, protect |
| /api/auth | Backend/Chatify/Routes/authRouter.mjs | Backend/Chatify/app.mjs:129 | csrfProtection |
| /api/chat | Backend/Chatify/Routes/chatRouter.mjs | Backend/Chatify/app.mjs:131 | csrfProtection, protect |
| /api/integrations | Backend/Chatify/Routes/integrationRouter.mjs | Backend/Chatify/app.mjs:138 | csrfProtection, protect |
| /api/integrations/runtime | Backend/Chatify/Routes/integrationRuntimeRouter.mjs | Backend/Chatify/app.mjs:137 | integrationRuntimeLimiter |
| /api/invite | Backend/Chatify/Routes/inviteLinkRouter.mjs | Backend/Chatify/app.mjs:136 | csrfProtection, protect |
| /api/message | Backend/Chatify/Routes/messageRouter.mjs | Backend/Chatify/app.mjs:132 | csrfProtection, messageLimiter, protect |
| /api/moderation | Backend/Chatify/Routes/moderationRouter.mjs | Backend/Chatify/app.mjs:133 | csrfProtection, protect |
| /api/space | Backend/Chatify/Routes/spaceRouter.mjs | Backend/Chatify/app.mjs:135 | csrfProtection, protect |
| /api/user | Backend/Chatify/Routes/userRouter.mjs | Backend/Chatify/app.mjs:130 |  |

## Socket.IO entry points

Dynamic constants are retained as `<dynamic:EXPRESSION>` and must be resolved during protocol review.

| Event | Direction | Source |
| --- | --- | --- |
| <dynamic:event> | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:1083 |
| <dynamic:eventName> | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:1203 |
| <dynamic:eventName> | server-to-client-emitter | Backend/Chatify/Controller/messageController.mjs:906 |
| auth:revoked | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:1219 |
| call:accept | client-to-server-listener | Backend/Chatify/Config/socket.mjs:830 |
| call:answer | client-to-server-listener | Backend/Chatify/Config/socket.mjs:936 |
| call:answer | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:908 |
| call:end | client-to-server-listener | Backend/Chatify/Config/socket.mjs:886 |
| call:error | server-to-client-emitter | Backend/Chatify/Utils/callSocketContract.mjs:71 |
| call:error | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:910 |
| call:ice-candidate | client-to-server-listener | Backend/Chatify/Config/socket.mjs:940 |
| call:ice-candidate | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:909 |
| call:incoming | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:905 |
| call:offer | client-to-server-listener | Backend/Chatify/Config/socket.mjs:932 |
| call:offer | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:907 |
| call:reject | client-to-server-listener | Backend/Chatify/Config/socket.mjs:859 |
| call:start | client-to-server-listener | Backend/Chatify/Config/socket.mjs:771 |
| call:sync | client-to-server-listener | Backend/Chatify/Config/socket.mjs:914 |
| call:sync | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:906 |
| chat:deleted | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:923 |
| chat:join | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:1018 |
| chat:join | client-to-server-listener | Backend/Chatify/Config/socket.mjs:718 |
| chat:leave | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:1012 |
| chat:leave | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:1028 |
| chat:leave | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:945 |
| chat:leave | client-to-server-listener | Backend/Chatify/Config/socket.mjs:740 |
| chat:new | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:922 |
| connect_error | transport-lifecycle | Frontend/Chatify/src/hooks/useChatSocket.ts:903 |
| connect | transport-lifecycle | Frontend/Chatify/src/hooks/useChatSocket.ts:897 |
| connected | client-to-server-listener | Backend/Chatify/Config/DBConfig.mjs:11 |
| connection | transport-lifecycle | Backend/Chatify/Config/socket.mjs:664 |
| contact-request:created | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:924 |
| contact-request:updated | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:925 |
| conversation:controls-updated | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:929 |
| conversation:organization-updated | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:930 |
| disconnect | transport-lifecycle | Backend/Chatify/Config/socket.mjs:1075 |
| disconnect | transport-lifecycle | Frontend/Chatify/src/hooks/useChatSocket.ts:899 |
| disconnected | client-to-server-listener | Backend/Chatify/Config/DBConfig.mjs:22 |
| error | transport-lifecycle | Backend/Chatify/Config/DBConfig.mjs:16 |
| error | transport-lifecycle | Backend/Chatify/Controller/messageController.mjs:1731 |
| error | transport-lifecycle | Backend/Chatify/Controller/messageController.mjs:1775 |
| error | transport-lifecycle | Backend/Chatify/Controller/userController.mjs:780 |
| error | transport-lifecycle | Backend/Chatify/Services/attachmentStorageService.mjs:41 |
| error | transport-lifecycle | Backend/Chatify/Services/profileImageStorageService.mjs:41 |
| finish | client-to-server-listener | Backend/Chatify/Middlewares/requestLogger.mjs:15 |
| finish | client-to-server-listener | Backend/Chatify/Services/attachmentStorageService.mjs:42 |
| finish | client-to-server-listener | Backend/Chatify/Services/profileImageStorageService.mjs:42 |
| message:deleted | server-to-client-emitter | Backend/Chatify/Controller/messageController.mjs:2612 |
| message:deleted | server-to-client-emitter | Backend/Chatify/Controller/moderationController.mjs:73 |
| message:deleted | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:915 |
| message:delivered | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:1052 |
| message:delivered | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:608 |
| message:delivered | client-to-server-listener | Backend/Chatify/Config/socket.mjs:945 |
| message:edited | server-to-client-emitter | Backend/Chatify/Controller/messageController.mjs:2777 |
| message:edited | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:916 |
| message:new | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:267 |
| message:new | server-to-client-emitter | Backend/Chatify/Controller/messageController.mjs:772 |
| message:new | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:911 |
| message:pinned | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:918 |
| message:reaction | server-to-client-emitter | Backend/Chatify/Controller/messageController.mjs:2882 |
| message:reaction | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:917 |
| message:read | server-to-client-emitter | Backend/Chatify/Controller/messageController.mjs:2298 |
| message:read | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:913 |
| message:send | client-to-server-listener | Backend/Chatify/Config/socket.mjs:762 |
| message:status-update | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:1007 |
| message:status-update | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:1149 |
| message:status-update | server-to-client-emitter | Backend/Chatify/Controller/messageController.mjs:2308 |
| message:status-update | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:912 |
| message:unpinned | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:919 |
| messages:read-batch | server-to-client-emitter | Backend/Chatify/Controller/messageController.mjs:2398 |
| messages:read-batch | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:914 |
| reconnect | transport-lifecycle | Frontend/Chatify/src/hooks/useChatSocket.ts:901 |
| socket:error | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:482 |
| socket:error | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:715 |
| socket:error | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:904 |
| socket:ready | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:699 |
| socket:ready | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:898 |
| space:new | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:926 |
| space:removed | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:928 |
| space:updated | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:927 |
| typing:start | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:1039 |
| typing:start | client-to-server-listener | Backend/Chatify/Config/socket.mjs:1019 |
| typing:stop | client-to-server-emitter | Frontend/Chatify/src/hooks/useChatSocket.ts:1045 |
| typing:stop | client-to-server-listener | Backend/Chatify/Config/socket.mjs:1047 |
| unread:update | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:932 |
| user:connect | client-to-server-listener | Backend/Chatify/Config/socket.mjs:703 |
| user:connected | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:700 |
| user:identity-updated | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:921 |
| user:status-change | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:920 |
| user:typing | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:1031 |
| user:typing | server-to-client-emitter | Backend/Chatify/Config/socket.mjs:1059 |
| user:typing | server-to-client-listener | Frontend/Chatify/src/hooks/useChatSocket.ts:931 |

## Service worker and background entry points

| Event | Source |
| --- | --- |
| notificationclick | Frontend/Chatify/public/chatify-service-worker.js:36 |
| push | Frontend/Chatify/public/chatify-service-worker.js:1 |

| Job kind | Source |
| --- | --- |
| setInterval | Backend/Chatify/Services/notificationService.mjs:463 |
| setInterval | Backend/Chatify/Services/privacyOperationsService.mjs:420 |
| setInterval | Frontend/Chatify/src/hooks/useQueueStatus.ts:49 |
| setInterval | Frontend/Chatify/src/hooks/useVoiceRecorder.ts:204 |
| setTimeout | Backend/Chatify/Config/socket.mjs:290 |
| setTimeout | Backend/Chatify/Config/socket.mjs:312 |
| setTimeout | Backend/Chatify/Utils/requestQueue.mjs:47 |
| setTimeout | Frontend/Chatify/src/api/axios.ts:140 |
| setTimeout | Frontend/Chatify/src/hooks/useCallController.ts:372 |
| setTimeout | Frontend/Chatify/src/hooks/useCallController.ts:801 |
| setTimeout | Frontend/Chatify/src/hooks/useChatQueries.ts:535 |
| setTimeout | Frontend/Chatify/src/hooks/useChatSocket.ts:1069 |
| setTimeout | Frontend/Chatify/src/hooks/useChatSocket.ts:497 |
| setTimeout | Frontend/Chatify/src/hooks/useChatSocket.ts:874 |
| setTimeout | Frontend/Chatify/src/hooks/useVoiceRecorder.ts:207 |
| setTimeout | Frontend/Chatify/src/utils/requestQueue.ts:63 |
| setTimeout | Frontend/Chatify/src/utils/sounds.ts:204 |
| setTimeout | Frontend/Chatify/src/utils/sounds.ts:211 |

## Data models

| Model | Source | Fields | Sensitive candidates | Ownership candidates | Role candidates | References | Indexes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AbuseReports | Backend/Chatify/Models/abuseReportModel.mjs | 61 | message, messageId, messageType | actor, assignedTo, memberCount, reportedUser, sender, user, userId, username | status | Chats, Messages, Spaces, Users | 6 |
| Attachments | Backend/Chatify/Models/attachmentModel.mjs | 12 | messageId |  | status | Chats, Messages, Users | 4 |
| CallSessions | Backend/Chatify/Models/callSessionModel.mjs | 17 | participantIds, recipientIds | calleeId, callerId, participantIds, recipientIds | status | Chats, Users | 5 |
| Chats | Backend/Chatify/Models/chatModel.mjs | 15 | channelDescription, channelKey, directKey, groupDescription, latestMessage, unReadMessages | groupAdmin, members | groupAdmin | Messages, Spaces, Users | 2 |
| ContactRequests | Backend/Chatify/Models/contactRequestModel.mjs | 6 | pairKey, recipient | recipient | status | Chats, Users | 4 |
| ConversationOrganizations | Backend/Chatify/Models/conversationOrganizationModel.mjs | 5 |  | user |  | Chats, Users | 4 |
| IntegrationApps | Backend/Chatify/Models/integrationAppModel.mjs | 6 | description | owner | status | Users | 1 |
| IntegrationAuditLogs | Backend/Chatify/Models/integrationAuditLogModel.mjs | 9 |  | actorUser | status | IntegrationApps, IntegrationInstallations, Users | 1 |
| IntegrationInstallations | Backend/Chatify/Models/integrationInstallationModel.mjs | 9 | tokenHash, tokenRotatedAt |  | status | IntegrationApps, Users | 2 |
| InviteLinks | Backend/Chatify/Models/inviteLinkModel.mjs | 11 | tokenHash | createdBy |  | Chats, Spaces, Users | 3 |
| Messages | Backend/Chatify/Models/messageModel.mjs | 71 | ciphertext, clientMessageId, encryptedPayload, encryptedPayloadFingerprint, keyVersion, messageId, messageType | calleeId, callerId, sender, senderDeviceId, user, username | status | Attachments, Chats, Messages, Users | 12 |
| NotificationOutbox | Backend/Chatify/Models/notificationOutboxModel.mjs | 30 | body, dedupeKey, htmlContent, messageId, payload, pushSubscriptionEndpointHash, recipient, templateKey, textContent | recipient, sender | providerStatus, status | Chats, Messages, Users | 3 |
| OAuthHandoff | Backend/Chatify/Models/oauthHandoffModel.mjs | 5 |  | userId |  | Users | 1 |
| PasswordReset | Backend/Chatify/Models/passwordResetModel.mjs | 5 | email, tokenHash | userId |  | Users | 1 |
| PrivacyOperationRuns | Backend/Chatify/Models/privacyOperationRunModel.mjs | 6 |  |  | status |  | 1 |
| PrivacyRequests | Backend/Chatify/Models/privacyRequestModel.mjs | 15 |  | actor, user | status | Users | 1 |
| SavedMessages | Backend/Chatify/Models/savedMessageModel.mjs | 4 | message | user |  | Chats, Messages, Users | 3 |
| Sessions | Backend/Chatify/Models/sessionModel.mjs | 11 | ipHash, refreshTokenHash, replacedByTokenHash | rememberMe, userAgentHash, userId |  | Users | 3 |
| Spaces | Backend/Chatify/Models/spaceModel.mjs | 10 | description | createdBy, members, owner, user | role | Chats, Users | 2 |
| TwoFactorChallenges | Backend/Chatify/Models/twoFactorChallengeModel.mjs | 6 | challengeTokenHash | rememberMe, userId |  | Users | 2 |
| UserBlocks | Backend/Chatify/Models/userBlockModel.mjs | 3 |  | blockedUser |  | Chats, Users | 3 |
| Users | Backend/Chatify/Models/userModel.mjs | 71 | ciphertext, email, emailNotificationsEnabled, emailUnsubscribedAt, endpoint, endpointHash, keys, lastSeen, messagePreviewMode, password, pendingSecretEncrypted, pushSubscriptions, secretEncrypted, showLastSeen, unsubscribeTokenHash | twoFactor, username | isVerified, lastVerifiedAt, mutedChatIds, profileStatus, role, showOnlineStatus, showProfileStatus | Chats, Users | 6 |

The JSON inventory additionally records field definitions, unique/TTL candidates, consumer files, request-body candidates, response-field candidates, hashing/encryption signals, and deletion operations.

## External communications

| Provider | Environment variables | Static hosts | Control signals | User-controlled destination candidate | Evidence |
| --- | --- | --- | --- | --- | --- |
| discord-oauth | DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET | http://localhost:5173, https://cdn.discordapp.com, https://dotenvx.com, https://feross.org, https://github.com, https://ko-fi.com, https://opencollective.com, https://paulmillr.com, https://registry.npmjs.org, https://tidelift.com, https://www.patreon.com, https://your-frontend.example.com, mongodb://127.0.0.1:27017 |  | no | Backend/Chatify/.env.example:19, Backend/Chatify/Config/passport.mjs:4, Backend/Chatify/package-lock.json:27, Backend/Chatify/package.json:29, Backend/Chatify/test/setup/env.mjs:11 |
| email | EMAIL_USER_SENDER |  |  | no |  |
| generic-http |  | http://localhost:3000, https://api.brevo.com, https://chatify-ckmn.onrender.com, https://chatify-ten-rho.vercel.app, https://dotenvx.com, https://eslint.org, https://feross.org, https://github.com, https://ko-fi.com, https://opencollective.com, https://paulmillr.com, https://registry.npmjs.org, https://tidelift.com, https://www.patreon.com | retry-control, timeout | yes | Backend/Chatify/package-lock.json:13, Backend/Chatify/package.json:15, Backend/Chatify/Services/emailService.mjs:1, Frontend/Chatify/e2e/pages/phase15CallAcceptance.ts:291, Frontend/Chatify/e2e/pages/productionSmoke.ts:246, Frontend/Chatify/package-lock.json:15, Frontend/Chatify/package.json:20, Frontend/Chatify/src/api/authApi.ts:1, Frontend/Chatify/src/api/axios.test.ts:1, Frontend/Chatify/src/api/axios.ts:1, Frontend/Chatify/src/api/chatApi.ts:1, Frontend/Chatify/src/api/deliveryHealthApi.test.ts:7, Frontend/Chatify/src/api/deliveryHealthApi.ts:1, Frontend/Chatify/src/api/integrationDiagnosticsApi.test.ts:7, Frontend/Chatify/src/api/integrationDiagnosticsApi.ts:1, Frontend/Chatify/src/api/inviteApi.ts:1, Frontend/Chatify/src/api/messageApi.test.ts:14, Frontend/Chatify/src/api/messageApi.ts:1, Frontend/Chatify/src/api/moderationApi.test.ts:9, Frontend/Chatify/src/api/moderationApi.ts:1, Frontend/Chatify/src/api/privacyOperationsApi.test.ts:7, Frontend/Chatify/src/api/privacyOperationsApi.ts:1, Frontend/Chatify/src/api/spaceApi.test.ts:9, Frontend/Chatify/src/api/spaceApi.ts:1, Frontend/Chatify/src/api/userApi.ts:1, Frontend/Chatify/src/api/userPrivacyApi.test.ts:8, Frontend/Chatify/src/hooks/useAuthQuery.test.tsx:2, Frontend/Chatify/src/hooks/useChatQueries.test.tsx:4, Frontend/Chatify/src/hooks/useChatSocket.test.tsx:176, Frontend/Chatify/src/hooks/useChatSocket.ts:5, Frontend/Chatify/src/pages/admin/AdminModeration.tsx:3, Frontend/Chatify/src/pages/chat/chat.tsx:3, Frontend/Chatify/src/pages/forgotPassword/forgotPassword.tsx:5, Frontend/Chatify/src/pages/login/login.tsx:9, Frontend/Chatify/src/pages/setupUsername/SetupUsername.tsx:2, Frontend/Chatify/src/pages/signup/signup.tsx:12 |
| github-oauth | GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET | http://localhost:5173, https://cdn.discordapp.com, https://dotenvx.com, https://feross.org, https://github.com, https://ko-fi.com, https://opencollective.com, https://paulmillr.com, https://registry.npmjs.org, https://tidelift.com, https://www.patreon.com, https://your-frontend.example.com, mongodb://127.0.0.1:27017 |  | no | Backend/Chatify/.env.example:17, Backend/Chatify/Config/passport.mjs:3, Backend/Chatify/package-lock.json:28, Backend/Chatify/package.json:30, Backend/Chatify/test/setup/env.mjs:9 |
| google-oauth | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | http://localhost:5173, https://cdn.discordapp.com, https://dotenvx.com, https://feross.org, https://github.com, https://ko-fi.com, https://opencollective.com, https://paulmillr.com, https://registry.npmjs.org, https://tidelift.com, https://www.patreon.com, https://your-frontend.example.com, mongodb://127.0.0.1:27017 |  | no | Backend/Chatify/.env.example:15, Backend/Chatify/Config/passport.mjs:2, Backend/Chatify/package-lock.json:29, Backend/Chatify/package.json:31, Backend/Chatify/test/setup/env.mjs:7 |
| mongodb | MONGODB_URL | http://localhost:5173, https://chatify.example.test, https://your-frontend.example.com, mongodb://127.0.0.1:27017, mongodb://example.invalid |  | no | Backend/Chatify/.env.example:5, Backend/Chatify/Config/DBConfig.mjs:4, Backend/Chatify/Services/attachmentStorageService.mjs:18, Backend/Chatify/Services/profileImageStorageService.mjs:18, Backend/Chatify/test/observability/health-readiness.test.mjs:42, Backend/Chatify/test/setup/mongo.mjs:8, Backend/Chatify/Utils/operationalReadiness.mjs:14, scripts/ops-check.mjs:24 |
| stun-turn | CALL_STUN_URLS, CALL_TURN_CREDENTIAL, CALL_TURN_URLS, CALL_TURN_USERNAME | http://localhost:3000, http://localhost:5173, https://chatify.example.test, https://your-frontend.example.com, mongodb://127.0.0.1:27017, mongodb://example.invalid | retry-control, timeout | no | Backend/Chatify/.env.example:36, Backend/Chatify/Config/socket.mjs:420, Backend/Chatify/test/observability/health-readiness.test.mjs:96, Backend/Chatify/Utils/callIceConfig.mjs:1, Backend/Chatify/Utils/callSocketContract.mjs:11, Frontend/Chatify/src/hooks/useChatSocket.test.tsx:1362 |
| web-push | VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY | http://localhost:5173, https://dotenvx.com, https://feross.org, https://github.com, https://ko-fi.com, https://opencollective.com, https://paulmillr.com, https://registry.npmjs.org, https://tidelift.com, https://www.patreon.com, https://your-frontend.example.com, mongodb://127.0.0.1:27017 |  | no | Backend/Chatify/.env.example:27, Backend/Chatify/package-lock.json:32, Backend/Chatify/package.json:34, Backend/Chatify/Services/notificationService.mjs:1 |

## Sensitive configuration map

| Variable | Category | Sensitive | Example value | Example definition | Usage |
| --- | --- | --- | --- | --- | --- |
| ACCESS_TOKEN_EXPIRES_IN | authentication-and-sessions | yes | <redacted> | Backend/Chatify/.env.example:8 | Backend/Chatify/Utils/tokenCookieGenerator.mjs:11 |
| API_KEY | general-runtime | yes | missing |  | .agents/skills/vitest/references/features-mocking.md:199 |
| BREVO_API_KEY | general-runtime | yes | <redacted> | Backend/Chatify/.env.example:23 | Backend/Chatify/Services/emailService.mjs:25, Backend/Chatify/Services/notificationService.mjs:270, Backend/Chatify/test/notification/notification.delivery.test.mjs:13, Backend/Chatify/test/notification/notification.delivery.test.mjs:46, Backend/Chatify/test/notification/notification.delivery.test.mjs:69, Backend/Chatify/test/observability/health-readiness.test.mjs:45, Backend/Chatify/test/setup/env.mjs:14 |
| CALL_STUN_URLS | webrtc-and-turn | no | stun:stun.l.google.com:19302 | Backend/Chatify/.env.example:36 |  |
| CALL_TURN_CREDENTIAL | webrtc-and-turn | yes | <redacted> | Backend/Chatify/.env.example:39 |  |
| CALL_TURN_URLS | webrtc-and-turn | no | <empty> | Backend/Chatify/.env.example:37 |  |
| CALL_TURN_USERNAME | webrtc-and-turn | no | <empty> | Backend/Chatify/.env.example:38 |  |
| CHATIFY_ALLOW_NONLOCAL_DELIVERY_SMOKE | general-runtime | no | missing |  | Frontend/Chatify/e2e/chat-delivery-reliability.spec.ts:126 |
| CHATIFY_ALLOW_NONLOCAL_PROFILE_IMAGE_ACCEPTANCE | general-runtime | no | missing |  | Frontend/Chatify/e2e/pages/profilePictureAcceptance.ts:162 |
| CHATIFY_CALL_DISCONNECT_GRACE_MS | webrtc-and-turn | no | 10000 | Backend/Chatify/.env.example:34 | Backend/Chatify/Config/socket.mjs:243, Backend/Chatify/test/socket/socket.calls.test.mjs:309, Backend/Chatify/test/socket/socket.calls.test.mjs:310, Backend/Chatify/test/socket/socket.calls.test.mjs:357, Backend/Chatify/test/socket/socket.calls.test.mjs:359 |
| CHATIFY_CALL_SMOKE | webrtc-and-turn | no | missing |  | Frontend/Chatify/e2e/chat-calls.spec.ts:193 |
| CHATIFY_CHAT_SMOKE_ARTIFACT_DIR | general-runtime | no | missing |  | Frontend/Chatify/e2e/chat-ui-smoke.spec.ts:9 |
| CHATIFY_CI_REQUIRE_PRODUCTION_EVIDENCE | general-runtime | no | missing |  | .github/workflows/security-and-test-foundation.yml:102 |
| CHATIFY_DELIVERY_DIAGNOSTICS | general-runtime | no | 0 | Backend/Chatify/.env.example:31 | Backend/Chatify/Config/socket.mjs:113, Backend/Chatify/Controller/messageController.mjs:702 |
| CHATIFY_E2E_ARTIFACT_DIR | general-runtime | no | missing |  | Frontend/Chatify/e2e/pages/chatPage.ts:23 |
| CHATIFY_LOCAL_BACKEND_URL | general-runtime | no | missing |  | Frontend/Chatify/e2e/chat-delivery-reliability.spec.ts:106 |
| CHATIFY_LOCAL_DELIVERY_SMOKE | general-runtime | no | missing |  | Frontend/Chatify/e2e/chat-delivery-reliability.spec.ts:99 |
| CHATIFY_LOCAL_EPHEMERAL_BACKEND | general-runtime | no | missing |  | Frontend/Chatify/e2e/chat-delivery-reliability.spec.ts:127 |
| CHATIFY_LOG_LEVEL | audit-logging-and-metrics | no | info | Backend/Chatify/.env.example:32 | Backend/Chatify/test/observability/observability-logger.test.mjs:111, Backend/Chatify/test/observability/observability-logger.test.mjs:114, Backend/Chatify/test/observability/observability-logger.test.mjs:133, Backend/Chatify/Utils/observabilityLogger.mjs:86 |
| CHATIFY_NOTIFICATION_DRY_RUN | general-runtime | no | 1 | Backend/Chatify/.env.example:24 | Backend/Chatify/Services/notificationService.mjs:46, Backend/Chatify/test/notification/notification.delivery.test.mjs:12, Backend/Chatify/test/notification/notification.delivery.test.mjs:45, Backend/Chatify/test/notification/notification.delivery.test.mjs:68 |
| CHATIFY_PROD_FRONTEND_URL | general-runtime | no | missing |  | Frontend/Chatify/playwright.production.config.ts:3 |
| CHATIFY_TEST_LOGS | audit-logging-and-metrics | no | 0 | Backend/Chatify/.env.example:33 | Backend/Chatify/test/observability/observability-logger.test.mjs:112, Backend/Chatify/test/observability/observability-logger.test.mjs:113, Backend/Chatify/test/observability/observability-logger.test.mjs:134, Backend/Chatify/Utils/observabilityLogger.mjs:87 |
| CI | general-runtime | no | missing |  | .agents/skills/vitest/references/core-cli.md:158, .agents/skills/vitest/references/core-describe.md:65, .agents/skills/vitest/references/core-describe.md:66, .agents/skills/vitest/references/core-test-api.md:65, .agents/skills/vitest/references/core-test-api.md:66, .agents/skills/vitest/references/features-filtering.md:173, .agents/skills/vitest/references/features-filtering.md:94, .agents/skills/vitest/references/features-filtering.md:95, Frontend/Chatify/playwright.config.ts:23 |
| COOKIE_SECRET | cookies-and-csrf | yes | missing |  | .agents/skills/session-management/references/session-middleware-chain.md:12 |
| CSRF_SECRET | cookies-and-csrf | yes | <redacted> | Backend/Chatify/.env.example:9 | Backend/Chatify/Middlewares/csrfProtection.mjs:10 |
| DISCORD_CLIENT_ID | general-runtime | no | <placeholder> | Backend/Chatify/.env.example:19 | Backend/Chatify/Config/passport.mjs:180, Backend/Chatify/test/setup/env.mjs:11 |
| DISCORD_CLIENT_SECRET | general-runtime | yes | <redacted> | Backend/Chatify/.env.example:20 | Backend/Chatify/Config/passport.mjs:181, Backend/Chatify/test/setup/env.mjs:12 |
| EMAIL_USER_SENDER | email | no | <placeholder> | Backend/Chatify/.env.example:22 | Backend/Chatify/Services/emailService.mjs:8, Backend/Chatify/Services/notificationService.mjs:270, Backend/Chatify/test/setup/env.mjs:13 |
| EXPIRES_IN | retention-and-lifecycle | no | 15m | Backend/Chatify/.env.example:7 | Backend/Chatify/test/setup/env.mjs:3 |
| FRONTEND_ORIGIN | cors-and-proxy | no | <placeholder> | Backend/Chatify/.env.example:12 | Backend/Chatify/app.mjs:76, Backend/Chatify/Config/socket.mjs:73, Backend/Chatify/Controller/authController.mjs:38, Backend/Chatify/test/setup/env.mjs:5, Backend/Chatify/test/socket/socket.auth.test.mjs:32, Backend/Chatify/test/socket/socket.auth.test.mjs:36, Backend/Chatify/test/socket/socket.auth.test.mjs:40, Backend/Chatify/Utils/inviteLinks.mjs:101 |
| FRONTEND_ORIGIN_DEV | cors-and-proxy | no | http://localhost:5173/ | Backend/Chatify/.env.example:13 | Backend/Chatify/app.mjs:77, Backend/Chatify/Config/socket.mjs:75, Backend/Chatify/test/setup/env.mjs:6, Backend/Chatify/test/socket/socket.auth.test.mjs:79, Backend/Chatify/Utils/inviteLinks.mjs:102 |
| GITHUB_CLIENT_ID | general-runtime | no | <placeholder> | Backend/Chatify/.env.example:17 | Backend/Chatify/Config/passport.mjs:167, Backend/Chatify/test/setup/env.mjs:9 |
| GITHUB_CLIENT_SECRET | general-runtime | yes | <redacted> | Backend/Chatify/.env.example:18 | Backend/Chatify/Config/passport.mjs:168, Backend/Chatify/test/setup/env.mjs:10 |
| GOOGLE_CLIENT_ID | general-runtime | no | <placeholder> | Backend/Chatify/.env.example:15 | Backend/Chatify/Config/passport.mjs:153, Backend/Chatify/test/setup/env.mjs:7 |
| GOOGLE_CLIENT_SECRET | general-runtime | yes | <redacted> | Backend/Chatify/.env.example:16 | Backend/Chatify/Config/passport.mjs:154, Backend/Chatify/test/setup/env.mjs:8 |
| HERCULES_ARTIFACT_DIR | general-runtime | no | missing |  | Frontend/Chatify/e2e/admin-delivery-health.spec.ts:6, Frontend/Chatify/e2e/admin-hub.spec.ts:5, Frontend/Chatify/e2e/admin-integrations.spec.ts:5, Frontend/Chatify/e2e/admin-privacy-operations.spec.ts:5, Frontend/Chatify/e2e/chat-phase42-47-visual-qa.spec.ts:19, Frontend/Chatify/e2e/chat-phase52-encrypted-recovery.spec.ts:14, Frontend/Chatify/e2e/chat-saved-messages.spec.ts:11 |
| JWT_SECRET | authentication-and-sessions | yes | missing |  | .agents/skills/session-management/references/nodejsexpress-jwt-implementation.md:13 |
| MONGODB_URL | database | no | mongodb://127.0.0.1:27017/chatify | Backend/Chatify/.env.example:5 | Backend/Chatify/Config/DBConfig.mjs:4, Backend/Chatify/test/observability/health-readiness.test.mjs:43, Backend/Chatify/test/setup/mongo.mjs:14, Backend/Chatify/test/setup/mongo.mjs:15 |
| NEEDS_JSON | general-runtime | no | missing |  | .github/workflows/security-and-test-foundation.yml:179 |
| NODE_ENV | general-runtime | no | development | Backend/Chatify/.env.example:1 | .agents/skills/session-management/references/session-middleware-chain.md:22, .agents/skills/vitest/references/features-filtering.md:172, .planning/phases/02-authenticated-realtime-contract/02-REVIEW.md:79, Backend/Chatify/app.mjs:37, Backend/Chatify/app.mjs:51, Backend/Chatify/app.mjs:62, Backend/Chatify/app.mjs:73, Backend/Chatify/Config/socket.mjs:51, Backend/Chatify/Controller/authController.mjs:36, Backend/Chatify/Controller/errController.mjs:82, Backend/Chatify/Controller/errController.mjs:82, Backend/Chatify/Middlewares/csrfProtection.mjs:8, Backend/Chatify/Middlewares/rateLimiters.mjs:3, Backend/Chatify/Middlewares/requestLogger.mjs:37, Backend/Chatify/Services/notificationService.mjs:451, Backend/Chatify/Services/notificationService.mjs:47, Backend/Chatify/Services/notificationService.mjs:48, Backend/Chatify/Services/privacyOperationsService.mjs:82, Backend/Chatify/test/notification/notification.delivery.test.mjs:11, Backend/Chatify/test/notification/notification.delivery.test.mjs:44, Backend/Chatify/test/notification/notification.delivery.test.mjs:67, Backend/Chatify/test/setup/env.mjs:1, Backend/Chatify/test/socket/socket.auth.test.mjs:31, Backend/Chatify/test/socket/socket.auth.test.mjs:35, Backend/Chatify/test/socket/socket.auth.test.mjs:39, Backend/Chatify/Utils/observabilityLogger.mjs:87, Backend/Chatify/Utils/tokenCookieGenerator.mjs:17, Backend/Chatify/Utils/tokenCookieGenerator.mjs:29, Backend/Chatify/Utils/twoFactor.mjs:172 |
| NOTIFICATION_WORKER_ENABLED | general-runtime | no | 1 | Backend/Chatify/.env.example:25 | Backend/Chatify/Services/notificationService.mjs:452 |
| NOTIFICATION_WORKER_INTERVAL_MS | general-runtime | no | 30000 | Backend/Chatify/.env.example:26 | Backend/Chatify/Services/notificationService.mjs:458 |
| PASSWORD_RESET_SECRET | general-runtime | yes | <redacted> | Backend/Chatify/.env.example:10 | Backend/Chatify/Controller/authController.mjs:469, Backend/Chatify/test/setup/env.mjs:4 |
| PORT | general-runtime | no | 5000 | Backend/Chatify/.env.example:2 | Backend/Chatify/server.mjs:9 |
| PORT_NUMBER | general-runtime | no | 5000 | Backend/Chatify/.env.example:3 | Backend/Chatify/server.mjs:9 |
| PRIVACY_OUTBOX_RETENTION_DAYS | retention-and-lifecycle | no | missing |  | Backend/Chatify/Services/privacyOperationsService.mjs:62 |
| PRIVACY_WORKER_ENABLED | general-runtime | no | missing |  | Backend/Chatify/Services/privacyOperationsService.mjs:83 |
| PRIVACY_WORKER_INTERVAL_MS | general-runtime | no | missing |  | Backend/Chatify/Services/privacyOperationsService.mjs:74 |
| SECRET_JWT_KEY | authentication-and-sessions | yes | <redacted> | Backend/Chatify/.env.example:6 | .planning/phases/02-authenticated-realtime-contract/02-01-PLAN.md:113, Backend/Chatify/Controller/authController.mjs:390, Backend/Chatify/Controller/authController.mjs:97, Backend/Chatify/Middlewares/csrfProtection.mjs:10, Backend/Chatify/test/auth/auth.lifecycle.test.mjs:56, Backend/Chatify/test/observability/health-readiness.test.mjs:44, Backend/Chatify/test/setup/env.mjs:2, Backend/Chatify/test/socket/socket.auth.test.mjs:172, Backend/Chatify/test/socket/socket.auth.test.mjs:195, Backend/Chatify/Utils/authToken.mjs:44, Backend/Chatify/Utils/tokenCookieGenerator.mjs:56, Backend/Chatify/Utils/twoFactor.mjs:176, Backend/Chatify/Utils/twoFactor.mjs:180 |
| SESSION_SECRET | authentication-and-sessions | yes | missing |  | .agents/skills/csrf-protection/references/nodejsexpress-csrf-protection.md:102, .agents/skills/session-management/references/session-middleware-chain.md:17 |
| token_urlsafe | general-runtime | yes | missing |  | .agents/skills/session-management/references/session-storage-with-redis.md:26 |
| TWO_FACTOR_ENCRYPTION_KEY | general-runtime | no | missing |  | Backend/Chatify/Utils/twoFactor.mjs:162, Backend/Chatify/Utils/twoFactor.mjs:168 |
| VAPID_PRIVATE_KEY | web-push | yes | <redacted> | Backend/Chatify/.env.example:29 | Backend/Chatify/Services/notificationService.mjs:282 |
| VAPID_PUBLIC_KEY | web-push | no | <empty> | Backend/Chatify/.env.example:28 | Backend/Chatify/Services/notificationService.mjs:281 |
| VAPID_SUBJECT | web-push | no | <placeholder> | Backend/Chatify/.env.example:27 | Backend/Chatify/Services/notificationService.mjs:280 |
| VITE_BACKEND_URL | general-runtime | no | http://localhost:5000/ | Frontend/Chatify/.env.example:1 |  |
| VITE_SOCKET_URL | general-runtime | no | http://localhost:5000/ | Frontend/Chatify/.env.example:2 |  |
| VITE_VAPID_PUBLIC_KEY | web-push | no | <empty> | Frontend/Chatify/.env.example:3 | Frontend/Chatify/src/utils/pushNotifications.ts:4 |
| VITEST | general-runtime | no | missing |  | .agents/skills/vitest/references/core-config.md:123, .agents/skills/vitest/references/core-config.md:167 |

### Configuration drift candidates

- Referenced but absent from committed examples: `API_KEY`, `CHATIFY_ALLOW_NONLOCAL_DELIVERY_SMOKE`, `CHATIFY_ALLOW_NONLOCAL_PROFILE_IMAGE_ACCEPTANCE`, `CHATIFY_CALL_SMOKE`, `CHATIFY_CHAT_SMOKE_ARTIFACT_DIR`, `CHATIFY_CI_REQUIRE_PRODUCTION_EVIDENCE`, `CHATIFY_E2E_ARTIFACT_DIR`, `CHATIFY_LOCAL_BACKEND_URL`, `CHATIFY_LOCAL_DELIVERY_SMOKE`, `CHATIFY_LOCAL_EPHEMERAL_BACKEND`, `CHATIFY_PROD_FRONTEND_URL`, `CI`, `COOKIE_SECRET`, `HERCULES_ARTIFACT_DIR`, `JWT_SECRET`, `NEEDS_JSON`, `PRIVACY_OUTBOX_RETENTION_DAYS`, `PRIVACY_WORKER_ENABLED`, `PRIVACY_WORKER_INTERVAL_MS`, `SESSION_SECRET`, `token_urlsafe`, `TWO_FACTOR_ENCRYPTION_KEY`, `VITEST`.
- Defined in examples but not statically referenced: `CALL_STUN_URLS`, `CALL_TURN_CREDENTIAL`, `CALL_TURN_URLS`, `CALL_TURN_USERNAME`, `VITE_BACKEND_URL`, `VITE_SOCKET_URL`.

## Phase 1 exit-gate evidence

| Gate | Evidence/status |
| --- | --- |
| cleanReproductionEvidence | GitHub Actions artifact: phase-1-reproduction-evidence |
| componentInventoryGenerated | true |
| entryPointInventoryGenerated | true |
| dataModelInventoryGenerated | true |
| externalCommunicationInventoryGenerated | true |
| sensitiveConfigurationMapGenerated | true |

## Static-analysis limitations

- Static discovery intentionally records dynamic route/event expressions instead of evaluating application code.
- Client input, response fields, outbound controls, deletion behavior, and some model metadata are heuristic candidates that require later source-to-sink validation.
- Runtime-only destinations, injected provider configuration, infrastructure settings, and secret values are outside committed inventory and belong in controlled evidence.
