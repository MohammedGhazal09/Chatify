import jsonwebtoken from 'jsonwebtoken'

export const generateTokenAndSetCookie = (user, res, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : process.env.EXPIRES_IN || '15m';
  const token = jsonwebtoken.sign({userId:user._id}, process.env.SECRET_JWT_KEY, {expiresIn});

  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
  
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/'
  })

  return token
}