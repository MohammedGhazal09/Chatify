import request from 'supertest';
import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import {
  TEST_PASSWORD,
  buildUserPayload,
  createUser,
  uniqueEmail,
  uniqueUsername,
} from '../fixtures/users.mjs';
import {
  getCsrfForAgent,
  loginWithAgent,
} from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';
import {
  USERNAME_ERROR_CODES,
  validateUsername,
} from '../../Utils/usernameValidation.mjs';

describe('username validation', () => {
  it('normalizes valid usernames and rejects invalid values', () => {
    expect(validateUsername('  Alpha.User_1  ')).toMatchObject({
      ok: true,
      value: 'alpha.user_1',
    });

    for (const value of [
      '',
      'ab',
      '.alpha',
      'alpha.',
      'alpha..user',
      'alpha__user',
      'alpha-user',
      'a'.repeat(25),
    ]) {
      expect(validateUsername(value).ok).toBe(false);
    }
  });

  it('rejects reserved usernames', () => {
    expect(validateUsername('Admin')).toMatchObject({
      ok: false,
      code: USERNAME_ERROR_CODES.RESERVED,
    });
  });
});

describe('user username persistence', () => {
  it('stores usernames normalized and keeps existing username-less users loadable', async () => {
    const userWithUsername = await createUser({ username: 'Mixed.Case_1' });
    const userWithoutUsername = await createUser({ email: uniqueEmail('legacy') });

    expect(userWithUsername.username).toBe('mixed.case_1');
    expect(userWithoutUsername.username).toBeUndefined();

    const loadedLegacyUser = await User.findById(userWithoutUsername._id);
    expect(loadedLegacyUser).toBeTruthy();
    expect(loadedLegacyUser.username).toBeUndefined();
  });

  it('rejects duplicate normalized usernames', async () => {
    await createUser({ username: 'Taken.User' });

    await expect(createUser({
      email: uniqueEmail('duplicate'),
      username: 'taken.user',
    })).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects invalid usernames at model validation', async () => {
    await expect(createUser({
      email: uniqueEmail('invalid'),
      username: 'bad-name',
    })).rejects.toThrow(/Username must be 3-24/);
  });
});

describe('signup username behavior', () => {
  it('requires username on signup', async () => {
    const app = await getTestApp();
    const agent = request.agent(app);
    const csrfToken = await getCsrfForAgent(agent);
    const payload = buildUserPayload();
    delete payload.username;

    const response = await agent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', csrfToken)
      .send(payload)
      .expect(400);

    expect(response.body.message).toBe('Please provide all the required fields');
  });

  it('rejects duplicate usernames on signup with a conflict response', async () => {
    const app = await getTestApp();
    const agent = request.agent(app);
    const username = uniqueUsername('taken');
    await createUser({ username });
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', csrfToken)
      .send(buildUserPayload({ username: username.toLocaleUpperCase('en-US') }))
      .expect(409);

    expect(response.body).toMatchObject({
      status: 'fail',
      code: USERNAME_ERROR_CODES.TAKEN,
    });
  });

  it('stores normalized username and returns it on successful signup', async () => {
    const app = await getTestApp();
    const agent = request.agent(app);
    const csrfToken = await getCsrfForAgent(agent);
    const payload = buildUserPayload({ username: 'New.User_1' });

    const response = await agent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', csrfToken)
      .send(payload)
      .expect(201);

    const user = await User.findOne({ email: payload.email });
    expect(user.username).toBe('new.user_1');
    expect(response.body.user.username).toBe('new.user_1');
  });
});

describe('username setup route', () => {
  it('requires authentication', async () => {
    const app = await getTestApp();
    const response = await request(app)
      .patch('/api/user/username')
      .send({ username: uniqueUsername('guest') })
      .expect(401);

    expect(response.body.message).toMatch(/Not authorized/);
  });

  it('requires CSRF protection', async () => {
    const user = await createUser({ email: uniqueEmail('csrf') });
    const { agent } = await loginWithAgent({ email: user.email });

    const response = await agent
      .patch('/api/user/username')
      .send({ username: uniqueUsername('csrf') })
      .expect(403);

    expect(response.body.message).toBe('CSRF token invalid or missing');
  });

  it('sets a first username and returns the updated account-safe user', async () => {
    const user = await createUser({ email: uniqueEmail('setup') });
    const { agent } = await loginWithAgent({ email: user.email });
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .patch('/api/user/username')
      .set('X-CSRF-Token', csrfToken)
      .send({ username: 'Setup.User' })
      .expect(200);

    expect(response.body.data.user.username).toBe('setup.user');
    expect(response.body.data.user.email).toBe(user.email);

    const savedUser = await User.findById(user._id);
    expect(savedUser.username).toBe('setup.user');
  });

  it('rejects duplicate usernames during setup', async () => {
    const username = uniqueUsername('reserved');
    await createUser({ username });
    const user = await createUser({ email: uniqueEmail('setup-duplicate') });
    const { agent } = await loginWithAgent({ email: user.email });
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .patch('/api/user/username')
      .set('X-CSRF-Token', csrfToken)
      .send({ username: username.toLocaleUpperCase('en-US') })
      .expect(409);

    expect(response.body.code).toBe(USERNAME_ERROR_CODES.TAKEN);
  });

  it('rejects a second username update', async () => {
    const user = await createUser({
      email: uniqueEmail('setup-existing'),
      username: uniqueUsername('existing'),
    });
    const { agent } = await loginWithAgent({ email: user.email });
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .patch('/api/user/username')
      .set('X-CSRF-Token', csrfToken)
      .send({ username: uniqueUsername('second') })
      .expect(409);

    expect(response.body.code).toBe(USERNAME_ERROR_CODES.ALREADY_SET);
  });
});
