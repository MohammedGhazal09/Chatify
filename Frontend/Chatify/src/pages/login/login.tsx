import { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { FaGoogle, FaGithub, FaLinkedin } from "react-icons/fa";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import { loginSchema, type LoginFormData } from '../../utils/validationSchemas';
import ChatifyIcon from '../../components/chatifyIcon';
import axios from 'axios';
import useAuthStore from '../../store/authStor';
import LoadingSpinner from '../../components/loadingSpinner';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setOAuthLoading, isOAuthLoading, login, isLoading } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange'
  });


useAuthRedirect();
  // Handle OAuth callback and errors
  useEffect(() => {
    const authStatus = searchParams.get('auth');
    const error = searchParams.get('error');
    
    if (authStatus === 'success') {
      navigate('/', { replace: true });
    } else if (error) {
      try {
        const errorDetails = JSON.parse(decodeURIComponent(error));
        console.error('OAuth Error Details:', errorDetails);
        
        setError('root', { 
          type: 'manual', 
          message: `${errorDetails.message} (Code: ${errorDetails.code})` 
        });
      } catch  {
        // Fallback for simple error strings
        console.error('OAuth Error:', error);
        setError('root', { 
          type: 'manual', 
          message: `Authentication failed: ${error}` 
        });
      }
      
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, setError]);


  const onSubmit = async (data: LoginFormData) => {
    clearErrors('root');
      try {
        await login(data);
      } catch (err: unknown) {
        let message = 'Login failed';
        
        if (axios.isAxiosError(err)) {
          const errorMsg = err.response?.data?.message;
          if (errorMsg) {
            message = errorMsg;
          } else if (err.response?.status === 401) {
            message = 'Invalid email or password';
          } else if (err.response?.status && err.response?.status >= 500) {
            message = 'Server error. Please try again later.';
          }
        } else if (err instanceof Error) {
          message = err.message;
        }
        
        setError('root', { type: 'manual', message });
      }

    };

const handleGoogleLogin = () => {
  clearErrors('root');
  setOAuthLoading(true);
  localStorage.setItem('oauth-pending', 'true');
  window.open('/api/auth/google', '_blank', 'width=600,height=600,top=100,left=100, noopener,noreferrer');
};

// Replace handleGitHubLogin:
const handleGitHubLogin = () => {
  clearErrors('root');
  setOAuthLoading(true);
  localStorage.setItem('oauth-pending', 'true');
  window.open('/api/auth/github', '_blank', 'noopener,noreferrer');
}

  const socialButtons = [
    { 
      icon: FaGoogle, 
      label: 'Google', 
      color: 'hover:bg-red-600',
      onClick: handleGoogleLogin
    },
    { 
      icon: FaGithub, 
      label: 'GitHub', 
      color: 'hover:bg-gray-700',
      onClick: handleGitHubLogin
    },
    { 
      icon: FaLinkedin, 
      label: 'LinkedIn', 
      color: 'hover:bg-gray-800',
      onClick: () => console.log('LinkedIn login not implemented')
    }
  ];
  
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-400/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-green-600/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(rgba(34,197,94,0.03)_1px,transparent_1px)] [background-size:20px_20px]"></div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-blue rounded-2xl mb-4 shadow-lg">
            <ChatifyIcon/>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent mb-2">
            Chatify
          </h1>
          <p className="text-gray-400 text-sm">
            Welcome back - Sign in to continue your conversations
          </p>
        </div>
        
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-center mb-2">Sign In</h2>
            <p className="text-gray-400 text-center text-sm">Enter your credentials to access Chatify</p>
          </div>

          <div className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                <input
                  id="email"
                  {...register('email')}
                  type="email"
                  placeholder="n@example.com"
                  disabled={isSubmitting}
                  className={`w-full bg-gray-800 border ${errors.email ? 'border-red-500' : 'border-gray-700'} rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:opacity-50`}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                <input
                  id="password"
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
                  disabled={isSubmitting}
                  className={`w-full bg-gray-800 border ${errors.password ? 'border-red-500' : 'border-gray-700'} rounded-xl pl-11 pr-11 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:opacity-50`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  {...register('rememberMe')}
                  type="checkbox"
                  className="h-4 w-4 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-300">
                  Remember me
                </label>
              </div>
              <a href="#" className="text-sm text-green-400 hover:text-green-300 transition-colors">
                Forgot password?
              </a>
            </div>

            {/* Root error */}
            {errors.root && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                <p className="text-sm font-medium">{errors.root.message}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isLoading}
              className="w-full bg-gradient-to-r cursor-pointer from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-700"></div>
            <span className="px-4 text-sm text-gray-500">or continue with</span>
            <div className="flex-1 border-t border-gray-700"></div>
          </div>

          {/* Social login options */}
          <div className="grid grid-cols-3 gap-3">
            {socialButtons.map(({ icon: Icon, label, color, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={isOAuthLoading}
                className={`flex items-center justify-center p-3 border border-gray-700 rounded-xl bg-gray-800/50 hover:bg-gray-700 ${color} transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
                title={`Continue with ${label}`}
              >
              {isOAuthLoading ? (
                <LoadingSpinner/>
                  ) : (
                  <Icon size={20} />
                  )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-green-400 hover:text-green-300 font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
        
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/5 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -bottom-20 -left-20 w-32 h-32 bg-green-400/5 rounded-full blur-2xl animate-pulse" style={{animationDelay: '3s'}}></div>
      </div>
    </div>
  );
};

export default Login;