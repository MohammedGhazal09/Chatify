#!/usr/bin/env bash
set -euo pipefail

node .audit/remediate-security-remaining-20260825.mjs
node .audit/remediate-security-compatibility-20260826.mjs
node .audit/remediate-security-atomic-core-20260826.mjs
node .audit/remediate-security-atomic-core-fix-20260826.mjs
node .audit/repair-session-rotation-20260826.mjs
node .audit/repair-session-rotation-commit-order-20260826.mjs
sed -i 's/readAccessTokenFromCooieHeader/readAccessTokenFromCookieHeader/g' Backend/Chatify/test/security/canonical-remediation-regressions.test.mjs

npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm audit fix --package-lock-only --ignore-scripts --no-fund || true
npm ci
(
  cd Backend/Chatify
  npm install --package-lock-only --ignore-scripts --no-audit --no-fund
  npm audit fix --package-lock-only --ignore-scripts --no-fund || true
  npm ci
  npm test -- --run
  npm audit --audit-level=high
  npm audit --omit=dev --audit-level=high
)
(
  cd Frontend/Chatify
  node - <<'NODE'
  const fs = require('node:fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.devDependencies ??= {};
  pkg.devDependencies.vite = '^8.2.1';
  pkg.devDependencies['@vitejs/plugin-react'] = '^6.1.0';
  pkg.engines = { node: '>=24.19.0 <25', npm: '>=11.17.0 <12' };
  pkg.packageManager = 'npm@11.17.0';
  pkg.allowScripts = { ...(pkg.allowScripts ?? {}), '@tailwindcss/oxide@4.1.11': true, fsevents: false };
  fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
NODE
  npm install --package-lock-only --ignore-scripts --no-audit --no-fund
  npm audit fix --package-lock-only --ignore-scripts --no-fund || true
  npm ci
  npm test -- --run
  npm run lint
  npm run build
  npm audit --audit-level=high
  npm audit --omit=dev --audit-level=high
)

npm run ops:check
npm run security:phase5:reproduce
npm run security:log-assert

rm -rf .audit
rm -f \
  .github/workflows/apply-comprehensive-security-remediation-v2.yml \
  .github/workflows/apply-comprehensive-security-remediation.yml \
  .github/workflows/apply-security-dependency-closure.yml \
  .github/workflows/complete-security-remediation-v2.yml \
  .github/workflows/complete-security-remediation.yml \
  .github/workflows/finalize-security-remediation.yml \
  .github/workflows/temporary-canonical-red-green.yml \
  .github/workflows/temporary-canonical-source-export.yml \
  .github/workflows/materialize-clean-remediation-tokenfix2-20260826.yml

cat > .github/workflows/required-quality-gate.yml <<'YAML'
name: Required Quality Gate
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: required-quality-gate-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
jobs:
  required-quality-gate:
    name: Required quality gate
    runs-on: ubuntu-24.04
    timeout-minutes: 90
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with:
          persist-credentials: false
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
        with:
          node-version: 24.19.0
          cache: npm
          cache-dependency-path: |
            package-lock.json
            Backend/Chatify/package-lock.json
            Frontend/Chatify/package-lock.json
      - run: npm install --global npm@11.17.0
      - run: npm ci
      - working-directory: Backend/Chatify
        run: npm ci
      - working-directory: Frontend/Chatify
        run: npm ci
      - name: Backend tests and audits
        working-directory: Backend/Chatify
        run: |
          npm test -- --run
          npm audit --audit-level=high
          npm audit --omit=dev --audit-level=high
      - name: Frontend tests, lint, build, and audits
        working-directory: Frontend/Chatify
        run: |
          npm test -- --run
          npm run lint
          npm run build
          npm audit --audit-level=high
          npm audit --omit=dev --audit-level=high
      - name: Repository security and operations
        run: |
          npm run ops:check
          npm run security:phase5:reproduce
          npm run security:log-assert
YAML

git config user.name github-actions[bot]
git config user.email 41898282+github-actions[bot]@users.noreply.github.com
git add -A
tree_sha="$(git write-tree)"
parent_sha="$(git rev-parse origin/main)"
commit_sha="$(printf '%s\n' 'fix(security): resolve validated repository findings' | git commit-tree "$tree_sha" -p "$parent_sha")"
git push origin "+$commit_sha:refs/heads/security/complete-remediation-20260826"

existing="$(gh pr list --head security/complete-remediation-20260826 --base main --state open --json number --jq '.[0].number // empty')"
if [ -z "$existing" ]; then
  gh pr create \
    --head security/complete-remediation-20260826 \
    --base main \
    --title 'security: resolve validated repository findings' \
    --body $'Replaces #21 with one ordinary commit based directly on main.\n\nThe candidate contains no audit payloads or branch-writing workflows and was published only after the complete backend, frontend, dependency, security, and operations gate passed.'
fi
gh pr close 21 --comment 'Superseded by the clean immutable remediation PR.' || true

if [ -n "${CHATIFY_ADMIN_TOKEN:-}" ]; then
  export GH_TOKEN="$CHATIFY_ADMIN_TOKEN"
  cat > /tmp/protection.json <<'JSON'
{"required_status_checks":{"strict":true,"contexts":["Required quality gate"]},"enforce_admins":true,"required_pull_request_reviews":{"dismissal_restrictions":{},"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1,"require_last_push_approval":true,"bypass_pull_request_allowances":{}},"restrictions":null,"required_linear_history":true,"allow_force_pushes":false,"allow_deletions":false,"block_creations":false,"required_conversation_resolution":true,"lock_branch":false,"allow_fork_syncing":true}
JSON
  gh api --method PUT \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "/repos/$GITHUB_REPOSITORY/branches/main/protection" \
    --input /tmp/protection.json
fi
