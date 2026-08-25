import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  collectLiveSupplyChainEvidence,
  inspectInstallScriptCoverage,
  sanitizeStructuredEvidence,
} from '../lib/live-supply-chain.mjs'

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chatify-phase4-live-'))
  const projectDir = path.join(root, 'Backend/Chatify')
  await mkdir(projectDir, { recursive: true })
  await mkdir(path.join(root, 'docs/security/audit/phase-4'), { recursive: true })
  await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
    name: 'backend',
    version: '1.0.0',
    allowScripts: {
      'native-addon@1.0.0': true,
      'denied-addon': false,
    },
  }, null, 2))
  await writeFile(path.join(projectDir, 'package-lock.json'), JSON.stringify({
    name: 'backend',
    lockfileVersion: 3,
    packages: {
      '': { name: 'backend', version: '1.0.0' },
      'node_modules/example': {
        version: '1.2.3',
        resolved: 'https://registry.npmjs.org/example/-/example-1.2.3.tgz',
        integrity: 'sha512-QUJDRA==',
      },
      'node_modules/native-addon': {
        version: '1.0.0',
        resolved: 'https://registry.npmjs.org/native-addon/-/native-addon-1.0.0.tgz',
        integrity: 'sha512-QUJDRA==',
        hasInstallScript: true,
      },
      'node_modules/denied-addon': {
        version: '2.0.0',
        resolved: 'https://registry.npmjs.org/denied-addon/-/denied-addon-2.0.0.tgz',
        integrity: 'sha512-QUJDRA==',
        hasInstallScript: true,
      },
    },
  }, null, 2))
  await writeFile(path.join(root, 'docs/security/audit/phase-4/dependency-exceptions.json'), JSON.stringify({
    schemaVersion: 1,
    entries: [],
  }, null, 2))
  return { root, projectDir }
}

test('install-script coverage requires version-pinned approvals or explicit name-wide denials', () => {
  const lockfile = {
    packages: {
      'node_modules/native-addon': { version: '1.0.0', hasInstallScript: true },
      'node_modules/denied-addon': { version: '2.0.0', hasInstallScript: true },
      'node_modules/unreviewed-addon': { version: '3.0.0', hasInstallScript: true },
    },
  }
  const coverage = inspectInstallScriptCoverage({
    manifest: {
      allowScripts: {
        'native-addon@1.0.0': true,
        'denied-addon': false,
        'unreviewed-addon': true,
      },
    },
    lockfile,
  })
  assert.equal(coverage.reviewedCount, 2)
  assert.equal(coverage.pendingCount, 1)
  assert.deepEqual(coverage.pendingPackages, ['unreviewed-addon@3.0.0'])
  assert.deepEqual(coverage.entries.map((entry) => entry.decision), ['deny', 'allow', 'unreviewed'])
})

test('structured evidence strips URL credentials and secret-like fields recursively', () => {
  const sanitized = sanitizeStructuredEvidence({
    registry: 'https://user:password@registry.example.test/npm?token=abc#fragment',
    message: ['request to https://user:', 'password@registry.example.test/npm?token=abc#fragment failed'].join(''),
    npmToken: 'top-secret',
    nested: [{ authorization: 'Bearer token-value', value: 'safe' }],
  })
  assert.equal(sanitized.registry, 'https://registry.example.test/npm')
  assert.equal(sanitized.message, 'request to https://registry.example.test/npm failed')
  assert.equal(sanitized.npmToken, '[redacted]')
  assert.equal(sanitized.nested[0].authorization, '[redacted]')
  assert.equal(sanitized.nested[0].value, 'safe')
})

test('live supply-chain evidence runs exact npm commands and writes sanitized artifacts', async () => {
  const { root, projectDir } = await createFixture()
  const calls = []
  const results = new Map([
    ['audit signatures --json', {
      status: 0,
      stdout: JSON.stringify({ audited: 1, verifiedSignatures: 1, registry: ['https://user:', 'secret@registry.npmjs.org/'].join('') }),
      stderr: '',
    }],
    ['audit --omit=dev --json', {
      status: 0,
      stdout: JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { high: 0, critical: 0 } } }),
      stderr: '',
    }],
    ['sbom --package-lock-only --sbom-format=cyclonedx --sbom-type=application', {
      status: 0,
      stdout: JSON.stringify({ bomFormat: 'CycloneDX', components: [{ name: 'example', version: '1.2.3' }] }),
      stderr: '',
    }],
  ])
  const runCommand = ({ command, args, cwd }) => {
    assert.equal(command, 'npm')
    assert.equal(cwd, projectDir)
    const key = args.join(' ')
    calls.push(key)
    return results.get(key) ?? { status: 127, stdout: '', stderr: 'unexpected command' }
  }

  const report = await collectLiveSupplyChainEvidence({
    root,
    project: 'backend',
    directory: 'Backend/Chatify',
    runCommand,
    now: new Date('2026-08-21T00:00:00.000Z'),
  })

  assert.deepEqual(calls, [...results.keys()])
  assert.equal(report.summary.result, 'passed')
  assert.equal(report.installScripts.pendingCount, 0)
  assert.equal(report.installScripts.reviewedCount, 2)
  assert.equal(report.audit.summary.blocking, 0)
  assert.equal(report.signatures.verified, true)
  assert.equal(report.sbom.bomFormat, 'CycloneDX')

  const outputDir = path.join(root, '.artifacts/security/phase-4/backend')
  const signature = JSON.parse(await readFile(path.join(outputDir, 'registry-signatures.json'), 'utf8'))
  assert.equal(signature.registry, 'https://registry.npmjs.org/')
  assert.equal(JSON.stringify(signature).includes('user:secret'), false)
  const evidence = JSON.parse(await readFile(path.join(outputDir, 'live-evidence.json'), 'utf8'))
  assert.equal(evidence.summary.result, 'passed')
})

test('live supply-chain evidence reports pending scripts, command failures, and blocking advisories', async () => {
  const { root, projectDir } = await createFixture()
  await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
    name: 'backend',
    version: '1.0.0',
    allowScripts: { 'denied-addon': false },
  }, null, 2))
  const runCommand = ({ args, cwd }) => {
    assert.equal(cwd, projectDir)
    const key = args.join(' ')
    if (key === 'audit signatures --json') return { status: 1, stdout: '{"error":"missing signature"}', stderr: 'ignored' }
    if (key === 'audit --omit=dev --json') {
      return {
        status: 1,
        stdout: JSON.stringify({
          auditReportVersion: 2,
          vulnerabilities: {
            example: {
              name: 'example',
              severity: 'high',
              isDirect: true,
              via: [{
                source: 123,
                name: 'example',
                dependency: 'example',
                title: 'Example high advisory',
                url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
                severity: 'high',
                range: '<1.2.4',
              }],
              effects: [],
              range: '<1.2.4',
              nodes: ['node_modules/example'],
              fixAvailable: true,
            },
          },
          metadata: { vulnerabilities: { high: 1, critical: 0 } },
        }),
        stderr: '',
      }
    }
    return { status: 1, stdout: '{"error":"sbom failed"}', stderr: 'ignored' }
  }

  const report = await collectLiveSupplyChainEvidence({
    root,
    project: 'backend',
    directory: 'Backend/Chatify',
    runCommand,
    now: new Date('2026-08-21T00:00:00.000Z'),
  })

  assert.equal(report.summary.result, 'failed')
  assert.equal(report.installScripts.pendingCount, 1)
  assert.equal(report.audit.summary.blocking, 1)
  assert.equal(report.signatures.verified, false)
  assert.equal(report.sbom.generated, false)
  assert.deepEqual(report.summary.failedGates, [
    'noPendingInstallScripts',
    'registrySignaturesVerified',
    'noBlockingAdvisories',
    'sbomGenerated',
  ])
})
