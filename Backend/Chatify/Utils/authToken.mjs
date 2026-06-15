import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_COOKIE = 'accessToken';

export const readAccessTokenFromCookieHeader = (cookieHeader = '') => {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }

  const tokenPair = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

  if (!tokenPair) {
    return null;
  }

  const token = tokenPair.slice(ACCESS_TOKEN_COOKIE.length + 1);

  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
};

export const readAccessTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (cookieToken) {
    return cookieToken;
  }

  const authorization = req.headers?.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  return null;
};

export const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.SECRET_JWT_KEY, {
    algorithms: ['HS256'],
  });

  if (!decoded?.userId) {
    throw new jwt.JsonWebTokenError('Missing user id claim');
  }

  if (decoded.type && decoded.type !== 'access') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }

  return {
    userId: decoded.userId.toString(),
    decoded,
  };
};
