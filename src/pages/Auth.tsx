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
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { toast } from "sonner";

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
  const [otpTouched, setOtpTouched] = useState(false);
  const otpIsValid = /^\d{6}$/.test(otp);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailIsValid = isValidEmail(emailInput.trim());
  const canSend = !isLoading && emailInput.trim().length > 0 && emailIsValid;

  // Add resend cooldown state (seconds)
  const [resendCooldown, setResendCooldown] = useState(0);

  // Add: Centralized auth error parser for consistent user-facing messages
  const parseAuthError = (err: unknown): string => {
    // Offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "You appear to be offline. Check your connection and try again.";
    }
    // Error objects
    if (err instanceof Error) {
      const msg = err.message || "";
      const lower = msg.toLowerCase();

      // Common cases: rate limit or too many attempts
      if (lower.includes("429") || lower.includes("rate")) {
        return "Too many attempts. Please wait a minute and try again.";
      }
      // Invalid code
      if (lower.includes("invalid") || lower.includes("code") || lower.includes("otp")) {
        return "The verification code is invalid or expired. Request a new one and try again.";
      }
      // Convex warmup / index issues (rare)
      if (lower.includes("index") || lower.includes("not found")) {
        return "Service is warming up. Please try again in a few seconds.";
      }

      // Sometimes backend returns a JSON string in the message
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.response?.data?.error) return String(parsed.response.data.error);
        if (parsed?.message) return String(parsed.message);
      } catch {
        // no-op
      }

      return "Something went wrong. Please try again.";
    }
    // Unknown
    return "An unexpected error occurred. Please try again.";
  };

  // Countdown effect for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // Form ref to auto-submit OTP when valid
  const otpFormRef = useRef<HTMLFormElement | null>(null);

  const resendCode = async (email: string) => {
    if (resendCooldown > 0) {
      toast(`Please wait ${resendCooldown}s before resending.`);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email);
      await signIn("email-otp", formData);
      setResendCooldown(60);
      toast("Verification code sent");
    } catch (e) {
      const msg = parseAuthError(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

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
      const email = emailInput.trim().toLowerCase();
      const isValidEmailLocal = isValidEmail(email);
      if (!isValidEmailLocal) {
        setEmailTouched(true);
        setError("Please enter a valid email address.");
        setIsLoading(false);
        return;
      }
      const formData = new FormData();
      formData.set("email", email);
      await signIn("email-otp", formData);
      setStep({ email });
      setResendCooldown(60);
      toast("We sent you a 6‑digit code.");
      setIsLoading(false);
    } catch (e) {
      const msg = parseAuthError(e);
      setError(msg);
      toast.error(msg);
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otpIsValid) {
      setOtpTouched(true);
      const msg = "Enter the 6-digit code sent to your email.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);

      const redirect = redirectTarget;
      navigate(redirect, { replace: true });
    } catch (e) {
      // Prefer specific invalid code text; fall back to parsed message otherwise
      const parsed = parseAuthError(e);
      const msg = parsed.includes("invalid or expired")
        ? "The verification code you entered is incorrect or expired."
        : parsed;
      setError(msg);
      toast.error(msg);
      setIsLoading(false);
      setOtp("");
      setOtpTouched(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      const redirect = redirectTarget;
      navigate(redirect, { replace: true });
    } catch (e) {
      const msg = parseAuthError(e);
      setError(msg);
      toast.error(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5] dark:bg-background">
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
                  Use your email to continue
                </CardTitle>
                <CardDescription>
                  Enter your email to receive a 6‑digit verification code
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleEmailSubmit}>
                <CardContent className="space-y-3">
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
                      inputMode="email"
                      autoComplete="email"
                      spellCheck={false}
                      aria-invalid={emailTouched && !emailIsValid ? "true" : "false"}
                      aria-describedby={emailTouched && !emailIsValid ? "email-error" : undefined}
                      pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                      maxLength={254}
                      onBlur={() => setEmailTouched(true)}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase();
                        setEmailInput(val);
                        // Clear top-level error as user edits
                        if (error) setError(null);
                      }}
                    />
                  </div>

                  {/* Inline email validation message */}
                  {emailTouched && !emailIsValid && (
                    <p id="email-error" role="alert" className="text-xs text-red-500">
                      Enter a valid email address (e.g., name@example.com).
                    </p>
                  )}

                  {/* Error */}
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </CardContent>

                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    variant="default"
                    disabled={!canSend}
                    className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send code
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {/* Social placeholder area */}
                  <div className="w-full pt-2">
                    <div className="relative text-center my-2 text-xs text-muted-foreground">
                      <span className="px-2 bg-card relative z-10">Or continue with</span>
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-border" />
                    </div>
                    <div className="flex gap-2">
                      {/* Google button (placeholder with brand styling) */}
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 bg-white text-black border hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                        onClick={() => toast("Google sign-in is coming soon")}
                        disabled={isLoading}
                      >
                        <span className="mr-2 inline-flex items-center">
                          {/* Google G icon */}
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.1-1.7 3.2-5.5 3.2-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 4 1.5l2.7-2.7C16.9 2.3 14.7 1.4 12 1.4 6.8 1.4 2.6 5.6 2.6 10.8S6.8 20.2 12 20.2c7.1 0 9.3-5 9.3-7.5 0-.5-.1-.9-.1-1.3H12z"/>
                          </svg>
                        </span>
                        Continue with Google
                      </Button>

                      {/* Facebook button (placeholder) */}
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 bg-[#1877F2] hover:bg-[#166FE5] text-white"
                        onClick={() => toast("Facebook sign-in is coming soon")}
                        disabled={isLoading}
                      >
                        Continue with Facebook
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground text-center">
                      You'll receive a 6‑digit code by email.
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
                  We've sent a 6‑digit code to {step.email}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit} ref={otpFormRef}>
                <CardContent className="pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={(val) => {
                        const digitsOnly = val.replace(/\D/g, "").slice(0, 6);
                        setOtp(digitsOnly);
                        if (!otpTouched && digitsOnly.length > 0) setOtpTouched(true);
                        // Auto-submit when 6 digits and not loading
                        if (digitsOnly.length === 6 && !isLoading) {
                          // Defer a tick to let hidden input sync
                          setTimeout(() => {
                            otpFormRef.current?.requestSubmit();
                          }, 0);
                        }
                        if (error) setError(null);
                      }}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
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

                  {/* Inline OTP validation message */}
                  {!otpIsValid && otpTouched && (
                    <p className="mt-2 text-xs text-red-500 text-center">
                      Enter a valid 6-digit code.
                    </p>
                  )}

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
                      onClick={() => resendCode(step.email)}
                      disabled={isLoading || resendCooldown > 0}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
                    disabled={isLoading || !otpIsValid}
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
                    onClick={() => {
                      setStep("signIn");
                      setOtp("");
                      setOtpTouched(false);
                      setError(null);
                    }}
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