import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, Eye, EyeOff } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function Auth({ redirectAfterAuth = "/dashboard" }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Determine redirect target (URL param has priority)
  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get("redirect") || redirectAfterAuth;

  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectTarget, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirectTarget]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const email = emailInput.trim();
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!isValidEmail) {
        setError("Please enter a valid email address.");
        setIsLoading(false);
        return;
      }
      if (authMode === "signup") {
        if (passwordInput.length < 6) {
          setError("Password must be at least 6 characters.");
          setIsLoading(false);
          return;
        }
        if (passwordInput !== confirmPasswordInput) {
          setError("Passwords do not match.");
          setIsLoading(false);
          return;
        }
      }
      // Email/password UI funnels into passwordless email-otp sign in (your auth provider)
      const formData = new FormData();
      formData.set("email", email);
      await signIn("email-otp", formData);
      setStep({ email });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again."
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);

      console.log("signed in");

      const redirect = redirectTarget;
      navigate(redirect, { replace: true });
    } catch (error) {
      console.error("OTP verification error:", error);

      setError("The verification code you entered is incorrect.");
      setIsLoading(false);

      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting anonymous sign in...");
      await signIn("anonymous");
      console.log("Anonymous sign in successful");
      const redirect = redirectTarget;
      navigate(redirect, { replace: true });
    } catch (error) {
      console.error("Guest login error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setError(`Failed to sign in as guest: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5] dark:bg-background">
      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center justify-center h-full flex-col">
        <Card className="min-w-[350px] pb-0 border shadow-md">
          {step === "signIn" ? (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center">
                  <img
                    src="https://harmless-tapir-303.convex.cloud/api/storage/727632b6-864f-4391-bc86-06526cee36c6"
                    alt="Lock Icon"
                    width={64}
                    height={64}
                    className="rounded-lg mb-4 mt-4 cursor-pointer"
                    onClick={() => navigate("/")}
                  />
                </div>
                <CardTitle className="text-xl">
                  {authMode === "login" ? "Welcome back" : "Create your account"}
                </CardTitle>
                <CardDescription>
                  {authMode === "login"
                    ? "Login with your email and password"
                    : "Sign up with your name, email, and password"}
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleEmailSubmit}>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-1 rounded-lg p-1 bg-muted">
                    <button
                      type="button"
                      className={`py-2 rounded-md text-sm transition ${
                        authMode === "login"
                          ? "bg-background shadow font-medium"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => {
                        setAuthMode("login");
                        setError(null);
                      }}
                      aria-pressed={authMode === "login"}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={`py-2 rounded-md text-sm transition ${
                        authMode === "signup"
                          ? "bg-background shadow font-medium"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => {
                        setAuthMode("signup");
                        setError(null);
                      }}
                      aria-pressed={authMode === "signup"}
                    >
                      Sign Up
                    </button>
                  </div>

                  {/* Email */}
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      className="pl-9"
                      disabled={isLoading}
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                  </div>

                  {/* Password (shown for both modes for consistent UI) */}
                  <div className="relative">
                    <Input
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      disabled={isLoading}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Confirm Password (signup only) */}
                  {authMode === "signup" && (
                    <div className="relative">
                      <Input
                        placeholder="Confirm password"
                        type={showConfirmPassword ? "text" : "password"}
                        disabled={isLoading}
                        required
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        minLength={6}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Forgot password (info only since passwordless auth) */}
                  {authMode === "login" && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setError(
                            "Password reset is not required. We use secure passwordless login via email code."
                          )
                        }
                        className="text-sm underline text-muted-foreground hover:text-foreground"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  {/* Error */}
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </CardContent>

                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    variant="default"
                    disabled={isLoading}
                    className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {authMode === "login" ? "Logging in..." : "Creating account..."}
                      </>
                    ) : (
                      <>
                        {authMode === "login" ? "Login" : "Sign Up"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {/* Toggle between modes */}
                  <div className="text-sm text-muted-foreground">
                    {authMode === "login" ? (
                      <>
                        Don&apos;t have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("signup");
                            setError(null);
                          }}
                          className="underline hover:text-primary"
                        >
                          Sign Up
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("login");
                            setError(null);
                          }}
                          className="underline hover:text-primary"
                        >
                          Login
                        </button>
                      </>
                    )}
                  </div>

                  {/* Social placeholder area */}
                  <div className="w-full pt-2">
                    <div className="relative text-center my-2 text-xs text-muted-foreground">
                      <span className="px-2 bg-card relative z-10">Or continue with</span>
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-border" />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          setError("Social logins will be available soon. Use email to continue.")
                        }
                      >
                        Google
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          setError("Social logins will be available soon. Use email to continue.")
                        }
                      >
                        Facebook
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground text-center">
                      We use secure passwordless login. You&apos;ll receive a 6‑digit code by email.
                    </p>
                  </div>
                </CardFooter>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center mt-4">
                <CardTitle>Check your email</CardTitle>
                <CardDescription>
                  We've sent a code to {step.email}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          // Find the closest form and submit it
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-500 text-center">
                      {error}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Didn't receive a code?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setStep("signIn")}
                    >
                      Try again
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify code
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Use different email
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">
            Secured by{" "}
            <a
              href="https://gen-z.vly.site/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              gen-z.vly.site
            </a>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}