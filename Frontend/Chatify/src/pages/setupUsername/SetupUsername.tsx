import { useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { AtSign, ArrowRight } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import ChatifyIcon from '../../components/chatifyIcon';
import { useSetUsername } from '../../hooks/useAuthQuery';
import { useAuthStore } from '../../store/authstore';
import {
  type UsernameSetupFormData,
  usernameSetupSchema,
} from '../../utils/validationSchemas';

const SetupUsername = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUsernameMutation = useSetUsername();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<UsernameSetupFormData>({
    resolver: zodResolver(usernameSetupSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (user?.username) {
      navigate('/', { replace: true });
    }
  }, [navigate, user?.username]);

  const onSubmit = async (data: UsernameSetupFormData) => {
    clearErrors('root');
    clearErrors('username');

    setUsernameMutation.mutate(data.username, {
      onSuccess: () => {
        navigate('/', { replace: true });
      },
      onError: (err: unknown | AxiosError) => {
        let message = 'Username could not be saved';
        let fieldError = false;

        if (axios.isAxiosError(err)) {
          message = err.response?.data?.message || message;
          fieldError = [400, 409].includes(err.response?.status ?? 0);
        }

        if (fieldError) {
          setError('username', { type: 'server', message });
          return;
        }

        setError('root', { type: 'manual', message });
      },
    });
  };

  const isBusy = isSubmitting || setUsernameMutation.isPending;

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(rgba(34,197,94,0.03)_1px,transparent_1px)] [background-size:20px_20px]"></div>

      <section className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-blue rounded-2xl mb-4 shadow-lg">
            <ChatifyIcon />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent mb-2">
            Chatify
          </h1>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-center mb-2">Choose your username</h2>
            <p className="text-gray-400 text-center text-sm">
              Pick the name people will use to find you in Chatify.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="setup-username" className="block text-sm font-medium text-gray-300">
                Username
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                <input
                  id="setup-username"
                  {...register('username')}
                  type="text"
                  placeholder="ahmed.musa"
                  disabled={isBusy}
                  aria-invalid={errors.username ? 'true' : 'false'}
                  aria-describedby="setup-username-helper setup-username-error"
                  className={`w-full bg-gray-800 border ${errors.username ? 'border-red-500' : 'border-gray-700'} rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:opacity-50`}
                />
              </div>
              <p id="setup-username-helper" className="text-gray-500 text-sm mt-1">
                Use 3-24 letters, numbers, dots, or underscores.
              </p>
              {errors.username && (
                <p id="setup-username-error" className="text-red-400 text-sm mt-1">
                  {errors.username.message}
                </p>
              )}
            </div>

            {errors.root && (
              <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                <p className="text-sm font-medium">{errors.root.message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="w-full bg-gradient-to-r cursor-pointer from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              {isBusy ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                  <span>Saving username</span>
                </>
              ) : (
                <>
                  Save username
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default SetupUsername;
