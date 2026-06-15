import request from 'supertest';
import User from '../../Models/userModel.mjs';
import { buildUserPayload, TEST_PASSWORD } from '../fixtures/users.mjs';
import { getTestApp } from '../setup/app.mjs';

const assertSuccess = (response, context) => {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${context} failed with ${response.statusCode}: ${JSON.stringify(response.body)}`);
  }
};

export const createAgent = async () => {
  const app = await getTestApp();
  return request.agent(app);
};

export const getCsrfForAgent = async (agent) => {
  const response = await agent.get('/api/csrf-token').expect(204);
  const csrfCookie = (response.headers['set-cookie'] ?? [])
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='));
  const csrfToken = decodeURIComponent(csrfCookie?.split(';')[0]?.split('=').slice(1).join('=') ?? '');

  if (!csrfToken) {
    throw new Error('Failed to fetch CSRF token');
  }

  return csrfToken;
};

export const signupWithAgent = async (overrides = {}) => {
  const agent = await createAgent();
  const payload = buildUserPayload(overrides);
  const csrfToken = await getCsrfForAgent(agent);
  const response = await agent
    .post('/api/auth/signup')
    .set('X-CSRF-Token', csrfToken)
    .send(payload);
  assertSuccess(response, 'signup');
  const user = await User.findOne({ email: payload.email });

  return { agent, user, payload, response };
};

export const loginWithAgent = async ({ email, password = TEST_PASSWORD, rememberMe = false }) => {
  const agent = await createAgent();
  const csrfToken = await getCsrfForAgent(agent);
  const response = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email, password, rememberMe });
  assertSuccess(response, 'login');

  return { agent, response };
};
