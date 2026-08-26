import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_COOKIE = 'accessToken';
export const ACCESS_TOKEN_ISSUER = 'chatify-api';
export const ACCESS_TOKEN_AUDIENCE = 'chatify-web';

export const readAccessTokenFromCookieHeader = (cookieHeader = '') => {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;

  const tokenPair = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

  if (!tokenPair) return null;
  const token = tokenPair.slice(ACCESS_TOKEN_COOKIE.length + 1);

  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
};

export const readAccessTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (cookieToken) return cookieToken;

  const authorization = req.headers?.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length);
  return null;
};

export const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.SECRET_JWT_KEY, {
    algorithms: ['HS256'],
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  });

  if (!decoded || typeof decoded !== 'object') throw new jwt.JsonWebTokenError('Invalid access token payload');
  if (decoded.type !== 'access') throw new jwt.JsonWebTokenError('Invalid token type');
  if (typeof decoded.userId !== 'string' || !decoded.userId) throw new jwt.JsonWebTokenError('Missing user id claim');
  if (typeof decoded.sub !== 'string' || decoded.sub !== decoded.userId) throw new jwt.JsonWebTokenError('Invalid subject claim');
  if (typeof decoded.sessionId !== 'string' || !decoded.sessionId) throw new jwt.JsonWebTokenError('Missing session id claim');
  if (typeof decoded.jti !== 'string' || !decoded.jti) throw new jwt.JsonWebTokenError('Missing JWT id claim');
  if (!Number.isFinite(decoded.iat) || !Number.isFinite(decoded.exp)) throw new jwt.JsonWebTokenError('Missing token time claims');

  return { userId: decoded.userId, sessionId: decoded.sessionId, decoded };
};
