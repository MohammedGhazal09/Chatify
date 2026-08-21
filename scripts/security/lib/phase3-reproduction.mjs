export const buildPhase3CommandPlan = () => [
  { name: 'clean-install-backend', command: 'npm', args: ['ci'], cwd: 'Backend/Chatify' },
  { name: 'clean-install-frontend', command: 'npm', args: ['ci'], cwd: 'Frontend/Chatify' },
  { name: 'phase1-parser-tests', command: 'npm', args: ['run', 'security:phase1:test'], cwd: '.' },
  { name: 'phase1-inventory-drift-check', command: 'npm', args: ['run', 'security:phase1:check'], cwd: '.' },
  { name: 'phase1-environment-doctor', command: 'npm', args: ['run', 'doctor'], cwd: '.' },
  { name: 'phase2-threat-model-tests', command: 'npm', args: ['run', 'security:phase2:test'], cwd: '.' },
  { name: 'phase2-threat-model-drift-check', command: 'npm', args: ['run', 'security:phase2:check'], cwd: '.' },
  { name: 'phase3-secret-scan-tests', command: 'npm', args: ['run', 'security:phase3:test'], cwd: '.' },
  { name: 'phase3-secret-scan-drift-check', command: 'npm', args: ['run', 'security:phase3:check'], cwd: '.' },
  { name: 'backend-secret-configuration-tests', command: 'npm', args: ['test', '--', '--run', 'test/security/secret-configuration.test.mjs'], cwd: 'Backend/Chatify' },
  { name: 'repository-quality-suite', command: 'npm', args: ['run', 'quality'], cwd: '.' },
  { name: 'operations-guard', command: 'npm', args: ['run', 'ops:check'], cwd: '.' },
]
