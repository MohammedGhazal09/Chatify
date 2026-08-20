#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const target = 'scripts/security/lib/inventory.mjs'
let source = await readFile(target, 'utf8')

const replaceOnce = (input, search, replacement, label) => {
  const first = input.indexOf(search)
  if (first === -1) throw new Error(`Patch marker not found: ${label}`)
  if (input.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Patch marker is ambiguous: ${label}`)
  }
  return `${input.slice(0, first)}${replacement}${input.slice(first + search.length)}`
}

const replaceBetween = (input, startMarker, endMarker, replacement, label) => {
  const start = input.indexOf(startMarker)
  if (start === -1) throw new Error(`Patch start marker not found: ${label}`)
  const end = input.indexOf(endMarker, start + startMarker.length)
  if (end === -1) throw new Error(`Patch end marker not found: ${label}`)
  return `${input.slice(0, start)}${replacement}${input.slice(end)}`
}

source = replaceBetween(
  source,
  'const shouldIgnoreRelativePath = (relativePath) => {',
  'const walkFilesystem = async',
  `const NON_RUNTIME_SOURCE_PREFIXES = [
  '.agents/',
  '.artifacts/',
  '.planning/',
  '.vscode/',
  'docs/',
]

const isGeneratedInventoryPath = (relativePath) => GENERATED_PATHS.has(relativePath)
const containsIgnoredDirectory = (relativePath) => relativePath
  .split('/')
  .some((part) => IGNORED_DIRECTORIES.has(part))

const shouldIgnoreFilesystemPath = (relativePath) => {
  if (!relativePath || relativePath === '.') return false
  return isGeneratedInventoryPath(relativePath) || containsIgnoredDirectory(relativePath)
}

const shouldExcludeFromStaticAnalysis = (relativePath) => (
  isGeneratedInventoryPath(relativePath)
  || containsIgnoredDirectory(relativePath)
  || NON_RUNTIME_SOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
)

`,
  'separate tracked inventory from static-analysis exclusions',
)

source = replaceOnce(
  source,
  'if (shouldIgnoreRelativePath(relativePath)) continue',
  'if (shouldIgnoreFilesystemPath(relativePath)) continue',
  'filesystem walk exclusion',
)
source = replaceOnce(
  source,
  ".map(toPosix).filter((file) => !shouldIgnoreRelativePath(file))",
  ".map(toPosix).filter((file) => !isGeneratedInventoryPath(file))",
  'git-index inventory filtering',
)
source = replaceOnce(
  source,
  "if (size > MAX_TEXT_BYTES || (!isEnvironmentTemplate && !SCANNABLE_EXTENSIONS.has(path.posix.extname(relativePath)))) return null",
  "if (shouldExcludeFromStaticAnalysis(relativePath) || size > MAX_TEXT_BYTES || (!isEnvironmentTemplate && !SCANNABLE_EXTENSIONS.has(path.posix.extname(relativePath)))) return null",
  'static-analysis source filtering',
)
source = replaceOnce(
  source,
  "  const extension = path.posix.extname(relativePath)\n",
  "  const extension = path.posix.extname(relativePath)\n  const parts = relativePath.split('/')\n",
  'component path parts',
)
source = replaceOnce(
  source,
  "  if (relativePath.startsWith('.artifacts/') || relativePath.startsWith('.agents/') || relativePath.startsWith('.vscode/') || relativePath.endsWith('.stackdump')) categories.push('generated-or-development-only')",
  "  if (relativePath.startsWith('.artifacts/') || relativePath.startsWith('.agents/') || relativePath.startsWith('.vscode/') || relativePath.endsWith('.stackdump') || parts.some((part) => IGNORED_DIRECTORIES.has(part))) categories.push('generated-or-development-only')",
  'generated component classification',
)
source = replaceOnce(
  source,
  "    .filter((file) => file.endsWith('package.json'))",
  "    .filter((file) => file.endsWith('package.json') && texts.has(file))",
  'scannable package manifests',
)

const routeHelpers = `const skipSourceTrivia = (source, startIndex) => {
  let index = startIndex

  while (index < source.length) {
    if (/\\s/.test(source[index])) {
      index += 1
      continue
    }
    if (source[index] === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\\n', index + 2)
      index = newline === -1 ? source.length : newline + 1
      continue
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2)
      index = end === -1 ? source.length : end + 2
      continue
    }
    break
  }

  return index
}

const getExpressReceivers = (source, sourcePath) => {
  const receivers = new Set()
  const patterns = [
    /\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:express\\s*\\.\\s*)?Router\\s*\\(/g,
    /\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*express\\s*\\(/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(source)) !== null) receivers.add(match[1])
  }

  if (sourcePath === 'Backend/Chatify/app.mjs') receivers.add('app')
  if (sourcePath.startsWith('Backend/Chatify/Routes/')) receivers.add('router')
  return receivers
}

const escapeRegExp = (value) => value.replaceAll('$', '\\$')

const extractRouteChainCalls = (source, receivers) => {
  if (receivers.size === 0) return []

  const receiverPattern = [...receivers].map(escapeRegExp).join('|')
  const regex = new RegExp(\`\\\\b(\${receiverPattern})\\\\s*\\\\.\\\\s*route\\\\s*\\\\(\`, 'g')
  const calls = []
  let match

  while ((match = regex.exec(source)) !== null) {
    const openIndex = source.indexOf('(', match.index + match[0].lastIndexOf('route') + 'route'.length)
    const routeCall = extractBalanced(source, openIndex)
    if (!routeCall) continue

    const [pathExpression = ''] = splitTopLevelArguments(routeCall.content)
    let cursor = routeCall.endIndex + 1

    while (cursor < source.length) {
      cursor = skipSourceTrivia(source, cursor)
      if (source[cursor] !== '.') break
      cursor = skipSourceTrivia(source, cursor + 1)

      const methodMatch = /^[A-Za-z_$][\\w$]*/.exec(source.slice(cursor))
      if (!methodMatch || !HTTP_METHODS.has(methodMatch[0])) break

      const method = methodMatch[0]
      const methodIndex = cursor
      cursor = skipSourceTrivia(source, cursor + method.length)
      if (source[cursor] !== '(') break

      const methodCall = extractBalanced(source, cursor)
      if (!methodCall) break
      calls.push({
        receiver: match[1],
        method,
        index: methodIndex,
        line: lineNumberAt(source, methodIndex),
        pathExpression,
        arguments: splitTopLevelArguments(methodCall.content),
        raw: methodCall.content,
      })
      cursor = methodCall.endIndex + 1
    }

    regex.lastIndex = Math.max(regex.lastIndex, cursor)
  }

  return calls
}

const extractExpressHttpCalls = (source, receivers) => {
  const directCalls = extractCalls(source, HTTP_METHODS)
    .filter((call) => receivers.has(call.receiver))
    .map((call) => ({
      ...call,
      pathExpression: call.arguments[0] ?? '',
      middlewareArguments: call.arguments.slice(1),
    }))
  const routeChainCalls = extractRouteChainCalls(source, receivers)
    .map((call) => ({
      ...call,
      middlewareArguments: call.arguments,
    }))

  return [...directCalls, ...routeChainCalls]
}

`

source = replaceOnce(
  source,
  'const parseDefaultImports = (source, sourcePath, knownFiles) => {',
  `${routeHelpers}const parseDefaultImports = (source, sourcePath, knownFiles) => {`,
  'Express route-chain helpers',
)

source = replaceOnce(
  source,
  `  const routeFiles = [...texts.keys()].filter((file) => (
    file.startsWith('Backend/Chatify/') && /\\.[cm]?[jt]s$/.test(file) && !/(^|\\/)(__tests__|test|tests)(\\/|$)/.test(file)
  ))`,
  `  const routeFiles = [...texts.keys()].filter((file) => (
    (file === 'Backend/Chatify/app.mjs' || file.startsWith('Backend/Chatify/Routes/'))
    && /\\.[cm]?[jt]s$/.test(file)
    && !/(^|\\/)(__tests__|test|tests)(\\/|$)/.test(file)
  ))`,
  'HTTP route source boundary',
)
source = replaceOnce(
  source,
  `    const imports = parseDefaultImports(source, file, knownFiles)
    for (const call of extractCalls(source, new Set(['use']))) {`,
  `    const imports = parseDefaultImports(source, file, knownFiles)
    const expressReceivers = getExpressReceivers(source, file)
    for (const call of extractCalls(source, new Set(['use']))) {
      if (!expressReceivers.has(call.receiver)) continue`,
  'Express mount receiver filtering',
)
source = replaceOnce(
  source,
  `    const source = texts.get(file)
    for (const call of extractCalls(source, HTTP_METHODS)) {
      const localPath = parseLiteralString(call.arguments[0] ?? '')`,
  `    const source = texts.get(file)
    const expressReceivers = getExpressReceivers(source, file)
    for (const call of extractExpressHttpCalls(source, expressReceivers)) {
      const localPath = parseLiteralString(call.pathExpression ?? '')`,
  'Express direct and chained route extraction',
)
source = replaceOnce(
  source,
  '          middlewareAndHandlerTokens: extractIdentifierTokens(call.arguments.slice(1)),',
  '          middlewareAndHandlerTokens: extractIdentifierTokens(call.middlewareArguments),',
  'Express chained middleware tokens',
)

await writeFile(target, source)
console.log(`Applied Phase 1 parser fixes to ${target}`)
