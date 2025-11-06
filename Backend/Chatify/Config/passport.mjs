import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import {Strategy as DiscordStrategy} from 'passport-discord'
import User from '../Models/userModel.mjs';

// Helper function to create or find OAuth user
const handleOAuthUser = async (profile, provider) => {
    try {

        const providerEmail = profile.email;
        const providerId = profile.id;
        const providerIdField = `${provider}Id`;
        
        // Extract user info based on provider
        let userInfo = {};
        
        switch (provider) {
            case 'google':
                userInfo = {
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName === undefined ? '' : profile.name.familyName,
                    email: profile.emails[0].value,
                    profilePic: profile.photos[0]?.value || ''
                };
                break;
            case 'github':
                const fullName = profile.displayName || profile.username || '';
                const nameParts = fullName.split(' ');
                userInfo = {
                    firstName: nameParts[0] || profile.username,
                    lastName: nameParts.slice(1).join(' ') || 'User',
                    email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
                    profilePic: profile.photos[0]?.value || ''
                };
                break;
            case 'discord':
              const avatarUrl = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null;
                userInfo = {
                    firstName: profile.username || profile.global_name,
                    lastName: '',
                    email: providerEmail,
                    profilePic: avatarUrl || ''
                };
                break;
        }

        // Check if user exists with same email (account linking)
        const existingEmailUser = await User.findOne({ 
            email: userInfo.email,
        });

        if (existingEmailUser) {
            // Link provider account to existing local account
            existingEmailUser.authProvider = provider;
            existingEmailUser.isVerified = true;
            existingEmailUser.profilePic = userInfo.profilePic
            existingEmailUser[providerIdField] = providerId;
            
            // Update profile pic if user doesn't have one
            if (!existingEmailUser.profilePic && userInfo.profilePic) {
                existingEmailUser.profilePic = userInfo.profilePic;
            }
            
            await existingEmailUser.save();
            return existingEmailUser;
        }

        // Create new user
        const newUser = await User.create({
            [providerIdField]: providerId,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            email: userInfo.email,
            profilePic: userInfo.profilePic,
            authProvider: provider,
            isVerified: true
        });

        return newUser;
    } catch (error) {
        console.error(`${provider} OAuth Error:`, error);
        throw error;
    }
};

// Google OAuth Strategy
const isProd = process.env.NODE_ENV === 'production';
const baseURL = isProd 
  ? 'https://chatify-ckmn.onrender.com' 
  : 'http://localhost:3000';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${baseURL}/api/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  // console.log("passport 100 line\n", profile);
  
    try {
        const user = await handleOAuthUser(profile, 'google');
        return done(null, user);
    } catch (error) {
      console.log(error);
      
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