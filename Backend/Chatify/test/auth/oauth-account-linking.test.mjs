import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import { handleOAuthUser } from '../../Config/passport.mjs';
import { createUser } from '../fixtures/users.mjs';

const buildGoogleProfile = ({ id = 'google-profile-id', email, verified = true } = {}) => ({
  id,
  name: {
    givenName: 'OAuth',
    familyName: 'User',
  },
  emails: [
    {
      value: email,
      verified,
    },
  ],
  photos: [
    {
      value: 'https://cdn.example.test/avatar.png',
    },
  ],
  _json: {
    email_verified: verified,
  },
});

describe('OAuth account linking boundaries', () => {
  it('does not attach a provider to an existing local account by email alone', async () => {
    const localUser = await createUser({ firstName: 'Local', lastName: 'Owner' });
    const profile = buildGoogleProfile({
      id: 'attacker-google-id',
      email: localUser.email,
    });

    await expect(handleOAuthUser(profile, 'google')).rejects.toThrow(/linking requires/i);

    const unchangedUser = await User.findById(localUser._id).select('+providerProfilePic');
    expect(unchangedUser.authProvider).toBe('local');
    expect(unchangedUser.googleId).toBeUndefined();
    expect(unchangedUser.providerProfilePic).toBeUndefined();
  });

  it('allows an already linked provider account to continue by provider id', async () => {
    const oauthUser = await User.create({
      firstName: 'Existing',
      lastName: 'Provider',
      email: 'existing-provider@example.test',
      authProvider: 'google',
      googleId: 'existing-google-id',
      isVerified: true,
      profilePic: '',
    });
    const profile = buildGoogleProfile({
      id: 'existing-google-id',
      email: oauthUser.email,
    });

    const result = await handleOAuthUser(profile, 'google');

    expect(result._id.toString()).toBe(oauthUser._id.toString());
    expect(await User.countDocuments({ email: oauthUser.email })).toBe(1);
  });
});
