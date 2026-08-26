#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'

import {
  assertPhase3ExitGate,
  buildSecretScan,
  checkGeneratedSecretScan,
  PHASE3_GENERATED_PATHS,
  writeGeneratedSecretScan,
} from './lib/secret-scan.mjs'

const args = new Set(process.argv.slice(2))
const modes = ['--write', '--check', '--json'].filter((flag) => args.has(flag))

if (modes.length !== 1) {
  console.error('Usage: node scripts/security/phase3-secret-scan.mjs --write|--check|--json')
  process.exitCode = 2
} else {
  const root = path.resolve(process.cwd())
  const report = await buildSecretScan(root)

  if (args.has('--write')) {
    const result = await writeGeneratedSecretScan(root, report)
    console.log(`Wrote ${result.files.length} sanitized Phase 3 evidence files:`)
    result.files.forEach((file) => console.log(`- ${file}`))
  } else if (args.has('--check')) {
    const current = await checkGeneratedSecretScan(root, report)
    if (!current) {
      console.error('Phase 3 generated secret-scan evidence is missing or stale.')
      console.error('Run: npm run security:phase3:generate')
      PHASE3_GENERATED_PATHS.forEach((file) => console.error(`- ${file}`))
      process.exitCode = 1
    } else {
      console.log('Phase 3 generated secret-scan evidence is current.')
    }
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  }

  try {
    assertPhase3ExitGate(report)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
