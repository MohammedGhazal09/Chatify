import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUTPUT_DIRECTORY = 'docs/security/audit/phase-1'
const GENERATED_PATHS = new Set([
  `${OUTPUT_DIRECTORY}/inventory.json`,
  `${OUTPUT_DIRECTORY}/inventory.md`,
])
const SOURCE_EXTENSIONS = new Set([
  '.cjs', '.css', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.ts', '.tsx', '.yaml', '.yml',
])
const SCANNABLE_EXTENSIONS = new Set([
  '.cjs', '.css', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.ts', '.tsx', '.yaml', '.yml',
])
const IGNORED_DIRECTORIES = new Set([
  '.git', '.next', '.nuxt', '.turbo', '.vite', 'build', 'coverage', 'dist', 'node_modules',
  'playwright-report', 'playwright-report-production', 'test-results',
])
const MAX_TEXT_BYTES = 2 * 1024 * 1024
const HTTP_METHODS = new Set(['all', 'delete', 'get', 'head', 'options', 'patch', 'post', 'put'])
const SOCKET_LIFECYCLE_EVENTS = new Set([
  'connect', 'connect_error', 'connection', 'disconnect', 'disconnecting', 'error', 'reconnect',
])
const SERVICE_WORKER_EVENTS = new Set([
  'activate', 'fetch', 'install', 'message', 'notificationclick', 'periodicsync', 'push', 'sync',
])

const toPosix = (value) => value.split(path.sep).join('/')
const sortStrings = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
const truncate = (value, max = 320) => value.length <= max ? value : `${value.slice(0, max - 1)}…`
const compactWhitespace = (value) => value.replace(/\s+/g, ' ').trim()
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const lineNumberAt = (source, index) => source.slice(0, index).split('\n').length
const markdownCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')

const pathExists = async (target) => {
  try {
    await access(target, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

const NON_RUNTIME_SOURCE_PREFIXES = [
  '.agents/',
  '.artifacts/',
  '.planning/',
  '.vscode/',
  'docs/',
  'scripts/security/__tests__/',
]

const isGeneratedInventoryPath = (relativePath) => GENERATED_PATHS.has(relativePath)
const containsIgnoredDirectory = (relativePath) => relativePath
  .split('/')
  .some((part) => IGNORED_DIRECTORIES.has(part))

const isDependencyLockfilePath = (relativePath) => (
  /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(relativePath)
)

const shouldIgnoreFilesystemPath = (relativePath) => {
  if (!relativePath || relativePath === '.') return false
  return isGeneratedInventoryPath(relativePath) || containsIgnoredDirectory(relativePath)
}

const shouldExcludeFromStaticAnalysis = (relativePath) => (
  isGeneratedInventoryPath(relativePath)
  || containsIgnoredDirectory(relativePath)
  || isDependencyLockfilePath(relativePath)
  || NON_RUNTIME_SOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
)

const walkFilesystem = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true })
  const files = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(current, entry.name)
    const relativePath = toPosix(path.relative(root, absolutePath))
    if (shouldIgnoreFilesystemPath(relativePath)) continue

    if (entry.isDirectory()) {
      files.push(...await walkFilesystem(root, absolutePath))
    } else if (entry.isFile()) {
      files.push(relativePath)
    }
  }

  return files
}

const listRepositoryFiles = async (root) => {
  try {
    const output = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const files = output.split('\0').filter(Boolean).map(toPosix).filter((file) => !isGeneratedInventoryPath(file))
    if (files.length > 0) {
      return { files: sortStrings(files), source: 'git-index' }
    }
  } catch {
    // A filesystem fallback keeps the library testable outside a Git worktree.
  }

  return { files: sortStrings(await walkFilesystem(root)), source: 'filesystem' }
}

const readTextIfSafe = async (root, relativePath, size) => {
  const isEnvironmentTemplate = /(^|\/)\.env\.(example|sample|template)$/.test(relativePath)
  if (shouldExcludeFromStaticAnalysis(relativePath) || size > MAX_TEXT_BYTES || (!isEnvironmentTemplate && !SCANNABLE_EXTENSIONS.has(path.posix.extname(relativePath)))) return null
  try {
    return await readFile(path.join(root, relativePath), 'utf8')
  } catch {
    return null
  }
}

const classifyComponent = (relativePath) => {
  const lower = relativePath.toLowerCase()
  const categories = []
  const extension = path.posix.extname(relativePath)
  const parts = relativePath.split('/')

  if (relativePath.endsWith('package.json')) categories.push('package-manifests')
  if (/package-lock\.json$|npm-shrinkwrap\.json$|yarn\.lock$|pnpm-lock\.yaml$/.test(relativePath)) categories.push('lockfiles')
  if (relativePath.startsWith('Backend/Chatify/')) categories.push('backend')
  if (relativePath.startsWith('Frontend/Chatify/')) categories.push('frontend')
  if (relativePath.includes('/Models/')) categories.push('models')
  if (relativePath.includes('/Routes/')) categories.push('routes')
  if (relativePath.includes('/Controller/')) categories.push('controllers')
  if (relativePath.includes('/Middlewares/')) categories.push('middleware')
  if (relativePath.includes('/Services/')) categories.push('services')
  if (relativePath.includes('/Config/')) categories.push('configuration')
  if (relativePath.includes('/Utils/')) categories.push('utilities')
  if (relativePath.startsWith('.github/workflows/')) categories.push('workflows')
  if (relativePath.startsWith('scripts/')) categories.push('cli-and-operations')
  if (relativePath.startsWith('docs/') || relativePath.startsWith('.planning/')) categories.push('documentation-and-runbooks')
  if (/(^|\/)(__tests__|test|tests|e2e)(\/|$)|\.(spec|test)\.[cm]?[jt]sx?$/.test(relativePath)) categories.push('tests')
  if (/(^|\/)(sw|service-worker|serviceworker)\.[cm]?[jt]s$/.test(lower) || lower.includes('vite-plugin-pwa')) categories.push('pwa-and-service-worker')
  if (/(^|\/)(dockerfile|compose\.ya?ml|render.*\.ya?ml|vercel\.json|netlify\.toml|Procfile)$/i.test(relativePath)) categories.push('deployment')
  if (relativePath.startsWith('.artifacts/') || relativePath.startsWith('.agents/') || relativePath.startsWith('.vscode/') || relativePath.endsWith('.stackdump') || parts.some((part) => IGNORED_DIRECTORIES.has(part))) categories.push('generated-or-development-only')
  if (SOURCE_EXTENSIONS.has(extension)) categories.push('text-source-or-config')
  if (categories.length === 0) categories.push('other')

  return sortStrings(categories)
}

const buildFileRecords = async (root, relativePaths) => {
  const records = []
  const texts = new Map()

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(root, relativePath)
    let fileStat
    try {
      fileStat = await stat(absolutePath)
    } catch {
      continue
    }
    if (!fileStat.isFile()) continue

    const bytes = await readFile(absolutePath)
    const text = await readTextIfSafe(root, relativePath, fileStat.size)
    if (text !== null) texts.set(relativePath, text)

    records.push({
      path: relativePath,
      bytes: fileStat.size,
      sha256: sha256(bytes),
      categories: classifyComponent(relativePath),
    })
  }

  return {
    records: records.sort((a, b) => a.path.localeCompare(b.path)),
    texts,
  }
}

const parseJson = (text, filePath) => {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Unable to parse ${filePath}: ${error.message}`)
  }
}

const getLockfileForManifest = (manifestPath, fileRecordByPath) => {
  const directory = path.posix.dirname(manifestPath)
  const candidates = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock']
    .map((file) => directory === '.' ? file : `${directory}/${file}`)
  const match = candidates.find((candidate) => fileRecordByPath.has(candidate))
  if (!match) return null
  const record = fileRecordByPath.get(match)
  return { path: match, sha256: record.sha256 }
}

const buildReproducibility = (fileRecords, texts) => {
  const fileRecordByPath = new Map(fileRecords.map((record) => [record.path, record]))
  const manifestPaths = fileRecords
    .map((record) => record.path)
    .filter((file) => file.endsWith('package.json') && texts.has(file))
    .sort((a, b) => a.localeCompare(b))
  const packages = []

  for (const manifestPath of manifestPaths) {
    const manifest = parseJson(texts.get(manifestPath), manifestPath)
    packages.push({
      path: manifestPath,
      cwd: path.posix.dirname(manifestPath) === '.' ? '.' : path.posix.dirname(manifestPath),
      name: manifest.name ?? null,
      version: manifest.version ?? null,
      private: manifest.private === true,
      type: manifest.type ?? 'commonjs-default',
      engines: manifest.engines ?? {},
      scripts: Object.fromEntries(Object.entries(manifest.scripts ?? {}).sort(([a], [b]) => a.localeCompare(b))),
      dependencies: Object.fromEntries(Object.entries(manifest.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b))),
      devDependencies: Object.fromEntries(Object.entries(manifest.devDependencies ?? {}).sort(([a], [b]) => a.localeCompare(b))),
      lockfile: getLockfileForManifest(manifestPath, fileRecordByPath),
    })
  }

  const cleanInstallCommands = packages
    .filter((pkg) => pkg.lockfile)
    .map((pkg) => ({
      cwd: pkg.cwd,
      command: 'npm ci',
      manifest: pkg.path,
      lockfile: pkg.lockfile.path,
    }))
    .sort((a, b) => a.cwd.localeCompare(b.cwd))

  const validationCommands = packages.flatMap((pkg) => Object.entries(pkg.scripts)
    .filter(([name]) => /^(build|doctor|e2e|evidence|lint|ops|quality|security|smoke|test)/.test(name))
    .map(([name, command]) => ({ cwd: pkg.cwd, script: name, command: `npm run ${name}`, implementation: command })))
    .sort((a, b) => `${a.cwd}:${a.script}`.localeCompare(`${b.cwd}:${b.script}`))

  return {
    packages,
    cleanInstallCommands,
    validationCommands,
    rootManifestHasLockfile: packages.find((pkg) => pkg.path === 'package.json')?.lockfile !== null,
    notes: [
      'Committed inventory is derived from tracked source and lockfiles; runtime versions and command outcomes are recorded in the CI evidence artifact.',
      'Only package directories with a lockfile are assigned an npm ci command.',
    ],
  }
}

const extractBalanced = (source, openIndex, openChar = '(', closeChar = ')') => {
  if (source[openIndex] !== openChar) return null
  let depth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === openChar) depth += 1
    if (char === closeChar) {
      depth -= 1
      if (depth === 0) {
        return { content: source.slice(openIndex + 1, index), endIndex: index }
      }
    }
  }

  return null
}

const splitTopLevelArguments = (content) => {
  const args = []
  let start = 0
  const stack = []
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  const matching = { ')': '(', ']': '[', '}': '{' }

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const next = content[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '(' || char === '[' || char === '{') stack.push(char)
    else if (char === ')' || char === ']' || char === '}') {
      if (stack.at(-1) === matching[char]) stack.pop()
    } else if (char === ',' && stack.length === 0) {
      args.push(content.slice(start, index).trim())
      start = index + 1
    }
  }

  const tail = content.slice(start).trim()
  if (tail || content.trim()) args.push(tail)
  return args
}

const parseLiteralString = (expression) => {
  const value = expression.trim()
  if (value.length < 2) return null
  const quote = value[0]
  if (!['"', "'", '`'].includes(quote) || value.at(-1) !== quote) return null
  if (quote === '`' && value.includes('${')) return null
  return value.slice(1, -1)
}

const extractCalls = (source, methods) => {
  const methodPattern = [...methods].sort((a, b) => b.length - a.length).join('|')
  const regex = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${methodPattern})\\s*\\(`, 'g')
  const calls = []
  let match

  while ((match = regex.exec(source)) !== null) {
    const openIndex = source.indexOf('(', match.index + match[0].lastIndexOf(match[2]) + match[2].length)
    const balanced = extractBalanced(source, openIndex)
    if (!balanced) continue
    calls.push({
      receiver: match[1],
      method: match[2],
      index: match.index,
      line: lineNumberAt(source, match.index),
      arguments: splitTopLevelArguments(balanced.content),
      raw: balanced.content,
    })
    regex.lastIndex = balanced.endIndex + 1
  }

  return calls
}

const skipSourceTrivia = (source, startIndex) => {
  let index = startIndex

  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1
      continue
    }
    if (source[index] === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2)
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
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:express\s*\.\s*)?Router\s*\(/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*express\s*\(/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(source)) !== null) receivers.add(match[1])
  }

  if (sourcePath === 'Backend/Chatify/app.mjs') receivers.add('app')
  if (sourcePath.startsWith('Backend/Chatify/Routes/')) receivers.add('router')
  return receivers
}

const escapeRegExp = (value) => value.replaceAll('$', '\$')

const extractRouteChainCalls = (source, receivers) => {
  if (receivers.size === 0) return []

  const receiverPattern = [...receivers].map(escapeRegExp).join('|')
  const regex = new RegExp(`\\b(${receiverPattern})\\s*\\.\\s*route\\s*\\(`, 'g')
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

      const methodMatch = /^[A-Za-z_$][\w$]*/.exec(source.slice(cursor))
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

const parseDefaultImports = (source, sourcePath, knownFiles) => {
  const imports = new Map()
  const regex = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g
  let match

  while ((match = regex.exec(source)) !== null) {
    if (!match[2].startsWith('.')) continue
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), match[2]))
    const candidates = [base, `${base}.mjs`, `${base}.js`, `${base}.ts`, `${base}.tsx`, `${base}/index.mjs`, `${base}/index.js`]
    const resolved = candidates.find((candidate) => knownFiles.has(candidate))
    if (resolved) imports.set(match[1], resolved)
  }

  return imports
}

const joinRoutePath = (prefix, localPath) => {
  if (!prefix) return localPath
  if (!localPath) return prefix
  if (localPath === '/') return prefix.endsWith('/') ? prefix : `${prefix}/`
  return `${prefix.replace(/\/$/, '')}/${localPath.replace(/^\//, '')}`
}

const extractIdentifierTokens = (expressions) => sortStrings(expressions.flatMap((expression) => (
  expression.match(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g) ?? []
)).filter((token) => !['async', 'false', 'function', 'null', 'true', 'undefined'].includes(token)))

const extractHttpRoutes = (texts, knownFiles) => {
  const routeFiles = [...texts.keys()].filter((file) => (
    (file === 'Backend/Chatify/app.mjs' || file.startsWith('Backend/Chatify/Routes/'))
    && /\.[cm]?[jt]s$/.test(file)
    && !/(^|\/)(__tests__|test|tests)(\/|$)/.test(file)
  ))
  const mountsByTarget = new Map()
  const directMounts = []

  for (const file of routeFiles) {
    const source = texts.get(file)
    const imports = parseDefaultImports(source, file, knownFiles)
    const expressReceivers = getExpressReceivers(source, file)
    for (const call of extractCalls(source, new Set(['use']))) {
      if (!expressReceivers.has(call.receiver)) continue
      const prefix = parseLiteralString(call.arguments[0] ?? '')
      if (!prefix) continue
      const targetExpression = call.arguments.at(-1)?.trim() ?? ''
      const targetIdentifier = /^[A-Za-z_$][\w$]*$/.test(targetExpression) ? targetExpression : null
      const targetFile = targetIdentifier ? imports.get(targetIdentifier) : null
      const mount = {
        prefix,
        source: file,
        line: call.line,
        receiver: call.receiver,
        middlewareTokens: extractIdentifierTokens(call.arguments.slice(1, targetFile ? -1 : undefined)),
        targetIdentifier,
        targetFile: targetFile ?? null,
      }
      directMounts.push(mount)
      if (targetFile) {
        const existing = mountsByTarget.get(targetFile) ?? []
        existing.push(mount)
        mountsByTarget.set(targetFile, existing)
      }
    }
  }

  const routes = []
  for (const file of routeFiles) {
    const source = texts.get(file)
    const expressReceivers = getExpressReceivers(source, file)
    for (const call of extractExpressHttpCalls(source, expressReceivers)) {
      const localPath = parseLiteralString(call.pathExpression ?? '')
      if (localPath === null) continue
      const mounts = mountsByTarget.get(file)
      const applicableMounts = mounts?.length ? mounts : [null]
      for (const mount of applicableMounts) {
        routes.push({
          method: call.method.toUpperCase(),
          localPath,
          mountPath: mount?.prefix ?? null,
          fullPath: mount ? joinRoutePath(mount.prefix, localPath) : localPath,
          source: file,
          line: call.line,
          receiver: call.receiver,
          mountSource: mount?.source ?? null,
          mountLine: mount?.line ?? null,
          middlewareAndHandlerTokens: extractIdentifierTokens(call.middlewareArguments),
          mountMiddlewareTokens: mount?.middlewareTokens ?? [],
        })
      }
    }
  }

  routes.sort((a, b) => (
    `${a.fullPath}:${a.method}:${a.source}:${a.line}`.localeCompare(`${b.fullPath}:${b.method}:${b.source}:${b.line}`)
  ))
  directMounts.sort((a, b) => `${a.prefix}:${a.source}:${a.line}`.localeCompare(`${b.prefix}:${b.source}:${b.line}`))
  return { routes, mounts: directMounts }
}

const extractLiteralConstantMap = (texts) => {
  const constants = new Map()
  const objectRegex = /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:Object\.freeze\s*\(\s*)?\{/g

  for (const source of texts.values()) {
    let match
    while ((match = objectRegex.exec(source)) !== null) {
      const openBrace = source.indexOf('{', match.index)
      const balanced = extractBalanced(source, openBrace, '{', '}')
      if (!balanced) continue
      for (const property of extractObjectProperties(source, openBrace)) {
        const colonIndex = property.definition.indexOf(':')
        if (colonIndex === -1) continue
        const literal = parseLiteralString(property.definition.slice(colonIndex + 1).replace(/,$/, '').trim())
        if (literal !== null) constants.set(`${match[1]}.${property.name}`, literal)
      }
      objectRegex.lastIndex = balanced.endIndex + 1
    }

    const scalarRegex = /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([^'"`$]+)\2/g
    while ((match = scalarRegex.exec(source)) !== null) constants.set(match[1], match[3])
  }

  return constants
}

const getSocketDirection = (file, method, event) => {
  const backend = file.startsWith('Backend/Chatify/')
  const frontend = file.startsWith('Frontend/Chatify/')
  if (!backend && !frontend) return null
  if (SOCKET_LIFECYCLE_EVENTS.has(event)) return 'transport-lifecycle'
  if (backend && (method === 'on' || method === 'once')) return 'client-to-server-listener'
  if (backend && method === 'emit') return 'server-to-client-emitter'
  if (frontend && method === 'emit') return 'client-to-server-emitter'
  if (frontend && (method === 'on' || method === 'once')) return 'server-to-client-listener'
  return null
}

const isLikelySocketReceiver = (receiver) => {
  const normalized = receiver.replace(/\s+/g, '')
  const root = normalized.match(/^[A-Za-z_$][\w$]*/)?.[0] ?? ''
  if (/socket/i.test(root) || root === 'io') return true
  return /(?:^|\.)(?:io|socket[A-Za-z_$\d]*)(?:$|\.|\()/i.test(normalized)
}

const extractSocketEvents = (texts) => {
  const events = []
  const literalConstants = extractLiteralConstantMap(texts)
  const regex = /\b([A-Za-z_$][\w$]*(?:(?:\s*\?\.\s*|\s*\.\s*)[A-Za-z_$][\w$]*|\s*\([^()\n]*\))*)\s*(?:\?\.|\.)\s*(on|once|emit)\s*\(/g

  for (const [file, source] of texts) {
    if (!file.startsWith('Backend/Chatify/') && !file.startsWith('Frontend/Chatify/')) continue
    if (!/\.[cm]?[jt]sx?$/.test(file) || /(^|\/)(__tests__|test|tests|e2e)(\/|$)|\.(test|spec)\./.test(file)) continue
    let match
    while ((match = regex.exec(source)) !== null) {
      const receiver = compactWhitespace(match[1])
      const method = match[2]
      if (!isLikelySocketReceiver(receiver)) continue
      const openIndex = source.indexOf('(', match.index + match[0].lastIndexOf(method) + method.length)
      const balanced = extractBalanced(source, openIndex)
      if (!balanced) continue
      const [firstArgument] = splitTopLevelArguments(balanced.content)
      if (!firstArgument) continue
      const literal = parseLiteralString(firstArgument)
      const expression = literal === null ? compactWhitespace(firstArgument) : null
      const resolvedConstant = expression ? literalConstants.get(expression) ?? null : null
      const event = literal ?? resolvedConstant ?? `<dynamic:${expression}>`
      const direction = getSocketDirection(file, method, event)
      if (!direction) continue
      events.push({
        event,
        dynamicExpression: expression,
        resolvedFromExpression: resolvedConstant ? expression : null,
        direction,
        method,
        receiver,
        source: file,
        line: lineNumberAt(source, match.index),
      })
    }
  }

  const deduplicated = new Map(events.map((entry) => [
    `${entry.direction}:${entry.event}:${entry.source}:${entry.line}`,
    entry,
  ]))
  return [...deduplicated.values()].sort((a, b) => (
    `${a.event}:${a.direction}:${a.source}:${a.line}`.localeCompare(`${b.event}:${b.direction}:${b.source}:${b.line}`)
  ))
}

const isServiceWorkerSource = (file) => (
  file.startsWith('Frontend/Chatify/')
  && /(^|\/)(?:[^/]*[-_.])?(?:sw|service-worker|serviceworker)(?:[-_.][^/]*)?\.[cm]?[jt]s$/i.test(file)
)

const extractServiceWorkerEvents = (texts) => {
  const entries = []
  const regex = /(?:self\s*\.\s*)?addEventListener\s*\(/g

  for (const [file, source] of texts) {
    if (!isServiceWorkerSource(file)) continue
    let match
    while ((match = regex.exec(source)) !== null) {
      const balanced = extractBalanced(source, source.indexOf('(', match.index))
      if (!balanced) continue
      const event = parseLiteralString(splitTopLevelArguments(balanced.content)[0] ?? '')
      if (!event || !SERVICE_WORKER_EVENTS.has(event)) continue
      entries.push({ event, source: file, line: lineNumberAt(source, match.index) })
      regex.lastIndex = balanced.endIndex + 1
    }
  }

  return entries.sort((a, b) => `${a.event}:${a.source}:${a.line}`.localeCompare(`${b.event}:${b.source}:${b.line}`))
}

const extractBackgroundJobs = (texts) => {
  const jobs = []
  const patterns = [
    ['setInterval', /\bsetInterval\s*\(/g],
    ['setTimeout', /\bsetTimeout\s*\(/g],
    ['cron-or-scheduler', /\b(?:cron|scheduleJob|scheduler\.)\b/g],
  ]

  for (const [file, source] of texts) {
    if (!/\.[cm]?[jt]s$/.test(file) || /(^|\/)(__tests__|test|tests|e2e)(\/|$)|\.(test|spec)\./.test(file)) continue
    for (const [kind, regex] of patterns) {
      let match
      while ((match = regex.exec(source)) !== null) {
        jobs.push({ kind, source: file, line: lineNumberAt(source, match.index) })
      }
    }
  }

  return jobs.sort((a, b) => `${a.kind}:${a.source}:${a.line}`.localeCompare(`${b.kind}:${b.source}:${b.line}`))
}

const extractObjectProperties = (source, openBraceIndex) => {
  const balanced = extractBalanced(source, openBraceIndex, '{', '}')
  if (!balanced) return []
  const content = balanced.content
  const properties = []
  let depthBrace = 0
  let depthBracket = 0
  let depthParen = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false
  let expectingProperty = true

  const skipWhitespaceAndComments = (start) => {
    let index = start
    while (index < content.length) {
      if (/\s/.test(content[index])) {
        index += 1
        continue
      }
      if (content[index] === '/' && content[index + 1] === '/') {
        const newline = content.indexOf('\n', index + 2)
        index = newline === -1 ? content.length : newline + 1
        continue
      }
      if (content[index] === '/' && content[index + 1] === '*') {
        const end = content.indexOf('*/', index + 2)
        index = end === -1 ? content.length : end + 2
        continue
      }
      break
    }
    return index
  }

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const next = content[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (depthBrace === 0 && depthBracket === 0 && depthParen === 0 && expectingProperty) {
      const start = skipWhitespaceAndComments(index)
      if (start >= content.length) break
      let name = null
      let cursor = start
      if (/[A-Za-z_$]/.test(content[cursor])) {
        cursor += 1
        while (/[\w$]/.test(content[cursor] ?? '')) cursor += 1
        name = content.slice(start, cursor)
      } else if (content[cursor] === '"' || content[cursor] === "'") {
        const keyQuote = content[cursor]
        cursor += 1
        const keyStart = cursor
        while (cursor < content.length && content[cursor] !== keyQuote) {
          if (content[cursor] === '\\') cursor += 1
          cursor += 1
        }
        name = content.slice(keyStart, cursor)
        cursor += 1
      }
      cursor = skipWhitespaceAndComments(cursor)
      if (name && content[cursor] === ':') {
        properties.push({
          name,
          index: openBraceIndex + 1 + start,
          relativeIndex: start,
          line: lineNumberAt(source, openBraceIndex + 1 + start),
        })
        expectingProperty = false
        index = cursor
        continue
      }
    }

    if (char === '{') depthBrace += 1
    else if (char === '}') depthBrace = Math.max(0, depthBrace - 1)
    else if (char === '[') depthBracket += 1
    else if (char === ']') depthBracket = Math.max(0, depthBracket - 1)
    else if (char === '(') depthParen += 1
    else if (char === ')') depthParen = Math.max(0, depthParen - 1)
    else if (char === ',' && depthBrace === 0 && depthBracket === 0 && depthParen === 0) expectingProperty = true
  }

  return properties.map((property, index) => {
    const nextStart = properties[index + 1]?.relativeIndex ?? content.length
    return {
      ...property,
      definition: compactWhitespace(content.slice(property.relativeIndex, nextStart).replace(/,$/, '')),
    }
  })
}

const classifyFieldNames = (fields, pattern) => sortStrings(fields.filter((field) => pattern.test(field.name)).map((field) => field.name))

const extractRequestBodyFields = (source) => {
  const fields = []
  const destructuring = /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:req|request)\.body\b/g
  let match
  while ((match = destructuring.exec(source)) !== null) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/[:=]/)[0]?.trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) fields.push(name)
    }
  }
  const direct = /\b(?:req|request)\.body\.([A-Za-z_$][\w$]*)/g
  while ((match = direct.exec(source)) !== null) fields.push(match[1])
  return sortStrings(fields)
}

const extractResponseFields = (source) => {
  const fields = []
  const regex = /\b(?:res|response)\s*\.\s*(?:json|send)\s*\(\s*\{/g
  let match
  while ((match = regex.exec(source)) !== null) {
    const openBrace = source.indexOf('{', match.index)
    fields.push(...extractObjectProperties(source, openBrace).map((entry) => entry.name))
  }
  const selectRegex = /\.select\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = selectRegex.exec(source)) !== null) {
    fields.push(...match[1].split(/\s+/).map((field) => field.replace(/^[-+]/, '')).filter(Boolean))
  }
  return sortStrings(fields)
}

const findModelConsumers = (modelFile, modelNames, texts, knownFiles) => {
  const consumers = []
  const basenameWithoutExtension = modelFile.replace(/\.[^.]+$/, '')

  for (const [file, source] of texts) {
    if (file === modelFile || !/\.[cm]?[jt]sx?$/.test(file)) continue
    const imports = parseDefaultImports(source, file, knownFiles)
    const importedModel = [...imports.values()].includes(modelFile)
    const textualImport = source.includes(basenameWithoutExtension)
    const nameUse = modelNames.some((modelName) => new RegExp(`\\b${modelName}\\b`).test(source))
    if (importedModel || textualImport || nameUse) consumers.push(file)
  }

  return sortStrings(consumers)
}

const extractDataModels = (texts, knownFiles) => {
  const models = []
  const modelFiles = [...texts.keys()].filter((file) => file.includes('/Models/') && /\.[cm]?[jt]s$/.test(file)).sort()

  for (const file of modelFiles) {
    const source = texts.get(file)
    const modelNames = sortStrings([...source.matchAll(/(?:mongoose\s*\.\s*)?model\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((match) => match[1]))
    const fields = []
    const schemaRegex = /new\s+(?:mongoose\s*\.\s*)?Schema\s*\(\s*\{/g
    let schemaMatch
    while ((schemaMatch = schemaRegex.exec(source)) !== null) {
      const openBrace = source.indexOf('{', schemaMatch.index)
      fields.push(...extractObjectProperties(source, openBrace))
    }

    const uniqueFields = sortStrings(fields.filter((field) => /\bunique\s*:\s*true\b/.test(field.definition)).map((field) => field.name))
    const ttlFields = sortStrings(fields.filter((field) => /\bexpires\s*:|expireAfterSeconds/.test(field.definition)).map((field) => field.name))
    const references = sortStrings([...source.matchAll(/\bref\s*:\s*['"`]([^'"`]+)['"`]/g)].map((match) => match[1]))
    const indexes = []
    const indexRegex = /\b([A-Za-z_$][\w$]*)\s*\.\s*index\s*\(/g
    let indexMatch
    while ((indexMatch = indexRegex.exec(source)) !== null) {
      const balanced = extractBalanced(source, source.indexOf('(', indexMatch.index))
      if (!balanced) continue
      const args = splitTopLevelArguments(balanced.content)
      indexes.push({
        schema: indexMatch[1],
        keys: truncate(compactWhitespace(args[0] ?? '')),
        options: truncate(compactWhitespace(args[1] ?? '')),
        line: lineNumberAt(source, indexMatch.index),
      })
      indexRegex.lastIndex = balanced.endIndex + 1
    }

    const consumers = findModelConsumers(file, modelNames, texts, knownFiles)
    const consumerSources = consumers.map((consumer) => texts.get(consumer) ?? '')
    const deletionOperations = []
    const deleteRegex = /\b(deleteMany|deleteOne|findByIdAndDelete|findOneAndDelete|remove)\s*\(/g
    for (const consumer of [file, ...consumers]) {
      const consumerSource = texts.get(consumer) ?? ''
      let deleteMatch
      while ((deleteMatch = deleteRegex.exec(consumerSource)) !== null) {
        deletionOperations.push({ operation: deleteMatch[1], source: consumer, line: lineNumberAt(consumerSource, deleteMatch.index) })
      }
    }

    models.push({
      source: file,
      modelNames,
      fields: fields.map((field) => ({ name: field.name, line: field.line, definition: truncate(field.definition, 240) }))
        .sort((a, b) => `${a.name}:${a.line}`.localeCompare(`${b.name}:${b.line}`)),
      sensitiveFields: classifyFieldNames(fields, /password|secret|token|email|phone|ip|cookie|session|credential|key|candidate|message|content|body|payload|endpoint|subscription|address|lastSeen/i),
      ownershipFields: classifyFieldNames(fields, /owner|user|createdBy|sender|recipient|member|participant|caller|callee|actor|moderator|admin|author|reportedBy|assignedTo/i),
      roleFields: classifyFieldNames(fields, /role|permission|admin|moderator|status|ban|mute|verified/i),
      lifecycleAndAuditFields: classifyFieldNames(fields, /deleted|tombstone|createdAt|updatedAt|audit|history|retention|expiresAt/i),
      uniqueFields,
      ttlFields,
      references,
      indexes: indexes.sort((a, b) => a.line - b.line),
      timestampsEnabled: /\btimestamps\s*:\s*true\b/.test(source),
      hashingOrEncryptionSignals: sortStrings([
        /argon2/i.test(source) ? 'argon2' : null,
        /bcrypt/i.test(source) ? 'bcrypt' : null,
        /\bcrypto\b|encrypt|decrypt/i.test(source) ? 'crypto-or-encryption' : null,
        /\bhash/i.test(source) ? 'hashing' : null,
      ]),
      consumerFiles: consumers,
      clientInputCandidates: sortStrings(consumerSources.flatMap(extractRequestBodyFields)),
      responseFieldCandidates: sortStrings(consumerSources.flatMap(extractResponseFields)),
      deletionOperations: deletionOperations.sort((a, b) => `${a.source}:${a.line}`.localeCompare(`${b.source}:${b.line}`)),
      extractionConfidence: 'heuristic-static-inventory; validate accepted and returned fields during authorization/data-flow review',
    })
  }

  return models
}

const isSensitiveConfigName = (name) => /(?:SECRET|PASSWORD|PASS|PRIVATE|TOKEN|CREDENTIAL|API_KEY|ACCESS_KEY|SIGNING|COOKIE_KEY|SESSION_KEY)/i.test(name)

const classifyConfigName = (name) => {
  if (/MONGO|DATABASE|\bDB_/.test(name)) return 'database'
  if (/JWT|AUTH|OAUTH|SESSION|TOKEN/.test(name)) return 'authentication-and-sessions'
  if (/COOKIE|CSRF|SAMESITE/.test(name)) return 'cookies-and-csrf'
  if (/ORIGIN|CORS|PROXY/.test(name)) return 'cors-and-proxy'
  if (/RATE|LIMIT|MAX_|BODY_SIZE|REQUEST_SIZE/.test(name)) return 'request-and-rate-limits'
  if (/CLOUDINARY|UPLOAD|MEDIA|ATTACHMENT/.test(name)) return 'media-and-uploads'
  if (/MAIL|SMTP|EMAIL/.test(name)) return 'email'
  if (/VAPID|WEB_PUSH|PUSH_/.test(name)) return 'web-push'
  if (/TURN|STUN|ICE|WEBRTC|CALL_/.test(name)) return 'webrtc-and-turn'
  if (/AUDIT|LOG|METRIC|OBSERV|TRACE/.test(name)) return 'audit-logging-and-metrics'
  if (/TTL|RETENTION|EXPIR|DELETE|GRACE/.test(name)) return 'retention-and-lifecycle'
  if (/WEBHOOK|INTEGRATION/.test(name)) return 'integrations'
  return 'general-runtime'
}

const sanitizeExampleValue = (name, value) => {
  if (isSensitiveConfigName(name)) return '<redacted>'
  if (!value) return '<empty>'
  if (/replace|changeme|example|placeholder|your[-_]/i.test(value)) return '<placeholder>'
  try {
    const parsed = new URL(value)
    if (parsed.username || parsed.password) {
      parsed.username = '<redacted>'
      parsed.password = '<redacted>'
    }
    return parsed.toString()
  } catch {
    return truncate(value, 160)
  }
}

const extractEnvironmentConfiguration = (texts) => {
  const definitions = new Map()
  const usage = new Map()
  const envFiles = [...texts.keys()].filter((file) => /(^|\/)\.env\.(example|sample|template)$/.test(file)).sort()

  for (const file of envFiles) {
    const source = texts.get(file)
    source.split(/\r?\n/).forEach((line, index) => {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match || line.trim().startsWith('#')) return
      const entries = definitions.get(match[1]) ?? []
      entries.push({ source: file, line: index + 1, value: match[2] })
      definitions.set(match[1], entries)
    })
  }

  const patterns = [
    { kind: 'process-env', regex: /\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g },
    { kind: 'process-env-bracket', regex: /\bprocess\.env\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g },
    { kind: 'vite-env', regex: /\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g },
    { kind: 'github-secret', regex: /\bsecrets\.([A-Za-z_][A-Za-z0-9_]*)/g },
    { kind: 'github-variable', regex: /\bvars\.([A-Za-z_][A-Za-z0-9_]*)/g },
  ]

  for (const [file, source] of texts) {
    for (const { kind, regex } of patterns) {
      let match
      while ((match = regex.exec(source)) !== null) {
        const entries = usage.get(match[1]) ?? []
        entries.push({ source: file, line: lineNumberAt(source, match.index), kind })
        usage.set(match[1], entries)
      }
    }
  }

  const names = sortStrings([...definitions.keys(), ...usage.keys()])
  const variables = names.map((name) => {
    const exampleEntries = definitions.get(name) ?? []
    const firstExample = exampleEntries[0]
    return {
      name,
      category: classifyConfigName(name),
      sensitive: isSensitiveConfigName(name),
      definedInExamples: exampleEntries.map(({ source, line }) => ({ source, line })),
      referencedAt: (usage.get(name) ?? []).sort((a, b) => `${a.source}:${a.line}`.localeCompare(`${b.source}:${b.line}`)),
      exampleValue: firstExample ? sanitizeExampleValue(name, firstExample.value) : null,
    }
  })

  return {
    exampleFiles: envFiles,
    variables,
    missingFromExamples: sortStrings([...usage.keys()].filter((name) => !definitions.has(name))),
    unusedExamples: sortStrings([...definitions.keys()].filter((name) => !usage.has(name))),
    categories: Object.fromEntries(sortStrings(variables.map((entry) => entry.category)).map((category) => [
      category,
      variables.filter((entry) => entry.category === category).map((entry) => entry.name),
    ])),
    redactionPolicy: 'Values for secret-like variables are never written to generated inventory.',
  }
}

const providerRules = [
  { provider: 'mongodb', regex: /mongoose\s*\.\s*connect|mongodb(?:\+srv)?:\/\/|\bMONGO(?:DB)?_/i },
  { provider: 'google-oauth', regex: /passport-google|google-oauth|\bGOOGLE_(?:CLIENT|OAUTH)/i },
  { provider: 'github-oauth', regex: /passport-github|\bGITHUB_(?:CLIENT|OAUTH)/i },
  { provider: 'discord-oauth', regex: /passport-discord|\bDISCORD_(?:CLIENT|OAUTH)/i },
  { provider: 'cloudinary', regex: /\bcloudinary\b|\bCLOUDINARY_/i },
  { provider: 'email', regex: /\bnodemailer\b|\bSMTP_|\bMAIL_(?:HOST|USER|PASS|PORT)/i },
  { provider: 'web-push', regex: /\bweb-push\b|\bVAPID_|\bWEB_PUSH_/i },
  { provider: 'stun-turn', regex: /\bstun:|\bturns?:|\bTURN_|\bSTUN_|\bICE_/i },
  { provider: 'generic-http', regex: /\baxios\b|\bfetch\s*\(|\bhttps?\s*\.\s*request\s*\(/i },
]

const extractStaticHosts = (source) => {
  const values = []
  const regex = /\b(?:https?|mongodb(?:\+srv)?|stun|turns?):\/\/[^\s'"`),]+/gi
  let match
  while ((match = regex.exec(source)) !== null) {
    const raw = match[0]
    try {
      const parsed = new URL(raw)
      values.push(`${parsed.protocol}//${parsed.host}`)
    } catch {
      const schemeEnd = raw.indexOf('://')
      const scheme = raw.slice(0, schemeEnd + 3)
      const authority = raw.slice(schemeEnd + 3).split('/')[0].replace(/^[^@]+@/, '<redacted>@')
      values.push(`${scheme}${authority}`)
    }
  }
  return sortStrings(values)
}

const getControls = (source) => sortStrings([
  /\btimeout\s*:|AbortSignal\.timeout|setTimeout/.test(source) ? 'timeout' : null,
  /\bmaxRedirects\s*:|redirect\s*:\s*['"]manual['"]/.test(source) ? 'redirect-limit' : null,
  /\bmaxContentLength\s*:|\bmaxBodyLength\s*:|response-size/.test(source) ? 'response-size-limit' : null,
  /\bretr(?:y|ies)\b/i.test(source) ? 'retry-control' : null,
  /\bvalidateStatus\s*:|status\s*>=?/.test(source) ? 'response-status-validation' : null,
  /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/.test(source) ? 'tls-validation-disabled-signal' : null,
])

const hasUserControlledHttpDestination = (source) => {
  const callRegex = /(?:axios\s*\.\s*(?:get|post|put|patch|delete|request)|fetch|https?\s*\.\s*request)\s*\(([^,\n)]+)/gi
  let match
  while ((match = callRegex.exec(source)) !== null) {
    const expression = match[1].trim()
    if (parseLiteralString(expression) !== null) continue
    if (/req\.(?:body|query|params)|request\.(?:body|query|params)|url|uri|endpoint|target|destination|webhook/i.test(expression)) return true
  }
  return false
}

const extractExternalCommunications = (texts, sensitiveConfiguration) => {
  const providers = new Map()

  for (const [file, source] of texts) {
    if (!/\.[cm]?[jt]sx?$|\.json$|\.ya?ml$|\.env\.(?:example|sample|template)$/.test(file)) continue
    for (const rule of providerRules) {
      if (!rule.regex.test(source)) continue
      const entry = providers.get(rule.provider) ?? {
        provider: rule.provider,
        evidence: [],
        environmentVariables: [],
        staticHosts: [],
        controls: [],
        userControlledDestinationCandidate: false,
      }
      const line = lineNumberAt(source, source.search(rule.regex))
      entry.evidence.push({ source: file, line })
      entry.staticHosts.push(...extractStaticHosts(source))
      entry.controls.push(...getControls(source))
      if (rule.provider === 'generic-http' && hasUserControlledHttpDestination(source)) {
        entry.userControlledDestinationCandidate = true
      }
      providers.set(rule.provider, entry)
    }
  }

  for (const variable of sensitiveConfiguration.variables) {
    const matchingProviders = []
    if (/MONGO|DATABASE|\bDB_/.test(variable.name)) matchingProviders.push('mongodb')
    if (/GOOGLE/.test(variable.name)) matchingProviders.push('google-oauth')
    if (/GITHUB/.test(variable.name)) matchingProviders.push('github-oauth')
    if (/DISCORD/.test(variable.name)) matchingProviders.push('discord-oauth')
    if (/CLOUDINARY/.test(variable.name)) matchingProviders.push('cloudinary')
    if (/MAIL|SMTP|EMAIL/.test(variable.name)) matchingProviders.push('email')
    if (/VAPID|WEB_PUSH/.test(variable.name)) matchingProviders.push('web-push')
    if (/TURN|STUN|ICE/.test(variable.name)) matchingProviders.push('stun-turn')
    for (const provider of matchingProviders) {
      const entry = providers.get(provider) ?? {
        provider,
        evidence: [],
        environmentVariables: [],
        staticHosts: [],
        controls: [],
        userControlledDestinationCandidate: false,
      }
      entry.environmentVariables.push(variable.name)
      providers.set(provider, entry)
    }
  }

  return [...providers.values()].map((entry) => ({
    ...entry,
    evidence: [...new Map(entry.evidence.map((item) => [`${item.source}:${item.line}`, item])).values()]
      .sort((a, b) => `${a.source}:${a.line}`.localeCompare(`${b.source}:${b.line}`)),
    environmentVariables: sortStrings(entry.environmentVariables),
    staticHosts: sortStrings(entry.staticHosts),
    controls: sortStrings(entry.controls),
    reviewFields: {
      credentialSource: 'environmentVariables and provider configuration evidence above',
      protocolsAndDestinations: 'staticHosts plus runtime/provider configuration',
      timeoutRedirectSizeRetryLogging: 'controls are static signals; validate effective runtime behavior in later phases',
    },
  })).sort((a, b) => a.provider.localeCompare(b.provider))
}

const buildComponents = (fileRecords) => {
  const categories = {}
  for (const record of fileRecords) {
    for (const category of record.categories) {
      categories[category] ??= []
      categories[category].push(record.path)
    }
  }
  for (const category of Object.keys(categories)) categories[category] = sortStrings(categories[category])

  return {
    trackedFileCount: fileRecords.length,
    totalTrackedBytes: fileRecords.reduce((total, record) => total + record.bytes, 0),
    categories: Object.fromEntries(Object.entries(categories).sort(([a], [b]) => a.localeCompare(b))),
    files: fileRecords,
  }
}

export const buildInventory = async (rootDirectory = process.cwd()) => {
  const root = path.resolve(rootDirectory)
  const { files, source } = await listRepositoryFiles(root)
  const { records, texts } = await buildFileRecords(root, files)
  const knownFiles = new Set(records.map((record) => record.path))
  const reproducibility = buildReproducibility(records, texts)
  const { routes, mounts } = extractHttpRoutes(texts, knownFiles)
  const sensitiveConfiguration = extractEnvironmentConfiguration(texts)

  return {
    schemaVersion: 1,
    scope: {
      repositoryRoot: '.',
      sourceSelection: source,
      excludedPaths: [...GENERATED_PATHS].sort(),
      generatedOutputsExcludedFromSelfInventory: [...GENERATED_PATHS].sort(),
      excludedContentDirectories: sortStrings([
        ...IGNORED_DIRECTORIES,
        ...NON_RUNTIME_SOURCE_PREFIXES.map((prefix) => prefix.replace(/\/$/, '')),
      ]),
      dependencyLockfilesExcludedFromContentParsing: true,
      contentParsingPolicy: 'All Git-tracked files are hashed; only runtime, workflow, package, environment-template, script, and deployment source is parsed.',
      maximumScannedTextFileBytes: MAX_TEXT_BYTES,
    },
    reproducibility,
    components: buildComponents(records),
    entryPoints: {
      httpRoutes: routes,
      routerMounts: mounts,
      socketEvents: extractSocketEvents(texts),
      socketNamespaces: texts.has('Backend/Chatify/Config/socket.mjs') ? ['/'] : [],
      serviceWorkerEvents: extractServiceWorkerEvents(texts),
      backgroundJobs: extractBackgroundJobs(texts),
      packageScripts: reproducibility.packages.flatMap((pkg) => Object.entries(pkg.scripts).map(([name, implementation]) => ({
        cwd: pkg.cwd,
        name,
        implementation,
      }))).sort((a, b) => `${a.cwd}:${a.name}`.localeCompare(`${b.cwd}:${b.name}`)),
    },
    dataModels: extractDataModels(texts, knownFiles),
    externalCommunications: extractExternalCommunications(texts, sensitiveConfiguration),
    sensitiveConfiguration,
    phase1ExitGate: {
      cleanReproductionEvidence: 'GitHub Actions artifact: phase-1-reproduction-evidence',
      componentInventoryGenerated: true,
      entryPointInventoryGenerated: true,
      dataModelInventoryGenerated: true,
      externalCommunicationInventoryGenerated: true,
      sensitiveConfigurationMapGenerated: true,
    },
    limitations: [
      'Static discovery does not execute application code; unresolved Socket.IO expressions are retained while runtime-computed route registrations require later review.',
      'All Git-tracked files are hashed, while dependency lockfiles, vendored, generated, artifact, build, report, and documentation content is deliberately not parsed as runtime source.',
      'Client input, response fields, outbound controls, deletion behavior, and some model metadata are heuristic candidates that require later source-to-sink validation.',
      'Runtime-only destinations, injected provider configuration, infrastructure settings, and secret values are outside committed inventory and belong in controlled evidence.',
    ],
  }
}

const renderTable = (headers, rows) => {
  if (rows.length === 0) return '_None discovered._\n'
  return [
    `| ${headers.map(markdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`),
    '',
  ].join('\n')
}

export const renderInventoryMarkdown = (inventory) => {
  const componentRows = Object.entries(inventory.components.categories).map(([category, files]) => [category, files.length])
  const packageRows = inventory.reproducibility.packages.map((pkg) => [
    pkg.cwd,
    pkg.name ?? '',
    pkg.version ?? '',
    pkg.lockfile?.path ?? 'none',
    Object.keys(pkg.scripts).join(', '),
  ])
  const routeRows = inventory.entryPoints.httpRoutes.map((route) => [
    route.method,
    route.fullPath,
    `${route.source}:${route.line}`,
    [...route.mountMiddlewareTokens, ...route.middlewareAndHandlerTokens].join(', '),
  ])
  const socketRows = inventory.entryPoints.socketEvents.map((event) => [
    event.event,
    event.direction,
    `${event.source}:${event.line}`,
  ])
  const modelRows = inventory.dataModels.map((model) => [
    model.modelNames.join(', ') || path.posix.basename(model.source),
    `${model.source}`,
    model.fields.length,
    model.sensitiveFields.join(', '),
    model.ownershipFields.join(', '),
    model.roleFields.join(', '),
    model.references.join(', '),
    model.indexes.length,
  ])
  const externalRows = inventory.externalCommunications.map((provider) => [
    provider.provider,
    provider.environmentVariables.join(', '),
    provider.staticHosts.join(', '),
    provider.controls.join(', '),
    provider.userControlledDestinationCandidate ? 'yes' : 'no',
    provider.evidence.map((entry) => `${entry.source}:${entry.line}`).join(', '),
  ])
  const configRows = inventory.sensitiveConfiguration.variables.map((variable) => [
    variable.name,
    variable.category,
    variable.sensitive ? 'yes' : 'no',
    variable.exampleValue ?? 'missing',
    variable.definedInExamples.map((entry) => `${entry.source}:${entry.line}`).join(', '),
    variable.referencedAt.map((entry) => `${entry.source}:${entry.line}`).join(', '),
  ])

  return `# Chatify Security Audit — Phase 1 Repository Inventory

This document is generated deterministically from tracked repository files. Run \`npm run security:phase1:generate\` after changing audited surfaces and \`npm run security:phase1:check\` to detect drift.

## Method and boundaries

- Source selection: \`${inventory.scope.sourceSelection}\`.
- Tracked files inventoried: **${inventory.components.trackedFileCount}**.
- Tracked bytes inventoried: **${inventory.components.totalTrackedBytes}**.
- Generated inventory files are excluded from their own input set.
- Secret-like example values are redacted; live environment values are never read.
- Runtime execution evidence is stored in the \`${inventory.phase1ExitGate.cleanReproductionEvidence}\` artifact rather than committed.

## Reproducibility baseline

${renderTable(['Working directory', 'Package', 'Version', 'Lockfile', 'Scripts'], packageRows)}
### Clean install commands

${renderTable(['Working directory', 'Command', 'Lockfile'], inventory.reproducibility.cleanInstallCommands.map((entry) => [entry.cwd, entry.command, entry.lockfile]))}
### Validation commands discovered

${renderTable(['Working directory', 'Script', 'Invocation', 'Implementation'], inventory.reproducibility.validationCommands.map((entry) => [entry.cwd, entry.script, entry.command, entry.implementation]))}
## Component inventory

${renderTable(['Category', 'Tracked files'], componentRows)}
Detailed paths and SHA-256 hashes are in \`inventory.json\`.

## HTTP entry points

${renderTable(['Method', 'Resolved path', 'Source', 'Middleware/handler tokens'], routeRows)}
### Router mounts

${renderTable(['Prefix', 'Target', 'Source', 'Mount middleware'], inventory.entryPoints.routerMounts.map((mount) => [mount.prefix, mount.targetFile ?? mount.targetIdentifier ?? 'dynamic', `${mount.source}:${mount.line}`, mount.middlewareTokens.join(', ')]))}
## Socket.IO entry points

Dynamic constants are retained as \`<dynamic:EXPRESSION>\` and must be resolved during protocol review.

${renderTable(['Event', 'Direction', 'Source'], socketRows)}
## Service worker and background entry points

${renderTable(['Event', 'Source'], inventory.entryPoints.serviceWorkerEvents.map((entry) => [entry.event, `${entry.source}:${entry.line}`]))}
${renderTable(['Job kind', 'Source'], inventory.entryPoints.backgroundJobs.map((entry) => [entry.kind, `${entry.source}:${entry.line}`]))}
## Data models

${renderTable(['Model', 'Source', 'Fields', 'Sensitive candidates', 'Ownership candidates', 'Role candidates', 'References', 'Indexes'], modelRows)}
The JSON inventory additionally records field definitions, unique/TTL candidates, consumer files, request-body candidates, response-field candidates, hashing/encryption signals, and deletion operations.

## External communications

${renderTable(['Provider', 'Environment variables', 'Static hosts', 'Control signals', 'User-controlled destination candidate', 'Evidence'], externalRows)}
## Sensitive configuration map

${renderTable(['Variable', 'Category', 'Sensitive', 'Example value', 'Example definition', 'Usage'], configRows)}
### Configuration drift candidates

- Referenced but absent from committed examples: ${inventory.sensitiveConfiguration.missingFromExamples.length ? inventory.sensitiveConfiguration.missingFromExamples.map((name) => `\`${name}\``).join(', ') : 'none'}.
- Defined in examples but not statically referenced: ${inventory.sensitiveConfiguration.unusedExamples.length ? inventory.sensitiveConfiguration.unusedExamples.map((name) => `\`${name}\``).join(', ') : 'none'}.

## Phase 1 exit-gate evidence

${renderTable(['Gate', 'Evidence/status'], Object.entries(inventory.phase1ExitGate).map(([gate, status]) => [gate, status]))}
## Static-analysis limitations

${inventory.limitations.map((item) => `- ${item}`).join('\n')}
`
}

const renderGeneratedFiles = (inventory) => ({
  [`${OUTPUT_DIRECTORY}/inventory.json`]: `${JSON.stringify(inventory, null, 2)}\n`,
  [`${OUTPUT_DIRECTORY}/inventory.md`]: renderInventoryMarkdown(inventory),
})

export const writeGeneratedInventory = async (rootDirectory, inventory) => {
  const root = path.resolve(rootDirectory)
  const files = renderGeneratedFiles(inventory)
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  return { files: Object.keys(files).sort() }
}

export const checkGeneratedInventory = async (rootDirectory, inventory) => {
  const root = path.resolve(rootDirectory)
  const files = renderGeneratedFiles(inventory)
  for (const [relativePath, expected] of Object.entries(files)) {
    const target = path.join(root, relativePath)
    if (!await pathExists(target)) return false
    if (await readFile(target, 'utf8') !== expected) return false
  }
  return true
}

export const getGeneratedInventoryPaths = () => [...GENERATED_PATHS].sort()
