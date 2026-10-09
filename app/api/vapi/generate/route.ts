export const maxDuration = 60;
import { adminDb as db } from "@/firebase/admin";
import { generateJson } from "@/lib/llm";
import { getRandomInterviewCover } from "@/lib/utils";
import { z } from "zod";

const requestSchema = z.object({
  role: z.string().min(1),
  level: z.string().min(1),
  techstack: z.string().min(1),
  type: z.string().min(1),
  amount: z.coerce.number().int().min(1).max(15),
  userid: z.string().min(1),
});

const questionsSchema = z.object({
  questions: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  // Optional shared secret so only the Vapi tool call can create interviews.
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-vapi-secret") !== secret) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }
  const { role, level, techstack, type, amount, userid } = input.data;

  try {
    const { questions } = await generateJson(
      [
        {
          role: "user",
          content: `Prepare ${amount} interview questions for a job interview.
Role: ${role}. Level: ${level}. Tech stack: ${techstack}. Focus: ${type}.
These will be read aloud by a voice assistant — no slashes, asterisks, or special characters.
Respond with ONLY valid JSON in this exact shape: {"questions": ["Question 1", "Question 2"]}`,
        },
      ],
      questionsSchema,
    );

    await db.collection("interviews").add({
      role,
      type,
      level,
      techstack: techstack.split(",").map((tech) => tech.trim()),
      questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    });

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
