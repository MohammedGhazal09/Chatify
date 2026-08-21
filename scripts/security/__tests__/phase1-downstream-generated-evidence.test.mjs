import assert from 'node:assert/strict'
import test from 'node:test'

import { PHASE1_EXCLUDED_GENERATED_PATHS } from '../lib/inventory.mjs'

const REQUIRED_DOWNSTREAM_GENERATED_PATHS = [
  'docs/security/audit/phase-2/threat-model.json',
  'docs/security/audit/phase-2/threat-model.md',
  'docs/security/audit/phase-3/secret-scan.json',
  'docs/security/audit/phase-3/secret-scan.md',
  'docs/security/audit/phase-4/dependency-policy.json',
  'docs/security/audit/phase-4/dependency-policy.md',
  'docs/security/audit/phase-5/authentication-policy.json',
  'docs/security/audit/phase-5/authentication-policy.md',
]

test('Phase 1 excludes deterministic downstream audit evidence from its repository hash', () => {
  assert.deepEqual(
    PHASE1_EXCLUDED_GENERATED_PATHS,
    [...new Set(PHASE1_EXCLUDED_GENERATED_PATHS)].sort(),
  )

  for (const relativePath of REQUIRED_DOWNSTREAM_GENERATED_PATHS) {
    assert.ok(
      PHASE1_EXCLUDED_GENERATED_PATHS.includes(relativePath),
      `Phase 1 must exclude ${relativePath}`,
    )
  }
})
