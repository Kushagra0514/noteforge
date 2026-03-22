import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { notes } = await req.json();

  if (!notes || notes.trim().length < 20) {
    return NextResponse.json({ error: "Notes too short" }, { status: 400 });
  }

  if (notes.length > 50000) {
    return NextResponse.json({ error: "Notes too long" }, { status: 400 });
  }

  const prompt = `You are a study assistant. Given the following notes, generate study materials in this exact JSON format and nothing else:

{
  "flashcards": [
    { "front": "question or term", "back": "answer or definition" }
  ],
  "quiz": [
    {
      "question": "question text",
      "choices": ["A", "B", "C", "D"],
      "answer": "correct choice exactly as written in choices"
    }
  ],
  "matching": [
    { "term": "term", "definition": "definition" }
  ],
  "summary": "2-3 sentence summary of the notes",
  "keyConcepts": ["concept 1", "concept 2", "concept 3"],
  "studyGuide": {
    "title": "topic title",
    "sections": [
      {
        "heading": "section heading",
        "points": ["key point 1", "key point 2"]
      }
    ],
    "definitions": [
      { "term": "term", "definition": "concise definition" }
    ],
    "mustKnow": ["critical fact 1", "critical fact 2"]
  }
}

Generate at least 15 flashcards, 10 quiz questions, 8 matching pairs, 5 key concepts, 6 study guide sections with at least 5 bullet points each, 10 definitions, and 6 must-know facts. Make the study guide sections clearly labeled with descriptive headings that reflect the actual topics in the notes. Be thorough and detailed — the user needs this to study for an exam.
NOTES:
${notes}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "stepfun/step-3.5-flash:free",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return NextResponse.json({ error: "No response from AI" }, { status: 500 });
  }

  try {
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
  }
}