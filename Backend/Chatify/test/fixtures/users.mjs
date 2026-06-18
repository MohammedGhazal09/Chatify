import User from '../../Models/userModel.mjs';

let userCounter = 0;

export const TEST_PASSWORD = 'Password123!';

export const uniqueEmail = (prefix = 'user') => {
  userCounter += 1;
  return `${prefix}-${Date.now()}-${userCounter}@example.test`;
};

export const uniqueUsername = (prefix = 'user') => {
  userCounter += 1;
  const safePrefix = String(prefix)
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8) || 'user';
  const suffix = `${Date.now().toString(36)}${userCounter.toString(36)}`;
  return `${safePrefix}.${suffix}`;
};

export const buildUserPayload = (overrides = {}) => ({
  firstName: overrides.firstName ?? 'Test',
  lastName: overrides.lastName ?? 'User',
  email: overrides.email ?? uniqueEmail(),
  username: overrides.username ?? uniqueUsername(),
  password: overrides.password ?? TEST_PASSWORD,
  profilePic: overrides.profilePic ?? '',
});

export const createUser = async (overrides = {}) => {
  const payload = buildUserPayload(overrides);

  return User.create({
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    ...(overrides.username ? { username: overrides.username } : {}),
    password: payload.password,
    profilePic: payload.profilePic,
    authProvider: 'local',
  });
};
