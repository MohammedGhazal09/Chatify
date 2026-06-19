import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import {Strategy as DiscordStrategy} from 'passport-discord'
import User from '../Models/userModel.mjs';
import { resolveOAuthCallbackBaseURL } from '../Utils/oauthConfig.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const getFirstEmailValue = (profile) => (
    Array.isArray(profile.emails)
        ? profile.emails.find((email) => typeof email?.value === 'string' && email.value)?.value
        : null
);

const getVerifiedEmailEntry = (profile) => {
    if (!Array.isArray(profile.emails)) {
        return null;
    }

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

        return {
            email: verifiedEmail?.value ?? getFirstEmailValue(profile),
            verified: Boolean(verifiedEmail),
        };
    }

    if (provider === 'discord') {
        return {
            email: profile.email,
            verified: profile?.verified === true || profile?._json?.verified === true,
        };
    }

    return {
        email: null,
        verified: false,
    };
};

// Helper function to create or find OAuth user
export const handleOAuthUser = async (profile, provider) => {
    try {

        const providerId = profile.id;
        const providerIdField = `${provider}Id`;
        const providerEmail = getProviderEmailInfo(profile, provider);

        if (!providerId || !providerEmail.email) {
            throw new Error('OAuth provider profile is missing required identity fields');
        }
        
        // Extract user info based on provider
        let userInfo = {};
        
        switch (provider) {
            case 'google':
                userInfo = {
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName === undefined ? '' : profile.name.familyName,
                    email: providerEmail.email,
                    emailVerified: providerEmail.verified,
                    providerProfilePic: profile.photos[0]?.value || ''
                };
                break;
            case 'github':
                const fullName = profile.displayName || profile.username || '';
                const nameParts = fullName.split(' ');
                userInfo = {
                    firstName: nameParts[0] || profile.username,
                    lastName: nameParts.slice(1).join(' ') || 'User',
                    email: providerEmail.email,
                    emailVerified: providerEmail.verified,
                    providerProfilePic: profile.photos[0]?.value || ''
                };
                break;
            case 'discord':
              const avatarUrl = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null;
                userInfo = {
                    firstName: profile.username || profile.global_name,
                    lastName: '',
                    email: providerEmail.email,
                    emailVerified: providerEmail.verified,
                    providerProfilePic: avatarUrl || ''
                };
                break;
        }

        const existingProviderUser = await User.findOne({
            [providerIdField]: providerId,
            authProvider: provider,
        }).select('+providerProfilePic +uploadedProfileImage');

        if (existingProviderUser) {
            existingProviderUser.providerProfilePic = userInfo.providerProfilePic

            if (!existingProviderUser.hasUploadedProfileImage()) {
                existingProviderUser.profilePic = userInfo.providerProfilePic || '';
            }

            await existingProviderUser.save();
            return existingProviderUser;
        }

        const existingEmailUser = await User.findOne({ 
            email: userInfo.email,
        }).select('+providerProfilePic +uploadedProfileImage');

        if (existingEmailUser) {
            throw new Error('OAuth account linking requires existing user confirmation');
        }

        // Create new user
        const newUser = await User.create({
            [providerIdField]: providerId,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            email: userInfo.email,
            profilePic: userInfo.providerProfilePic,
            providerProfilePic: userInfo.providerProfilePic,
            authProvider: provider,
            isVerified: userInfo.emailVerified
        });

        return newUser;
    } catch (error) {
        logger.error('oauth.user_handling_failed', {
            provider,
            error,
        });
        throw error;
    }
};

// Google OAuth Strategy
const baseURL = resolveOAuthCallbackBaseURL();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${baseURL}/api/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await handleOAuthUser(profile, 'google');
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// GitHub OAuth Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${baseURL}/api/auth/github/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await handleOAuthUser(profile, 'github');
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: `${baseURL}/api/auth/discord/callback`,
    scope: ['identify', 'email'],
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await handleOAuthUser(profile, 'discord');
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}))

export default passport;
