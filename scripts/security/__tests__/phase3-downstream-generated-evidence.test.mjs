import assert from 'node:assert/strict'
import test from 'node:test'

import { PHASE3_EXCLUDED_GENERATED_PATHS } from '../lib/secret-scan.mjs'

const REQUIRED_DOWNSTREAM_GENERATED_PATHS = [
  'docs/security/audit/phase-4/dependency-policy.json',
  'docs/security/audit/phase-4/dependency-policy.md',
  'docs/security/audit/phase-5/authentication-policy.json',
  'docs/security/audit/phase-5/authentication-policy.md',
]

test('Phase 3 excludes deterministic downstream policy evidence from current-tree and history digests', () => {
  assert.deepEqual(
    PHASE3_EXCLUDED_GENERATED_PATHS,
    [...new Set(PHASE3_EXCLUDED_GENERATED_PATHS)].sort(),
  )

  for (const relativePath of REQUIRED_DOWNSTREAM_GENERATED_PATHS) {
    assert.ok(
      PHASE3_EXCLUDED_GENERATED_PATHS.includes(relativePath),
      `Phase 3 must exclude ${relativePath}`,
    )
  }
})
