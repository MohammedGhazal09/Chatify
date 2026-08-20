import { useState, useEffect, useRef, type FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowRight, KeyRound, LoaderCircle } from "lucide-react";
import { FaGoogle, FaGithub, FaDiscord } from "react-icons/fa";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { loginSchema, type LoginFormData } from "../../utils/validationSchemas";
import ChatifyIcon from "../../components/chatifyIcon";
import axios, { AxiosError } from "axios";
import { useAuthStore } from "../../store/authstore";
import { useLogin, useVerifyTwoFactorLogin } from "../../hooks/useAuthQuery";
import { useAuthRedirect } from "../../hooks/useAuthRedirect";
import { resolveOAuthUrl } from "../../api/apiOrigin";
import type { TwoFactorChallengeData } from "../../types/auth";

type TwoFactorLoginState =
  | { kind: 'password'; version: number }
  | { kind: 'challenge'; version: number; challenge: TwoFactorChallengeData; email: string };

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorLoginState, setTwoFactorLoginState] = useState<TwoFactorLoginState>({
    kind: 'password',
    version: 0,
  });
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const loginChallengeRequestRef = useRef(0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const twoFactorChallenge = twoFactorLoginState.kind === 'challenge' ? twoFactorLoginState.challenge : null;
  const challengeEmail = twoFactorLoginState.kind === 'challenge' ? twoFactorLoginState.email : '';

  const setLoading = useAuthStore((state) => state.setLoading);

  const loginMutation = useLogin();
  const verifyTwoFactorLogin = useVerifyTwoFactorLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
    getValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  useAuthRedirect();
  // Handle OAuth callback and errors
  useEffect(() => {
    const authStatus = searchParams.get("auth");
    const error = searchParams.get("error");
    
    if (authStatus === "success") {
      // OAuth successful - check auth and redirect
      // Trigger auth check to update store
      window.location.href = '/';
    } else if (error) {
      try {
        const errorDetails = JSON.parse(decodeURIComponent(error));

        setError("root", {
          type: "manual",
          message: `${errorDetails.message} (Code: ${errorDetails.code})`,
        });
      } catch {
        // Fallback for simple error strings
        let errorMessage = "Authentication failed";
        
        switch (error) {
          case "oauth_error":
            errorMessage = "OAuth authentication error. Please try again.";
            break;
          case "oauth_failed":
            errorMessage = "OAuth authentication failed. Please try again.";
            break;
          case "auth_failed":
            errorMessage = "Failed to create session. Please try again.";
            break;
          default:
            errorMessage = `Authentication failed: ${error}`;
        }
        
        setError("root", {
          type: "manual",
          message: errorMessage,
        });
      }

      // Clean up URL
      navigate("/login", { replace: true });
    }
  }, [searchParams, navigate, setError, setLoading]);

  // form submission handler
  const onSubmit = async (data: LoginFormData) => {
    clearErrors("root");
    const requestId = loginChallengeRequestRef.current + 1;
    loginChallengeRequestRef.current = requestId;
    setTwoFactorLoginState({ kind: 'password', version: requestId });

    try {
    loginMutation.mutate(data, {
      onSuccess: (response) => {
        if (requestId !== loginChallengeRequestRef.current) {
          return;
        }

        if (response.data.status === 'mfa_required') {
          const challenge = response.data.data;
          const email = getValues('email');
          setTwoFactorCode('');
          setTwoFactorLoginState((current) => (
            current.version === requestId
              ? { kind: 'challenge', version: requestId, challenge, email }
              : current
          ));
        }
      },
      onError: (err: unknown | AxiosError) => {
        if (requestId !== loginChallengeRequestRef.current) {
          return;
        }

        let message = "Login failed";
        if (axios.isAxiosError(err))
          message = err.response?.data?.message || err.message;
        setError("root", { type: "manual", message });
      },
    })
  } catch (error) {
    setError("root", {
      type: "manual",
      message: error instanceof Error ? error.message : "Login failed",
    });
  }
    
  };

  const handleGoogleLogin = () => {
    clearErrors("root");
    window.location.href = resolveOAuthUrl('google');
  };

  const handleTwoFactorSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearErrors("root");

    if (!twoFactorChallenge) {
      setError("root", { type: "manual", message: "Two-factor challenge expired. Sign in again." });
      return;
    }

    verifyTwoFactorLogin.mutate(
      {
        challengeToken: twoFactorChallenge.challengeToken,
        code: twoFactorCode,
      },
      {
        onError: (err: unknown | AxiosError) => {
          let message = "Two-factor verification failed";
          if (axios.isAxiosError(err))
            message = err.response?.data?.message || err.message;
          setError("root", { type: "manual", message });
        },
      }
    );
  };

  const handleBackToPassword = () => {
    const nextVersion = loginChallengeRequestRef.current + 1;
    loginChallengeRequestRef.current = nextVersion;
    setTwoFactorLoginState({ kind: 'password', version: nextVersion });
    setTwoFactorCode('');
    clearErrors("root");
  };

  const handleGitHubLogin = () => {
    clearErrors("root");
    window.location.href = resolveOAuthUrl('github');
  };

  const handleDiscordLogin = () => {
    clearErrors("root");
    window.location.href = resolveOAuthUrl('discord');
  };

  const socialButtons = [
    {
      icon: FaGoogle,
      label: "Google",
      color: "hover:bg-red-600",
      onClick: handleGoogleLogin,
    },
    {
      icon: FaGithub,
      label: "GitHub",
      color: "hover:bg-gray-700",
      onClick: handleGitHubLogin,
    },
    {
      icon: FaDiscord,
      label: "Discord",
      color: "hover:bg-gray-800",
      onClick: handleDiscordLogin,
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-400/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-3/4 left-1/2 w-64 h-64 bg-green-600/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(rgba(34,197,94,0.03)_1px,transparent_1px)] [background-size:20px_20px]"></div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-blue rounded-2xl mb-4 shadow-lg">
            <ChatifyIcon />
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
            <h2 className="text-2xl font-bold text-center mb-2">
              {twoFactorChallenge ? 'Two-factor verification' : 'Sign In'}
            </h2>
            <p className="text-gray-400 text-center text-sm">
              {twoFactorChallenge
                ? 'Enter your authenticator code or a backup code'
                : 'Enter your credentials to access Chatify'}
            </p>
          </div>

          {twoFactorChallenge ? (
            <form key="two-factor-login" onSubmit={handleTwoFactorSubmit} className="space-y-6">
              {challengeEmail ? (
                <p className="rounded-xl border border-gray-800 bg-gray-800/60 px-4 py-3 text-sm text-gray-300">
                  {challengeEmail}
                </p>
              ) : null}

              <div className="space-y-2">
                <label
                  htmlFor="twoFactorCode"
                  className="block text-sm font-medium text-gray-300"
                >
                  Verification code
                </label>
                <div className="relative">
                  <KeyRound
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    size={18}
                  />
                  <input
                    id="twoFactorCode"
                    value={twoFactorCode}
                    onChange={(event) => setTwoFactorCode(event.target.value)}
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    placeholder="123456 or backup code"
                    disabled={verifyTwoFactorLogin.isPending}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {errors.root && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                  <p className="text-sm font-medium">{errors.root?.message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!twoFactorCode.trim() || verifyTwoFactorLogin.isPending}
                className="w-full bg-gradient-to-r cursor-pointer from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
              >
                {verifyTwoFactorLogin.isPending ? (
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                ) : (
                  <KeyRound size={18} />
                )}
                Verify
              </button>

              <button
                type="button"
                onClick={handleBackToPassword}
                disabled={verifyTwoFactorLogin.isPending}
                className="w-full cursor-pointer rounded-xl border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back to sign in
              </button>
            </form>
          ) : (
          <form key="password-login" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  size={18}
                />
                <input
                  id="email"
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="n@example.com"
                  disabled={isSubmitting}
                  className={`w-full bg-gray-800 border ${
                    errors.email ? "border-red-500" : "border-gray-700"
                  } rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:opacity-50`}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-sm mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  size={18}
                />
                <input
                  id="password"
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="********"
                  disabled={isSubmitting}
                  className={`w-full bg-gray-800 border ${
                    errors.password ? "border-red-500" : "border-gray-700"
                  } rounded-xl pl-11 pr-14 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:opacity-50`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="cursor-pointer absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-700/70 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                >
                  {showPassword ? (
                    <EyeOff className="cursor-pointer" size={18} />
                  ) : (
                    <Eye className="cursor-pointer" size={18} />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-sm mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label
                htmlFor="rememberMe"
                className="flex items-center cursor-pointer group"
              >
                <div className="relative">
                  <input
                    id="rememberMe"
                    {...register("rememberMe")}
                    type="checkbox"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-800 border-2 border-gray-700 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-green-600 peer-checked:border-green-500 transition-all duration-300"></div>
                  <div className="absolute top-1 left-1 w-4 h-4 bg-gray-600 rounded-full peer-checked:translate-x-5 peer-checked:bg-white transition-all duration-300 shadow-md pointer-events-none"></div>
                </div>
                <span className="ml-3 text-sm text-gray-400 group-hover:text-gray-200 transition-colors select-none">
                  Remember me for 30 days
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-green-400 hover:text-green-300 transition-colors font-medium"
              >
                Forgot password?
              </Link>
            </div>

            {/* Root error */}
            {errors.root && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                <p className="text-sm font-medium">{errors.root?.message}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || loginMutation.isPending}
              className="w-full bg-gradient-to-r cursor-pointer from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            </button>
          </form>
          )}

          {!twoFactorChallenge ? (
            <>
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
                    type="button"
                    onClick={onClick}
                    className={`flex items-center justify-center p-3 border border-gray-700 rounded-xl bg-gray-800/50 hover:bg-gray-700 ${color} transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
                    title={`Continue with ${label}`}
                    aria-label={`Continue with ${label}`}
                  >
                    <Icon size={20} />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-green-400 hover:text-green-300 font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>

        <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/5 rounded-full blur-2xl animate-pulse"></div>
        <div
          className="absolute -bottom-20 -left-20 w-32 h-32 bg-green-400/5 rounded-full blur-2xl animate-pulse"
          style={{ animationDelay: "3s" }}
        ></div>
      </div>
    </main>
  );
};

export default Login;
