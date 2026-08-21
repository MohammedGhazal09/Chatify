const LIVE_SCRIPT = 'scripts/security/phase4-live-supply-chain.mjs'

export const buildPhase4CommandPlan = () => [
  { name: 'clean-install-backend', command: 'npm', args: ['ci', '--strict-allow-scripts'], cwd: 'Backend/Chatify' },
  { name: 'clean-install-frontend', command: 'npm', args: ['ci', '--strict-allow-scripts'], cwd: 'Frontend/Chatify' },
  { name: 'backend-live-supply-chain', command: 'node', args: [LIVE_SCRIPT, '--project=backend', '--directory=Backend/Chatify'], cwd: '.' },
  { name: 'frontend-live-supply-chain', command: 'node', args: [LIVE_SCRIPT, '--project=frontend', '--directory=Frontend/Chatify'], cwd: '.' },
  { name: 'phase1-parser-tests', command: 'npm', args: ['run', 'security:phase1:test'], cwd: '.' },
  { name: 'phase1-inventory-drift-check', command: 'npm', args: ['run', 'security:phase1:check'], cwd: '.' },
  { name: 'phase1-environment-doctor', command: 'npm', args: ['run', 'doctor'], cwd: '.' },
  { name: 'phase2-threat-model-tests', command: 'npm', args: ['run', 'security:phase2:test'], cwd: '.' },
  { name: 'phase2-threat-model-drift-check', command: 'npm', args: ['run', 'security:phase2:check'], cwd: '.' },
  { name: 'phase3-secret-scan-tests', command: 'npm', args: ['run', 'security:phase3:test'], cwd: '.' },
  { name: 'phase3-secret-scan-drift-check', command: 'npm', args: ['run', 'security:phase3:check'], cwd: '.' },
  { name: 'phase4-dependency-policy-tests', command: 'npm', args: ['run', 'security:phase4:test'], cwd: '.' },
  { name: 'phase4-dependency-policy-drift-check', command: 'npm', args: ['run', 'security:phase4:check'], cwd: '.' },
  { name: 'backend-discord-strategy-test', command: 'npm', args: ['test', '--', '--run', 'test/auth/discord-oauth-strategy.test.mjs'], cwd: 'Backend/Chatify' },
  { name: 'repository-quality-suite', command: 'npm', args: ['run', 'quality'], cwd: '.' },
  { name: 'operations-guard', command: 'npm', args: ['run', 'ops:check'], cwd: '.' },
]
