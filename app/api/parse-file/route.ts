import { NextRequest, NextResponse } from "next/server";
import { parseOffice } from "officeparser";
import { extractText } from "unpdf";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let text = "";

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".pdf")) {
      const uint8Array = new Uint8Array(arrayBuffer);
      const { text: pages } = await extractText(uint8Array, { mergePages: true });
      text = Array.isArray(pages) ? pages.join(" ").trim() : String(pages).trim();
    } else if (
      fileName.endsWith(".docx") ||
      fileName.endsWith(".pptx") ||
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".rtf")
    ) {
      const ast = await parseOffice(buffer, { newlineDelimiter: " " });
      text = ast.toText().trim();
    } else if (fileName.endsWith(".txt")) {
      text = buffer.toString("utf-8").trim();
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    if (!text || text.length < 20) {
      return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("File parse error:", err);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}