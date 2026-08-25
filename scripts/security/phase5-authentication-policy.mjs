#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'

import {
  assertPhase5ExitGate,
  buildAuthenticationPolicy,
  checkGeneratedAuthenticationPolicy,
  PHASE5_GENERATED_PATHS,
  writeGeneratedAuthenticationPolicy,
} from './lib/authentication-policy.mjs'

const args = new Set(process.argv.slice(2))
const modes = ['--write', '--check', '--json'].filter((flag) => args.has(flag))

if (modes.length !== 1) {
  console.error('Usage: node scripts/security/phase5-authentication-policy.mjs --write|--check|--json')
  process.exitCode = 2
} else {
  const root = path.resolve(process.cwd())
  const report = await buildAuthenticationPolicy(root)

  if (args.has('--write')) {
    const result = await writeGeneratedAuthenticationPolicy(root, report)
    console.log(`Wrote ${result.files.length} deterministic Phase 5 evidence files:`)
    result.files.forEach((file) => console.log(`- ${file}`))
  } else if (args.has('--check')) {
    const current = await checkGeneratedAuthenticationPolicy(root, report)
    if (!current) {
      console.error('Phase 5 generated authentication-policy evidence is missing or stale.')
      console.error('Run: npm run security:phase5:generate')
      PHASE5_GENERATED_PATHS.forEach((file) => console.error(`- ${file}`))
      process.exitCode = 1
    } else {
      console.log('Phase 5 generated authentication-policy evidence is current.')
    }
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  }

  try {
    assertPhase5ExitGate(report)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
