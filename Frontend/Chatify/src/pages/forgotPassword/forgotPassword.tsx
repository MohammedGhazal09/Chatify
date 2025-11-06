import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Key, ArrowLeft } from "lucide-react";
import ChatifyIcon from "../../components/chatifyIcon";
import axios from "axios";
import {
  useForgotPassword,
  useVerifyResetCode,
  useResetPassword,
} from "../../hooks/useAuthQuery";
import { useForm } from "react-hook-form";

type Step = "email" | "code" | "password";
type EmailFormData = { email?: string };
type CodeFormData = { email?: string; code?: string };
type PasswordFormData = {
  email?: string;
  code?: string;
  newPassword?: string;
  confirmPassword?: string;
};
const ForgotPassword = () => {
  const step = useRef<Step>("email");
  const responseMsg = useRef<string>("");
  const navigate = useNavigate();
  const forgotPasswordMutation = useForgotPassword();
  const verifyResetCodeMutation = useVerifyResetCode();
  const resetPasswordMutation = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<EmailFormData | CodeFormData | PasswordFormData>({
    mode: "onChange",
  });

  const handleSendCode = async (data: EmailFormData) => {
    clearErrors("root");
    forgotPasswordMutation.mutate(data.email!, {
      onSuccess: (response) => {
        responseMsg.current =
          response.data?.message?.toString() || "Reset code sent";
        step.current = "code";
      },
      onError: (err: unknown) => {
        if (axios.isAxiosError(err)) {
          setError("root", {
            type: "manual",
            message: err.response?.data?.message || "Failed to send reset code",
          });
        }
      },
    });
  };

  const handleVerifyCode = async (data: CodeFormData) => {
    clearErrors("root");
    verifyResetCodeMutation.mutate(
      { email: data.email!, code: data.code! },
      {
        onSuccess: () => {
          step.current = "password";
        },
        onError: (err: unknown) => {
          if (axios.isAxiosError(err)) {
            setError("root", {
              type: "manual",
              message: err.response?.data?.message || "Invalid or expired code",
            });
          }
        },
      }
    );
  };

  const handleResetPassword = async (data: PasswordFormData) => {
    clearErrors("root");
    if (data.newPassword !== data.confirmPassword) {
      setError("root", {
        type: "manual",
        message: "Passwords do not match",
      });
      return;
    }
    resetPasswordMutation.mutate(
      { email: data.email!, code: data.code!, newPassword: data.newPassword! },
      {
        onSuccess: () => {
          navigate("/login");
        },
        onError: (err: unknown) => {
          console.log(err)
          console.log(axios.isAxiosError(err));
          if (axios.isAxiosError(err)) {
            setError("root", {
              type: "manual",
              message:
                err.response?.data?.message || "Failed to reset password",
            });
          }
        },
      }
    );
  };
  
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects - same as login */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-400/5 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-blue rounded-2xl mb-4 shadow-lg">
            <ChatifyIcon />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
            Reset Password
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            {step.current === "email" &&
              "Enter your email to receive a reset code"}
            {step.current === "code" &&
              "Enter the 6-digit code sent to your email"}
            {step.current === "password" && "Create your new password"}
          </p>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {/* Step indicator */}
          <div className="flex justify-center mb-8 space-x-2">
            <div
              className={`h-2 w-16 rounded-full ${
                step.current === "email" ? "bg-green-500" : "bg-gray-700"
              }`}
            ></div>
            <div
              className={`h-2 w-16 rounded-full ${
                step.current === "code" ? "bg-green-500" : "bg-gray-700"
              }`}
            ></div>
            <div
              className={`h-2 w-16 rounded-full ${
                step.current === "password" ? "bg-green-500" : "bg-gray-700"
              }`}
            ></div>
          </div>

          {errors.root && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6">
              <p className="text-sm">{errors.root?.message}</p>
            </div>
          )}

          {/* Email Step */}
          {step.current === "email" && (
            <form onSubmit={handleSubmit(handleSendCode)} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    size={18}
                  />
                  <input
                    type="email"
                    {...register("email", { required: true })}
                    placeholder="you@example.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>Send Reset Code</>
                )}
              </button>
            </form>
          )}

          {/* Code Step */}
          {step.current === "code" && (
            <form
              onSubmit={handleSubmit(handleVerifyCode)}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Verification Code
                </label>
                <div className="relative">
                  <Key
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    size={18}
                  />
                  <input
                    type="text"
                    {...register("code", {
                      required: true,
                      onChange: (event) => {
                        event.target.value = event.target.value.replace(/\D/g, "");
                      },
                    })}
                    placeholder="123456"
                    required
                    maxLength={6}
                    className="scrollbar-none overflow-hidden w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-center text-2xl tracking-wider"
                  />
                </div>
              </div>
              {responseMsg.current && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl mb-6">
                  <p className="text-sm">{responseMsg.current}</p>
                </div>
              )}

              <p className="text-sm text-gray-400 text-center">
                Code expires in 5 minutes
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                ) : (
                  "Verify Code"
                )}
              </button>

              <button
                type="button"
                onClick={() => (step.current = "email")}
                className="hover:underline cursor-pointer w-full text-gray-400 hover:text-gray-300 text-sm"
              >
                Didn't receive code? Try again
              </button>
            </form>
          )}

          {/* Password Step */}
          {step.current === "password" && (
            <form
              onSubmit={handleSubmit(handleResetPassword)}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  New Password
                </label>
                <div className="relative">
                  <Lock
                    className="z-10 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    size={18}
                  />
                  <input
                    type={"password"}
                    {...register("newPassword", {
                      required: true,
                    })}
                    minLength={8}
                    placeholder="********"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    size={18}
                  />
                  <input
                    type={"password"}
                    {...register("confirmPassword", {
                    })}
                    required
                    minLength={8}
                    placeholder="********"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                ) : (
                  "Reset Password"
                )}
              </button>
            </form>
          )}

          {/* Back to login */}
          <button
            onClick={() => navigate("/login")}
            className="hover:underline cursor-pointer mt-6 w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-300 text-sm"
          >
            <ArrowLeft size={16} />
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
