#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'

import { collectLiveSupplyChainEvidence } from './lib/live-supply-chain.mjs'

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const match = /^--([^=]+)=(.*)$/.exec(argument)
  return match ? [match[1], match[2]] : [argument.replace(/^--/, ''), true]
}))

if (!['backend', 'frontend'].includes(options.project) || typeof options.directory !== 'string') {
  console.error('Usage: node scripts/security/phase4-live-supply-chain.mjs --project=backend|frontend --directory=<project-directory>')
  process.exitCode = 2
} else {
  try {
    const report = await collectLiveSupplyChainEvidence({
      root: path.resolve(process.cwd()),
      project: options.project,
      directory: options.directory,
    })
    console.log(`Phase 4 ${options.project} live supply-chain evidence: ${report.summary.result}.`)
    console.log(`Pending install scripts: ${report.installScripts.pendingCount ?? 'unknown'}.`)
    console.log(`Blocking high/critical advisories: ${report.audit.summary.blocking}.`)
    if (report.summary.result !== 'passed') {
      console.error(`Failed gates: ${report.summary.failedGates.join(', ')}`)
      process.exitCode = 1
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
