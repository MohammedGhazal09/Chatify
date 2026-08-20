#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import {
  buildThreatModel,
  checkGeneratedThreatModel,
  getGeneratedThreatModelPaths,
  writeGeneratedThreatModel,
} from './lib/threat-model.mjs'

const args = new Set(process.argv.slice(2))
const modes = ['--write', '--check', '--json']
const modeCount = modes.filter((flag) => args.has(flag)).length
const unknownArgs = [...args].filter((arg) => !modes.includes(arg))

if (modeCount !== 1 || unknownArgs.length > 0) {
  console.error('Usage: node scripts/security/phase2-threat-model.mjs --write|--check|--json')
  process.exitCode = 2
} else {
  const root = path.resolve(process.cwd())
  const inventoryPath = path.join(root, 'docs/security/audit/phase-1/inventory.json')
  const sourcePath = path.join(root, 'docs/security/audit/phase-2/threat-model.source.json')
  const [inventoryText, sourceText] = await Promise.all([
    readFile(inventoryPath, 'utf8'),
    readFile(sourcePath, 'utf8'),
  ])
  const model = buildThreatModel({
    source: JSON.parse(sourceText),
    inventory: JSON.parse(inventoryText),
    inventoryText,
  })

  if (args.has('--write')) {
    const result = await writeGeneratedThreatModel(root, model)
    console.log(`Wrote ${result.files.length} Phase 2 threat-model files:`)
    result.files.forEach((file) => console.log(`- ${file}`))
  } else if (args.has('--check')) {
    const current = await checkGeneratedThreatModel(root, model)
    if (!current) {
      console.error('Phase 2 generated threat model is missing or stale.')
      console.error('Run: npm run security:phase2:generate')
      console.error('Expected files:')
      getGeneratedThreatModelPaths().forEach((file) => console.error(`- ${file}`))
      process.exitCode = 1
    } else {
      console.log('Phase 2 generated threat model is current.')
    }
  } else {
    process.stdout.write(`${JSON.stringify(model, null, 2)}\n`)
  }
}
