#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'

import {
  assertPhase4ExitGate,
  buildDependencyPolicy,
  checkGeneratedDependencyPolicy,
  PHASE4_GENERATED_PATHS,
  writeGeneratedDependencyPolicy,
} from './lib/dependency-policy.mjs'

const args = new Set(process.argv.slice(2))
const modes = ['--write', '--check', '--json'].filter((flag) => args.has(flag))

if (modes.length !== 1) {
  console.error('Usage: node scripts/security/phase4-dependency-policy.mjs --write|--check|--json')
  process.exitCode = 2
} else {
  const root = path.resolve(process.cwd())
  const report = await buildDependencyPolicy(root)

  if (args.has('--write')) {
    const result = await writeGeneratedDependencyPolicy(root, report)
    console.log(`Wrote ${result.files.length} deterministic Phase 4 evidence files:`)
    result.files.forEach((file) => console.log(`- ${file}`))
  } else if (args.has('--check')) {
    const current = await checkGeneratedDependencyPolicy(root, report)
    if (!current) {
      console.error('Phase 4 generated dependency-policy evidence is missing or stale.')
      console.error('Run: npm run security:phase4:generate')
      PHASE4_GENERATED_PATHS.forEach((file) => console.error(`- ${file}`))
      process.exitCode = 1
    } else {
      console.log('Phase 4 generated dependency-policy evidence is current.')
    }
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  }

  try {
    assertPhase4ExitGate(report)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
