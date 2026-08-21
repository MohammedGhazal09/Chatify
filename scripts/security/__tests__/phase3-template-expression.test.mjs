import assert from 'node:assert/strict'
import test from 'node:test'

import { scanTextForSecrets } from '../lib/secret-detectors.mjs'

test('generic detector ignores nonliteral template expressions used to build test secrets', () => {
  const interpolation = '${strongSecret(11)}'
  const source = [
    'const config = { SECRET_JWT_KEY: `jwt-',
    interpolation,
    '` }',
  ].join('')

  assert.deepEqual(scanTextForSecrets({
    text: source,
    filePath: 'Backend/Chatify/test/security/secret-configuration.test.mjs',
    scope: 'current-tree',
  }), [])
})
