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

export const signupWithAgent = async (overrides = {}) => {
  const agent = await createAgent();
  const payload = buildUserPayload(overrides);
  const response = await agent.post('/api/auth/signup').send(payload);
  assertSuccess(response, 'signup');
  const user = await User.findOne({ email: payload.email });

  return { agent, user, payload, response };
};

export const loginWithAgent = async ({ email, password = TEST_PASSWORD, rememberMe = false }) => {
  const agent = await createAgent();
  const response = await agent.post('/api/auth/login').send({ email, password, rememberMe });
  assertSuccess(response, 'login');

  return { agent, response };
};
