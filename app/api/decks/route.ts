import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { title, notes, flashcards, quiz, matching, summary, keyConcepts, studyGuide, accessToken } = await req.json();

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { data, error } = await supabase
      .from("decks")
      .insert({
        user_id: user.id,
        title,
        notes,
        flashcards,
        quiz,
        matching,
        summary,
        key_concepts: keyConcepts,
        study_guide: studyGuide,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ deck: data });
  } catch (err) {
    console.error("Save deck error:", err);
    return NextResponse.json({ error: "Failed to save deck" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const accessToken = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!accessToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ decks: data });
  } catch (err) {
    console.error("Get decks error:", err);
    return NextResponse.json({ error: "Failed to get decks" }, { status: 500 });
  }
}