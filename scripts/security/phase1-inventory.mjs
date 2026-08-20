#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'

import {
  buildInventory,
  checkGeneratedInventory,
  getGeneratedInventoryPaths,
  writeGeneratedInventory,
} from './lib/inventory.mjs'

const args = new Set(process.argv.slice(2))
const modeCount = ['--write', '--check', '--json'].filter((flag) => args.has(flag)).length

if (modeCount !== 1) {
  console.error('Usage: node scripts/security/phase1-inventory.mjs --write|--check|--json')
  process.exitCode = 2
} else {
  const root = path.resolve(process.cwd())
  const inventory = await buildInventory(root)

  if (args.has('--write')) {
    const result = await writeGeneratedInventory(root, inventory)
    console.log(`Wrote ${result.files.length} Phase 1 inventory files:`)
    result.files.forEach((file) => console.log(`- ${file}`))
  } else if (args.has('--check')) {
    const current = await checkGeneratedInventory(root, inventory)
    if (!current) {
      console.error('Phase 1 generated inventory is missing or stale.')
      console.error('Run: npm run security:phase1:generate')
      console.error('Expected files:')
      getGeneratedInventoryPaths().forEach((file) => console.error(`- ${file}`))
      process.exitCode = 1
    } else {
      console.log('Phase 1 generated inventory is current.')
    }
  } else {
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`)
  }
}
