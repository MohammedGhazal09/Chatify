import passport from 'passport'
import {Strategy as GoogleStrategy} from 'passport-google-oauth20'
import User from '../Models/userModel.mjs'

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let existingUser = await User.findOne({googleId: profile.id, authProvider: 'google'})
    if (existingUser) {
      return done(null, existingUser)
    }

    const newUser = await User.create({
      googleId: profile.id,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      email: profile.emails[0].value,
      profilePic: profile.photos[0].value || '',
      authProvider: 'google',
      isVerified: true,
    })
    return done(null, newUser)
  } catch (err) {
    return done(err, null)
  }
}
))

export default passport