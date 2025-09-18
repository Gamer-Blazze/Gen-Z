import { useState } from "react";
import { toast } from "sonner";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

export default function SignupDemo() {
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const parseSignupError = (err: unknown): string => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "You appear to be offline. Check your connection and try again.";
    }
    if (err instanceof Error) {
      const msg = err.message || "";
      const lower = msg.toLowerCase();
      if (lower.includes("429") || lower.includes("rate")) {
        return "Too many attempts. Please wait a minute and try again.";
      }
      if (lower.includes("network") || lower.includes("failed to fetch")) {
        return "Network issue. Please try again.";
      }
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) return String(parsed.error);
        if (parsed?.message) return String(parsed.message);
      } catch {
        // ignore
      }
      return "Something went wrong. Please try again.";
    }
    return "An unexpected error occurred. Please try again.";
  };

  const onBlurUsername = async () => {
    const value = username.trim().toLowerCase();
    if (!value) {
      setUsernameStatus("idle");
      return;
    }
    // reset any prior error
    if (error) setError(null);
    setUsernameStatus("checking");
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline");
      }
      const res = await fetch(`/check-username?username=${encodeURIComponent(value)}`, {
        method: "GET",
      });
      if (res.status === 429) {
        setUsernameStatus("error");
        setError("Too many checks. Please wait a bit and try again.");
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { available: boolean };
      setUsernameStatus(data.available ? "available" : "taken");
    } catch (e) {
      setUsernameStatus("error");
      const msg = parseSignupError(e);
      setError(msg);
      toast.error(msg);
    }
  };

  const canSubmit =
    username.trim().length >= 3 &&
    isValidEmail(email) &&
    password.trim().length >= 6 &&
    usernameStatus !== "checking" &&
    usernameStatus !== "taken" &&
    !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear previous error on new attempt
    setError(null);

    // Basic validations with inline feedback
    const u = username.trim();
    const p = password.trim();
    const em = email.trim();

    if (u.length < 3) {
      const msg = "Username must be at least 3 characters.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!isValidEmail(em)) {
      const msg = "Please enter a valid email address.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (p.length < 6) {
      const msg = "Password must be at least 6 characters.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (usernameStatus === "taken") {
      const msg = "This username is already taken.";
      setError(msg);
      toast.error(msg);
      return;
    }

    try {
      setSubmitting(true);
      // Simulate request latency
      await new Promise((r) => setTimeout(r, 800));
      toast.success("Signed up (demo). Wire this to your real signup API.");
      // Note: keep as demo – no navigation performed
    } catch (e) {
      const msg = parseSignupError(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold mb-4">Create your account (Demo)</h1>

        {/* Add: top-level error banner */}
        {error && (
          <div className="mb-3 rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-1.5 mb-4">
          <label className="text-sm font-medium">Username</label>
          <input
            type="text"
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="yourname"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameStatus !== "idle") setUsernameStatus("idle");
              if (error) setError(null);
            }}
            onBlur={onBlurUsername}
            maxLength={20}
            disabled={submitting}
            aria-invalid={username.trim().length > 0 && username.trim().length < 3 ? "true" : "false"}
          />
          {usernameStatus === "checking" && (
            <p className="text-xs text-muted-foreground">Checking availability…</p>
          )}
          {usernameStatus === "available" && (
            <p className="text-xs text-green-600">Available</p>
          )}
          {usernameStatus === "taken" && (
            <p className="text-xs text-red-500">
              This username is already taken, please choose another one.
            </p>
          )}
          {username.trim().length > 0 && username.trim().length < 3 && (
            <p className="text-xs text-red-500">At least 3 characters.</p>
          )}
          {usernameStatus === "error" && (
            <p className="text-xs text-red-500">Could not check availability. Try again.</p>
          )}
        </div>

        <div className="space-y-1.5 mb-4">
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            autoComplete="email"
            disabled={submitting}
            aria-invalid={email.length > 0 && !isValidEmail(email) ? "true" : "false"}
          />
          {email.length > 0 && !isValidEmail(email) && (
            <p className="text-xs text-red-500">Enter a valid email address.</p>
          )}
        </div>

        <div className="space-y-1.5 mb-6">
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            autoComplete="new-password"
            disabled={submitting}
            aria-invalid={password.length > 0 && password.length < 6 ? "true" : "false"}
          />
          <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          {password.length > 0 && password.length < 6 && (
            <p className="text-xs text-red-500">Password is too short.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-[#1877F2] px-3 py-2 font-medium text-white transition-colors hover:bg-[#166FE5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Sign up"}
        </button>
      </form>
    </div>
  );
}

// Example usage (place on any page to try it)
export function SignupDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4">
        <SignupDemo />
      </div>
    </div>
  );
}