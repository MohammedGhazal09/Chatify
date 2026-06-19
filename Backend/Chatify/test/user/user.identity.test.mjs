import request from 'supertest';
import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createAgent, getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';

const validIdentityMark = (overrides = {}) => ({
  label: 'Relay Grid',
  initials: 'RG',
  paletteId: 'teal',
  patternId: 'rings',
  accentId: 'mint',
  ...overrides,
});

const updateIdentityMark = (agent, csrfToken, payload) => agent
  .patch('/api/user/identity')
  .set('X-CSRF-Token', csrfToken)
  .send(payload);

const expectNoPrivateIdentityFields = (payload) => {
  expect(JSON.stringify(payload)).not.toMatch(
    /uploadedProfileImage|providerProfilePic|storageFileId|bucket|objectKey|sha256|hash|password|cookie|token|reset/i
  );
};

const expectNoPublicEmailFields = (payload) => {
  expect(JSON.stringify(payload)).not.toMatch(/"email"/i);
};

const setupIdentityUser = async (overrides = {}) => {
  const signedUp = await signupWithAgent(overrides);
  const csrfToken = await getCsrfForAgent(signedUp.agent);
  return { ...signedUp, csrfToken };
};

describe('user identity marks', () => {
  it('persists valid abstract identity marks and serializes them through authenticated identity surfaces', async () => {
    const owner = await setupIdentityUser({
      firstName: 'Identity',
      lastName: 'Owner',
    });
    const viewer = await setupIdentityUser({
      firstName: 'Identity',
      lastName: 'Viewer',
    });
    const outsider = await setupIdentityUser({
      firstName: 'Identity',
      lastName: 'Outsider',
    });

    await createDirectChat([owner.user, viewer.user]);

    const response = await updateIdentityMark(owner.agent, owner.csrfToken, validIdentityMark()).expect(200);

    expect(response.body.data.user.identityMark).toMatchObject({
      source: 'custom',
      label: 'Relay Grid',
      initials: 'RG',
      paletteId: 'teal',
      patternId: 'rings',
      accentId: 'mint',
    });
    expect(response.body.data.user.identityMark.updatedAt).toBeTruthy();
    expectNoPrivateIdentityFields(response.body);

    const storedUser = await User.findById(owner.user._id).lean();
    expect(storedUser.identityMark).toMatchObject({
      label: 'Relay Grid',
      initials: 'RG',
      paletteId: 'teal',
      patternId: 'rings',
      accentId: 'mint',
    });
    expect(storedUser.identityMarkUpdatedAt).toBeInstanceOf(Date);

    const loggedUser = await owner.agent
      .get('/api/user/get-logged-user')
      .expect(200);
    const allUsers = await viewer.agent
      .get('/api/user/get-all-users')
      .expect(200);
    const onlineUsers = await viewer.agent
      .get('/api/user/online-users')
      .expect(200);
    const onlineStatus = await viewer.agent
      .get(`/api/user/online-status/${owner.user._id}`)
      .expect(200);
    const lookup = await viewer.agent
      .get(`/api/user/lookup/${owner.user.username.toUpperCase()}`)
      .expect(200);
    const chats = await viewer.agent
      .get('/api/chat/get-all-chats')
      .expect(200);

    const ownerFromAllUsers = allUsers.body.users.find((candidate) => candidate._id === owner.user._id.toString());
    const outsiderFromAllUsers = allUsers.body.users.find((candidate) => candidate._id === outsider.user._id.toString());
    const ownerFromContacts = onlineUsers.body.data.allContacts.find((candidate) => candidate._id === owner.user._id.toString());
    const ownerFromChat = chats.body.data.chats[0].members.find((candidate) => candidate._id === owner.user._id.toString());

    expect(loggedUser.body.user.email).toBe(owner.user.email);
    expect(loggedUser.body.user.username).toBe(owner.user.username);
    expect(loggedUser.body.user.identityMark).toMatchObject({ source: 'custom', label: 'Relay Grid' });
    expect(ownerFromAllUsers).toMatchObject({
      username: owner.user.username,
      identityMark: expect.objectContaining({ source: 'custom', label: 'Relay Grid' }),
    });
    expect(outsiderFromAllUsers).toBeUndefined();
    expect(ownerFromContacts).toMatchObject({
      username: owner.user.username,
      identityMark: expect.objectContaining({ source: 'custom', label: 'Relay Grid' }),
    });
    expect(onlineStatus.body.data).toMatchObject({
      username: owner.user.username,
      identityMark: expect.objectContaining({ source: 'custom', label: 'Relay Grid' }),
    });
    expect(lookup.body.data.user).toMatchObject({
      username: owner.user.username,
      identityMark: expect.objectContaining({ source: 'custom', label: 'Relay Grid' }),
    });
    expect(ownerFromChat).toMatchObject({
      username: owner.user.username,
      identityMark: expect.objectContaining({ source: 'custom', label: 'Relay Grid' }),
    });
    expectNoPrivateIdentityFields(loggedUser.body);
    expectNoPrivateIdentityFields(allUsers.body);
    expectNoPrivateIdentityFields(onlineUsers.body);
    expectNoPrivateIdentityFields(onlineStatus.body);
    expectNoPrivateIdentityFields(lookup.body);
    expectNoPrivateIdentityFields(chats.body);
    expectNoPublicEmailFields(allUsers.body);
    expectNoPublicEmailFields(onlineUsers.body);
    expectNoPublicEmailFields(onlineStatus.body);
    expectNoPublicEmailFields(lookup.body);
    expectNoPublicEmailFields(chats.body);
  });

  it('validates exact username lookup without exposing email identity', async () => {
    const viewer = await setupIdentityUser({
      firstName: 'Lookup',
      lastName: 'Viewer',
    });

    const invalid = await viewer.agent
      .get('/api/user/lookup/not%20valid')
      .expect(400);
    const missing = await viewer.agent
      .get('/api/user/lookup/missing.user')
      .expect(404);

    expect(invalid.body).toMatchObject({
      status: 'fail',
      code: 'USERNAME_INVALID',
    });
    expect(missing.body.message).toBe('User not found');
    expectNoPublicEmailFields(invalid.body);
    expectNoPublicEmailFields(missing.body);
  });

  it('limits online-status lookups to unblocked chat contacts and self', async () => {
    await UserBlock.init();

    const owner = await setupIdentityUser({
      firstName: 'Presence',
      lastName: 'Owner',
    });
    const viewer = await setupIdentityUser({
      firstName: 'Presence',
      lastName: 'Viewer',
    });
    const outsider = await setupIdentityUser({
      firstName: 'Presence',
      lastName: 'Outsider',
    });

    await createDirectChat([owner.user, viewer.user]);

    await owner.agent
      .get(`/api/user/online-status/${owner.user._id}`)
      .expect(200);
    await viewer.agent
      .get(`/api/user/online-status/${owner.user._id}`)
      .expect(200);
    await outsider.agent
      .get(`/api/user/online-status/${owner.user._id}`)
      .expect(404);

    await UserBlock.create({
      blocker: owner.user._id,
      blockedUser: viewer.user._id,
    });

    await viewer.agent
      .get(`/api/user/online-status/${owner.user._id}`)
      .expect(404);
  });

  it('rejects unsupported preset ids, URL-like values, and living-being identity concepts', async () => {
    const { agent, csrfToken } = await setupIdentityUser({
      firstName: 'Invalid',
      lastName: 'Identity',
    });
    const invalidCases = [
      validIdentityMark({ paletteId: 'purple' }),
      validIdentityMark({ patternId: 'portrait' }),
      validIdentityMark({ accentId: 'https://cdn.example.test/accent' }),
      validIdentityMark({ label: 'https://evil.example/avatar.png' }),
      validIdentityMark({ label: 'Cat face' }),
      validIdentityMark({ initials: 'ABCD' }),
    ];

    for (const payload of invalidCases) {
      const response = await updateIdentityMark(agent, csrfToken, payload).expect(400);

      expect(response.body).toMatchObject({
        status: 'fail',
        code: 'IDENTITY_MARK_INVALID',
      });
      expectNoPrivateIdentityFields(response.body);
    }

    const currentUser = await agent
      .get('/api/user/get-logged-user')
      .expect(200);

    expect(currentUser.body.user.identityMark.source).toBe('fallback');
  });

  it('returns deterministic abstract fallback identity marks for users without custom metadata', async () => {
    const { agent } = await setupIdentityUser({
      firstName: 'Fallback',
      lastName: 'User',
    });

    const firstResponse = await agent
      .get('/api/user/get-logged-user')
      .expect(200);
    const secondResponse = await agent
      .get('/api/user/get-logged-user')
      .expect(200);

    expect(firstResponse.body.user.identityMark).toMatchObject({
      source: 'fallback',
      label: 'Fallback User',
      initials: 'FU',
    });
    expect(secondResponse.body.user.identityMark).toEqual(firstResponse.body.user.identityMark);
  });

  it('requires authentication and CSRF for identity mark updates', async () => {
    const app = await getTestApp();
    const agent = await createAgent();
    const signedUp = await setupIdentityUser({
      firstName: 'Secure',
      lastName: 'Identity',
    });

    await request(app)
      .patch('/api/user/identity')
      .send(validIdentityMark())
      .expect(401);

    await agent
      .patch('/api/user/identity')
      .send(validIdentityMark())
      .expect(401);

    await signedUp.agent
      .patch('/api/user/identity')
      .send(validIdentityMark())
      .expect(403);
  });

  it('accepts nested identityMark payloads without echoing raw request metadata on validation errors', async () => {
    const { agent, csrfToken } = await setupIdentityUser({
      firstName: 'Nested',
      lastName: 'Payload',
    });

    const updated = await updateIdentityMark(agent, csrfToken, {
      identityMark: validIdentityMark({
        label: 'Orbit Node',
        initials: 'ON',
        paletteId: 'indigo',
        patternId: 'orbit',
        accentId: 'sky',
      }),
    }).expect(200);

    expect(updated.body.data.user.identityMark).toMatchObject({
      source: 'custom',
      label: 'Orbit Node',
      initials: 'ON',
      paletteId: 'indigo',
      patternId: 'orbit',
      accentId: 'sky',
    });

    const invalid = await updateIdentityMark(agent, csrfToken, {
      identityMark: validIdentityMark({
        label: 'Dog portrait',
      }),
    }).expect(400);

    expect(JSON.stringify(invalid.body)).not.toContain('Dog portrait');
  });
});
