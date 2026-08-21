import assert from 'node:assert/strict'
import { test } from 'vitest'

import {
  DISCORD_AUTHORIZATION_URL,
  DISCORD_PROFILE_URL,
  DISCORD_TOKEN_URL,
  DiscordStrategy,
} from '../../Config/discordOAuthStrategy.mjs'

const createStrategy = () => new DiscordStrategy({
  clientID: 'discord-client-id',
  clientSecret: 'fixture-client-secret',
  callbackURL: 'https://chatify.example.test/api/auth/discord/callback',
  scope: ['identify', 'email'],
}, () => {})

const readProfile = (strategy, accessToken = 'fixture-access-token') => new Promise((resolve, reject) => {
  strategy.userProfile(accessToken, (error, profile) => {
    if (error) reject(error)
    else resolve(profile)
  })
})

test('configures Discord OAuth endpoints and a space-separated scope contract', () => {
  const strategy = createStrategy()

  assert.equal(strategy.name, 'discord')
  assert.equal(strategy._oauth2._authorizeUrl, DISCORD_AUTHORIZATION_URL)
  assert.equal(strategy._oauth2._accessTokenUrl, DISCORD_TOKEN_URL)
  assert.equal(strategy._profileURL, DISCORD_PROFILE_URL)
  assert.equal(strategy._scopeSeparator, ' ')
  assert.equal(strategy._oauth2._useAuthorizationHeaderForGET, true)
})

test('loads and normalizes the Discord current-user profile', async () => {
  const strategy = createStrategy()
  let request = null
  strategy._oauth2.get = (url, accessToken, callback) => {
    request = { url, accessToken }
    callback(null, JSON.stringify({
      id: '123456789012345678',
      username: 'chatify-user',
      global_name: 'Chatify User',
      email: 'chatify-user@example.test',
      verified: true,
      avatar: 'avatar-hash',
      discriminator: '0',
    }), { statusCode: 200 })
  }

  const profile = await readProfile(strategy)

  assert.deepEqual(request, {
    url: DISCORD_PROFILE_URL,
    accessToken: 'fixture-access-token',
  })
  assert.deepEqual(profile, {
    provider: 'discord',
    id: '123456789012345678',
    username: 'chatify-user',
    global_name: 'Chatify User',
    email: 'chatify-user@example.test',
    verified: true,
    avatar: 'avatar-hash',
    discriminator: '0',
    _raw: JSON.stringify({
      id: '123456789012345678',
      username: 'chatify-user',
      global_name: 'Chatify User',
      email: 'chatify-user@example.test',
      verified: true,
      avatar: 'avatar-hash',
      discriminator: '0',
    }),
    _json: {
      id: '123456789012345678',
      username: 'chatify-user',
      global_name: 'Chatify User',
      email: 'chatify-user@example.test',
      verified: true,
      avatar: 'avatar-hash',
      discriminator: '0',
    },
  })
})

test('preserves provider errors without exposing access tokens', async () => {
  const strategy = createStrategy()
  const providerError = new Error('Discord profile request failed')
  strategy._oauth2.get = (_url, _accessToken, callback) => callback(providerError)

  await assert.rejects(readProfile(strategy, 'sensitive-token'), (error) => {
    assert.equal(error, providerError)
    assert.equal(error.message.includes('sensitive-token'), false)
    return true
  })
})


test('rejects non-success Discord profile responses without echoing the response body', async () => {
  const strategy = createStrategy()
  strategy._oauth2.get = (_url, _accessToken, callback) => callback(
    null,
    JSON.stringify({ message: 'provider-private-error-detail' }),
    { statusCode: 401 }
  )

  await assert.rejects(readProfile(strategy), (error) => {
    assert.match(error.message, /status 401/i)
    assert.equal(error.message.includes('provider-private-error-detail'), false)
    return true
  })
})

test('rejects malformed and identity-incomplete Discord profiles', async () => {
  const malformed = createStrategy()
  malformed._oauth2.get = (_url, _accessToken, callback) => callback(null, '{not-json')
  await assert.rejects(readProfile(malformed), /parse Discord user profile/i)

  const incomplete = createStrategy()
  incomplete._oauth2.get = (_url, _accessToken, callback) => callback(null, JSON.stringify({ id: '123' }))
  await assert.rejects(readProfile(incomplete), /missing required identity fields/i)
})
