import { Strategy as OAuth2Strategy } from 'passport-oauth2'

export const DISCORD_AUTHORIZATION_URL = 'https://discord.com/oauth2/authorize'
export const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token'
export const DISCORD_PROFILE_URL = 'https://discord.com/api/users/@me'

const parseDiscordProfile = (body) => {
  let payload
  try {
    payload = JSON.parse(body)
  } catch (error) {
    throw new Error('Failed to parse Discord user profile', { cause: error })
  }

  if (!payload || typeof payload !== 'object' || !payload.id || !payload.username) {
    throw new Error('Discord user profile is missing required identity fields')
  }

  return {
    provider: 'discord',
    id: String(payload.id),
    username: String(payload.username),
    global_name: typeof payload.global_name === 'string' ? payload.global_name : null,
    email: typeof payload.email === 'string' ? payload.email : null,
    verified: payload.verified === true,
    avatar: typeof payload.avatar === 'string' ? payload.avatar : null,
    discriminator: typeof payload.discriminator === 'string' ? payload.discriminator : null,
    _raw: body,
    _json: payload,
  }
}

export class DiscordStrategy extends OAuth2Strategy {
  constructor(options, verify) {
    const strategyOptions = {
      ...options,
      authorizationURL: DISCORD_AUTHORIZATION_URL,
      tokenURL: DISCORD_TOKEN_URL,
      scopeSeparator: ' ',
    }
    super(strategyOptions, verify)
    this.name = 'discord'
    this._profileURL = options.profileURL || DISCORD_PROFILE_URL
    this._oauth2.useAuthorizationHeaderforGET(true)
  }

  userProfile(accessToken, done) {
    this._oauth2.get(this._profileURL, accessToken, (error, body, response) => {
      if (error) return done(error)

      const statusCode = Number(response?.statusCode ?? 200)
      if (statusCode < 200 || statusCode >= 300) {
        return done(new Error(`Discord user profile request failed with status ${statusCode}`))
      }

      try {
        return done(null, parseDiscordProfile(body))
      } catch (profileError) {
        return done(profileError)
      }
    })
  }
}

export default DiscordStrategy
