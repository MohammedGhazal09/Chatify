import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPhase5CommandPlan } from '../lib/phase5-reproduction.mjs'

test('Phase 5 reproduction covers inherited gates, live supply chain, authentication, quality, and operations', () => {
  const plan = buildPhase5CommandPlan()
  const names = plan.map((item) => item.name)

  assert.equal(names[0], 'clean-install-backend')
  assert.equal(names[1], 'clean-install-frontend')
  assert.ok(names.includes('backend-live-supply-chain'))
  assert.ok(names.includes('frontend-live-supply-chain'))
  assert.ok(names.includes('phase1-inventory-drift-check'))
  assert.ok(names.includes('phase2-threat-model-drift-check'))
  assert.ok(names.includes('phase3-secret-scan-drift-check'))
  assert.ok(names.includes('phase4-supply-chain-drift-check'))
  assert.ok(names.includes('phase5-authentication-policy-tests'))
  assert.ok(names.includes('phase5-authentication-policy-drift-check'))
  assert.ok(names.includes('phase5-authentication-runtime-regressions'))
  assert.ok(names.includes('repository-quality-suite'))
  assert.equal(names.at(-1), 'operations-guard')
  assert.equal(new Set(names).size, names.length)

  const runtime = plan.find((item) => item.name === 'phase5-authentication-runtime-regressions')
  assert.equal(runtime.cwd, 'Backend/Chatify')
  assert.ok(runtime.args.includes('test/auth/phase5-authentication-security.test.mjs'))
  assert.ok(runtime.args.includes('test/auth/phase5-sensitive-flows.test.mjs'))
  assert.ok(runtime.args.includes('test/socket/socket.auth.test.mjs'))
})
