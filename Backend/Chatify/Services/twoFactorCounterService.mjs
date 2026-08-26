import TwoFactorUsage from '../Models/twoFactorUsageModel.mjs';

const isDuplicateKeyError = (error) => error?.code === 11000;

export const claimTotpCounter = async ({ userId, counter }) => {
  if (!userId || !Number.isSafeInteger(counter) || counter < 0) {
    return false;
  }

  const updated = await TwoFactorUsage.findOneAndUpdate(
    {
      userId,
      lastAcceptedCounter: { $lt: counter },
    },
    { $set: { lastAcceptedCounter: counter } },
    { new: true }
  );

  if (updated) {
    return true;
  }

  try {
    await TwoFactorUsage.create({ userId, lastAcceptedCounter: counter });
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return false;
    }
    throw error;
  }
};

export const clearTotpCounterState = async (userId) => {
  if (!userId) return;
  await TwoFactorUsage.deleteOne({ userId });
};
