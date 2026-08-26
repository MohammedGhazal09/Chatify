import fs from 'node:fs';

const path = 'Backend/Chatify/Utils/tokenCookieGenerator.mjs';
let source = fs.readFileSync(path, 'utf8');

const replacement = `export const rotateSessionCookies = async ({ refreshToken, res, req = null }) => {
  if (!refreshToken) throw new CustomError('Refresh token required', 401);
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  const rotation = await withDatabaseTransaction(async (session) => {
    const existing = await Session.findOne({ refreshTokenHash: tokenHash })
      .select('+userAgentHash +ipHash')
      .session(session);

    if (!existing) {
      return { ok: false, message: 'Invalid refresh token', statusCode: 401, revokedSessionIds: [] };
    }

    const family = await SessionFamily.findOne({ familyId: existing.familyId }).session(session);
    if (!family || family.compromisedAt || existing.revokedAt || existing.replacedByTokenHash) {
      const familySessions = await Session.find({ familyId: existing.familyId })
        .select('_id')
        .session(session)
        .lean();
      await compromiseFamilyInTransaction({
        familyId: existing.familyId,
        userId: existing.userId,
        now,
        session,
      });
      return {
        ok: false,
        message: 'Refresh token already used',
        statusCode: 401,
        revokedSessionIds: familySessions.map((entry) => entry._id),
      };
    }

    if (existing.expiresAt <= now) {
      await Session.updateOne(
        { _id: existing._id, revokedAt: null },
        { $set: { revokedAt: now, lastUsedAt: now } },
        { session },
      );
      return {
        ok: false,
        message: 'Refresh token expired',
        statusCode: 401,
        revokedSessionIds: [existing._id],
      };
    }

    const claimed = await Session.findOneAndUpdate(
      {
        _id: existing._id,
        refreshTokenHash: tokenHash,
        revokedAt: null,
        replacedByTokenHash: null,
        expiresAt: { $gt: now },
      },
      { $set: { revokedAt: now, lastUsedAt: now } },
      { new: false, session },
    ).select('+userAgentHash +ipHash');

    if (!claimed) {
      const familySessions = await Session.find({ familyId: existing.familyId })
        .select('_id')
        .session(session)
        .lean();
      await compromiseFamilyInTransaction({
        familyId: existing.familyId,
        userId: existing.userId,
        now,
        session,
      });
      return {
        ok: false,
        message: 'Refresh token already used',
        statusCode: 401,
        revokedSessionIds: familySessions.map((entry) => entry._id),
      };
    }

    const user = await User.findById(claimed.userId).session(session);
    if (!user) {
      const familySessions = await Session.find({ familyId: claimed.familyId })
        .select('_id')
        .session(session)
        .lean();
      await compromiseFamilyInTransaction({
        familyId: claimed.familyId,
        userId: claimed.userId,
        now,
        session,
      });
      return {
        ok: false,
        message: 'User not found',
        statusCode: 404,
        revokedSessionIds: familySessions.map((entry) => entry._id),
      };
    }

    const requestMetadata = buildSessionMetadataFromRequest(req);
    const successor = await createRefreshSession({
      user,
      rememberMe: claimed.rememberMe,
      familyId: claimed.familyId,
      metadata: {
        deviceLabel: claimed.deviceLabel || requestMetadata.deviceLabel,
        userAgentHash: claimed.userAgentHash ?? requestMetadata.userAgentHash,
        ipHash: claimed.ipHash ?? requestMetadata.ipHash,
      },
      session,
      createFamily: false,
    });

    await Session.updateOne(
      { _id: claimed._id, replacedByTokenHash: null },
      { $set: { replacedByTokenHash: successor.refreshTokenHash } },
      { session },
    );
    await SessionFamily.updateOne(
      { familyId: claimed.familyId, compromisedAt: null },
      { $max: { expiresAt: successor.session.expiresAt } },
      { session },
    );

    return {
      ok: true,
      user,
      predecessorId: claimed._id,
      refreshToken: successor.refreshToken,
      session: successor.session,
    };
  });

  for (const sessionId of rotation.revokedSessionIds ?? []) {
    disconnectSessionSockets(sessionId, rotation.message === 'Refresh token already used'
      ? 'refresh_token_reuse'
      : 'session_revoked');
  }

  if (!rotation.ok) {
    throw new CustomError(rotation.message, rotation.statusCode);
  }

  disconnectSessionSockets(rotation.predecessorId, 'session_rotated');
  const accessToken = createAccessToken(rotation.user, rotation.session);
  setSessionCookies(res, {
    accessToken,
    refreshToken: rotation.refreshToken,
    rememberMe: rotation.session.rememberMe,
  });
  return {
    accessToken,
    refreshToken: rotation.refreshToken,
    session: rotation.session,
    user: rotation.user,
  };
};

export const revokeRefreshSession`;

const pattern = /export const rotateSessionCookies = async \(\{ refreshToken, res, req = null \}\) => \{[\s\S]*?\n\};\n\nexport const revokeRefreshSession/;
if (!pattern.test(source)) {
  throw new Error('rotateSessionCookies block was not found for commit-order repair');
}
source = source.replace(pattern, replacement);
fs.writeFileSync(path, source);
console.log('Session-family replay containment now commits before the error is returned.');
