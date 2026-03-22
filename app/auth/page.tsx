"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Check your email for a confirmation link!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    }

    setLoading(false);
  }

  return (
    <main suppressHydrationWarning style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", position: "relative" }}>
      {/* Background orb */}
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,124,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.5rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            note<span style={{ color: "var(--accent)" }}>forge</span>
          </span>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Card */}
        <div className="glass" style={{ borderRadius: "20px", padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", padding: "0.75rem 1rem", outline: "none", transition: "border-color 0.2s ease" }}
              onFocus={e => e.target.style.borderColor = "rgba(124,124,255,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", padding: "0.75rem 1rem", outline: "none", transition: "border-color 0.2s ease" }}
              onFocus={e => e.target.style.borderColor = "rgba(124,124,255,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          {error && <p style={{ fontSize: "0.82rem", color: "#f87171" }}>{error}</p>}
          {message && <p style={{ fontSize: "0.82rem", color: "#4ade80" }}>{message}</p>}

          <button
            className="btn-generate"
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)" }}>
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 500 }}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}