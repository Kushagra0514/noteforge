"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";

type Flashcard = { front: string; back: string };
type QuizQuestion = { question: string; choices: string[]; answer: string };
type MatchingPair = { term: string; definition: string };
type StudyGuideSection = { heading: string; points: string[] };
type StudyGuide = {
  title: string;
  sections: StudyGuideSection[];
  definitions: { term: string; definition: string }[];
  mustKnow: string[];
};

type Result = {
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  matching: MatchingPair[];
  summary: string;
  keyConcepts: string[];
  studyGuide: StudyGuide;
};

const TABS = ["Flashcards", "Quiz", "Matching", "Study Guide", "Summary"] as const;
type Tab = (typeof TABS)[number];

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Flashcards");

  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const [quizIndex, setQuizIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDef, setSelectedDef] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const [shuffledDefs, setShuffledDefs] = useState<MatchingPair[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<jsPDF | null>(null);
  const [capturing, setCapturing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("noteforge_result");
    if (!raw) { router.push("/"); return; }
    const parsed = JSON.parse(raw) as Result;
    setResult(parsed);
    setShuffledDefs([...parsed.matching].sort(() => Math.random() - 0.5));
    }, [router]);

  useEffect(() => {
    if (previewOpen) {
        document.body.style.overflow = "hidden";
    } else {
        document.body.style.overflow = "";
    }
    return () => {
        document.body.style.overflow = "";
    };
    }, [previewOpen]);

  if (!result) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
    </div>
  );

  function handleTermClick(term: string) {
    if (matched.has(term)) return;
    setSelectedTerm(term === selectedTerm ? null : term);
    if (selectedDef) checkMatch(term, selectedDef);
  }

  function handleDefClick(pair: MatchingPair) {
    if (matched.has(pair.term)) return;
    setSelectedDef(pair.term === selectedDef ? null : pair.term);
    if (selectedTerm) checkMatch(selectedTerm, pair.term);
  }

  function checkMatch(term: string, defOwner: string) {
    if (term === defOwner) {
      setMatched(prev => new Set([...prev, term]));
      setSelectedTerm(null);
      setSelectedDef(null);
    } else {
      setWrongPair(`${term}||${defOwner}`);
      setTimeout(() => {
        setWrongPair(null);
        setSelectedTerm(null);
        setSelectedDef(null);
      }, 800);
    }
  }

  function resetMatching() {
    setMatched(new Set());
    setSelectedTerm(null);
    setSelectedDef(null);
    setWrongPair(null);
    setShuffledDefs([...result!.matching].sort(() => Math.random() - 0.5));
  }

  function handleAnswer(choice: string) {
    if (selected) return;
    setSelected(choice);
    if (choice === result!.quiz[quizIndex].answer) setScore(s => s + 1);
  }

  function nextQuestion() {
    if (quizIndex + 1 >= result!.quiz.length) { setQuizDone(true); return; }
    setQuizIndex(i => i + 1);
    setSelected(null);
  }

  function resetQuiz() {
    setQuizIndex(0);
    setSelected(null);
    setScore(0);
    setQuizDone(false);
  }
  async function handleSave() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const notes = sessionStorage.getItem("noteforge_notes") ?? "";
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result!.studyGuide?.title ?? "Untitled deck",
          notes,
          flashcards: result!.flashcards,
          quiz: result!.quiz,
          matching: result!.matching,
          summary: result!.summary,
          keyConcepts: result!.keyConcepts,
          studyGuide: result!.studyGuide,
          accessToken: session.access_token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

async function handleExportClick() {
  if (!result?.studyGuide) return;
  setCapturing(true);

  try {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const sg = result.studyGuide;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;
    const maxW = pageW - margin * 2;
    let y = margin;

    const INDIGO: [number, number, number] = [80, 70, 200];
    const BLACK: [number, number, number] = [20, 20, 30];
    const GRAY: [number, number, number] = [90, 90, 110];
    const LIGHT_GRAY: [number, number, number] = [230, 230, 240];
    const WHITE: [number, number, number] = [255, 255, 255];
    const INDIGO_LIGHT: [number, number, number] = [240, 240, 255];

    function checkPage(needed: number) {
      if (y + needed > pageH - margin) {
        doc.addPage();
        doc.setFillColor(...WHITE);
        doc.rect(0, 0, pageW, pageH, "F");
        doc.setFillColor(...INDIGO);
        doc.rect(0, 0, pageW, 10, "F");
        doc.setFontSize(8);
        doc.setTextColor(...WHITE);
        doc.setFont("helvetica", "bold");
        doc.text("noteforge", margin, 6.5);
        doc.setFont("helvetica", "normal");
        doc.text(sg.title, pageW - margin, 6.5, { align: "right" });
        y = 18;
      }
    }

    // White background
    doc.setFillColor(...WHITE);
    doc.rect(0, 0, pageW, pageH, "F");

    // Header stripe
    doc.setFillColor(...INDIGO);
    doc.rect(0, 0, pageW, 14, "F");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.text("noteforge — study guide", margin, 9);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString(), pageW - margin, 9, { align: "right" });

    y = 22;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(sg.title, maxW);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 2;

    // Indigo divider
    doc.setDrawColor(...INDIGO);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageW - margin, y);
    y += 7;

    // MUST KNOW
    checkPage(14);
    doc.setFillColor(...INDIGO);
    doc.roundedRect(margin - 1, y - 5, maxW + 2, 8, 2, 2, "F");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.text("MUST KNOW", margin + 2, y);
    y += 7;

    sg.mustKnow.forEach((fact, i) => {
      checkPage(9);
      doc.setFillColor(...INDIGO_LIGHT);
      const lines = doc.splitTextToSize(fact, maxW - 12);
      doc.roundedRect(margin - 1, y - 4, maxW + 2, lines.length * 5.2 + 4, 2, 2, "F");
      doc.setFontSize(9.5);
      doc.setTextColor(...INDIGO);
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}.`, margin + 2, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BLACK);
      doc.text(lines, margin + 10, y);
      y += lines.length * 5.2 + 5;
    });

    y += 4;

    // SECTIONS
    sg.sections.forEach((section) => {
      checkPage(16);
      doc.setFillColor(...INDIGO_LIGHT);
      doc.roundedRect(margin - 1, y - 5, maxW + 2, 9, 2, 2, "F");
      doc.setFillColor(...INDIGO);
      doc.rect(margin - 1, y - 5, 4, 9, "F");
      doc.setFontSize(10.5);
      doc.setTextColor(...INDIGO);
      doc.setFont("helvetica", "bold");
      doc.text(section.heading, margin + 6, y + 0.5);
      y += 10;

      section.points.forEach((point) => {
        checkPage(8);
        doc.setFontSize(9.5);
        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "normal");
        doc.text("•", margin + 3, y);
        doc.setTextColor(...BLACK);
        const lines = doc.splitTextToSize(point, maxW - 12);
        doc.text(lines, margin + 9, y);
        y += lines.length * 5 + 1.5;
      });

      y += 5;
      checkPage(4);
      doc.setDrawColor(...LIGHT_GRAY);
      doc.setLineWidth(0.3);
      doc.line(margin, y - 2, pageW - margin, y - 2);
    });

    y += 2;

    // DEFINITIONS
    checkPage(16);
    doc.setFillColor(...INDIGO);
    doc.roundedRect(margin - 1, y - 5, maxW + 2, 8, 2, 2, "F");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.text("KEY DEFINITIONS", margin + 2, y);
    y += 8;

    sg.definitions.forEach((def, idx) => {
      checkPage(10);
      const termLines = doc.splitTextToSize(def.term, maxW * 0.3);
      const defLines = doc.splitTextToSize(def.definition, maxW * 0.65);
      const rowH = Math.max(termLines.length, defLines.length) * 5 + 3;

      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 252);
        doc.rect(margin - 1, y - 4, maxW + 2, rowH, "F");
      }

      doc.setFontSize(9.5);
      doc.setTextColor(...INDIGO);
      doc.setFont("helvetica", "bold");
      doc.text(termLines, margin + 1, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BLACK);
      doc.text(defLines, margin + maxW * 0.34, y);
      y += rowH;
    });

    y += 4;

    // KEY CONCEPTS
    if (result.keyConcepts?.length) {
      checkPage(14);
      doc.setDrawColor(...LIGHT_GRAY);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setTextColor(...INDIGO);
      doc.setFont("helvetica", "bold");
      doc.text("KEY CONCEPTS", margin, y);
      y += 6;

      let x = margin;
      const pillH = 7;
      const pillPad = 4;

      result.keyConcepts.forEach((concept) => {
        doc.setFontSize(8.5);
        const w = doc.getTextWidth(concept) + pillPad * 2;
        if (x + w > pageW - margin) { x = margin; y += pillH + 3; checkPage(12); }
        doc.setFillColor(...INDIGO_LIGHT);
        doc.roundedRect(x, y - 5, w, pillH, 2, 2, "F");
        doc.setTextColor(...INDIGO);
        doc.setFont("helvetica", "normal");
        doc.text(concept, x + pillPad, y);
        x += w + 3;
      });

      y += 10;
    }

    // FOOTER
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LIGHT_GRAY);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.setFont("helvetica", "normal");
      doc.text("Generated by NoteForge", margin, pageH - 5);
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
    }

    // Build blob URL for preview
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);
    setPreviewPdf(doc);
    setPreviewImage(blobUrl);
    setTimeout(() => {
      setPreviewOpen(true);
    }, 50);

  } catch (err) {
    console.error("PDF generation error:", err);
  } finally {
    setCapturing(false);
  }
}

  function handleDownload() {
    if (!previewPdf || !result?.studyGuide) return;
    previewPdf.save(`${result.studyGuide.title.replace(/\s+/g, "_")}_study_guide.pdf`);
    if (previewImage) URL.revokeObjectURL(previewImage);
    setPreviewOpen(false);
    setPreviewImage(null);
  }

  const card = result.flashcards[cardIndex];
  const question = result.quiz[quizIndex];
  const matchingDone = matched.size === result.matching.length;

  return (
    <main style={{ minHeight: "100vh", padding: "0 1.5rem", position: "relative", overflowX: "hidden" }}>
      <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,124,255,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* PDF Preview Modal */}
      {previewOpen && (
        <div
            onClick={() => {
            if (previewImage) URL.revokeObjectURL(previewImage);
            setPreviewOpen(false);
            setPreviewImage(null);
            }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", backdropFilter: "blur(8px)" }}
        >
            <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#0e0e1a", border: "1px solid rgba(124,124,255,0.2)", borderRadius: "20px", padding: "1.5rem", maxWidth: "640px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: "1.25rem", overflowY: "auto" }}
            >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)" }}>Ready to download</p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Review your study guide before saving</p>
                </div>
                <button
                onClick={() => {
                    if (previewImage) URL.revokeObjectURL(previewImage);
                    setPreviewOpen(false);
                    setPreviewImage(null);
                }}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", width: "32px", height: "32px", cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                ×
                </button>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {[
                `${result?.studyGuide?.mustKnow?.length ?? 0} must-know facts`,
                `${result?.studyGuide?.sections?.length ?? 0} sections`,
                `${result?.studyGuide?.definitions?.length ?? 0} definitions`,
                `${result?.keyConcepts?.length ?? 0} key concepts`,
                ].map(item => (
                <span key={item} style={{ padding: "0.3rem 0.8rem", borderRadius: "100px", background: "rgba(124,124,255,0.08)", border: "1px solid rgba(124,124,255,0.2)", color: "var(--accent)", fontSize: "0.78rem" }}>
                    {item}
                </span>
                ))}
            </div>

            {/* Content preview */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "500px", overflowY: "auto" }}>

                {/* Title */}
                <div style={{ borderBottom: "1px solid rgba(124,124,255,0.2)", paddingBottom: "0.75rem" }}>
                    <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)" }}>{result?.studyGuide?.title}</p>
                </div>

                {/* Must know */}
                <div>
                    <p style={{ fontSize: "0.7rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "0.75rem" }}>⚡ Must know</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {result?.studyGuide?.mustKnow?.map((fact, i) => (
                        <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                        <span style={{ color: "var(--accent)", fontSize: "0.78rem", fontWeight: 700, flexShrink: 0, marginTop: "0.1rem" }}>{i + 1}.</span>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{fact}</p>
                        </div>
                    ))}
                    </div>
                </div>

                {/* Sections */}
                {result?.studyGuide?.sections?.map((section, i) => (
                    <div key={i}>
                    <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)", marginBottom: "0.5rem", borderLeft: "3px solid rgba(124,124,255,0.5)", paddingLeft: "0.6rem" }}>{section.heading}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {section.points.map((point, j) => (
                        <div key={j} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                            <span style={{ color: "rgba(124,124,255,0.5)", marginTop: "0.5rem", flexShrink: 0, width: "3px", height: "3px", borderRadius: "50%", background: "rgba(124,124,255,0.5)", display: "inline-block" }} />
                            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{point}</p>
                        </div>
                        ))}
                    </div>
                    </div>
                ))}

                {/* Definitions */}
                <div>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "0.75rem" }}>Key definitions</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {result?.studyGuide?.definitions?.map((def, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.75rem", alignItems: "flex-start" }}>
                        <p style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 600, fontFamily: "'Sora', sans-serif" }}>{def.term}</p>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{def.definition}</p>
                        </div>
                    ))}
                    </div>
                </div>

                {/* Key concepts */}
                {result?.keyConcepts?.length > 0 && (
                    <div>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "0.75rem" }}>Key concepts</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {result?.keyConcepts?.map((concept, i) => (
                        <span key={i} style={{ padding: "0.3rem 0.8rem", borderRadius: "100px", background: "rgba(124,124,255,0.08)", border: "1px solid rgba(124,124,255,0.2)", color: "var(--accent)", fontSize: "0.78rem" }}>
                            {concept}
                        </span>
                        ))}
                    </div>
                    </div>
                )}

                </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                onClick={() => {
                    if (previewImage) URL.revokeObjectURL(previewImage);
                    setPreviewOpen(false);
                    setPreviewImage(null);
                }}
                style={{ padding: "0.65rem 1.25rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", cursor: "pointer" }}
                >
                Cancel
                </button>
                <button className="btn-generate" onClick={handleDownload}>
                Download PDF
                </button>
            </div>
            </div>
        </div>
        )}

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
          {result.flashcards.length} cards · {result.quiz.length} questions
        </span>
        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: "8px", border: `1px solid ${saved ? "rgba(34,197,94,0.3)" : "rgba(124,124,255,0.3)"}`, background: saved ? "rgba(34,197,94,0.08)" : "rgba(124,124,255,0.08)", color: saved ? "#4ade80" : "var(--accent)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 500, cursor: saving || saved ? "default" : "pointer", transition: "all 0.2s ease" }}
        >
          {saved ? "✓ Saved" : saving ? "Saving..." : "Save deck"}
        </button>
      </nav>

      {/* Tab bar */}
      <div style={{ maxWidth: "860px", margin: "0 auto 2rem", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", gap: "0.25rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: "12px", padding: "0.25rem", overflowX: "auto" }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "0.6rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", fontWeight: 500, whiteSpace: "nowrap", transition: "all 0.2s ease", background: activeTab === tab ? "var(--accent)" : "transparent", color: activeTab === tab ? "#fff" : "var(--text-secondary)" }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", paddingBottom: "6rem", position: "relative", zIndex: 1 }}>

        {/* FLASHCARDS */}
        {activeTab === "Flashcards" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{cardIndex + 1} / {result.flashcards.length} · click card to flip</p>
            <div onClick={() => setFlipped(f => !f)} style={{ width: "100%", maxWidth: "580px", height: "260px", cursor: "pointer", perspective: "1000px" }}>
              <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.5s ease", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
                <div className="glass" style={{ position: "absolute", inset: 0, borderRadius: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", backfaceVisibility: "hidden" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "1rem" }}>Question</span>
                  <p style={{ fontFamily: "'Sora', sans-serif", fontSize: "1.2rem", fontWeight: 600, color: "var(--text-primary)", textAlign: "center", lineHeight: 1.4 }}>{card.front}</p>
                </div>
                <div className="glass" style={{ position: "absolute", inset: 0, borderRadius: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "rgba(124,124,255,0.06)", borderColor: "rgba(124,124,255,0.2)" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "1rem" }}>Answer</span>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "1rem", color: "var(--text-primary)", textAlign: "center", lineHeight: 1.6 }}>{card.back}</p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button onClick={() => { setCardIndex(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={cardIndex === 0} style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", cursor: cardIndex === 0 ? "not-allowed" : "pointer", opacity: cardIndex === 0 ? 0.4 : 1 }}>← Prev</button>
              <button onClick={() => { setFlipped(false); setCardIndex(0); }} style={{ padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", cursor: "pointer" }}>Reset</button>
              <button onClick={() => { setCardIndex(i => Math.min(result.flashcards.length - 1, i + 1)); setFlipped(false); }} disabled={cardIndex === result.flashcards.length - 1} style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", cursor: cardIndex === result.flashcards.length - 1 ? "not-allowed" : "pointer", opacity: cardIndex === result.flashcards.length - 1 ? 0.4 : 1 }}>Next →</button>
            </div>
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem", marginTop: "1rem" }}>
              {result.flashcards.map((fc, i) => (
                <div key={i} onClick={() => { setCardIndex(i); setFlipped(false); }} className="glass" style={{ borderRadius: "10px", padding: "0.75rem 1rem", cursor: "pointer", borderColor: i === cardIndex ? "rgba(124,124,255,0.4)" : "var(--border)" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{fc.front}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUIZ */}
        {activeTab === "Quiz" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
            {quizDone ? (
              <div className="glass" style={{ borderRadius: "20px", padding: "3rem", textAlign: "center", maxWidth: "520px", width: "100%" }}>
                <p style={{ fontFamily: "'Sora', sans-serif", fontSize: "3rem", fontWeight: 800, color: "var(--accent)", marginBottom: "0.5rem" }}>{score}/{result.quiz.length}</p>
                <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>{score === result.quiz.length ? "Perfect score! 🎉" : score >= result.quiz.length / 2 ? "Good job! Keep studying." : "Keep practicing — you've got this."}</p>
                <button className="btn-generate" onClick={resetQuiz}>Try again</button>
              </div>
            ) : (
              <>
                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Question {quizIndex + 1} of {result.quiz.length}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--accent)" }}>Score: {score}</p>
                </div>
                <div style={{ width: "100%", height: "3px", background: "var(--border)", borderRadius: "2px" }}>
                  <div style={{ height: "100%", width: `${(quizIndex / result.quiz.length) * 100}%`, background: "var(--accent)", borderRadius: "2px", transition: "width 0.3s ease" }} />
                </div>
                <div className="glass" style={{ borderRadius: "20px", padding: "2rem", width: "100%" }}>
                  <p style={{ fontFamily: "'Sora', sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1.5rem", lineHeight: 1.5 }}>{question.question}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {question.choices.map((choice) => {
                      const isCorrect = choice === question.answer;
                      const isSelected = choice === selected;
                      let bg = "rgba(255,255,255,0.02)";
                      let borderColor = "var(--border)";
                      let color = "var(--text-secondary)";
                      if (selected) {
                        if (isCorrect) { bg = "rgba(34,197,94,0.1)"; borderColor = "rgba(34,197,94,0.4)"; color = "#4ade80"; }
                        else if (isSelected) { bg = "rgba(239,68,68,0.1)"; borderColor = "rgba(239,68,68,0.4)"; color = "#f87171"; }
                      }
                      return (
                        <button key={choice} onClick={() => handleAnswer(choice)} style={{ padding: "0.9rem 1.25rem", borderRadius: "10px", border: `1px solid ${borderColor}`, background: bg, color, fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", textAlign: "left", cursor: selected ? "default" : "pointer", transition: "all 0.2s ease" }}>
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                  {selected && (
                    <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                      <button className="btn-generate" onClick={nextQuestion}>
                        {quizIndex + 1 >= result.quiz.length ? "See results" : "Next →"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* MATCHING */}
        {activeTab === "Matching" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Click a term then its matching definition</p>
              <button onClick={resetMatching} style={{ padding: "0.4rem 0.9rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", cursor: "pointer" }}>Shuffle</button>
            </div>
            {matchingDone && (
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "12px" }}>
                <p style={{ color: "#4ade80", fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>All matched! 🎉</p>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>Terms</p>
                {result.matching.map((pair) => {
                  const isMatched = matched.has(pair.term);
                  const isSelected = selectedTerm === pair.term;
                  const isWrong = wrongPair?.startsWith(pair.term);
                  return (
                    <button key={pair.term} onClick={() => handleTermClick(pair.term)} style={{ padding: "0.9rem 1rem", borderRadius: "10px", border: `1px solid ${isWrong ? "rgba(239,68,68,0.5)" : isMatched ? "rgba(34,197,94,0.3)" : isSelected ? "rgba(124,124,255,0.5)" : "var(--border)"}`, background: isWrong ? "rgba(239,68,68,0.08)" : isMatched ? "rgba(34,197,94,0.06)" : isSelected ? "rgba(124,124,255,0.1)" : "rgba(255,255,255,0.02)", color: isMatched ? "#4ade80" : isSelected ? "var(--accent)" : "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", textAlign: "left", cursor: isMatched ? "default" : "pointer", transition: "all 0.2s ease", opacity: isMatched ? 0.6 : 1 }}>
                      {pair.term}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>Definitions</p>
                {shuffledDefs.map((pair) => {
                  const isMatched = matched.has(pair.term);
                  const isSelected = selectedDef === pair.term;
                  const isWrong = wrongPair?.endsWith(pair.term);
                  return (
                    <button key={pair.term} onClick={() => handleDefClick(pair)} style={{ padding: "0.9rem 1rem", borderRadius: "10px", border: `1px solid ${isWrong ? "rgba(239,68,68,0.5)" : isMatched ? "rgba(34,197,94,0.3)" : isSelected ? "rgba(124,124,255,0.5)" : "var(--border)"}`, background: isWrong ? "rgba(239,68,68,0.08)" : isMatched ? "rgba(34,197,94,0.06)" : isSelected ? "rgba(124,124,255,0.1)" : "rgba(255,255,255,0.02)", color: isMatched ? "#4ade80" : isSelected ? "var(--accent)" : "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", textAlign: "left", cursor: isMatched ? "default" : "pointer", transition: "all 0.2s ease", opacity: isMatched ? 0.6 : 1 }}>
                      {pair.definition}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STUDY GUIDE */}
        {activeTab === "Study Guide" && result.studyGuide && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.5rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{result.studyGuide.title}</h2>
              <button
                onClick={handleExportClick}
                disabled={capturing}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.1rem", borderRadius: "8px", border: "1px solid rgba(124,124,255,0.3)", background: "rgba(124,124,255,0.08)", color: "var(--accent)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 500, cursor: capturing ? "not-allowed" : "pointer", opacity: capturing ? 0.6 : 1, transition: "all 0.2s ease" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,124,255,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(124,124,255,0.08)")}
              >
                {capturing ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export PDF
                  </>
                )}
              </button>
            </div>

            <div className="glass" style={{ borderRadius: "16px", padding: "1.5rem", borderColor: "rgba(124,124,255,0.2)", background: "rgba(124,124,255,0.04)" }}>
              <p style={{ fontSize: "0.72rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "1rem" }}>⚡ Must know</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {result.studyGuide.mustKnow.map((fact, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.8rem", marginTop: "0.15rem", flexShrink: 0 }}>{i + 1}.</span>
                    <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.6 }}>{fact}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.studyGuide.sections.map((section, i) => (
              <div key={i} className="glass" style={{ borderRadius: "16px", padding: "1.5rem" }}>
                <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "0.75rem", borderLeft: "3px solid var(--accent)", paddingLeft: "0.75rem" }}>{section.heading}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {section.points.map((point, j) => (
                    <div key={j} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <span style={{ color: "var(--text-muted)", marginTop: "0.55rem", flexShrink: 0, width: "4px", height: "4px", borderRadius: "50%", background: "var(--text-muted)", display: "inline-block" }} />
                      <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="glass" style={{ borderRadius: "16px", padding: "1.5rem" }}>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "1rem" }}>Key definitions</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {result.studyGuide.definitions.map((def, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "1rem", alignItems: "flex-start" }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600, fontFamily: "'Sora', sans-serif" }}>{def.term}</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{def.definition}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUMMARY */}
        {activeTab === "Summary" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="glass" style={{ borderRadius: "16px", padding: "2rem" }}>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "1rem" }}>Summary</p>
              <p style={{ fontSize: "1rem", color: "var(--text-primary)", lineHeight: 1.8, fontWeight: 300 }}>{result.summary}</p>
            </div>
            <div className="glass" style={{ borderRadius: "16px", padding: "2rem" }}>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "1rem" }}>Key concepts</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {result.keyConcepts.map((concept, i) => (
                  <span key={i} style={{ padding: "0.4rem 0.9rem", borderRadius: "100px", background: "rgba(124,124,255,0.08)", border: "1px solid rgba(124,124,255,0.2)", color: "var(--accent)", fontSize: "0.82rem", fontWeight: 500 }}>
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}