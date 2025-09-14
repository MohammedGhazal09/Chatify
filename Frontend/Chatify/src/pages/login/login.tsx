import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Github, Apple, Chrome } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../hooks/useAuth';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import { signupSchema, type SignupFormData } from '../../utils/validationSchemas';
import ChatifyIcon from '../../components/chatifyIcon';
import axios from 'axios';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { signup } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange'
  });

  useAuthRedirect();

  const onSubmit = async (data: SignupFormData) => {
    clearErrors('root');

    try {
      await signup(data);
    } catch (err: unknown) {
      let message = 'Signup failed';
      
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.message || err.message || 'Signup failed';
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      setError('root', { 
        type: 'manual', 
        message 
      });
    }
  };

  const socialButtons = [
    { icon: Chrome, label: 'Google', color: 'hover:bg-red-600' },
    { icon: Github, label: 'GitHub', color: 'hover:bg-gray-700' },
    { icon: Apple, label: 'Apple', color: 'hover:bg-gray-800' }
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl mb-4 shadow-lg shadow-green-500/25">
            <ChatifyIcon/>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent mb-2">
            ChatFlow
          </h1>
          <p className="text-gray-400 text-sm">
            Get started for free - Join the next generation of messaging
          </p>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-center mb-2">Create Account</h2>
            <p className="text-gray-400 text-center text-sm">Sign up to get started with ChatFlow</p>
          </div>

              {/* First name  */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="block text-sm font-medium text-white">
                  First Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    id="firstName"
                    {...register('firstName')}
                    type="text"
                    placeholder="Ahmed"
                    disabled={isSubmitting}
                    className={`w-full bg-gray-800 border ${errors.firstName ? 'border-red-500' : 'border-gray-700'} rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:opacity-50`}
                  />
                </div>
                {errors.firstName && (
                  <p className="text-red-400 text-sm mt-1">{errors.firstName.message}</p>
                )}
              </div>

              {/* Last name */}
              <div className="space-y-2">
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-300">
                  Last Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    id="lastName"
                    {...register('lastName')}
                    type="text"
                    placeholder="Musa"
                    disabled={isSubmitting}
                    className={`w-full bg-gray-800 border ${errors.lastName ? 'border-red-500' : 'border-gray-700'} rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:opacity-50`}
                  />
                </div>
                {errors.lastName && (
                  <p className="text-red-400 text-sm mt-1">{errors.lastName.message}</p>
                )}
              </div>
            </div>

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

            {/* Password  */}
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

            {/* Root error */}
            {errors.root && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                <p className="text-sm font-medium">{errors.root.message}</p>
              </div>
            )}

            {/* Submit sec */}
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r cursor-pointer from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

          {/* BR */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-700"></div>
            <span className="px-4 text-sm text-gray-500">or continue with</span>
            <div className="flex-1 border-t border-gray-700"></div>
          </div>

          {/* Login options */}
          <div className="grid grid-cols-3 gap-3">
            {socialButtons.map(({ icon: Icon, label, color }) => (
              <button
                key={label}
                className={`flex items-center justify-center p-3 border border-gray-700 rounded-xl bg-gray-800/50 hover:bg-gray-700 ${color} transition-all transform hover:scale-105 active:scale-95`}
                title={`Continue with ${label}`}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <a
              href="/login"
              className="text-green-400 hover:text-green-300 font-medium transition-colors"
            >
              Sign in
            </a>
          </p>
        </div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/5 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -bottom-20 -left-20 w-32 h-32 bg-green-400/5 rounded-full blur-2xl animate-pulse" style={{animationDelay: '3s'}}></div>
      </div>
    </div>
  );
};

export default Login;