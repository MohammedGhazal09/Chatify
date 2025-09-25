import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import User from '../Models/userModel.mjs';

// Helper function to create or find OAuth user
const handleOAuthUser = async (profile, provider) => {
    try {
        const providerEmail = profile.email;
        const providerEmailField = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        const providerId = profile.id;
        const providerIdField = `${provider}Id`;
        // Check if user already exists with this provider email
        let existingUser = await User.findOne({ 
            [providerEmailField]: providerEmail,
            authProvider: provider 
        });
        
        if (existingUser) {
            return existingUser;
        }

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
            case 'linkedin':
                userInfo = {
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName,
                    email: profile.emails[0].value,
                    profilePic: profile.photos[0]?.value || ''
                };
                break;
        }

        // Check if user exists with same email (account linking)
        const existingEmailUser = await User.findOne({ 
            email: userInfo.email,
            authProvider: 'local'
        });

        if (existingEmailUser) {
            // Link provider account to existing local account
            existingEmailUser.authProvider = provider;
            existingEmailUser.isVerified = true;
            
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
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/auth/google/callback"
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
    callbackURL: "http://localhost:3000/api/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
  writeFileSync("profile.json", JSON.stringify(profile, null, 2));
    try {
        const user = await handleOAuthUser(profile, 'github');
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// LinkedIn OAuth Strategy
passport.use(new LinkedInStrategy({
    clientID: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/auth/linkedin/callback",
    scope: ['r_emailaddress', 'r_liteprofile']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await handleOAuthUser(profile, 'linkedin');
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

export default passport;