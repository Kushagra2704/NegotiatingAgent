"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; role?: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setCurrentUser({ email: session.user.email ?? "", role: profile?.role });
      }
      setCheckingSession(false);
    });
  }, []);

  async function continueAsCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const role = currentUser?.role;
    if (next !== "/") { router.replace(next); return; }
    router.replace(role === "host" ? "/host/negotiations" : "/");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setCurrentUser(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If the caller gave an explicit next param, honour it.
    // Otherwise route based on profile role: hosts go to their dashboard.
    if (next !== "/") {
      router.replace(next);
      return;
    }

    const userId = authData.session?.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile?.role === "host") {
        router.replace("/host/negotiations");
        return;
      }
    }

    router.replace("/");
  }

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-airbnb-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* Already signed in banner */}
        {currentUser && (
          <div className="mb-6 bg-airbnb-bg border border-airbnb-border rounded-2xl p-4">
            <p className="text-xs text-airbnb-gray mb-1">Currently signed in as</p>
            <p className="text-sm font-semibold text-airbnb-dark truncate">{currentUser.email}</p>
            <p className="text-xs text-airbnb-gray capitalize mb-3">{currentUser.role ?? "guest"}</p>
            <div className="flex gap-2">
              <button
                onClick={continueAsCurrentUser}
                className="flex-1 bg-airbnb-pink text-white text-xs font-semibold py-2.5 rounded-xl"
              >
                Continue
              </button>
              <button
                onClick={signOut}
                className="flex-1 border border-airbnb-border text-airbnb-dark text-xs font-semibold py-2.5 rounded-xl"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold text-airbnb-dark mb-1">
          {currentUser ? "Sign in with another account" : "Sign in to NegotiateAI"}
        </h1>
        <p className="text-sm text-airbnb-gray mb-8">
          {currentUser ? "Enter credentials below to switch accounts." : "Use your account credentials."}
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-airbnb-dark block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full border border-airbnb-border rounded-xl px-4 py-3 text-sm text-airbnb-dark placeholder:text-airbnb-light focus:outline-none focus:border-airbnb-dark"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-airbnb-dark block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full border border-airbnb-border rounded-xl px-4 py-3 text-sm text-airbnb-dark placeholder:text-airbnb-light focus:outline-none focus:border-airbnb-dark"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-airbnb-pink text-white font-semibold py-4 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-xs text-airbnb-gray text-center mt-6">
          Demo: guest@negotiateai.dev · host@negotiateai.dev
        </p>
      </div>
    </div>
  );
}
