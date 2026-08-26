import { describe, expect, it } from 'vitest';
import Session from '../../Models/sessionModel.mjs';
import SessionFamily from '../../Models/sessionFamilyModel.mjs';
import {
  issueSessionCookies,
  rotateSessionCookies,
} from '../../Utils/tokenCookieGenerator.mjs';
import { createUser } from '../fixtures/users.mjs';

const createCookieResponse = () => {
  const cookies = new Map();
  return {
    cookies,
    cookie(name, value) {
      cookies.set(name, value);
      return this;
    },
    clearCookie(name) {
      cookies.delete(name);
      return this;
    },
  };
};

describe('refresh-token family replay containment', () => {
  it('compromises the durable family and revokes the successor after concurrent replay', async () => {
    const user = await createUser();
    const initial = await issueSessionCookies({
      user,
      res: createCookieResponse(),
    });

    const attempts = await Promise.allSettled([
      rotateSessionCookies({
        refreshToken: initial.refreshToken,
        res: createCookieResponse(),
      }),
      rotateSessionCookies({
        refreshToken: initial.refreshToken,
        res: createCookieResponse(),
      }),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const family = await SessionFamily.findOne({ familyId: initial.session.familyId }).lean();
    expect(family?.compromisedAt).toBeTruthy();

    const successorToken = fulfilled[0].value.refreshToken;
    const successor = await Session.findOne({
      familyId: initial.session.familyId,
      refreshTokenHash: { $ne: initial.session.refreshTokenHash },
    }).lean();
    expect(successor?.revokedAt).toBeTruthy();

    await expect(rotateSessionCookies({
      refreshToken: successorToken,
      res: createCookieResponse(),
    })).rejects.toMatchObject({ statusCode: 401 });
  });
});
