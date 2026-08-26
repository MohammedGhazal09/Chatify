import TwoFactorReplay from '../Models/twoFactorReplayModel.mjs';
import { CustomError } from '../Utils/customError.mjs';

const REPLAY_ERROR_MESSAGE = 'Invalid or already used two-factor code';

const buildReplayError = () => new CustomError(REPLAY_ERROR_MESSAGE, 401);

export const consumeTotpCounter = async ({ userId, counter, session }) => {
  if (!userId || !Number.isSafeInteger(counter) || counter < 0) {
    throw buildReplayError();
  }

  const existing = await TwoFactorReplay.findOne({ userId }).session(session ?? null);

  if (!existing) {
    try {
      const [created] = await TwoFactorReplay.create(
        [{ userId, lastCounter: counter }],
        session ? { session } : undefined
      );
      return created;
    } catch (error) {
      if (error?.code === 11000) throw buildReplayError();
      throw error;
    }
  }

  if (existing.lastCounter >= counter) {
    throw buildReplayError();
  }

  const update = await TwoFactorReplay.updateOne(
    {
      _id: existing._id,
      lastCounter: { $lt: counter },
    },
    { $set: { lastCounter: counter } },
    session ? { session } : undefined
  );

  if (update.modifiedCount !== 1) {
    throw buildReplayError();
  }

  return TwoFactorReplay.findById(existing._id).session(session ?? null);
};

export const clearTotpReplayState = ({ userId, session = null }) => (
  TwoFactorReplay.deleteOne({ userId }, session ? { session } : undefined)
);
