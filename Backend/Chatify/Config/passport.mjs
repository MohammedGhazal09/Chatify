import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import DiscordStrategy from './discordOAuthStrategy.mjs';
import User from '../Models/userModel.mjs';
import { normalizeEmail } from '../Utils/authIdentity.mjs';
import { resolveOAuthCallbackBaseURL } from '../Utils/oauthConfig.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const getFirstEmailValue = (profile) => Array.isArray(profile.emails)
  ? profile.emails.find((email) => typeof email?.value === 'string' && email.value)?.value
  : null;

const getVerifiedEmailEntry = (profile) => {
  if (!Array.isArray(profile.emails)) return null;
  return profile.emails.find((email) => email?.verified === true && email?.primary === true)
    ?? profile.emails.find((email) => email?.verified === true)
    ?? null;
};

const getProviderEmailInfo = (profile, provider) => {
  if (provider === 'google') {
    return {
      email: getFirstEmailValue(profile),
      verified: profile?._json?.email_verified === true || profile.emails?.[0]?.verified === true,
    };
  }
  if (provider === 'github') {
    const verifiedEmail = getVerifiedEmailEntry(profile);
    return { email: verifiedEmail?.value ?? getFirstEmailValue(profile), verified: Boolean(verifiedEmail) };
  }
  if (provider === 'discord') {
    return {
      email: profile.email,
      verified: profile?.verified === true || profile?._json?.verified === true,
    };
  }
  return { email: null, verified: false };
};

export const handleOAuthUser = async (profile, provider) => {
  try {
    const providerId = profile.id;
    const providerIdField = `${provider}Id`;
    const providerEmail = getProviderEmailInfo(profile, provider);
    const email = normalizeEmail(providerEmail.email);

    if (!providerId || !email) throw new Error('OAuth provider profile is missing required identity fields');
    if (providerEmail.verified !== true) throw new Error('OAuth provider did not supply a verified email');

    let userInfo;
    switch (provider) {
      case 'google':
        userInfo = {
          firstName: profile.name?.givenName || 'OAuth',
          lastName: profile.name?.familyName || '',
          email,
          providerProfilePic: profile.photos?.[0]?.value || '',
        };
        break;
      case 'github': {
        const fullName = profile.displayName || profile.username || '';
        const nameParts = fullName.split(' ');
        userInfo = {
          firstName: nameParts[0] || profile.username || 'OAuth',
          lastName: nameParts.slice(1).join(' ') || 'User',
          email,
          providerProfilePic: profile.photos?.[0]?.value || '',
        };
        break;
      }
      case 'discord': {
        const avatarUrl = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : '';
        userInfo = {
          firstName: profile.username || profile.global_name || 'OAuth',
          lastName: '',
          email,
          providerProfilePic: avatarUrl,
        };
        break;
      }
      default:
        throw new Error('Unsupported OAuth provider');
    }

    const existingProviderUser = await User.findOne({
      [providerIdField]: providerId,
      authProvider: provider,
    }).select('+providerProfilePic +uploadedProfileImage');

    if (existingProviderUser) {
      existingProviderUser.providerProfilePic = userInfo.providerProfilePic;
      if (!existingProviderUser.hasUploadedProfileImage()) existingProviderUser.profilePic = userInfo.providerProfilePic || '';
      await existingProviderUser.save();
      return existingProviderUser;
    }

    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) throw new Error('OAuth account linking requires existing user confirmation');

    return User.create({
      [providerIdField]: providerId,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      email,
      profilePic: userInfo.providerProfilePic,
      providerProfilePic: userInfo.providerProfilePic,
      authProvider: provider,
      isVerified: true,
    });
  } catch (error) {
    logger.error('oauth.user_handling_failed', { provider, error });
    throw error;
  }
};

const baseURL = resolveOAuthCallbackBaseURL();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${baseURL}/api/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try { return done(null, await handleOAuthUser(profile, 'google')); }
  catch (error) { return done(error, null); }
}));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: `${baseURL}/api/auth/github/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try { return done(null, await handleOAuthUser(profile, 'github')); }
  catch (error) { return done(error, null); }
}));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: `${baseURL}/api/auth/discord/callback`,
  scope: ['identify', 'email'],
}, async (accessToken, refreshToken, profile, done) => {
  try { return done(null, await handleOAuthUser(profile, 'discord')); }
  catch (error) { return done(error, null); }
}));

export default passport;
