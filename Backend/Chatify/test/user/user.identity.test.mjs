import request from 'supertest';
import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
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
    const chats = await viewer.agent
      .get('/api/chat/get-all-chats')
      .expect(200);

    const ownerFromAllUsers = allUsers.body.users.find((candidate) => candidate._id === owner.user._id.toString());
    const ownerFromContacts = onlineUsers.body.data.allContacts.find((candidate) => candidate._id === owner.user._id.toString());
    const ownerFromChat = chats.body.data.chats[0].members.find((candidate) => candidate._id === owner.user._id.toString());

    expect(loggedUser.body.user.identityMark).toMatchObject({ source: 'custom', label: 'Relay Grid' });
    expect(ownerFromAllUsers.identityMark).toMatchObject({ source: 'custom', label: 'Relay Grid' });
    expect(ownerFromContacts.identityMark).toMatchObject({ source: 'custom', label: 'Relay Grid' });
    expect(ownerFromChat.identityMark).toMatchObject({ source: 'custom', label: 'Relay Grid' });
    expectNoPrivateIdentityFields(loggedUser.body);
    expectNoPrivateIdentityFields(allUsers.body);
    expectNoPrivateIdentityFields(onlineUsers.body);
    expectNoPrivateIdentityFields(chats.body);
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
