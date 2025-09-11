import { useState } from "react";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

export default function SignupDemo() {
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onBlurUsername = async () => {
    const value = username.trim().toLowerCase();
    if (!value) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    try {
      const res = await fetch(`/check-username?username=${encodeURIComponent(value)}`);
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as { available: boolean };
      setUsernameStatus(data.available ? "available" : "taken");
    } catch {
      setUsernameStatus("error");
    }
  };

  const canSubmit =
    username.trim().length >= 3 &&
    email.trim().length > 0 &&
    password.trim().length >= 6 &&
    usernameStatus !== "checking" &&
    usernameStatus !== "taken" &&
    !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mock handler: in your real app, call your signup API
    try {
      setSubmitting(true);
      // Simulate request latency
      await new Promise((r) => setTimeout(r, 800));
      alert("Signed up (mock). In your app, wire to real signup.");
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
            }}
            onBlur={onBlurUsername}
            maxLength={20}
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
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5 mb-6">
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">At least 6 characters.</p>
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
