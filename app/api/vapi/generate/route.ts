export const maxDuration = 60;
import { adminDb as db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { z } from "zod";

const questionsSchema = z.object({
  questions: z.array(z.string()),
});

export async function POST(request: Request) {
  const { role, level, techstack, type, amount, userid } = await request.json();

  try {
    const start = performance.now();

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-8b-instruct",
          provider: { order: ["Groq"], allow_fallbacks: true },
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: `Prepare ${amount} interview questions for a job interview.
              Role: ${role}. Level: ${level}. Tech stack: ${techstack}. Focus: ${type}.
              These will be read aloud by a voice assistant — no slashes, asterisks, or special characters.
              Respond with ONLY valid JSON in this exact shape: {"questions": ["Question 1", "Question 2"]}`,
            },
          ],
        }),
      },
    );

    const data = await response.json();
    console.log("Served by:", data.provider);
    console.log("OpenRouter latency:", performance.now() - start);

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenRouter request failed");
    }

    const raw = data.choices[0].message.content;
    const parsed = questionsSchema.parse(JSON.parse(raw));

    const interview = {
      role,
      type,
      level,
      techstack: techstack.split(","),
      questions: parsed.questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("generate error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
