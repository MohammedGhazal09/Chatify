import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUTPUT_DIRECTORY = 'docs/security/audit/phase-2'
const OUTPUT_FILES = {
  json: `${OUTPUT_DIRECTORY}/threat-model.json`,
  markdown: `${OUTPUT_DIRECTORY}/threat-model.md`,
}

export const getGeneratedThreatModelPaths = () => [OUTPUT_FILES.json, OUTPUT_FILES.markdown]
const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low']

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const unique = (values) => [...new Set(values)]
const sorted = (values) => unique(values.filter((value) => value !== undefined && value !== null))
  .sort((left, right) => String(left).localeCompare(String(right)))
const sortObjects = (values, selector) => [...values].sort((left, right) => selector(left).localeCompare(selector(right)))
const toIdSet = (items) => new Set((items ?? []).map((item) => item.id))
const markdownCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')

const hasDuplicates = (values) => new Set(values).size !== values.length

const validateIds = (failures, label, items) => {
  const ids = (items ?? []).map((item) => item?.id).filter(Boolean)
  if (ids.length !== (items ?? []).length) failures.push(`${label} entries must each have a non-empty id`)
  if (hasDuplicates(ids)) failures.push(`${label} ids must be unique`)
}

const validateReferences = (failures, label, values, allowed) => {
  for (const value of values ?? []) {
    if (!allowed.has(value)) failures.push(`${label} references unknown id ${value}`)
  }
}

export const validateThreatModelSource = (source) => {
  const failures = []
  if (!source || typeof source !== 'object') return ['Threat-model source must be an object']
  if (source.schemaVersion !== 1) failures.push('schemaVersion must equal 1')
  if (!source.repository || typeof source.repository !== 'string') failures.push('repository must be a non-empty string')
  if (!/^[0-9a-f]{40}$/.test(source.version ?? '')) failures.push('version must be a 40-character lowercase Git SHA')

  const collections = [
    ['actors', source.actors],
    ['zones', source.zones],
    ['dataClasses', source.dataClasses],
    ['assets', source.assets],
    ['boundaries', source.boundaries],
    ['entryPointGroups', source.entryPointGroups],
    ['modelGroups', source.modelGroups],
    ['providerGroups', source.providerGroups],
    ['dataFlows', source.dataFlows],
    ['invariants', source.invariants],
    ['attackerStories', source.attackerStories],
  ]
  for (const [label, items] of collections) validateIds(failures, label, items)

  const actorIds = toIdSet(source.actors)
  const zoneIds = toIdSet(source.zones)
  const dataClassIds = toIdSet(source.dataClasses)
  const assetIds = toIdSet(source.assets)
  const boundaryIds = toIdSet(source.boundaries)
  const invariantIds = toIdSet(source.invariants)

  for (const asset of source.assets ?? []) {
    validateReferences(failures, `asset ${asset.id}.dataClassIds`, asset.dataClassIds, dataClassIds)
    validateReferences(failures, `asset ${asset.id}.invariantIds`, asset.invariantIds, invariantIds)
  }
  for (const boundary of source.boundaries ?? []) {
    validateReferences(failures, `boundary ${boundary.id}.fromZoneId`, [boundary.fromZoneId], zoneIds)
    validateReferences(failures, `boundary ${boundary.id}.toZoneId`, [boundary.toZoneId], zoneIds)
    validateReferences(failures, `boundary ${boundary.id}.actorIds`, boundary.actorIds, actorIds)
  }
  for (const group of source.entryPointGroups ?? []) {
    validateReferences(failures, `entryPointGroup ${group.id}.boundaryId`, [group.boundaryId], boundaryIds)
    validateReferences(failures, `entryPointGroup ${group.id}.assetIds`, group.assetIds, assetIds)
    validateReferences(failures, `entryPointGroup ${group.id}.dataClassIds`, group.dataClassIds, dataClassIds)
  }
  for (const group of source.modelGroups ?? []) {
    validateReferences(failures, `modelGroup ${group.id}.assetIds`, group.assetIds, assetIds)
    validateReferences(failures, `modelGroup ${group.id}.dataClassIds`, group.dataClassIds, dataClassIds)
  }
  for (const group of source.providerGroups ?? []) {
    validateReferences(failures, `providerGroup ${group.id}.boundaryId`, [group.boundaryId], boundaryIds)
  }
  for (const flow of source.dataFlows ?? []) {
    validateReferences(failures, `dataFlow ${flow.id}.fromZoneId`, [flow.fromZoneId], zoneIds)
    validateReferences(failures, `dataFlow ${flow.id}.toZoneId`, [flow.toZoneId], zoneIds)
    validateReferences(failures, `dataFlow ${flow.id}.boundaryIds`, flow.boundaryIds, boundaryIds)
    validateReferences(failures, `dataFlow ${flow.id}.assetIds`, flow.assetIds, assetIds)
    validateReferences(failures, `dataFlow ${flow.id}.dataClassIds`, flow.dataClassIds, dataClassIds)
    validateReferences(failures, `dataFlow ${flow.id}.invariantIds`, flow.invariantIds, invariantIds)
  }
  for (const story of source.attackerStories ?? []) {
    validateReferences(failures, `attackerStory ${story.id}.actorId`, [story.actorId], actorIds)
    validateReferences(failures, `attackerStory ${story.id}.boundaryIds`, story.boundaryIds, boundaryIds)
    validateReferences(failures, `attackerStory ${story.id}.assetIds`, story.assetIds, assetIds)
    validateReferences(failures, `attackerStory ${story.id}.invariantIds`, story.invariantIds, invariantIds)
    if (!SEVERITY_LEVELS.includes(story.severity)) failures.push(`attackerStory ${story.id}.severity must be one of ${SEVERITY_LEVELS.join(', ')}`)
  }
  for (const invariant of source.invariants ?? []) {
    if (!SEVERITY_LEVELS.includes(invariant.severityIfBroken)) {
      failures.push(`invariant ${invariant.id}.severityIfBroken must be one of ${SEVERITY_LEVELS.join(', ')}`)
    }
  }
  for (const severity of SEVERITY_LEVELS) {
    if (!Array.isArray(source.severityCalibration?.[severity]) || source.severityCalibration[severity].length === 0) {
      failures.push(`severityCalibration.${severity} must contain at least one repository-specific example`)
    }
  }

  return sorted(failures)
}

const isDynamicSocketEvent = (entry) => String(entry.event ?? '').startsWith('<dynamic:')

const matchesHttpGroup = (route, group) => {
  if (group.kind !== 'http') return false
  if ((group.excludePaths ?? []).includes(route.fullPath)) return false
  if ((group.excludePrefixes ?? []).some((prefix) => (
    route.fullPath === prefix || route.fullPath.startsWith(`${prefix}/`)
  ))) return false
  if ((group.exactPaths ?? []).includes(route.fullPath)) return true
  return (group.pathPrefixes ?? []).some((prefix) => (
    route.fullPath === prefix || route.fullPath.startsWith(`${prefix}/`)
  ))
}

const matchesSocketGroup = (entry, group) => {
  if (group.kind !== 'socket') return false
  const dynamic = isDynamicSocketEvent(entry)
  if (group.dynamic === true && !dynamic) return false
  if (group.dynamic !== true && dynamic) return false
  if ((group.directions ?? []).length > 0 && !group.directions.includes(entry.direction)) return false
  if ((group.events ?? []).includes(entry.event)) return true
  return group.matchAllEvents === true
}

const matchesServiceWorkerGroup = (entry, group) => (
  group.kind === 'service-worker'
  && ((group.events ?? []).includes(entry.event) || group.matchAllEvents === true)
)

const isDevelopmentOnlySource = (source) => (
  source.startsWith('scripts/security/')
  || source.startsWith('.planning/')
  || source.startsWith('docs/')
  || /(^|\/)(?:test|tests|__tests__|e2e)(\/|$)/.test(source)
  || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(source)
)

const matchesBackgroundGroup = (entry, group) => (
  group.kind === 'background-job'
  && ((group.kinds ?? []).length === 0 || group.kinds.includes(entry.kind))
  && (group.sourcePrefixes ?? []).some((prefix) => entry.source.startsWith(prefix))
)

const mapSurfaces = (items, groups, matcher, describe) => {
  const mapped = []
  const unmapped = []
  const ambiguous = []
  const counts = new Map(groups.map((group) => [group.id, 0]))

  for (const item of items) {
    const matches = groups.filter((group) => matcher(item, group))
    if (matches.length === 0) {
      unmapped.push(describe(item))
      continue
    }
    if (matches.length > 1) {
      ambiguous.push(`${describe(item)} => ${matches.map((group) => group.id).join(', ')}`)
      continue
    }
    const group = matches[0]
    counts.set(group.id, (counts.get(group.id) ?? 0) + 1)
    mapped.push({ item, groupId: group.id })
  }

  return {
    mapped: mapped.length,
    total: items.length,
    unmapped: sorted(unmapped),
    ambiguous: sorted(ambiguous),
    groups: sortObjects(groups.map((group) => ({
      id: group.id,
      count: counts.get(group.id) ?? 0,
    })), (entry) => entry.id),
  }
}

const mapModels = (models, groups) => mapSurfaces(
  models,
  groups,
  (model, group) => (group.modelSources ?? []).includes(model.source),
  (model) => model.source,
)

const mapProviders = (providers, groups) => mapSurfaces(
  providers,
  groups,
  (provider, group) => (group.providers ?? []).includes(provider.provider),
  (provider) => provider.provider,
)

const buildCoverage = (source, inventory) => {
  const httpGroups = (source.entryPointGroups ?? []).filter((group) => group.kind === 'http')
  const socketGroups = (source.entryPointGroups ?? []).filter((group) => group.kind === 'socket')
  const serviceWorkerGroups = (source.entryPointGroups ?? []).filter((group) => group.kind === 'service-worker')
  const backgroundGroups = (source.entryPointGroups ?? []).filter((group) => group.kind === 'background-job')

  const runtimeJobs = []
  const ignoredDevelopmentOnly = []
  for (const entry of inventory.entryPoints?.backgroundJobs ?? []) {
    if (isDevelopmentOnlySource(entry.source)) ignoredDevelopmentOnly.push(entry.source)
    else runtimeJobs.push(entry)
  }

  return {
    httpRoutes: mapSurfaces(
      inventory.entryPoints?.httpRoutes ?? [],
      httpGroups,
      matchesHttpGroup,
      (route) => `${route.method} ${route.fullPath}`,
    ),
    socketEvents: mapSurfaces(
      inventory.entryPoints?.socketEvents ?? [],
      socketGroups,
      matchesSocketGroup,
      (entry) => `${entry.event} (${entry.direction})`,
    ),
    serviceWorkerEvents: mapSurfaces(
      inventory.entryPoints?.serviceWorkerEvents ?? [],
      serviceWorkerGroups,
      matchesServiceWorkerGroup,
      (entry) => `${entry.event} (${entry.source})`,
    ),
    backgroundJobs: {
      ...mapSurfaces(
        runtimeJobs,
        backgroundGroups,
        matchesBackgroundGroup,
        (entry) => `${entry.source} (${entry.kind})`,
      ),
      ignoredDevelopmentOnly: sorted(ignoredDevelopmentOnly),
    },
    dataModels: mapModels(inventory.dataModels ?? [], source.modelGroups ?? []),
    externalProviders: mapProviders(inventory.externalCommunications ?? [], source.providerGroups ?? []),
  }
}

const coverageFailures = (coverage) => {
  const failures = []
  for (const route of coverage.httpRoutes.unmapped) failures.push(`Unmapped HTTP route: ${route}`)
  for (const route of coverage.httpRoutes.ambiguous) failures.push(`Ambiguous HTTP route mapping: ${route}`)
  for (const event of coverage.socketEvents.unmapped) failures.push(`Unmapped Socket.IO event: ${event.replace(/ \([^)]*\)$/, '')}`)
  for (const event of coverage.socketEvents.ambiguous) failures.push(`Ambiguous Socket.IO event mapping: ${event}`)
  for (const event of coverage.serviceWorkerEvents.unmapped) failures.push(`Unmapped service-worker event: ${event}`)
  for (const event of coverage.serviceWorkerEvents.ambiguous) failures.push(`Ambiguous service-worker event mapping: ${event}`)
  for (const model of coverage.dataModels.unmapped) failures.push(`Unmapped data model: ${model}`)
  for (const model of coverage.dataModels.ambiguous) failures.push(`Ambiguous data model mapping: ${model}`)
  for (const provider of coverage.externalProviders.unmapped) failures.push(`Unmapped external provider: ${provider}`)
  for (const provider of coverage.externalProviders.ambiguous) failures.push(`Ambiguous external provider mapping: ${provider}`)
  for (const job of coverage.backgroundJobs.unmapped) failures.push(`Unmapped background job: ${job.replace(/ \([^)]*\)$/, '')}`)
  for (const job of coverage.backgroundJobs.ambiguous) failures.push(`Ambiguous background job mapping: ${job}`)
  return failures
}

const buildRuntimeSurfaceProjection = (inventory) => {
  const backgroundJobs = (inventory.entryPoints?.backgroundJobs ?? [])
    .filter((entry) => !isDevelopmentOnlySource(entry.source))

  return {
    inventorySchemaVersion: inventory.schemaVersion,
    httpRoutes: inventory.entryPoints?.httpRoutes ?? [],
    socketEvents: inventory.entryPoints?.socketEvents ?? [],
    serviceWorkerEvents: inventory.entryPoints?.serviceWorkerEvents ?? [],
    backgroundJobs,
    dataModels: inventory.dataModels ?? [],
    externalProviders: inventory.externalCommunications ?? [],
  }
}

export const buildThreatModel = ({ source, inventory }) => {
  const sourceFailures = validateThreatModelSource(source)
  const coverage = buildCoverage(source, inventory)
  const failures = [...sourceFailures, ...coverageFailures(coverage)]
  if (failures.length > 0) {
    throw new Error(`Threat model validation failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`)
  }

  const runtimeSurface = buildRuntimeSurfaceProjection(inventory)

  return {
    schemaVersion: 1,
    repository: source.repository,
    version: source.version,
    inventory: {
      runtimeSurfaceSha256: sha256(JSON.stringify(runtimeSurface)),
      schemaVersion: inventory.schemaVersion,
      sourceSelection: inventory.scope?.sourceSelection ?? null,
      surfaceCounts: {
        httpRoutes: runtimeSurface.httpRoutes.length,
        socketEvents: runtimeSurface.socketEvents.length,
        serviceWorkerEvents: runtimeSurface.serviceWorkerEvents.length,
        backgroundJobs: runtimeSurface.backgroundJobs.length,
        dataModels: runtimeSurface.dataModels.length,
        externalProviders: runtimeSurface.externalProviders.length,
      },
    },
    overview: source.overview,
    actors: source.actors,
    zones: source.zones,
    dataClasses: source.dataClasses,
    assets: source.assets,
    boundaries: source.boundaries,
    entryPointGroups: source.entryPointGroups,
    modelGroups: source.modelGroups,
    providerGroups: source.providerGroups,
    dataFlows: source.dataFlows,
    invariants: source.invariants,
    attackerStories: source.attackerStories,
    outOfScope: source.outOfScope,
    severityCalibration: source.severityCalibration,
    coverage,
    exitGate: {
      sourceReferencesValid: true,
      allHttpRoutesMapped: coverage.httpRoutes.unmapped.length === 0 && coverage.httpRoutes.ambiguous.length === 0,
      allSocketEventsMapped: coverage.socketEvents.unmapped.length === 0 && coverage.socketEvents.ambiguous.length === 0,
      allServiceWorkerEventsMapped: coverage.serviceWorkerEvents.unmapped.length === 0 && coverage.serviceWorkerEvents.ambiguous.length === 0,
      allRuntimeBackgroundJobsMapped: coverage.backgroundJobs.unmapped.length === 0 && coverage.backgroundJobs.ambiguous.length === 0,
      allDataModelsMapped: coverage.dataModels.unmapped.length === 0 && coverage.dataModels.ambiguous.length === 0,
      allExternalProvidersMapped: coverage.externalProviders.unmapped.length === 0 && coverage.externalProviders.ambiguous.length === 0,
      allCurrentSurfacesMapped: true,
    },
  }
}

const renderTable = (headers, rows) => {
  if (rows.length === 0) return '_None._\n'
  return [
    `| ${headers.map(markdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`),
    '',
  ].join('\n')
}

const renderList = (items) => (items ?? []).map((item) => `- ${item}`).join('\n') || '- None.'

export const renderThreatModelMarkdown = (model) => {
  const actorRows = model.actors.map((actor) => [actor.id, actor.name, actor.control, actor.capabilities.join('; ')])
  const boundaryRows = model.boundaries.map((boundary) => [
    boundary.id,
    boundary.name,
    `${boundary.fromZoneId} → ${boundary.toZoneId}`,
    boundary.channels.join(', '),
    boundary.controls.join('; '),
    boundary.assumptions.join('; '),
  ])
  const assetRows = model.assets.map((asset) => [asset.id, asset.name, asset.dataClassIds.join(', '), asset.invariantIds.join(', ')])
  const flowRows = model.dataFlows.map((flow) => [
    flow.id,
    flow.name,
    `${flow.fromZoneId} → ${flow.toZoneId}`,
    flow.dataClassIds.join(', '),
    flow.controls.join('; '),
    flow.failureModes.join('; '),
  ])
  const invariantRows = model.invariants.map((invariant) => [
    invariant.id,
    invariant.statement,
    invariant.severityIfBroken,
    invariant.evidence.join(', '),
  ])
  const storyRows = model.attackerStories.map((story) => [
    story.id,
    story.title,
    story.actorId,
    story.severity,
    story.attack,
    story.securityOutcome,
    story.mitigations.join('; '),
  ])
  const coverageRows = Object.entries(model.coverage).map(([name, value]) => [
    name,
    value.mapped,
    value.total,
    value.unmapped.length,
    value.ambiguous.length,
  ])

  return `# Chatify Repository Threat Model

## Overview

${model.overview.purpose}

### Security objectives

${renderList(model.overview.securityObjectives)}

### Included repository scope

${renderList(model.overview.included)}

### Explicit exclusions

${renderList(model.overview.excluded)}

The model is derived from Phase 1 runtime-surface SHA-256 \`${model.inventory.runtimeSurfaceSha256}\`, covering ${model.inventory.surfaceCounts.httpRoutes} HTTP routes, ${model.inventory.surfaceCounts.socketEvents} Socket.IO registrations, ${model.inventory.surfaceCounts.dataModels} data models, and ${model.inventory.surfaceCounts.externalProviders} external-provider groups. File-only audit and documentation changes do not alter this digest. It is a repository-scoped threat model, not a vulnerability report.

## Threat Model, Trust Boundaries, and Assumptions

### Actors

${renderTable(['ID', 'Actor', 'Control', 'Capabilities'], actorRows)}
### Assets and protected data

${renderTable(['ID', 'Asset', 'Data classes', 'Required invariants'], assetRows)}
### Trust boundaries

${renderTable(['ID', 'Boundary', 'Flow', 'Channels', 'Existing controls', 'Assumptions'], boundaryRows)}
### Data flows

${renderTable(['ID', 'Flow', 'Zones', 'Data classes', 'Controls', 'Failure modes'], flowRows)}
### Security invariants

${renderTable(['ID', 'Invariant', 'Severity if broken', 'Repository evidence'], invariantRows)}
## Attack Surface, Mitigations, and Attacker Stories

### Inventory coverage gate

${renderTable(['Surface', 'Mapped', 'Total', 'Unmapped', 'Ambiguous'], coverageRows)}
### Attacker stories

${renderTable(['ID', 'Story', 'Actor', 'Severity', 'Attack', 'Security outcome', 'Existing mitigations'], storyRows)}
### Out-of-scope attacker stories

${renderList(model.outOfScope)}

## Severity Calibration (Critical, High, Medium, Low)

### Critical

${renderList(model.severityCalibration.critical)}

### High

${renderList(model.severityCalibration.high)}

### Medium

${renderList(model.severityCalibration.medium)}

### Low

${renderList(model.severityCalibration.low)}

Repository: ${model.repository}
Version: ${model.version}
`
}

const serializeModel = (model) => `${JSON.stringify(model, null, 2)}\n`

export const writeGeneratedThreatModel = async (rootDirectory, model) => {
  const root = path.resolve(rootDirectory)
  await mkdir(path.join(root, OUTPUT_DIRECTORY), { recursive: true })
  const jsonPath = path.join(root, OUTPUT_FILES.json)
  const markdownPath = path.join(root, OUTPUT_FILES.markdown)
  await writeFile(jsonPath, serializeModel(model))
  await writeFile(markdownPath, renderThreatModelMarkdown(model))
  return { files: [jsonPath, markdownPath] }
}

export const checkGeneratedThreatModel = async (rootDirectory, model) => {
  const root = path.resolve(rootDirectory)
  const expected = new Map([
    [OUTPUT_FILES.json, serializeModel(model)],
    [OUTPUT_FILES.markdown, renderThreatModelMarkdown(model)],
  ])
  for (const [relativePath, expectedContent] of expected) {
    try {
      const actual = await readFile(path.join(root, relativePath), 'utf8')
      if (actual !== expectedContent) return false
    } catch {
      return false
    }
  }
  return true
}
