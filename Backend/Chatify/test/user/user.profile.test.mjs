import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

const updateProfile = (agent, csrfToken, payload) => agent
  .patch('/api/user/profile')
  .set('X-CSRF-Token', csrfToken)
  .send(payload);

const updatePrivacy = (agent, csrfToken, payload) => agent
  .patch('/api/user/privacy-settings')
  .set('X-CSRF-Token', csrfToken)
  .send(payload);

const expectNoPublicEmailFields = (payload) => {
  expect(JSON.stringify(payload)).not.toMatch(/"email"/i);
};

const expectNoPrivateStatus = (payload) => {
  expect(JSON.stringify(payload)).not.toContain('Deep work only');
};

const setupProfileUser = async (overrides = {}) => {
  const signedUp = await signupWithAgent(overrides);
  const csrfToken = await getCsrfForAgent(signedUp.agent);
  return { ...signedUp, csrfToken };
};

describe('user profile and presence privacy', () => {
  it('persists bounded profile bio and status text for the current user', async () => {
    const owner = await setupProfileUser({
      firstName: 'Profile',
      lastName: 'Owner',
    });

    const response = await updateProfile(owner.agent, owner.csrfToken, {
      profileBio: '  Building reliable chat tools.  ',
      profileStatus: '  Available for focused work  ',
    }).expect(200);
    const storedUser = await User.findById(owner.user._id).lean();

    expect(response.body.data.user).toMatchObject({
      profileBio: 'Building reliable chat tools.',
      profileStatus: 'Available for focused work',
    });
    expect(storedUser.profileBio).toBe('Building reliable chat tools.');
    expect(storedUser.profileStatus).toBe('Available for focused work');
  });

  it('rejects unsafe profile text before persistence', async () => {
    const owner = await setupProfileUser({
      firstName: 'Profile',
      lastName: 'Invalid',
    });

    const invalidCases = [
      { profileBio: 'https://example.test/me' },
      { profileStatus: 'www.example.test' },
      { profileBio: 'a'.repeat(161) },
      { profileStatus: 'b'.repeat(81) },
      { profileBio: 'Hello <script>' },
    ];

    for (const payload of invalidCases) {
      const response = await updateProfile(owner.agent, owner.csrfToken, payload).expect(400);

      expect(response.body).toMatchObject({
        status: 'fail',
      });
    }

    const storedUser = await User.findById(owner.user._id).lean();
    expect(storedUser.profileBio).toBe('');
    expect(storedUser.profileStatus).toBe('');
  });

  it('serializes public profile fields without exposing private email or hidden status text', async () => {
    const owner = await setupProfileUser({
      firstName: 'Profile',
      lastName: 'Visible',
    });
    const viewer = await setupProfileUser({
      firstName: 'Profile',
      lastName: 'Viewer',
    });

    await createDirectChat([owner.user, viewer.user]);
    await updateProfile(owner.agent, owner.csrfToken, {
      profileBio: 'Public profile bio',
      profileStatus: 'Deep work only',
    }).expect(200);
    await updatePrivacy(owner.agent, owner.csrfToken, {
      showProfileStatus: false,
    }).expect(200);

    const allUsers = await viewer.agent
      .get('/api/user/get-all-users')
      .expect(200);
    const onlineStatus = await viewer.agent
      .get(`/api/user/online-status/${owner.user._id}`)
      .expect(200);
    const onlineUsers = await viewer.agent
      .get('/api/user/online-users')
      .expect(200);
    const lookup = await viewer.agent
      .get(`/api/user/lookup/${owner.user.username}`)
      .expect(200);
    const chats = await viewer.agent
      .get('/api/chat/get-all-chats')
      .expect(200);

    const ownerFromAllUsers = allUsers.body.users.find((candidate) => candidate._id === owner.user._id.toString());
    const ownerFromContacts = onlineUsers.body.data.allContacts.find((candidate) => candidate._id === owner.user._id.toString());
    const ownerFromChat = chats.body.data.chats[0].members.find((candidate) => candidate._id === owner.user._id.toString());

    expect(ownerFromAllUsers).toMatchObject({
      profileBio: 'Public profile bio',
      profileStatus: '',
    });
    expect(ownerFromContacts).toMatchObject({
      profileBio: 'Public profile bio',
      profileStatus: '',
    });
    expect(onlineStatus.body.data).toMatchObject({
      profileBio: 'Public profile bio',
      profileStatus: '',
    });
    expect(lookup.body.data.user).toMatchObject({
      profileBio: 'Public profile bio',
      profileStatus: '',
    });
    expect(ownerFromChat).toMatchObject({
      profileBio: 'Public profile bio',
    });
    expect(JSON.stringify(ownerFromChat)).not.toContain('profileStatus');

    expectNoPublicEmailFields(allUsers.body);
    expectNoPublicEmailFields(onlineStatus.body);
    expectNoPublicEmailFields(onlineUsers.body);
    expectNoPublicEmailFields(lookup.body);
    expectNoPublicEmailFields(chats.body);
    expectNoPrivateStatus(allUsers.body);
    expectNoPrivateStatus(onlineStatus.body);
    expectNoPrivateStatus(onlineUsers.body);
    expectNoPrivateStatus(lookup.body);
    expectNoPrivateStatus(chats.body);
  });

  it('filters blocked contacts out of HTTP presence and contact lists', async () => {
    await UserBlock.init();

    const owner = await setupProfileUser({
      firstName: 'Blocked',
      lastName: 'Owner',
    });
    const viewer = await setupProfileUser({
      firstName: 'Blocked',
      lastName: 'Viewer',
    });

    await createDirectChat([owner.user, viewer.user]);

    const visibleBeforeBlock = await viewer.agent
      .get('/api/user/online-users')
      .expect(200);
    expect(visibleBeforeBlock.body.data.allContacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: owner.user._id.toString() }),
      ])
    );

    await UserBlock.create({
      blocker: owner.user._id,
      blockedUser: viewer.user._id,
    });

    const hiddenAfterBlock = await viewer.agent
      .get('/api/user/online-users')
      .expect(200);
    const contactsAfterBlock = await viewer.agent
      .get('/api/user/get-all-users')
      .expect(200);

    expect(hiddenAfterBlock.body.data.allContacts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: owner.user._id.toString() }),
      ])
    );
    expect(contactsAfterBlock.body.users).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: owner.user._id.toString() }),
      ])
    );
  });
});
