import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const aiSchema = z.object({
  action: z.enum([
    "summarize",
    "rewrite",
    "improve",
    "action-items",
    "translate",
    "explain",
  ]),
  text: z.string().min(1, "Text content is required"),
  targetLanguage: z.string().optional(),
});

// Initialize Gemini API Client
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(geminiApiKey);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure Gemini API Key is configured
  if (!geminiApiKey) {
    return NextResponse.json(
      { error: "AI assistant key (GEMINI_API_KEY) is not configured on the server." },
      { status: 501 }
    );
  }

  try {
    const json = await req.json();
    const payload = aiSchema.parse(json);

    let systemPrompt = "";
    switch (payload.action) {
      case "summarize":
        systemPrompt =
          "Summarize the following document content comprehensively and concisely. Use clear bullet points and bold headers where appropriate to present a professional overview.";
        break;
      case "rewrite":
        systemPrompt =
          "Rewrite the following text to enhance its clarity, tone, and flow while keeping the core meaning. Do not write introductory explanations like 'Here is your text'; output ONLY the rewritten content.";
        break;
      case "improve":
        systemPrompt =
          "Correct any grammatical, spelling, or punctuation errors in the text, and refine its prose style to be more professional. Do not write introductory explanations; output ONLY the improved text.";
        break;
      case "action-items":
        systemPrompt =
          "Extract all key action items, tasks, deadlines, and decisions from the text below. Present them in a neat, checkbox-friendly format (`- [ ] Task`).";
        break;
      case "translate":
        const lang = payload.targetLanguage || "Spanish";
        systemPrompt = `Translate the following text accurately into ${lang}. Output ONLY the translated text without notes or comments.`;
        break;
      case "explain":
        systemPrompt =
          "Provide a clear, detailed, and educational explanation of the concepts, words, or ideas described in the following text. Use markdown for headings and formatting.";
        break;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Return a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await model.generateContentStream({
            contents: [
              {
                role: "user",
                parts: [
                  { text: `${systemPrompt}\n\nContent:\n${payload.text}` },
                ],
              },
            ],
          });

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              controller.enqueue(encoder.encode(chunkText));
            }
          }
        } catch (streamError) {
          console.error("AI Stream Generation Error:", streamError);
          controller.enqueue(
            encoder.encode("\n[Error: Failed to stream AI generation]")
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("AI api error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
