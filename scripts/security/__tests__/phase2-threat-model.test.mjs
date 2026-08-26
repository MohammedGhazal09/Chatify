import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildThreatModel,
  checkGeneratedThreatModel,
  renderThreatModelMarkdown,
  validateThreatModelSource,
  writeGeneratedThreatModel,
} from '../lib/threat-model.mjs'
import { buildPhase2CommandPlan } from '../lib/phase2-reproduction.mjs'

const makeInventory = () => ({
  schemaVersion: 1,
  scope: { sourceSelection: 'git-index' },
  components: { trackedFileCount: 12, totalTrackedBytes: 4096 },
  entryPoints: {
    httpRoutes: [
      { method: 'POST', fullPath: '/api/auth/login', source: 'Backend/Chatify/Routes/authRouter.mjs', middlewareAndHandlerTokens: ['csrfProtection', 'login'], mountMiddlewareTokens: [] },
      { method: 'GET', fullPath: '/api/message/:chatId', source: 'Backend/Chatify/Routes/messageRouter.mjs', middlewareAndHandlerTokens: ['getMessages'], mountMiddlewareTokens: ['protect', 'csrfProtection'] },
      { method: 'GET', fullPath: '/api/health', source: 'Backend/Chatify/app.mjs', middlewareAndHandlerTokens: ['buildHealthPayload'], mountMiddlewareTokens: [] },
    ],
    socketEvents: [
      { event: 'chat:join', direction: 'client-to-server-listener', method: 'on', source: 'Backend/Chatify/Config/socket.mjs' },
      { event: 'message:new', direction: 'server-to-client-listener', method: 'on', source: 'Frontend/Chatify/src/hooks/useChatSocket.ts' },
      { event: 'connection', direction: 'transport-lifecycle', method: 'on', source: 'Backend/Chatify/Config/socket.mjs' },
      { event: '<dynamic:event>', direction: 'client-to-server-emitter', method: 'emit', source: 'Frontend/Chatify/src/hooks/useChatSocket.ts' },
    ],
    serviceWorkerEvents: [
      { event: 'push', source: 'Frontend/Chatify/public/sw.js' },
    ],
    backgroundJobs: [
      { kind: 'setInterval', source: 'Backend/Chatify/Services/notificationService.mjs' },
      { kind: 'setTimeout', source: 'Frontend/Chatify/src/hooks/useCallController.ts' },
      { kind: 'cron-or-scheduler', source: 'scripts/security/lib/inventory.mjs' },
    ],
    packageScripts: [],
  },
  dataModels: [
    { source: 'Backend/Chatify/Models/userModel.mjs', modelNames: ['Users'] },
    { source: 'Backend/Chatify/Models/messageModel.mjs', modelNames: ['Messages'] },
  ],
  externalCommunications: [
    { provider: 'mongodb', evidence: [{ source: 'Backend/Chatify/Config/DBConfig.mjs', line: 1 }], environmentVariables: ['MONGODB_URL'] },
    { provider: 'google-oauth', evidence: [{ source: 'Backend/Chatify/Config/passport.mjs', line: 1 }], environmentVariables: ['GOOGLE_CLIENT_ID'] },
    { provider: 'cloudinary', evidence: [{ source: 'scripts/security/lib/inventory.mjs', line: 1 }], environmentVariables: [] },
  ],
  sensitiveConfiguration: { variables: [] },
})

const makeSource = () => ({
  schemaVersion: 1,
  repository: 'MohammedGhazal09/Chatify',
  version: '46dff3834a9f727840cfb02a2e8acaef43cf06f8',
  overview: {
    purpose: 'A real-time messaging application.',
    securityObjectives: ['Protect account identity', 'Keep conversations private'],
    included: ['Backend runtime', 'Frontend runtime'],
    excluded: ['Physical device compromise'],
  },
  actors: [
    { id: 'unauthenticated-user', name: 'Unauthenticated user', control: 'attacker-controlled', capabilities: ['Send public HTTP requests'] },
    { id: 'authenticated-user', name: 'Authenticated user', control: 'attacker-controlled', capabilities: ['Send authenticated HTTP and Socket.IO requests'] },
    { id: 'operator', name: 'Operator', control: 'operator-controlled', capabilities: ['Configure production secrets'] },
  ],
  zones: [
    { id: 'browser', name: 'Browser client', trust: 'untrusted-client' },
    { id: 'api', name: 'HTTP API', trust: 'trusted-runtime' },
    { id: 'socket', name: 'Socket.IO runtime', trust: 'trusted-runtime' },
    { id: 'database', name: 'MongoDB and GridFS', trust: 'privileged-data-store' },
    { id: 'external', name: 'External providers', trust: 'third-party' },
  ],
  dataClasses: [
    { id: 'account-data', name: 'Account data', sensitivity: 'restricted', examples: ['email'] },
    { id: 'conversation-data', name: 'Conversation data', sensitivity: 'restricted', examples: ['messages'] },
  ],
  assets: [
    { id: 'accounts', name: 'Accounts', dataClassIds: ['account-data'], invariantIds: ['INV-IDENTITY'] },
    { id: 'messages', name: 'Messages', dataClassIds: ['conversation-data'], invariantIds: ['INV-AUTHZ'] },
  ],
  boundaries: [
    { id: 'BROWSER-HTTP', name: 'Browser to HTTP API', fromZoneId: 'browser', toZoneId: 'api', actorIds: ['unauthenticated-user', 'authenticated-user'], channels: ['HTTPS'], controls: ['CORS', 'CSRF'], assumptions: ['TLS terminates at an authorized proxy'] },
    { id: 'BROWSER-SOCKET', name: 'Browser to Socket.IO', fromZoneId: 'browser', toZoneId: 'socket', actorIds: ['authenticated-user'], channels: ['WSS'], controls: ['Origin allowlist'], assumptions: ['Socket identity is derived from the session cookie'] },
    { id: 'APP-DATABASE', name: 'Application to MongoDB', fromZoneId: 'api', toZoneId: 'database', actorIds: ['operator'], channels: ['MongoDB protocol'], controls: ['Server-side models'], assumptions: ['Database credentials remain secret'] },
    { id: 'APP-EXTERNAL', name: 'Application to external providers', fromZoneId: 'api', toZoneId: 'external', actorIds: ['operator'], channels: ['HTTPS'], controls: ['Provider credentials'], assumptions: ['Provider endpoints are operator-controlled'] },
  ],
  entryPointGroups: [
    { id: 'HTTP-AUTH', kind: 'http', boundaryId: 'BROWSER-HTTP', pathPrefixes: ['/api/auth'], assetIds: ['accounts'], dataClassIds: ['account-data'] },
    { id: 'HTTP-MESSAGE', kind: 'http', boundaryId: 'BROWSER-HTTP', pathPrefixes: ['/api/message'], assetIds: ['messages'], dataClassIds: ['conversation-data'] },
    { id: 'HTTP-OPERATIONS', kind: 'http', boundaryId: 'BROWSER-HTTP', exactPaths: ['/api/health'], assetIds: [], dataClassIds: [] },
    { id: 'SOCKET-ROOM', kind: 'socket', boundaryId: 'BROWSER-SOCKET', events: ['chat:join'], directions: ['client-to-server-listener'], assetIds: ['messages'], dataClassIds: ['conversation-data'] },
    { id: 'SOCKET-SERVER', kind: 'socket', boundaryId: 'BROWSER-SOCKET', directions: ['server-to-client-listener'], matchAllEvents: true, assetIds: ['messages'], dataClassIds: ['conversation-data'] },
    { id: 'SOCKET-LIFECYCLE', kind: 'socket', boundaryId: 'BROWSER-SOCKET', directions: ['transport-lifecycle'], matchAllEvents: true, assetIds: [], dataClassIds: [] },
    { id: 'SOCKET-DYNAMIC', kind: 'socket', boundaryId: 'BROWSER-SOCKET', dynamic: true, matchAllEvents: true, assetIds: [], dataClassIds: [] },
    { id: 'SERVICE-WORKER', kind: 'service-worker', boundaryId: 'BROWSER-HTTP', events: ['push'], assetIds: ['messages'], dataClassIds: ['conversation-data'] },
    { id: 'BACKGROUND-NOTIFICATION', kind: 'background-job', boundaryId: 'APP-EXTERNAL', sourcePrefixes: ['Backend/Chatify/Services/notificationService.mjs'], assetIds: ['messages'], dataClassIds: ['conversation-data'] },
    { id: 'BACKGROUND-FRONTEND', kind: 'background-job', boundaryId: 'BROWSER-SOCKET', sourcePrefixes: ['Frontend/Chatify/'], assetIds: [], dataClassIds: [] },
  ],
  modelGroups: [
    { id: 'MODEL-ACCOUNT', modelSources: ['Backend/Chatify/Models/userModel.mjs'], assetIds: ['accounts'], dataClassIds: ['account-data'] },
    { id: 'MODEL-MESSAGE', modelSources: ['Backend/Chatify/Models/messageModel.mjs'], assetIds: ['messages'], dataClassIds: ['conversation-data'] },
  ],
  providerGroups: [
    { id: 'PROVIDER-DATABASE', providers: ['mongodb'], boundaryId: 'APP-DATABASE', status: 'runtime-observed' },
    { id: 'PROVIDER-OAUTH', providers: ['google-oauth'], boundaryId: 'APP-EXTERNAL', status: 'runtime-observed' },
    { id: 'PROVIDER-HEURISTIC', providers: ['cloudinary'], boundaryId: 'APP-EXTERNAL', status: 'heuristic-only' },
  ],
  dataFlows: [
    { id: 'FLOW-LOGIN', name: 'Login', fromZoneId: 'browser', toZoneId: 'api', boundaryIds: ['BROWSER-HTTP'], assetIds: ['accounts'], dataClassIds: ['account-data'], invariantIds: ['INV-IDENTITY'], controls: ['CSRF'], failureModes: ['Account takeover'] },
  ],
  invariants: [
    { id: 'INV-IDENTITY', statement: 'Identity comes only from verified credentials and active sessions.', severityIfBroken: 'critical', evidence: ['Backend/Chatify/Middlewares/protectRoutes.mjs'] },
    { id: 'INV-AUTHZ', statement: 'Conversation resources require membership or ownership checks.', severityIfBroken: 'high', evidence: ['Backend/Chatify/Utils/chatAccess.mjs'] },
  ],
  attackerStories: [
    { id: 'STORY-IDOR', title: 'Cross-chat object access', actorId: 'authenticated-user', boundaryIds: ['BROWSER-HTTP'], assetIds: ['messages'], invariantIds: ['INV-AUTHZ'], severity: 'high', preconditions: ['Attacker has an account'], attack: 'Guess another chat identifier.', securityOutcome: 'Read another user conversation.', mitigations: ['Membership checks'] },
  ],
  outOfScope: ['Compromise of the end-user operating system'],
  severityCalibration: {
    critical: ['Authentication bypass exposing many accounts'],
    high: ['Cross-conversation message access'],
    medium: ['Bounded presence disclosure'],
    low: ['Non-sensitive error detail'],
  },
})

test('buildThreatModel maps every Phase 1 surface deterministically', () => {
  const inventory = makeInventory()
  const source = makeSource()
  const first = buildThreatModel({ source, inventory, inventoryText: JSON.stringify(inventory) })
  const second = buildThreatModel({ source, inventory, inventoryText: JSON.stringify(inventory) })

  assert.deepEqual(first, second)
  assert.equal(first.coverage.httpRoutes.mapped, 3)
  assert.equal(first.coverage.httpRoutes.unmapped.length, 0)
  assert.equal(first.coverage.socketEvents.unmapped.length, 0)
  assert.equal(first.coverage.dataModels.unmapped.length, 0)
  assert.equal(first.coverage.externalProviders.unmapped.length, 0)
  assert.equal(first.coverage.backgroundJobs.mapped, 2)
  assert.deepEqual(first.coverage.backgroundJobs.ignoredDevelopmentOnly, ['scripts/security/lib/inventory.mjs'])
  assert.equal(first.exitGate.allCurrentSurfacesMapped, true)
})

test('buildThreatModel fails closed for a new unmapped HTTP route', () => {
  const inventory = makeInventory()
  inventory.entryPoints.httpRoutes.push({
    method: 'POST',
    fullPath: '/api/billing/checkout',
    source: 'Backend/Chatify/Routes/billingRouter.mjs',
    middlewareAndHandlerTokens: ['protect'],
    mountMiddlewareTokens: [],
  })

  assert.throws(
    () => buildThreatModel({ source: makeSource(), inventory, inventoryText: JSON.stringify(inventory) }),
    /Unmapped HTTP route: POST \/api\/billing\/checkout/,
  )
})

test('buildThreatModel fails closed for unmapped socket, model, provider, and runtime job surfaces', () => {
  const inventory = makeInventory()
  inventory.entryPoints.socketEvents.push({ event: 'billing:charge', direction: 'client-to-server-listener', method: 'on', source: 'Backend/Chatify/Config/socket.mjs' })
  inventory.dataModels.push({ source: 'Backend/Chatify/Models/paymentModel.mjs', modelNames: ['Payments'] })
  inventory.externalCommunications.push({ provider: 'payments', evidence: [], environmentVariables: [] })
  inventory.entryPoints.backgroundJobs.push({ kind: 'setInterval', source: 'Backend/Chatify/Services/billingWorker.mjs' })

  assert.throws(
    () => buildThreatModel({ source: makeSource(), inventory, inventoryText: JSON.stringify(inventory) }),
    /Unmapped Socket.IO event: billing:charge[\s\S]*Unmapped data model: Backend\/Chatify\/Models\/paymentModel\.mjs[\s\S]*Unmapped external provider: payments[\s\S]*Unmapped background job: Backend\/Chatify\/Services\/billingWorker\.mjs/,
  )
})

test('validateThreatModelSource rejects broken references and incomplete severity calibration', () => {
  const source = makeSource()
  source.assets[0].invariantIds.push('INV-MISSING')
  source.boundaries[0].actorIds.push('missing-actor')
  source.severityCalibration.low = []

  const failures = validateThreatModelSource(source)
  assert.ok(failures.some((failure) => failure.includes('INV-MISSING')))
  assert.ok(failures.some((failure) => failure.includes('missing-actor')))
  assert.ok(failures.some((failure) => failure.includes('severityCalibration.low')))
})

test('rendered model uses the security threat-model contract and exact cache footer', () => {
  const inventory = makeInventory()
  const model = buildThreatModel({ source: makeSource(), inventory, inventoryText: JSON.stringify(inventory) })
  const markdown = renderThreatModelMarkdown(model)

  assert.match(markdown, /^# Chatify Repository Threat Model/m)
  assert.match(markdown, /^## Overview$/m)
  assert.match(markdown, /^## Threat Model, Trust Boundaries, and Assumptions$/m)
  assert.match(markdown, /^## Attack Surface, Mitigations, and Attacker Stories$/m)
  assert.match(markdown, /^## Severity Calibration \(Critical, High, Medium, Low\)$/m)
  assert.match(markdown, /Repository: MohammedGhazal09\/Chatify\nVersion: 46dff3834a9f727840cfb02a2e8acaef43cf06f8\n$/)
  assert.doesNotMatch(markdown, /generated at/i)
})

test('generated threat-model write/check detects drift', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'chatify-phase2-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'docs/security/audit/phase-2'), { recursive: true })

  const inventory = makeInventory()
  const model = buildThreatModel({ source: makeSource(), inventory, inventoryText: JSON.stringify(inventory) })
  const result = await writeGeneratedThreatModel(root, model)

  assert.deepEqual(result.files.map((file) => path.basename(file)), ['threat-model.json', 'threat-model.md'])
  assert.equal(await checkGeneratedThreatModel(root, model), true)

  await writeFile(path.join(root, 'docs/security/audit/phase-2/threat-model.md'), '# stale\n')
  assert.equal(await checkGeneratedThreatModel(root, model), false)

  const parsed = JSON.parse(await readFile(path.join(root, 'docs/security/audit/phase-2/threat-model.json'), 'utf8'))
  assert.equal(parsed.schemaVersion, 1)
})

test('committed Chatify threat model maps the complete Phase 1 inventory', async () => {
  const root = path.resolve(import.meta.dirname, '../../..')
  const inventoryText = await readFile(path.join(root, 'docs/security/audit/phase-1/inventory.json'), 'utf8')
  const sourceText = await readFile(path.join(root, 'docs/security/audit/phase-2/threat-model.source.json'), 'utf8')
  const model = buildThreatModel({
    source: JSON.parse(sourceText),
    inventory: JSON.parse(inventoryText),
    inventoryText,
  })

  assert.equal(model.coverage.httpRoutes.total, 116)
  assert.equal(model.coverage.socketEvents.total, 67)
  assert.equal(model.coverage.dataModels.total, 22)
  assert.equal(model.coverage.externalProviders.total, 9)
  assert.equal(model.exitGate.allCurrentSurfacesMapped, true)
})

test('nested HTTP trust boundaries can exclude a more-specific prefix', () => {
  const inventory = makeInventory()
  inventory.entryPoints.httpRoutes.push({
    method: 'GET',
    fullPath: '/api/integrations/runtime/manifest',
    source: 'Backend/Chatify/Routes/integrationRuntimeRouter.mjs',
    middlewareAndHandlerTokens: ['integrationRuntimeAuth'],
    mountMiddlewareTokens: ['integrationRuntimeLimiter'],
  })
  const source = makeSource()
  source.entryPointGroups.push(
    { id: 'HTTP-INTEGRATIONS', kind: 'http', boundaryId: 'BROWSER-HTTP', pathPrefixes: ['/api/integrations'], excludePrefixes: ['/api/integrations/runtime'], assetIds: [], dataClassIds: [] },
    { id: 'HTTP-INTEGRATION-RUNTIME', kind: 'http', boundaryId: 'BROWSER-HTTP', pathPrefixes: ['/api/integrations/runtime'], assetIds: [], dataClassIds: [] },
  )

  const model = buildThreatModel({ source, inventory, inventoryText: JSON.stringify(inventory) })
  assert.equal(model.coverage.httpRoutes.unmapped.length, 0)
  assert.equal(model.coverage.httpRoutes.ambiguous.length, 0)
})


test('Phase 2 CLI writes, checks, and prints the model from repository evidence', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'chatify-phase2-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'docs/security/audit/phase-1'), { recursive: true })
  await mkdir(path.join(root, 'docs/security/audit/phase-2'), { recursive: true })

  const inventory = makeInventory()
  await writeFile(
    path.join(root, 'docs/security/audit/phase-1/inventory.json'),
    `${JSON.stringify(inventory, null, 2)}\n`,
  )
  await writeFile(
    path.join(root, 'docs/security/audit/phase-2/threat-model.source.json'),
    `${JSON.stringify(makeSource(), null, 2)}\n`,
  )

  const cli = path.resolve(import.meta.dirname, '../phase2-threat-model.mjs')
  const writeResult = spawnSync(process.execPath, [cli, '--write'], { cwd: root, encoding: 'utf8' })
  assert.equal(writeResult.status, 0, writeResult.stderr)
  assert.match(writeResult.stdout, /Wrote 2 Phase 2 threat-model files/)

  const checkResult = spawnSync(process.execPath, [cli, '--check'], { cwd: root, encoding: 'utf8' })
  assert.equal(checkResult.status, 0, checkResult.stderr)
  assert.match(checkResult.stdout, /Phase 2 generated threat model is current/)

  const jsonResult = spawnSync(process.execPath, [cli, '--json'], { cwd: root, encoding: 'utf8' })
  assert.equal(jsonResult.status, 0, jsonResult.stderr)
  assert.equal(JSON.parse(jsonResult.stdout).repository, 'MohammedGhazal09/Chatify')

  const usageResult = spawnSync(process.execPath, [cli], { cwd: root, encoding: 'utf8' })
  assert.equal(usageResult.status, 2)
  assert.match(usageResult.stderr, /Usage:/)
})


test('Phase 2 reproduction plan validates the inherited baseline before repository quality', () => {
  const plan = buildPhase2CommandPlan()
  assert.deepEqual(plan.map((entry) => entry.name), [
    'clean-install-backend',
    'clean-install-frontend',
    'phase1-inventory-drift-check',
    'phase2-threat-model-tests',
    'phase2-threat-model-drift-check',
    'phase1-environment-doctor',
    'repository-quality-suite',
    'operations-guard',
  ])
  assert.deepEqual(plan.find((entry) => entry.name === 'phase2-threat-model-tests').args, [
    'run',
    'security:phase2:test',
  ])
})


test('Phase 2 output is stable across file-only Phase 1 inventory changes', () => {
  const firstInventory = makeInventory()
  const secondInventory = structuredClone(firstInventory)
  secondInventory.components.trackedFileCount += 50
  secondInventory.components.totalTrackedBytes += 100_000
  secondInventory.components.files = [{ path: 'docs/audit-only.md', sha256: 'a'.repeat(64), bytes: 100_000 }]

  const first = buildThreatModel({
    source: makeSource(),
    inventory: firstInventory,
    inventoryText: `${JSON.stringify(firstInventory, null, 2)}\n`,
  })
  const second = buildThreatModel({
    source: makeSource(),
    inventory: secondInventory,
    inventoryText: `${JSON.stringify(secondInventory, null, 2)}\n`,
  })

  assert.deepEqual(first, second)
  assert.equal(renderThreatModelMarkdown(first), renderThreatModelMarkdown(second))
})
