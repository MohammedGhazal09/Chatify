import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const phaseDir = path.join(root, '.planning/phases/25-production-evidence-closure-and-live-smoke-execution');
const outputPath = path.join(phaseDir, '25-PRODUCTION-EVIDENCE.md');

const artifacts = [
  {
    label: 'Phase 14 production live acceptance',
    path: '.planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md',
    acceptableStatuses: ['passed', 'passed_user_confirmed'],
  },
  {
    label: 'Phase 15 call acceptance',
    path: '.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-CALL-ACCEPTANCE.md',
    acceptableStatuses: ['local_ready', 'production_ready', 'production_ready_user_confirmed', 'passed_user_confirmed'],
  },
  {
    label: 'Phase 16 profile image acceptance',
    path: '.planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-PROFILE-IMAGE-ACCEPTANCE.md',
    acceptableStatuses: ['passed', 'passed_user_confirmed'],
  },
  {
    label: 'Phase 17 v1 readiness decision',
    path: '.planning/phases/17-v1-readiness-closure-and-release-gate/17-V1-READINESS.md',
    acceptableStatuses: ['ready', 'passed', 'ready_user_confirmed'],
  },
  {
    label: 'Phase 24 group call verification',
    path: '.planning/phases/24-group-message-sender-names-and-group-voice-video-calls/24-VERIFICATION.md',
    acceptableStatuses: ['passed'],
  },
];

const contracts = [
  {
    label: 'Production live smoke',
    required: [
      'CHATIFY_PRODUCTION_SMOKE',
      'CHATIFY_PROD_FRONTEND_URL',
      'CHATIFY_PROD_BACKEND_URL',
      'CHATIFY_SMOKE_USER_A_EMAIL',
      'CHATIFY_SMOKE_USER_A_USERNAME',
      'CHATIFY_SMOKE_USER_A_PASSWORD',
      'CHATIFY_SMOKE_USER_B_EMAIL',
      'CHATIFY_SMOKE_USER_B_USERNAME',
      'CHATIFY_SMOKE_USER_B_PASSWORD',
    ],
    urlVars: ['CHATIFY_PROD_FRONTEND_URL', 'CHATIFY_PROD_BACKEND_URL'],
    optIn: ['CHATIFY_PRODUCTION_SMOKE', '1'],
    productionUrlOnly: true,
  },
  {
    label: 'Local two-account call smoke',
    required: [
      'CHATIFY_LOCAL_CALL_SMOKE',
      'CHATIFY_LOCAL_FRONTEND_URL',
      'CHATIFY_LOCAL_BACKEND_URL',
      'CHATIFY_LOCAL_USER_A_EMAIL',
      'CHATIFY_LOCAL_USER_A_PASSWORD',
      'CHATIFY_LOCAL_USER_B_EMAIL',
      'CHATIFY_LOCAL_USER_B_PASSWORD',
    ],
    urlVars: ['CHATIFY_LOCAL_FRONTEND_URL', 'CHATIFY_LOCAL_BACKEND_URL'],
    optIn: ['CHATIFY_LOCAL_CALL_SMOKE', '1'],
    productionUrlOnly: false,
  },
  {
    label: 'Local profile-image cross-user smoke',
    required: [
      'CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE',
      'CHATIFY_LOCAL_BACKEND_URL',
      'VITE_BACKEND_URL',
      'CHATIFY_LOCAL_USER_A_EMAIL',
      'CHATIFY_LOCAL_USER_A_PASSWORD',
      'CHATIFY_LOCAL_USER_B_EMAIL',
      'CHATIFY_LOCAL_USER_B_PASSWORD',
    ],
    urlVars: ['CHATIFY_LOCAL_BACKEND_URL', 'VITE_BACKEND_URL'],
    optIn: ['CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE', '1'],
    productionUrlOnly: false,
  },
  {
    label: 'Production TURN readiness',
    required: ['CALL_TURN_URLS', 'CALL_TURN_USERNAME', 'CALL_TURN_CREDENTIAL'],
    urlVars: [],
    optIn: null,
    productionUrlOnly: false,
  },
];

const readEnv = (name) => process.env[name]?.trim() ?? '';

const isLocalHostname = (hostname) => {
  const normalized = hostname.toLowerCase();

  return normalized === 'localhost' ||
    normalized === '0.0.0.0' ||
    normalized === '[::1]' ||
    normalized === '::1' ||
    normalized.endsWith('.local') ||
    normalized.startsWith('127.');
};

const parseUrlEnv = (name, productionUrlOnly) => {
  const value = readEnv(name);

  if (!value) {
    return { name, status: 'missing', origin: '[missing]' };
  }

  try {
    const parsed = new URL(value);
    const allowedProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const invalidLocalProductionUrl = productionUrlOnly && isLocalHostname(parsed.hostname);

    if (!allowedProtocol || invalidLocalProductionUrl) {
      return { name, status: 'invalid', origin: '[invalid]' };
    }

    return { name, status: 'valid', origin: parsed.origin };
  } catch {
    return { name, status: 'invalid', origin: '[invalid]' };
  }
};

const summarizeContract = (contract) => {
  const missing = contract.required.filter((name) => !readEnv(name));
  const invalidUrls = contract.urlVars
    .map((name) => parseUrlEnv(name, contract.productionUrlOnly))
    .filter((url) => url.status !== 'valid');
  const optInBlocked = contract.optIn ? readEnv(contract.optIn[0]) !== contract.optIn[1] : false;
  const blockers = [];

  if (optInBlocked) {
    blockers.push(`${contract.optIn[0]}=${contract.optIn[1]} is required.`);
  }

  if (missing.length > 0) {
    blockers.push(`Missing env: ${missing.join(', ')}.`);
  }

  if (invalidUrls.length > 0) {
    blockers.push(`Invalid URL env: ${invalidUrls.map((url) => url.name).join(', ')}.`);
  }

  return {
    ...contract,
    blockers,
    invalidUrls,
    missing,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    origins: contract.urlVars
      .map((name) => parseUrlEnv(name, contract.productionUrlOnly))
      .map((url) => `${url.name}: ${url.origin}`),
  };
};

const readArtifactStatus = (artifact) => {
  const filePath = path.join(root, artifact.path);

  if (!fs.existsSync(filePath)) {
    return {
      ...artifact,
      status: 'missing',
      acceptable: false,
    };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const yamlStatus = text.match(/^status:\s*([^\r\n]+)/m)?.[1]?.trim();
  const boldStatus = text.match(/\*\*Status:\*\*\s*([^\r\n]+)/)?.[1]?.trim();
  const decision = text.match(/\*\*Decision:\*\*\s*([^\r\n]+)/)?.[1]?.trim();
  const status = (yamlStatus || boldStatus || decision || 'unknown').toLowerCase();

  return {
    ...artifact,
    status,
    acceptable: artifact.acceptableStatuses.includes(status),
  };
};

const markdownList = (items, emptyText) => (
  items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : `- ${emptyText}`
);

const contractRows = (summaries) => summaries.map((summary) => {
  const detail = summary.blockers.length > 0 ? summary.blockers.join(' ') : 'Required environment is present.';
  const origins = summary.origins.length > 0 ? summary.origins.join('; ') : 'No URL env in this contract.';

  return `| ${summary.label} | ${summary.status} | ${origins} | ${detail} |`;
});

const artifactRows = (summaries) => summaries.map((artifact) => {
  const detail = artifact.acceptable
    ? 'Acceptable for this gate.'
    : `Expected one of: ${artifact.acceptableStatuses.join(', ')}.`;

  return `| ${artifact.label} | ${artifact.status} | ${artifact.path} | ${detail} |`;
});

const writeReport = () => {
  const generatedAt = new Date().toISOString();
  const contractSummaries = contracts.map(summarizeContract);
  const artifactSummaries = artifacts.map(readArtifactStatus);
  const blockers = [
    ...contractSummaries.flatMap((summary) => summary.blockers.map((blocker) => `${summary.label}: ${blocker}`)),
    ...artifactSummaries
      .filter((artifact) => !artifact.acceptable)
      .map((artifact) => `${artifact.label}: status is ${artifact.status}.`),
  ];
  const status = blockers.length === 0 ? 'passed' : 'blocked';
  const decision = status === 'passed'
    ? 'Release evidence gate passed. Phase 17 can be updated only after the live smoke commands also show zero blockers.'
    : 'Release evidence gate remains blocked. Do not claim v1 readiness or hosted/provider success.';
  const content = `---
phase: 25-production-evidence-closure-and-live-smoke-execution
artifact: production-evidence
status: ${status}
generated_at: ${generatedAt}
privacy: sanitized
---

# Phase 25 Production Evidence

## Decision

${decision}

## Environment Contracts

| Contract | Status | Origins | Detail |
|---|---|---|---|
${contractRows(contractSummaries).join('\n')}

## Evidence Artifacts

| Artifact | Status | Path | Detail |
|---|---|---|---|
${artifactRows(artifactSummaries).join('\n')}

## Blockers

${markdownList(blockers, 'None')}

## Required Commands

- \`npm run evidence:production\`
- \`npm run smoke:prod -- --grep "Phase 14 production live acceptance|Phase 15" --workers=1\`
- \`npm run smoke:local -- --grep "Phase 15|Phase 16" --workers=1\`
- \`npm run ops:check\`

## Privacy Rules

- This artifact records environment variable names, status, and sanitized origins only.
- It must not contain raw emails, passwords, cookies, tokens, reset codes, SDP, ICE candidates, or TURN credentials.
- Missing credentials are release blockers, not test passes.
`;

  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');

  return { outputPath, status, blockerCount: blockers.length };
};

const result = writeReport();
console.log(`production evidence ${result.status}: ${path.relative(root, result.outputPath)} (${result.blockerCount} blocker${result.blockerCount === 1 ? '' : 's'})`);

if (result.status !== 'passed') {
  process.exitCode = 1;
}
