import { z } from "zod";

// Llama 3.1 8B served by Groq through OpenRouter: fast enough for a voice-app
// hand-off, and JSON mode keeps the output parseable.
export async function generateJson<T extends z.ZodTypeAny>(
  messages: { role: "system" | "user"; content: string }[],
  schema: T,
): Promise<z.infer<T>> {
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
        messages,
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenRouter request failed");
  }

  return schema.parse(JSON.parse(data.choices[0].message.content));
}
