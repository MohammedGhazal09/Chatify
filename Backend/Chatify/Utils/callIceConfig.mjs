const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];

const splitEnvList = (value) => (typeof value === 'string'
  ? value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  : []);

const parseStunServers = () => {
  const stunUrls = splitEnvList(process.env.CALL_STUN_URLS);
  const urls = stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS;

  return urls.map((url) => ({ urls: url }));
};

const parseTurnServers = () => {
  const turnUrls = splitEnvList(process.env.CALL_TURN_URLS);
  const username = process.env.CALL_TURN_USERNAME;
  const credential = process.env.CALL_TURN_CREDENTIAL;

  if (turnUrls.length === 0 || !username || !credential) {
    return [];
  }

  return turnUrls.map((url) => ({
    urls: url,
    username,
    credential,
  }));
};

export const getCallIceConfig = () => {
  const stunServers = parseStunServers();
  const turnServers = parseTurnServers();
  const turnReady = turnServers.length > 0;
  const productionReady = process.env.NODE_ENV !== 'production' || turnReady;
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
