import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPhase4CommandPlan } from '../lib/phase4-reproduction.mjs'

test('Phase 4 reproduction covers live supply-chain evidence, inherited gates, application quality, and operations', () => {
  const plan = buildPhase4CommandPlan()
  assert.deepEqual(plan.map((item) => item.name), [
    'clean-install-backend',
    'clean-install-frontend',
    'backend-live-supply-chain',
    'frontend-live-supply-chain',
    'phase1-parser-tests',
    'phase1-inventory-drift-check',
    'phase1-environment-doctor',
    'phase2-threat-model-tests',
    'phase2-threat-model-drift-check',
    'phase3-secret-scan-tests',
    'phase3-secret-scan-drift-check',
    'phase4-dependency-policy-tests',
    'phase4-dependency-policy-drift-check',
    'backend-discord-strategy-test',
    'repository-quality-suite',
    'operations-guard',
  ])
  assert.deepEqual(plan.slice(0, 2).map((item) => item.cwd), ['Backend/Chatify', 'Frontend/Chatify'])
  assert.deepEqual(plan.slice(0, 2).map((item) => item.args), [
    ['ci', '--strict-allow-scripts'],
    ['ci', '--strict-allow-scripts'],
  ])
  assert.equal(JSON.stringify(plan).includes('install-scripts'), false)
  assert.equal(plan.filter((item) => item.name.endsWith('live-supply-chain')).every((item) => (
    item.command === 'node' && item.args[0] === 'scripts/security/phase4-live-supply-chain.mjs'
  )), true)
})
