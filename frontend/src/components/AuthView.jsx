import { useState } from "react";
import { api } from "../api";

export default function AuthView({ onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      return setError("Please enter a valid email address.");
    }
    if (password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await api.signup(email.trim(), password, name.trim());
      } else {
        await api.login(email.trim(), password);
      }
      await onAuthSuccess();
    } catch (err) {
      setError(err.message || "Failed to authenticate. Please check your credentials.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4 pt-safe pb-safe">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-paper shadow-2xl p-6 sm:p-8 animate-fade-in ring-1 ring-white/10">
        {/* Header */}
        <div className="text-center">
          <img
            src="/img/logo.png"
            alt="BurnRate"
            className="mx-auto h-16 w-16 rounded-2xl shadow-lg shadow-leaf/25"
          />
          <h1 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            BurnRate
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink/60">
            {mode === "login"
              ? "Welcome back! Log in to view your daily safe-to-spend."
              : "Create an account to start tracking category budgets."}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-6 grid grid-cols-2 rounded-2xl bg-mint p-1 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-xl py-2.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
              mode === "login" ? "bg-forest text-white shadow-sm" : "text-ink/60 hover:text-ink"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`rounded-xl py-2.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
              mode === "signup" ? "bg-forest text-white shadow-sm" : "text-ink/60 hover:text-ink"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <label className="block text-xs sm:text-sm font-semibold text-ink/80">
              Your Name (Optional)
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="mt-1.5 w-full rounded-2xl bg-mint px-4 py-3.5 text-sm font-medium placeholder:text-ink/30 focus:ring-2 focus:ring-leaf/40"
              />
            </label>
          )}

          <label className="block text-xs sm:text-sm font-semibold text-ink/80">
            Email Address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-2xl bg-mint px-4 py-3.5 text-sm font-medium placeholder:text-ink/30 focus:ring-2 focus:ring-leaf/40"
            />
          </label>

          <label className="block text-xs sm:text-sm font-semibold text-ink/80">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-2xl bg-mint px-4 py-3.5 text-sm font-medium placeholder:text-ink/30 focus:ring-2 focus:ring-leaf/40"
            />
          </label>

          {error && (
            <div className="rounded-xl bg-coral/10 p-3 text-xs sm:text-sm text-coral leading-relaxed font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-forest py-4 font-bold text-white shadow-md shadow-forest/20 transition active:scale-98 hover:bg-leaf disabled:opacity-50 text-sm sm:text-base mt-2"
          >
            {loading ? "Processing…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-black/5 text-center text-[11px] text-ink/50">
          <span>🔒 Multi-tenant secure database powered by Neon PostgreSQL</span>
        </div>
      </div>
    </div>
  );
}
