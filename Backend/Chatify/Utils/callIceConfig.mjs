const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];

const splitEnvList = (value) => (typeof value === 'string'
  ? value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  : []);

const parseStunServers = (env = process.env) => {
  const stunUrls = splitEnvList(env.CALL_STUN_URLS);
  const urls = stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS;

  return urls.map((url) => ({ urls: url }));
};

const parseTurnServers = (env = process.env) => {
  const turnUrls = splitEnvList(env.CALL_TURN_URLS);
  const username = env.CALL_TURN_USERNAME;
  const credential = env.CALL_TURN_CREDENTIAL;

  if (turnUrls.length === 0 || !username || !credential) {
    return [];
  }

  return turnUrls.map((url) => ({
    urls: url,
    username,
    credential,
  }));
};

export const getCallIceConfig = (env = process.env) => {
  const stunServers = parseStunServers(env);
  const turnServers = parseTurnServers(env);
  const turnReady = turnServers.length > 0;
  const productionReady = env.NODE_ENV !== 'production' || turnReady;
  const warnings = [];

  if (!turnReady) {
    warnings.push('TURN server is not configured. Development STUN fallback is available, but production calling is not fully ready.');
  }

  return {
    iceServers: [...stunServers, ...turnServers],
    turnReady,
    productionReady,
    warnings,
  };
};
