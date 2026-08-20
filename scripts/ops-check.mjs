import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const requiredRootScripts = [
  'test',
  'quality',
  'quality:backend',
  'quality:frontend',
  'quality:frontend:test',
  'quality:frontend:lint',
  'quality:frontend:build',
  'smoke:local',
  'smoke:prod',
  'ops:check',
];

const requiredBackendEnv = [
  'NODE_ENV',
  'PORT',
  'PORT_NUMBER',
  'MONGODB_URL',
  'SECRET_JWT_KEY',
  'PASSWORD_RESET_SECRET',
  'FRONTEND_ORIGIN',
  'FRONTEND_ORIGIN_DEV',
  'EMAIL_USER_SENDER',
  'BREVO_API_KEY',
  'CHATIFY_DELIVERY_DIAGNOSTICS',
  'CHATIFY_LOG_LEVEL',
  'CHATIFY_TEST_LOGS',
  'CHATIFY_CALL_DISCONNECT_GRACE_MS',
  'CALL_STUN_URLS',
  'CALL_TURN_URLS',
  'CALL_TURN_USERNAME',
  'CALL_TURN_CREDENTIAL',
];

const requiredFrontendEnv = [
  'VITE_BACKEND_URL',
  'VITE_SOCKET_URL',
];

const requiredRunbooks = [
  'credential-rotation.md',
  'deployment-verification.md',
  'incident-triage.md',
  'local-startup.md',
  'production-smoke.md',
  'rollback.md',
];

const readinessComponentNames = [
  'database',
  'environment',
  'storage',
  'socket',
  'cors',
  'cookies',
  'queues',
  'calls',
];

const relative = (filePath) => path.relative(root, filePath).replaceAll(path.sep, '/');

const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const pushMissing = (failures, filePath, item) => {
  failures.push(`${relative(filePath)} missing ${item}`);
};

const requireFile = (failures, filePath) => {
  if (!fs.existsSync(filePath)) {
    failures.push(`${relative(filePath)} does not exist`);
    return false;
  }

  return true;
};

const assertContains = ({ failures, filePath, text, items, label }) => {
  items.forEach((item) => {
    if (!text.includes(item)) {
      pushMissing(failures, filePath, `${label} ${item}`);
    }
  });
};

const getMarkdownFiles = (directory) => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return getMarkdownFiles(fullPath);
      }
      return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
    });
};

const scannedFiles = [
  path.join(root, 'README.md'),
  path.join(root, 'package.json'),
  path.join(root, 'Backend/Chatify/.env.example'),
  path.join(root, 'Frontend/Chatify/.env.example'),
  path.join(root, 'Backend/Chatify/Utils/observabilityLogger.mjs'),
  path.join(root, 'Backend/Chatify/Utils/operationalReadiness.mjs'),
  path.join(root, 'Backend/Chatify/test/observability/observability-logger.test.mjs'),
  path.join(root, 'Backend/Chatify/test/observability/health-readiness.test.mjs'),
  ...getMarkdownFiles(path.join(root, 'docs/operations')),
  ...getMarkdownFiles(path.join(root, '.planning/phases/18-operational-observability-and-runbook-hardening')),
];

const secretPatterns = [
  {
    name: 'bearer token',
    pattern: /Bearer\s+(?!\[redacted\]|<)(?=[A-Za-z0-9._~+/=-]{10,})(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]+/i,
  },
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  },
  {
    name: 'auth cookie',
    pattern: /\b(?:accessToken|refreshToken)=((?!<|\[redacted\])[^;\s`"']{10,})/i,
  },
  {
    name: 'non-placeholder secret assignment',
    pattern: /\b(?:BREVO_API_KEY|SECRET_JWT_KEY|PASSWORD_RESET_SECRET|CALL_TURN_CREDENTIAL|CHATIFY_SMOKE_USER_[AB]_PASSWORD)\s*=\s*(?!["']?<[^>]+>|replace-with|your-|test-|$)[^\s`"']+/,
  },
  {
    name: 'nonlocal mongodb uri',
    pattern: /mongodb(?:\+srv)?:\/\/(?!127\.0\.0\.1|localhost|example\.invalid)[^\s`"'<>)]+/i,
  },
];

const checkPackageScripts = (failures) => {
  const packagePath = path.join(root, 'package.json');
  if (!requireFile(failures, packagePath)) return;

  const pkg = JSON.parse(readText(packagePath));
  const scripts = pkg.scripts ?? {};

  requiredRootScripts.forEach((scriptName) => {
    if (!scripts[scriptName]) {
      failures.push(`package.json missing script ${scriptName}`);
    }
  });
};

const checkEnvExamples = (failures) => {
  const backendEnv = path.join(root, 'Backend/Chatify/.env.example');
  const frontendEnv = path.join(root, 'Frontend/Chatify/.env.example');

  if (requireFile(failures, backendEnv)) {
    assertContains({
      failures,
      filePath: backendEnv,
      text: readText(backendEnv),
      items: requiredBackendEnv.map((key) => `${key}=`),
      label: 'env key',
    });
  }

  if (requireFile(failures, frontendEnv)) {
    assertContains({
      failures,
      filePath: frontendEnv,
      text: readText(frontendEnv),
      items: requiredFrontendEnv.map((key) => `${key}=`),
      label: 'env key',
    });
  }
};

const checkRunbooks = (failures) => {
  const operationsDir = path.join(root, 'docs/operations');

  requiredRunbooks.forEach((fileName) => {
    const filePath = path.join(operationsDir, fileName);
    if (!requireFile(failures, filePath)) return;

    const text = readText(filePath);
    ['## Purpose', '## Prerequisites', '## Procedure', '## Verification'].forEach((heading) => {
      if (!text.includes(heading)) {
        failures.push(`${relative(filePath)} missing ${heading}`);
      }
    });
  });
};

const checkReadinessSurface = (failures) => {
  const readinessPath = path.join(root, 'Backend/Chatify/Utils/operationalReadiness.mjs');
  if (!requireFile(failures, readinessPath)) return;

  const text = readText(readinessPath);
  assertContains({
    failures,
    filePath: readinessPath,
    text,
    items: readinessComponentNames,
    label: 'readiness component',
  });
};

const checkSecrets = (failures) => {
  scannedFiles
    .filter((filePath) => fs.existsSync(filePath))
    .forEach((filePath) => {
      const text = readText(filePath);
      secretPatterns.forEach(({ name, pattern }) => {
        const match = text.match(pattern);
        if (match) {
          failures.push(`${relative(filePath)} contains possible ${name}: ${match[0]}`);
        }
      });
    });
};

const failures = [];

checkPackageScripts(failures);
checkEnvExamples(failures);
checkRunbooks(failures);
checkReadinessSurface(failures);
checkSecrets(failures);

if (failures.length > 0) {
  console.error('ops-check failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('ops-check passed');
