import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildThreatModel,
  checkGeneratedThreatModel,
  computeRuntimeSurfaceDigest,
  renderThreatModelMarkdown,
  validateThreatModelSource,
  writeGeneratedThreatModel,
} from '../lib/phase2-threat-model.mjs'
import { buildPhase2CommandPlan } from '../lib/phase2-reproduction.mjs'

const makeInventory = () => ({
  schemaVersion: 1,
  repository: { sourceSelection: 'fixture' },
  entryPoints: {
    httpRoutes: [
      {
        method: 'GET',
        fullPath: '/api/health',
        source: 'Backend/Chatify/app.mjs',
        middlewareAndHandlerTokens: ['buildHealthPayload'],
      },
    ],
    socketEvents: [
      {
        event: 'chat:join',
        direction: 'client-to-server-listener',
        source: 'Backend/Chatify/Config/socket.mjs',
      },
    ],
    serviceWorkerEvents: [
      {
        event: 'push',
        source: 'Frontend/Chatify/public/chatify-service-worker.js',
      },
    ],
    backgroundJobs: [
      {
        kind: 'setInterval',
        source: 'Backend/Chatify/Services/notificationService.mjs',
      },
    ],
  },
  dataModels: [
    {
      source: 'Backend/Chatify/Models/userModel.mjs',
      modelName: 'Users',
    },
  ],
  externalCommunications: {
    providers: {
      mongodb: {
        environmentVariables: ['MONGODB_URL'],
        staticHosts: [],
        evidence: ['Backend/Chatify/Config/DBConfig.mjs:4'],
        controlSignals: [],
        userControlledDestinationCandidate: false,
      },
    },
  },
})

const makeSource = () => ({
  schemaVersion: 1,
  review: {
    repository: 'owner/repo',
    baseCommit: 'abc123',
    reviewedAt: '2026-08-20',
    authors: ['security-review'],
    status: 'reviewed',
  },
  severityCalibration: {
    critical: 'Critical impact',
    high: 'High impact',
    medium: 'Medium impact',
    low: 'Low impact',
  },
  actors: [
    { id: 'anonymous', trust: 'external', description: 'Unauthenticated actor' },
    { id: 'user', trust: 'authenticated', description: 'Authenticated user' },
  ],
  zones: [
    { id: 'browser', trust: 'untrusted-client', description: 'Browser' },
    { id: 'app', trust: 'application', description: 'Application' },
    { id: 'database', trust: 'external-provider', description: 'Database' },
  ],
  dataClasses: [
    { id: 'public-metadata', classification: 'public', description: 'Public metadata' },
    { id: 'message-content', classification: 'restricted', description: 'Private content' },
  ],
  assets: [
    {
      id: 'availability',
      name: 'Availability',
      dataClassIds: ['public-metadata'],
      objectives: ['availability'],
    },
    {
      id: 'private-messages',
      name: 'Private messages',
      dataClassIds: ['message-content'],
      objectives: ['confidentiality'],
    },
  ],
  boundaries: [
    {
      id: 'public-api',
      sourceZoneId: 'browser',
      targetZoneId: 'app',
      actorIds: ['anonymous', 'user'],
      dataClassIds: ['public-metadata'],
      assetIds: ['availability'],
      invariantIds: ['INV-HEALTH'],
      description: 'Public API boundary',
    },
    {
      id: 'socket-authenticated',
      sourceZoneId: 'browser',
      targetZoneId: 'app',
      actorIds: ['user'],
      dataClassIds: ['message-content'],
      assetIds: ['private-messages'],
      invariantIds: ['INV-SOCKET'],
      description: 'Socket boundary',
    },
    {
      id: 'database',
      sourceZoneId: 'app',
      targetZoneId: 'database',
      actorIds: ['user'],
      dataClassIds: ['message-content'],
      assetIds: ['private-messages'],
      invariantIds: ['INV-DATABASE'],
      description: 'Database boundary',
    },
  ],
  flows: [
    {
      id: 'FLOW-HEALTH',
      actorId: 'anonymous',
      sourceZoneId: 'browser',
      targetZoneId: 'app',
      boundaryId: 'public-api',
      dataClassIds: ['public-metadata'],
      assetIds: ['availability'],
      invariantIds: ['INV-HEALTH'],
      description: 'Health request',
    },
    {
      id: 'FLOW-MESSAGE',
      actorId: 'user',
      sourceZoneId: 'browser',
      targetZoneId: 'app',
      boundaryId: 'socket-authenticated',
      dataClassIds: ['message-content'],
      assetIds: ['private-messages'],
      invariantIds: ['INV-SOCKET'],
      description: 'Socket message request',
    },
    {
      id: 'FLOW-DATABASE',
      actorId: 'user',
      sourceZoneId: 'app',
      targetZoneId: 'database',
      boundaryId: 'database',
      dataClassIds: ['message-content'],
      assetIds: ['private-messages'],
      invariantIds: ['INV-DATABASE'],
      description: 'Database persistence',
    },
  ],
  invariants: [
    {
      id: 'INV-HEALTH',
      statement: 'Health responses remain public and minimal.',
      ownerPhase: 6,
      validation: ['HTTP review'],
    },
    {
      id: 'INV-SOCKET',
      statement: 'Sockets enforce authenticated membership.',
      ownerPhase: 13,
      validation: ['Socket authorization tests'],
    },
    {
      id: 'INV-DATABASE',
      statement: 'Database access preserves ownership.',
      ownerPhase: 10,
      validation: ['Database authorization review'],
    },
  ],
  attackerStories: [
    {
      id: 'ATTACK-SOCKET',
      title: 'Unauthorized socket access',
      attackerActorId: 'user',
      targetAssetIds: ['private-messages'],
      boundaryIds: ['socket-authenticated'],
      invariantIds: ['INV-SOCKET'],
      validationOwnerPhases: [13],
      severity: 'high',
      preconditions: ['Attacker has a user account'],
      steps: ['Emit a room event for another chat'],
      impact: 'Private message access',
    },
  ],
  httpGroups: [
    {
      id: 'HTTP-PUBLIC',
      prefixes: ['/api/health'],
      methods: ['GET'],
      boundaryId: 'public-api',
      assetIds: ['availability'],
      dataClassIds: ['public-metadata'],
    },
  ],
  socketGroups: [
    {
      id: 'SOCKET-AUTHENTICATED',
      directions: ['client-to-server-listener'],
      eventPrefixes: ['chat:'],
      boundaryId: 'socket-authenticated',
      assetIds: ['private-messages'],
      dataClassIds: ['message-content'],
    },
  ],
  entryPointGroups: [
    {
      id: 'BACKGROUND-NOTIFICATIONS',
      kind: 'background-job',
      sourcePrefixes: ['Backend/Chatify/Services/notificationService.mjs'],
      boundaryId: 'database',
      assetIds: ['private-messages'],
      dataClassIds: ['message-content'],
    },
    {
      id: 'SERVICE-WORKER',
      kind: 'service-worker-event',
      sourcePrefixes: ['Frontend/Chatify/public/chatify-service-worker.js'],
      boundaryId: 'socket-authenticated',
      assetIds: ['private-messages'],
      dataClassIds: ['message-content'],
    },
  ],
  modelGroups: [
    {
      id: 'MODELS-PRIVATE',
      modelSources: ['Backend/Chatify/Models/userModel.mjs'],
      assetIds: ['private-messages'],
      dataClassIds: ['message-content'],
    },
  ],
  providerGroups: [
    {
      id: 'PROVIDER-MONGODB',
      providerNames: ['mongodb'],
      boundaryId: 'database',
      assetIds: ['private-messages'],
      dataClassIds: ['message-content'],
    },
  ],
})

test('buildThreatModel maps every Phase 1 surface deterministically', () => {
  const model = buildThreatModel({
    source: makeSource(),
    inventory: makeInventory(),
    inventoryText: JSON.stringify(makeInventory()),
  })

  assert.equal(model.coverage.httpRoutes.unmapped, 0)
  assert.equal(model.coverage.socketEvents.unmapped, 0)
  assert.equal(model.coverage.serviceWorkerEvents.unmapped, 0)
  assert.equal(model.coverage.backgroundJobs.unmapped, 0)
  assert.equal(model.coverage.dataModels.unmapped, 0)
  assert.equal(model.coverage.externalProviders.unmapped, 0)
  assert.equal(model.exitGate.allCurrentSurfacesMapped, true)
})

test('buildThreatModel fails closed for a new unmapped HTTP route', () => {
  const inventory = makeInventory()
  inventory.entryPoints.httpRoutes.push({
    method: 'POST',
    fullPath: '/api/unmapped',
    source: 'Backend/Chatify/Routes/unmappedRouter.mjs',
    middlewareAndHandlerTokens: ['unmapped'],
  })
  assert.throws(
    () => buildThreatModel({ source: makeSource(), inventory, inventoryText: JSON.stringify(inventory) }),
    /Unmapped Phase 1 HTTP route/
  )
})

test('buildThreatModel fails closed for unmapped socket, model, provider, and runtime job surfaces', () => {
  const source = makeSource()
  const inventory = makeInventory()
  inventory.entryPoints.socketEvents.push({
    event: 'admin:unmapped',
    direction: 'client-to-server-listener',
    source: 'Backend/Chatify/Config/socket.mjs',
  })
  assert.throws(
    () => buildThreatModel({ source, inventory, inventoryText: JSON.stringify(inventory) }),
    /Unmapped Phase 1 socket event/
  )

  const modelInventory = makeInventory()
  modelInventory.dataModels.push({
    source: 'Backend/Chatify/Models/newSensitiveModel.mjs',
    modelName: 'NewSensitive',
  })
  assert.throws(
    () => buildThreatModel({ source, inventory: modelInventory, inventoryText: JSON.stringify(modelInventory) }),
    /Unmapped Phase 1 data model/
  )

  const providerInventory = makeInventory()
  providerInventory.externalCommunications.providers.webhook = {
    environmentVariables: [],
    staticHosts: [],
    evidence: ['Backend/Chatify/Services/webhook.mjs:1'],
    controlSignals: [],
    userControlledDestinationCandidate: true,
  }
  assert.throws(
    () => buildThreatModel({ source, inventory: providerInventory, inventoryText: JSON.stringify(providerInventory) }),
    /Unmapped Phase 1 external provider/
  )

  const jobInventory = makeInventory()
  jobInventory.entryPoints.backgroundJobs.push({
    kind: 'setInterval',
    source: 'Backend/Chatify/Services/newWorker.mjs',
  })
  assert.throws(
    () => buildThreatModel({ source, inventory: jobInventory, inventoryText: JSON.stringify(jobInventory) }),
    /Unmapped Phase 1 background job/
  )
})

test('validateThreatModelSource rejects broken references and incomplete severity calibration', () => {
  const source = makeSource()
  source.boundaries[0].actorIds = ['missing']
  source.severityCalibration.low = ''
  assert.throws(
    () => validateThreatModelSource(source),
    /references missing actor|Severity calibration low must be populated/
  )
})

test('rendered model uses the security threat-model contract and exact cache footer', () => {
  const model = buildThreatModel({
    source: makeSource(),
    inventory: makeInventory(),
    inventoryText: JSON.stringify(makeInventory()),
  })
  const markdown = renderThreatModelMarkdown(model)
  assert.match(markdown, /^# Threat Model: owner\/repo/m)
  assert.match(markdown, /## 1\. System Overview/)
  assert.match(markdown, /## 7\. Threat Summary/)
  assert.match(markdown, /<!-- security-threat-model-cache: begin -->/)
  assert.match(markdown, /digest:/)
  assert.match(markdown, /<!-- security-threat-model-cache: end -->/)
})

test('generated threat-model write/check detects drift', async () => {
  const root = await mkdir(path.join(os.tmpdir(), `chatify-phase2-${Date.now()}`), { recursive: true }).then(() => (
    path.join(os.tmpdir(), `chatify-phase2-${Date.now()}`)
  ))
  await mkdir(path.join(root, 'docs/security/audit/phase-2'), { recursive: true })
  const model = buildThreatModel({
    source: makeSource(),
    inventory: makeInventory(),
    inventoryText: JSON.stringify(makeInventory()),
  })
  await writeGeneratedThreatModel(root, model)
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
  assert.equal(model.coverage.dataModels.total, 23)
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
  })
  const source = makeSource()
  source.httpGroups = [
    {
      id: 'HTTP-INTEGRATIONS',
      prefixes: ['/api/integrations'],
      excludePrefixes: ['/api/integrations/runtime'],
      boundaryId: 'public-api',
      assetIds: ['availability'],
      dataClassIds: ['public-metadata'],
    },
    {
      id: 'HTTP-INTEGRATION-RUNTIME',
      prefixes: ['/api/integrations/runtime'],
      boundaryId: 'public-api',
      assetIds: ['availability'],
      dataClassIds: ['public-metadata'],
    },
  ]
  const model = buildThreatModel({
    source,
    inventory,
    inventoryText: JSON.stringify(inventory),
  })
  const mappings = model.coverage.httpRoutes.items.filter((item) => (
    item.key === 'GET /api/integrations/runtime/manifest'
  ))
  assert.equal(mappings.length, 1)
  assert.equal(mappings[0].groupId, 'HTTP-INTEGRATION-RUNTIME')
})

test('Phase 2 CLI writes, checks, and prints the model from repository evidence', async () => {
  const root = path.resolve(import.meta.dirname, '../../..')
  const inventoryText = await readFile(path.join(root, 'docs/security/audit/phase-1/inventory.json'), 'utf8')
  const sourceText = await readFile(path.join(root, 'docs/security/audit/phase-2/threat-model.source.json'), 'utf8')
  const source = JSON.parse(sourceText)
  const inventory = JSON.parse(inventoryText)
  const model = buildThreatModel({ source, inventory, inventoryText })

  assert.equal(model.schemaVersion, 1)
  assert.equal(model.runtimeSurfaceDigest, computeRuntimeSurfaceDigest(inventory))
})

test('Phase 2 reproduction plan validates the inherited baseline before repository quality', () => {
  const plan = buildPhase2CommandPlan()
  assert.deepEqual(plan.map((item) => item.name), [
    'clean-install-backend',
    'clean-install-frontend',
    'phase1-inventory-drift-check',
    'phase2-threat-model-tests',
    'phase2-threat-model-drift-check',
    'phase1-environment-doctor',
    'repository-quality-suite',
    'operations-guard',
  ])
})

test('Phase 2 output is stable across file-only Phase 1 inventory changes', () => {
  const source = makeSource()
  const inventory = makeInventory()
  const base = buildThreatModel({
    source,
    inventory,
    inventoryText: JSON.stringify(inventory),
  })
  const changedInventory = {
    ...inventory,
    files: [{ path: 'docs/readme.md', sha256: 'deadbeef' }],
  }
  const changed = buildThreatModel({
    source,
    inventory: changedInventory,
    inventoryText: JSON.stringify(changedInventory),
  })
  assert.equal(base.runtimeSurfaceDigest, changed.runtimeSurfaceDigest)
  assert.equal(base.inventorySha256, changed.inventorySha256)
})
