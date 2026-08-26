import User from '../Models/userModel.mjs';
import { beginPresencePrivacyMutation } from '../Services/socketPresencePrivacyService.mjs';
import { serializeHttpPresence } from '../Utils/presencePrivacy.mjs';

const isPlainObject = (value) => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';

const wrapJsonResponse = (res, next, sanitizer) => {
  const originalJson = res.json.bind(res);
  let responseStarted = false;

  const restoreJson = () => {
    res.json = originalJson;
  };

  res.json = (body) => {
    if (responseStarted) return res;
    responseStarted = true;

    void Promise.resolve()
      .then(() => sanitizer(body))
      .then((safeBody) => {
        restoreJson();
        return originalJson(safeBody);
      })
      .catch((error) => {
        // The global error handler must receive the real response writer. Leaving the
        // wrapper installed here makes its second res.json call a no-op and can leave
        // the HTTP request open indefinitely.
        restoreJson();
        next(error);
      });

    return res;
  };
};

const loadPresenceUser = (userId) => User.findById(userId)
  .select('_id isOnline lastSeen showOnlineStatus showLastSeen showProfileStatus')
  .lean();

export const sanitizeSinglePresenceResponse = (req, res, next) => {
  wrapJsonResponse(res, next, async (body) => {
    if (!isPlainObject(body?.data) || res.statusCode < 200 || res.statusCode >= 300) {
      return body;
    }

    const user = await loadPresenceUser(req.params.userId);
    if (!user) {
      const safeData = { ...body.data };
      delete safeData.isOnline;
      delete safeData.isCallReachable;
      delete safeData.lastSeen;
      return { ...body, data: safeData };
    }

    return {
      ...body,
      data: serializeHttpPresence(body.data, user),
    };
  });

  next();
};

export const sanitizeContactPresenceResponse = (req, res, next) => {
  wrapJsonResponse(res, next, async (body) => {
    const data = body?.data;
    if (!isPlainObject(data) || res.statusCode < 200 || res.statusCode >= 300) {
      return body;
    }

    const allContacts = Array.isArray(data.allContacts) ? data.allContacts : [];
    const contactIds = allContacts.map((entry) => toIdString(entry?._id)).filter(Boolean);
    const users = await User.find({ _id: { $in: [...new Set(contactIds)] } })
      .select('_id isOnline lastSeen showOnlineStatus showLastSeen showProfileStatus')
      .lean();
    const usersById = new Map(users.map((user) => [toIdString(user._id), user]));
    const safeContacts = allContacts
      .map((entry) => serializeHttpPresence(entry, usersById.get(toIdString(entry?._id))))
      .filter(Boolean);

    return {
      ...body,
      data: {
        ...data,
        allContacts: safeContacts,
        onlineUsers: safeContacts.filter((entry) => entry.isOnline === true),
      },
    };
  });

  next();
};

export const capturePresencePrivacyMutation = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
      .select('_id showOnlineStatus showLastSeen showProfileStatus')
      .lean();
    const endMutation = beginPresencePrivacyMutation(user);

    res.once('finish', endMutation);
    res.once('close', endMutation);
    next();
  } catch (error) {
    next(error);
  }
};
