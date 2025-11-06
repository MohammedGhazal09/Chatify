import jsonwebtoken from 'jsonwebtoken'

export const generateTokenAndSetCookie = (user, res, rememberMe = false) => {
  console.log('\n🔑 === Token Generation Start ===');
  console.log('👤 User ID:', user._id);
  console.log('📧 User Email:', user.email);
  console.log('💾 Remember Me:', rememberMe);
  
  const expiresIn = rememberMe ? '30d' : process.env.EXPIRES_IN || '15m';
  const token = jsonwebtoken.sign({userId:user._id}, process.env.SECRET_JWT_KEY, {expiresIn});

  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
  
  console.log('⏱️ Token expires in:', expiresIn);
  console.log('⏱️ Cookie maxAge:', maxAge, 'ms');
  console.log('🌍 Environment:', isProd ? 'production' : 'development');
  console.log('🔒 Secure:', isProd);
  console.log('🍪 SameSite:', isProd ? 'none' : 'lax');
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge,
    path: '/'
  };
  
  console.log('🍪 Full cookie options:', cookieOptions);
  
  res.cookie('accessToken', token, cookieOptions);
  
  console.log('✅ Cookie set successfully');
  console.log('🔑 === Token Generation End ===\n');

  return token
}