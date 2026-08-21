import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPhase3CommandPlan } from '../lib/phase3-reproduction.mjs'

test('Phase 3 reproduction includes clean installs, inherited gates, secret tests, full quality, and operations', () => {
  const plan = buildPhase3CommandPlan()
  const names = plan.map((item) => item.name)

  assert.deepEqual(names, [
    'clean-install-backend',
    'clean-install-frontend',
    'phase1-parser-tests',
    'phase1-inventory-drift-check',
    'phase1-environment-doctor',
    'phase2-threat-model-tests',
    'phase2-threat-model-drift-check',
    'phase3-secret-scan-tests',
    'phase3-secret-scan-drift-check',
    'backend-secret-configuration-tests',
    'repository-quality-suite',
    'operations-guard',
  ])
  assert.equal(plan.every((item) => item.command === 'npm'), true)
  assert.equal(plan.some((item) => item.cwd === 'Backend/Chatify'), true)
})
