"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";



export default function Home() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const charCount = notes.length;
  const isReady = charCount >= 20 && charCount <= 50000;

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);


  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError("");
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-file", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse file");

      setNotes(data.text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setFileName("");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleGenerate() {
    if (!isReady) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      sessionStorage.setItem("noteforge_result", JSON.stringify(data));
      sessionStorage.setItem("noteforge_notes", notes);
      router.push("/results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const features = [
    {
      icon: "⚡",
      title: "Flashcards",
      description: "Flip through AI-generated cards that pull out the key terms and concepts from your notes.",
      span: "col-span-1",
    },
    {
      icon: "🧩",
      title: "Matching game",
      description: "Match terms to definitions in an interactive game.",
      span: "col-span-1",
    },
    {
      icon: "📝",
      title: "Multiple choice quiz",
      description: "Test your knowledge with auto-generated questions and four answer choices.",
      span: "col-span-1 md:col-span-2",
    },
    {
      icon: "📋",
      title: "Study guide",
      description: "A structured cheat sheet with sections, key definitions, and must-know facts — ready to review before any exam.",
      span: "col-span-1",
    },
    {
      icon: "💡",
      title: "Key concepts",
      description: "The most important ideas distilled into a scannable list.",
      span: "col-span-1",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "0 1.5rem",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Background orbs */}
      <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,124,255,0.08) 0%, transparent 70%)", animation: "float-orb 12s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "0%", right: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(100,80,255,0.06) 0%, transparent 70%)", animation: "float-orb 16s ease-in-out infinite reverse", pointerEvents: "none", zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "900px", margin: "0 auto", padding: "1.75rem 0", position: "relative", zIndex: 1 }}>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          note<span style={{ color: "var(--accent)" }}>forge</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user && (
            <button onClick={() => router.push("/decks")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", padding: "0.5rem 0.75rem" }}>
              My decks
            </button>
          )}
          {user ? (
            <button onClick={async () => { await supabase.auth.signOut(); setUser(null); }} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>
              Sign out
            </button>
          ) : (
            <button onClick={() => router.push("/auth")} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid rgba(124,124,255,0.3)", background: "rgba(124,124,255,0.08)", color: "var(--accent)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: "900px", margin: "0 auto", paddingTop: "5rem", paddingBottom: "5rem", position: "relative", zIndex: 1, textAlign: "center" }}>
        <div className="animate-fade-up delay-1" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(124,124,255,0.08)", border: "1px solid rgba(124,124,255,0.2)", borderRadius: "100px", padding: "0.35rem 1rem", marginBottom: "2rem", fontSize: "0.8rem", color: "var(--accent)", fontWeight: 500 }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
          Paste notes. Get study materials instantly.
        </div>

        <h1 className="animate-fade-up delay-2" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "clamp(2.5rem, 6vw, 4rem)", lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "1.25rem" }}>
          Turn your notes into<br />
          <span style={{ color: "var(--accent)" }}>a full study set</span>
        </h1>

        <p className="animate-fade-up delay-3" style={{ fontSize: "1.05rem", color: "var(--text-secondary)", maxWidth: "520px", margin: "0 auto 3rem", lineHeight: 1.7, fontWeight: 300 }}>
          Paste any lecture notes or upload a PDF, Word doc, or PowerPoint — NoteForge generates flashcards, quizzes, matching games, study guides, and summaries instantly.
        </p>

        {/* Input area */}
        <div className="animate-fade-up delay-4 glass" style={{ borderRadius: "18px", padding: "1.5rem", textAlign: "left" }}>

          {/* File name indicator */}
          {fileName && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(124,124,255,0.08)", borderRadius: "8px", fontSize: "0.8rem", color: "var(--accent)" }}>
              <span>📄</span>
              <span>{fileName}</span>
              <button onClick={() => { setFileName(""); setNotes(""); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}>×</button>
            </div>
          )}

          <textarea
            className="note-textarea"
            placeholder="Paste your notes here... or upload a file below."
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setFileName(""); }}
            rows={8}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.xlsx,.txt,.rtf"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing || loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text-secondary)",
                  fontSize: "0.82rem",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  padding: "0.5rem 0.9rem",
                  cursor: parsing || loading ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  opacity: parsing || loading ? 0.5 : 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(124,124,255,0.4)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                {parsing ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Parsing...
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload file
                  </>
                )}
              </button>

              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                PDF, DOCX, PPTX, XLSX, TXT
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.8rem", color: charCount > 50000 ? "#ff6b6b" : charCount >= 20 ? "var(--accent)" : "var(--text-muted)" }}>
                {charCount === 0 ? "Min 20 characters" : charCount > 50000 ? `Too long — ${charCount.toLocaleString()} / 50,000` : `${charCount.toLocaleString()} chars`}
              </span>

              <button className="btn-generate" onClick={handleGenerate} disabled={!isReady || loading || parsing}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Generating...
                  </span>
                ) : "Generate study set →"}
              </button>
            </div>
          </div>

          {error && <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#ff6b6b" }}>{error}</p>}
        </div>
      </section>

      {/* Bento features grid */}
      <section style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "6rem", position: "relative", zIndex: 1 }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500, marginBottom: "1.25rem" }}>
          What you get
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
          {features.map((f) => (
            <div key={f.title} className="glass" style={{ borderRadius: "16px", padding: "1.5rem", gridColumn: f.span.includes("col-span-2") ? "span 2" : "span 1" }}>
              <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.75rem" }}>{f.icon}</span>
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "0.4rem", letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, fontWeight: 300 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}