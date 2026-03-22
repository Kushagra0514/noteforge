"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Deck = {
  id: string;
  title: string;
  created_at: string;
  flashcards: unknown[];
  quiz: unknown[];
  matching: unknown[];
  summary: string;
  key_concepts: string[];
  study_guide: unknown;
  notes: string;
};

export default function DecksPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function loadDecks() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const res = await fetch("/api/decks", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.decks) setDecks(data.decks);
      setLoading(false);
    }
    loadDecks();
  }, [router]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("decks")
        .delete()
        .eq("id", id);

      if (!error) setDecks(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(null);
    }
  }

  function handleOpen(deck: Deck) {
    const result = {
      flashcards: deck.flashcards,
      quiz: deck.quiz,
      matching: deck.matching,
      summary: deck.summary,
      keyConcepts: deck.key_concepts,
      studyGuide: deck.study_guide,
    };
    sessionStorage.setItem("noteforge_result", JSON.stringify(result));
    sessionStorage.setItem("noteforge_notes", deck.notes ?? "");
    router.push("/results");
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  return (
    <main style={{ minHeight: "100vh", padding: "0 1.5rem", position: "relative", overflowX: "hidden" }}>
      <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,124,255,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "860px", margin: "0 auto", padding: "1.75rem 0", position: "relative", zIndex: 1 }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          Back
        </button>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          note<span style={{ color: "var(--accent)" }}>forge</span>
        </span>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {decks.length} saved {decks.length === 1 ? "deck" : "decks"}
        </span>
      </nav>

      <section style={{ maxWidth: "860px", margin: "0 auto", paddingBottom: "6rem", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.75rem", color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>Your decks</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>All your saved study sets in one place</p>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
            <p style={{ color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif" }}>Loading your decks...</p>
          </div>
        ) : decks.length === 0 ? (
          <div className="glass" style={{ borderRadius: "20px", padding: "4rem", textAlign: "center" }}>
            <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>No saved decks yet</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>Generate a study set and hit "Save deck" to see it here</p>
            <button className="btn-generate" onClick={() => router.push("/")}>Generate a study set</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {decks.map(deck => (
              <div key={deck.id} className="glass" style={{ borderRadius: "16px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", cursor: "pointer" }} onClick={() => handleOpen(deck)}>
                <div>
                  <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "0.4rem", lineHeight: 1.4 }}>{deck.title}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatDate(deck.created_at)}</p>
                </div>

                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {[
                    `${deck.flashcards?.length ?? 0} cards`,
                    `${deck.quiz?.length ?? 0} questions`,
                    `${deck.matching?.length ?? 0} matches`,
                  ].map(stat => (
                    <span key={stat} style={{ padding: "0.2rem 0.6rem", borderRadius: "100px", background: "rgba(124,124,255,0.08)", border: "1px solid rgba(124,124,255,0.15)", color: "var(--accent)", fontSize: "0.72rem" }}>
                      {stat}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                  <button
                    onClick={e => { e.stopPropagation(); handleOpen(deck); }}
                    className="btn-generate"
                    style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }}
                  >
                    Study →
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(deck.id); }}
                    disabled={deleting === deck.id}
                    style={{ background: "none", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "rgba(239,68,68,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.78rem", padding: "0.5rem 0.75rem", cursor: deleting === deck.id ? "not-allowed" : "pointer", transition: "all 0.2s ease" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"}
                  >
                    {deleting === deck.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}