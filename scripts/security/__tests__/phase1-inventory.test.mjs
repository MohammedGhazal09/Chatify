import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildInventory,
  checkGeneratedInventory,
  renderInventoryMarkdown,
  writeGeneratedInventory,
} from '../lib/inventory.mjs'

const write = async (root, relativePath, content) => {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
}

const createFixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'chatify-phase1-'))

  await write(root, 'package.json', JSON.stringify({
    name: 'fixture-root',
    scripts: {
      quality: 'npm test',
      'ops:check': 'node scripts/ops.mjs',
    },
  }, null, 2))
  await write(root, 'Backend/Chatify/package.json', JSON.stringify({
    name: 'backend',
    scripts: { test: 'vitest run', start: 'node server.mjs' },
    dependencies: { express: '^5.0.0', mongoose: '^8.0.0', axios: '^1.0.0' },
  }, null, 2))
  await write(root, 'Backend/Chatify/package-lock.json', '{"lockfileVersion":3}\n')
  await write(root, 'Frontend/Chatify/package.json', JSON.stringify({
    name: 'frontend',
    scripts: { test: 'vitest run', build: 'vite build' },
    dependencies: { react: '^19.0.0', 'socket.io-client': '^4.0.0' },
  }, null, 2))
  await write(root, 'Frontend/Chatify/package-lock.json', '{"lockfileVersion":3}\n')

  await write(root, 'Backend/Chatify/app.mjs', `
import authRouter from './Routes/authRouter.mjs'
import messageRouter from './Routes/messageRouter.mjs'
app.get('/api/health', health)
app.use('/api/auth', csrfProtection, authRouter)
app.use('/api/message', protect, csrfProtection, messageRouter)
`)
  await write(root, 'Backend/Chatify/Routes/authRouter.mjs', `
router.post('/login', login)
router.get('/verify/:token', verify)
`)
  await write(root, 'Backend/Chatify/Routes/messageRouter.mjs', `
router.post('/', upload.single('file'), createMessage)
router.delete('/:messageId', removeMessage)
`)
  await write(root, 'Backend/Chatify/Config/socket.mjs', `
const CALL_SOCKET_EVENTS = { START: 'call:start' }
io.on('connection', socket => {
  socket.on('chat:join', handler)
  socket.on(CALL_SOCKET_EVENTS.START, handler)
  socket.emit('socket:ready', payload)
  io.in(chatId).emit('message:new', payload)
})
`)
  await write(root, 'Frontend/Chatify/src/socket.ts', `
socket.emit('chat:join', chatId)
socket.on('message:new', onMessage)
`)
  await write(root, 'Frontend/Chatify/public/sw.js', `
self.addEventListener('push', onPush)
self.addEventListener('notificationclick', onClick)
`)

  await write(root, 'Backend/Chatify/Models/userModel.mjs', `
import mongoose from 'mongoose'
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: { type: String, select: false },
  role: { type: String, enum: ['user', 'admin'] },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, expires: 0 },
}, { timestamps: true })
userSchema.index({ email: 1 }, { unique: true })
export default mongoose.model('User', userSchema)
`)
  await write(root, 'Backend/Chatify/Controller/userController.mjs', `
import User from '../Models/userModel.mjs'
export const create = async (req, res) => {
  const { email, password, role } = req.body
  const user = await User.create({ email, password, role })
  res.json({ id: user.id, email: user.email, role: user.role })
}
`)

  await write(root, 'Backend/Chatify/.env.example', `
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/chatify
JWT_ACCESS_SECRET=replace-me
FRONTEND_ORIGIN=http://localhost:5173
TURN_PASSWORD=replace-me
`)
  await write(root, 'Backend/Chatify/config.mjs', `
const mongo = process.env.MONGO_URI
const jwt = process.env.JWT_ACCESS_SECRET
const undeclared = process.env.WEB_PUSH_PUBLIC_KEY
const origin = process.env.FRONTEND_ORIGIN
`)
  await write(root, 'Backend/Chatify/Services/integrationService.mjs', `
import axios from 'axios'
export const deliver = async (targetUrl, payload) => axios.post(targetUrl, payload, {
  timeout: 5000,
  maxRedirects: 0,
  maxContentLength: 1048576,
})
`)
  await write(root, 'Backend/Chatify/server.mjs', `
setInterval(() => cleanup(), 60_000)
`)
  await write(root, '.github/workflows/ci.yml', `
name: CI
jobs:
  test:
    steps:
      - run: npm test
        env:
          API_TOKEN: \${{ secrets.API_TOKEN }}
`)

  return root
}

test('buildInventory discovers Phase 1 surfaces deterministically and redacts secrets', async (t) => {
  const root = await createFixture()
  t.after(() => rm(root, { recursive: true, force: true }))

  const first = await buildInventory(root)
  const second = await buildInventory(root)

  assert.deepEqual(first, second)
  assert.equal(first.schemaVersion, 1)
  assert.equal(first.reproducibility.packages.length, 3)
  assert.deepEqual(
    first.reproducibility.cleanInstallCommands.map((entry) => entry.cwd),
    ['Backend/Chatify', 'Frontend/Chatify'],
  )

  const routes = first.entryPoints.httpRoutes.map((route) => `${route.method} ${route.fullPath}`)
  assert.ok(routes.includes('GET /api/health'))
  assert.ok(routes.includes('POST /api/auth/login'))
  assert.ok(routes.includes('GET /api/auth/verify/:token'))
  assert.ok(routes.includes('POST /api/message/'))
  assert.ok(routes.includes('DELETE /api/message/:messageId'))

  assert.ok(first.entryPoints.socketEvents.some((entry) => (
    entry.direction === 'client-to-server-listener' && entry.event === 'chat:join'
  )))
  assert.ok(first.entryPoints.socketEvents.some((entry) => (
    entry.direction === 'server-to-client-emitter' && entry.event === 'message:new'
  )))
  assert.ok(first.entryPoints.socketEvents.some((entry) => (
    entry.dynamicExpression === 'CALL_SOCKET_EVENTS.START' && entry.event === 'call:start'
  )))
  assert.deepEqual(
    first.entryPoints.serviceWorkerEvents.map((entry) => entry.event),
    ['notificationclick', 'push'],
  )

  const userModel = first.dataModels.find((model) => model.modelNames.includes('User'))
  assert.ok(userModel)
  assert.ok(userModel.fields.some((field) => field.name === 'email'))
  assert.ok(userModel.sensitiveFields.includes('passwordHash'))
  assert.ok(userModel.ownershipFields.includes('ownerId'))
  assert.ok(userModel.roleFields.includes('role'))
  assert.ok(userModel.references.includes('User'))
  assert.ok(userModel.indexes.some((index) => index.options.includes('unique')))
  assert.ok(userModel.clientInputCandidates.includes('email'))
  assert.ok(userModel.responseFieldCandidates.includes('email'))

  const jwtConfig = first.sensitiveConfiguration.variables.find((entry) => entry.name === 'JWT_ACCESS_SECRET')
  assert.ok(jwtConfig)
  assert.equal(jwtConfig.sensitive, true)
  assert.equal(jwtConfig.exampleValue, '<redacted>')
  assert.ok(first.sensitiveConfiguration.missingFromExamples.includes('WEB_PUSH_PUBLIC_KEY'))

  const integration = first.externalCommunications.find((entry) => entry.provider === 'generic-http')
  assert.ok(integration)
  assert.ok(integration.controls.includes('timeout'))
  assert.ok(integration.controls.includes('redirect-limit'))
  assert.equal(integration.userControlledDestinationCandidate, true)

  assert.ok(first.entryPoints.backgroundJobs.some((entry) => entry.kind === 'setInterval'))
  assert.ok(first.components.categories.workflows.includes('.github/workflows/ci.yml'))
})

test('generated inventory write/check detects stale output without timestamps', async (t) => {
  const root = await createFixture()
  t.after(() => rm(root, { recursive: true, force: true }))

  const inventory = await buildInventory(root)
  const markdown = renderInventoryMarkdown(inventory)
  assert.doesNotMatch(markdown, /generated at/i)

  const result = await writeGeneratedInventory(root, inventory)
  assert.equal(result.files.length, 2)
  assert.equal(await checkGeneratedInventory(root, inventory), true)

  await writeFile(path.join(root, 'docs/security/audit/phase-1/inventory.md'), '# stale\n')
  assert.equal(await checkGeneratedInventory(root, inventory), false)

  const json = JSON.parse(await readFile(
    path.join(root, 'docs/security/audit/phase-1/inventory.json'),
    'utf8',
  ))
  assert.equal(json.schemaVersion, 1)
})

test('git-index inventory hashes every tracked file without parsing generated or vendored content', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'chatify-phase1-git-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  await write(root, 'package.json', JSON.stringify({ name: 'tracked-fixture' }, null, 2))
  await write(root, '.artifacts/security/evidence.json', '{"token":"process.env.ARTIFACT_SECRET"}\n')
  await write(root, 'Frontend/Chatify/dist/tracked.js', "router.get('/generated-route', handler)\n")
  await write(root, 'node_modules/tracked-package/index.js', "socket.on('vendored:event', handler)\n")
  await write(root, 'Backend/Chatify/app.mjs', "app.get('/api/health', health)\n")

  execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' })
  execFileSync('git', ['add', '--all'], { cwd: root, stdio: 'ignore' })

  await write(root, 'node_modules/untracked-package/index.js', "app.get('/untracked', handler)\n")

  const inventory = await buildInventory(root)
  const paths = inventory.components.files.map((record) => record.path)
  const routes = inventory.entryPoints.httpRoutes.map((route) => route.fullPath)
  const events = inventory.entryPoints.socketEvents.map((event) => event.event)

  assert.equal(inventory.scope.sourceSelection, 'git-index')
  assert.ok(paths.includes('.artifacts/security/evidence.json'))
  assert.ok(paths.includes('Frontend/Chatify/dist/tracked.js'))
  assert.ok(paths.includes('node_modules/tracked-package/index.js'))
  assert.ok(!paths.includes('node_modules/untracked-package/index.js'))
  assert.ok(inventory.components.categories['generated-or-development-only'].includes('.artifacts/security/evidence.json'))
  assert.ok(inventory.components.categories['generated-or-development-only'].includes('Frontend/Chatify/dist/tracked.js'))
  assert.ok(inventory.components.categories['generated-or-development-only'].includes('node_modules/tracked-package/index.js'))
  assert.ok(routes.includes('/api/health'))
  assert.ok(!routes.includes('/generated-route'))
  assert.ok(!events.includes('vendored:event'))
  assert.ok(!inventory.sensitiveConfiguration.variables.some((entry) => entry.name === 'ARTIFACT_SECRET'))
})
