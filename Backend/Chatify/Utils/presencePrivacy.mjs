const isPlainObject = (value) => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';

const toIsoDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const getPresencePrivacyPolicy = (user) => ({
  showOnlineStatus: user?.showOnlineStatus !== false,
  showLastSeen: user?.showLastSeen !== false,
  showProfileStatus: user?.showProfileStatus !== false,
});

export const hasPresenceVisibilityPolicyChanged = (previousPolicy, user) => {
  if (!previousPolicy) return false;
  const currentPolicy = getPresencePrivacyPolicy(user);

  return (
    previousPolicy.showOnlineStatus !== currentPolicy.showOnlineStatus ||
    previousPolicy.showLastSeen !== currentPolicy.showLastSeen
  );
};

const applyProfileStatusPrivacy = (result, user) => {
  if (user?.showProfileStatus === false && 'profileStatus' in result) {
    result.profileStatus = '';
  }

  return result;
};

const applyLastSeenPrivacy = ({ result, user, visibleOnline }) => {
  delete result.lastSeen;

  if (user?.showLastSeen === false || visibleOnline) {
    return result;
  }

  const lastSeen = toIsoDate(user?.lastSeen);
  if (lastSeen) {
    result.lastSeen = lastSeen;
  }

  return result;
};

export const serializeSocketPresence = (entry, user) => {
  if (!isPlainObject(entry) || !user) return null;

  const result = { ...entry };
  const visibleOnline = user.showOnlineStatus !== false && user.isOnline === true;

  result.userId = toIdString(user._id) || toIdString(entry.userId);
  result.isOnline = visibleOnline;
  result.isCallReachable = visibleOnline && entry.isCallReachable === true;

  applyLastSeenPrivacy({ result, user, visibleOnline });
  applyProfileStatusPrivacy(result, user);
  return result;
};

export const serializeHttpPresence = (entry, user) => {
  if (!isPlainObject(entry) || !user) return null;

  const result = { ...entry };
  const onlineVisible = user.showOnlineStatus !== false;
  const visibleOnline = onlineVisible && user.isOnline === true;

  if (onlineVisible) {
    result.isOnline = visibleOnline;
    result.isCallReachable = visibleOnline && entry.isCallReachable === true;
  } else {
    delete result.isOnline;
    delete result.isCallReachable;
  }

  applyLastSeenPrivacy({ result, user, visibleOnline });
  applyProfileStatusPrivacy(result, user);
  return result;
};

export const shouldDeliverSocketPresenceTransition = ({
  entry,
  user,
  previousPolicy,
}) => {
  if (!isPlainObject(entry) || !user) return false;

  if (user.showOnlineStatus !== false) {
    return true;
  }

  if (hasPresenceVisibilityPolicyChanged(previousPolicy, user)) {
    return true;
  }

  return user.showLastSeen !== false && Boolean(toIsoDate(entry.lastSeen));
};
