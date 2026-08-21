import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  assertPhase4ExitGate,
  buildDependencyPolicy,
  checkGeneratedDependencyPolicy,
  evaluateNpmAuditReport,
  renderDependencyPolicyMarkdown,
  validateDependencyExceptions,
  validateInstallScriptPolicy,
  writeGeneratedDependencyPolicy,
} from '../lib/dependency-policy.mjs'

const NOW = new Date('2026-08-21T00:00:00.000Z')

const writeJson = (filePath, value) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)

const lockfile = ({
  name,
  dependencies = {},
  devDependencies = {},
  packageEntries = {},
} = {}) => ({
  name,
  version: '1.0.0',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': {
      name,
      version: '1.0.0',
      dependencies,
      devDependencies,
    },
    ...packageEntries,
  },
})

const registryEntry = (name, version, overrides = {}) => ({
  version,
  resolved: `https://registry.npmjs.org/${name.replace('/', '%2f')}/-/${name.split('/').at(-1)}-${version}.tgz`,
  integrity: 'sha512-Zml4dHVyZS1sb2NrZmlsZS1pbnRlZ3JpdHktZml4dHVyZS1vbmx5',
  license: 'MIT',
  ...overrides,
})

const createFixture = async ({ unsafe = false, includeDependabot = true } = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chatify-phase4-policy-'))
  const backend = path.join(root, 'Backend/Chatify')
  const frontend = path.join(root, 'Frontend/Chatify')
  const workflows = path.join(root, '.github/workflows')
  const docs = path.join(root, 'docs/security/audit/phase-4')
  await Promise.all([
    mkdir(backend, { recursive: true }),
    mkdir(frontend, { recursive: true }),
    mkdir(workflows, { recursive: true }),
    mkdir(docs, { recursive: true }),
  ])

  const backendManifest = {
    name: 'backend',
    version: '1.0.0',
    dependencies: { axios: '^1.18.0' },
    devDependencies: { argon2: '^0.43.1' },
    allowScripts: {
      'argon2@0.43.1': true,
    },
  }
  const frontendManifest = {
    name: 'frontend',
    version: '1.0.0',
    dependencies: { react: '^19.2.0' },
    devDependencies: {},
    allowScripts: {},
  }

  await writeJson(path.join(backend, 'package.json'), backendManifest)
  await writeJson(path.join(frontend, 'package.json'), frontendManifest)
  await writeJson(path.join(backend, 'package-lock.json'), lockfile({
    name: 'backend',
    dependencies: backendManifest.dependencies,
    devDependencies: backendManifest.devDependencies,
    packageEntries: {
      'node_modules/axios': registryEntry('axios', '1.18.0'),
      'node_modules/argon2': registryEntry('argon2', '0.43.1', { dev: true, hasInstallScript: true }),
      ...(unsafe ? {
        'node_modules/unsafe-git': {
          version: 'git+https://github.com/example/unsafe.git#main',
          resolved: 'git+https://github.com/example/unsafe.git#main',
        },
        'node_modules/missing-integrity': {
          version: '1.2.3',
          resolved: 'http://registry.example.invalid/missing-integrity-1.2.3.tgz',
        },
      } : {}),
    },
  }))
  await writeJson(path.join(frontend, 'package-lock.json'), lockfile({
    name: 'frontend',
    dependencies: frontendManifest.dependencies,
    packageEntries: {
      'node_modules/react': registryEntry('react', '19.2.0'),
    },
  }))

  await writeFile(path.join(workflows, 'ci.yml'), unsafe
    ? 'steps:\n  - uses: actions/checkout@v4\n'
    : 'steps:\n  - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262\n')

  if (includeDependabot) {
    await writeFile(path.join(root, '.github/dependabot.yml'), `version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /Backend/Chatify\n    schedule:\n      interval: weekly\n  - package-ecosystem: npm\n    directory: /Frontend/Chatify\n    schedule:\n      interval: weekly\n  - package-ecosystem: github-actions\n    directory: /\n    schedule:\n      interval: weekly\n`)
  }

  await writeJson(path.join(docs, 'dependency-exceptions.json'), { schemaVersion: 1, entries: [] })
  await writeJson(path.join(docs, 'install-script-policy.json'), {
    schemaVersion: 1,
    entries: [{
      project: 'backend',
      package: 'argon2',
      version: '0.43.1',
      decision: 'allow',
      owner: 'security-maintainers',
      reason: 'Argon2 requires its reviewed native binding installation step.',
    }],
  })

  return root
}

test('buildDependencyPolicy records deterministic lockfile, script, workflow, and update evidence', async () => {
  const root = await createFixture()
  const report = await buildDependencyPolicy(root, { now: NOW })

  assert.equal(report.phase, 4)
  assert.deepEqual(report.projects.map((project) => project.id), ['backend', 'frontend'])
  assert.equal(report.projects[0].lockfile.packageCount, 2)
  assert.equal(report.projects[0].lockfile.productionPackageCount, 1)
  assert.equal(report.projects[0].lockfile.devPackageCount, 1)
  assert.equal(report.projects[0].lockfile.integrityCoverage.complete, true)
  assert.deepEqual(report.projects[0].installScripts, [{
    package: 'argon2',
    version: '0.43.1',
    lockPath: 'node_modules/argon2',
    decision: 'allow',
  }])
  assert.equal(report.workflows.remoteActions[0].pinned, true)
  assert.equal(report.dependabot.complete, true)
  assert.deepEqual(report.violations, [])
  assert.equal(Object.values(report.exitGate).every(Boolean), true)
  assert.doesNotThrow(() => assertPhase4ExitGate(report))

  const markdown = renderDependencyPolicyMarkdown(report)
  assert.match(markdown, /Phase 4 Dependency and Supply-Chain Policy/)
  assert.match(markdown, /argon2@0\.43\.1/)
  assert.equal(markdown.includes(new Date().toISOString()), false)
})

test('bundled lockfile packages inherit source and integrity from their parent artifact', async () => {
  const root = await createFixture()
  const lockPath = path.join(root, 'Backend/Chatify/package-lock.json')
  const parsed = JSON.parse(await readFile(lockPath, 'utf8'))
  parsed.packages['node_modules/axios/node_modules/bundled-helper'] = {
    version: '1.2.3',
    inBundle: true,
  }
  await writeJson(lockPath, parsed)

  const report = await buildDependencyPolicy(root, { now: NOW })
  const bundled = report.projects[0].packages.find((item) => item.package === 'bundled-helper')

  assert.equal(bundled.sourceType, 'bundled')
  assert.equal(bundled.integrityInherited, true)
  assert.equal(bundled.bundleParentPath, 'node_modules/axios')
  assert.equal(report.projects[0].lockfile.integrityCoverage.complete, true)
  assert.equal(report.violations.some((item) => item.package === 'bundled-helper'), false)
  assert.doesNotThrow(() => assertPhase4ExitGate(report))
})

test('bundled status cannot bypass source and integrity without a verified parent artifact', async () => {
  const root = await createFixture()
  const lockPath = path.join(root, 'Backend/Chatify/package-lock.json')
  const parsed = JSON.parse(await readFile(lockPath, 'utf8'))
  parsed.packages['node_modules/unverified-bundled-helper'] = {
    version: '1.2.3',
    inBundle: true,
  }
  await writeJson(lockPath, parsed)

  const report = await buildDependencyPolicy(root, { now: NOW })
  assert.equal(report.violations.some((item) => (
    item.code === 'dependency-bundle-parent-unverified'
    && item.package === 'unverified-bundled-helper'
  )), true)
  assert.throws(() => assertPhase4ExitGate(report), /dependencySourcesTrusted/)
})

test('obsolete SHA-1 lockfile integrity is rejected', async () => {
  const root = await createFixture()
  const lockPath = path.join(root, 'Backend/Chatify/package-lock.json')
  const parsed = JSON.parse(await readFile(lockPath, 'utf8'))
  parsed.packages['node_modules/axios'].integrity = 'sha1-QUJDRA=='
  await writeJson(lockPath, parsed)

  const report = await buildDependencyPolicy(root, { now: NOW })
  assert.equal(report.violations.some((item) => (
    item.code === 'dependency-integrity-missing'
    && item.package === 'axios'
  )), true)
  assert.throws(() => assertPhase4ExitGate(report), /dependencyIntegrityComplete/)
})

test('unsafe sources, missing integrity, mutable actions, and missing update coverage fail closed', async () => {
  const root = await createFixture({ unsafe: true, includeDependabot: false })
  const report = await buildDependencyPolicy(root, { now: NOW })
  const codes = report.violations.map((violation) => violation.code)

  assert.ok(codes.includes('dependency-source-git'))
  assert.ok(codes.includes('dependency-source-insecure-http'))
  assert.ok(codes.includes('dependency-integrity-missing'))
  assert.ok(codes.includes('workflow-action-mutable-ref'))
  assert.ok(codes.includes('dependabot-coverage-missing'))
  assert.throws(() => assertPhase4ExitGate(report), /Phase 4 exit gate failed/)
})

test('manifest and lockfile root metadata must agree', async () => {
  const root = await createFixture()
  const lockPath = path.join(root, 'Backend/Chatify/package-lock.json')
  const parsed = JSON.parse(await readFile(lockPath, 'utf8'))
  parsed.packages[''].dependencies.axios = '^1.17.0'
  await writeJson(lockPath, parsed)

  const report = await buildDependencyPolicy(root, { now: NOW })
  assert.ok(report.violations.some((violation) => violation.code === 'lockfile-root-mismatch'))
})

test('dependency exceptions are exact, accountable, controlled, short-lived, and never critical', () => {
  const valid = validateDependencyExceptions({
    schemaVersion: 1,
    entries: [{
      project: 'backend',
      package: 'axios',
      version: '1.18.0',
      advisoryId: 'GHSA-aaaa-bbbb-cccc',
      severity: 'high',
      owner: 'security-maintainers',
      reason: 'Temporary exception while the compatible upstream patch is validated.',
      compensatingControls: ['The affected adapter is disabled at the application boundary.'],
      expiresAt: '2026-09-20T00:00:00.000Z',
    }],
  }, { now: NOW })
  assert.equal(valid.size, 1)

  const invalidEntries = [
    { package: '*', version: '1.0.0', advisoryId: 'GHSA-aaaa-bbbb-cccc', severity: 'high' },
    { package: 'axios', version: '^1.0.0', advisoryId: 'GHSA-aaaa-bbbb-cccc', severity: 'high' },
    { package: 'axios', version: '1.0.0', advisoryId: 'unknown', severity: 'high' },
    { package: 'axios', version: '1.0.0', advisoryId: 'GHSA-aaaa-bbbb-cccc', severity: 'critical' },
  ]

  for (const entry of invalidEntries) {
    assert.throws(() => validateDependencyExceptions({
      schemaVersion: 1,
      entries: [{
        project: 'backend',
        owner: 'security-maintainers',
        reason: 'A specific temporary exception with compensating controls.',
        compensatingControls: ['A concrete application-level mitigation remains enforced.'],
        expiresAt: '2026-09-20T00:00:00.000Z',
        ...entry,
      }],
    }, { now: NOW }), /exception|package|version|advisory|critical/i)
  }

  assert.throws(() => validateDependencyExceptions({
    schemaVersion: 1,
    entries: [{
      project: 'backend',
      package: 'axios',
      version: '1.0.0',
      advisoryId: 'GHSA-aaaa-bbbb-cccc',
      severity: 'high',
      owner: '',
      reason: 'short',
      compensatingControls: [],
      expiresAt: '2027-01-01T00:00:00.000Z',
    }],
  }, { now: NOW }), /owner|reason|compensating|90 days/i)
})

test('install-script policy requires version-pinned allows and name-wide denials', () => {
  const valid = validateInstallScriptPolicy({
    schemaVersion: 1,
    entries: [
      {
        project: 'backend',
        package: 'argon2',
        version: '0.43.1',
        decision: 'allow',
        owner: 'security-maintainers',
        reason: 'Reviewed native binding installation is required for password hashing.',
      },
      {
        project: 'backend',
        package: 'mongodb-memory-server',
        decision: 'deny',
        owner: 'security-maintainers',
        reason: 'Eager binary download is denied and tests download only when explicitly executed.',
      },
    ],
  })
  assert.equal(valid.entries.length, 2)

  assert.throws(() => validateInstallScriptPolicy({
    schemaVersion: 1,
    entries: [{
      project: 'backend',
      package: 'argon2',
      decision: 'allow',
      owner: 'security-maintainers',
      reason: 'Broad approval is unsafe and must include an exact version.',
    }],
  }), /version/i)
  assert.throws(() => validateInstallScriptPolicy({
    schemaVersion: 1,
    entries: [{
      project: 'backend',
      package: 'mongodb-memory-server',
      version: '11.2.0',
      decision: 'deny',
      owner: 'security-maintainers',
      reason: 'Denials must remain name-wide across dependency updates.',
    }],
  }), /denial|version/i)
})

test('npm audit findings are matched only by exact project, package, version, and advisory', () => {
  const exceptions = validateDependencyExceptions({
    schemaVersion: 1,
    entries: [{
      project: 'backend',
      package: 'axios',
      version: '1.18.0',
      advisoryId: 'GHSA-aaaa-bbbb-cccc',
      severity: 'high',
      owner: 'security-maintainers',
      reason: 'Temporary exact exception while the upstream release is verified.',
      compensatingControls: ['The vulnerable request construction path is not reachable from user input.'],
      expiresAt: '2026-09-20T00:00:00.000Z',
    }],
  }, { now: NOW })
  const audit = {
    auditReportVersion: 2,
    vulnerabilities: {
      axios: {
        name: 'axios',
        severity: 'high',
        isDirect: true,
        via: [{
          source: 123,
          name: 'axios',
          dependency: 'axios',
          title: 'Fixture advisory',
          url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
          severity: 'high',
          range: '<1.18.1',
        }],
        effects: [],
        range: '<1.18.1',
        nodes: ['node_modules/axios'],
        fixAvailable: true,
      },
    },
    metadata: { vulnerabilities: { high: 1, critical: 0, total: 1 } },
  }
  const lock = lockfile({
    name: 'backend',
    dependencies: { axios: '^1.18.0' },
    packageEntries: { 'node_modules/axios': registryEntry('axios', '1.18.0') },
  })

  const result = evaluateNpmAuditReport({
    project: 'backend',
    audit,
    lockfile: lock,
    exceptions,
  })
  assert.equal(result.findings.length, 1)
  assert.equal(result.findings[0].excepted, true)
  assert.equal(result.summary.blocking, 0)

  const changedLock = structuredClone(lock)
  changedLock.packages['node_modules/axios'].version = '1.18.1'
  const changed = evaluateNpmAuditReport({ project: 'backend', audit, lockfile: changedLock, exceptions })
  assert.equal(changed.findings[0].excepted, false)
  assert.equal(changed.summary.blocking, 1)
})

test('generated dependency policy detects stale evidence and remains self-stable', async () => {
  const root = await createFixture()
  const report = await buildDependencyPolicy(root, { now: NOW })
  await writeGeneratedDependencyPolicy(root, report)
  assert.equal(await checkGeneratedDependencyPolicy(root, report), true)

  await writeFile(path.join(root, 'docs/security/audit/phase-4/dependency-policy.md'), '# stale\n')
  assert.equal(await checkGeneratedDependencyPolicy(root, report), false)

  await writeGeneratedDependencyPolicy(root, report)
  const rebuilt = await buildDependencyPolicy(root, { now: NOW })
  assert.deepEqual(rebuilt, report)
})
