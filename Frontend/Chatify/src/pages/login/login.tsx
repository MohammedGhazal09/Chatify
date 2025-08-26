import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ChatifyIcon from "../../components/chatifyIcon";
import AccountsButton from "../../components/accountsButton";
import { useAuth } from "../../hooks/useAuth";
import { useAuthRedirect } from "../../hooks/useAuthRedirect";
import { loginSchema, type LoginFormData } from "../../utils/validationSchemas";

const Login = () => {
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  useAuthRedirect();

  const onSubmit = async (data: LoginFormData) => {
    clearErrors("root");

    try {
      await login(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError("root", {
        type: "manual",
        message,
      });
    }
  };

  const inputStyle: string = "text-black text-2xl border-black border-2 rounded p-2 w-full"
  const labelStyle: string = "text-black text-2xl font-bold"
  const errorStyle: string = "text-red-600 text-lg mt-1";

  return (
    <div className="bg-[#d3e2f1] h-screen flex items-center justify-center text-white">
      <div className="bg-[#ffffff] p-8 rounded-lg shadow-lg flex flex-col items-center box-">
        <div className="w-24 h-24 mb-4">
          <ChatifyIcon />
        </div>
        <h1 className={`${labelStyle} mb-5`}>Login</h1>
        <h3 className={`${labelStyle} mb-5`}>Sign in to your account</h3>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-2 w-full"
          style={{ width: '100%' }}
        >
          <div>
            <label className={labelStyle}>Email</label>
            <input
              className={`${inputStyle} placeholder:text-[20px] ${
                errors.email ? "border-red-500" : ""
              }`}
              {...register("email")}
              type="email"
              placeholder="n@example.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className={errorStyle}>{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className={labelStyle}>Password</label>
            <input
              className={`${inputStyle} ${
                errors.password ? "border-red-500" : ""
              }`}
              {...register("password")}
              type="password"
              placeholder="********"
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className={errorStyle}>{errors.password.message}</p>
            )}
          </div>

          {errors.root && <p className={errorStyle}>{errors.root.message}</p>}

          <AccountsButton color="#20b551" text={isSubmitting ? "Logging in..." : "Login"} disabled={isSubmitting} />

          <p className="text-black text-2xl mt-4"> Do not have an account?{" "}
            <a href="/signup" className="text-black underline font-bold">
              Signup
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
