"use server";

import { feedbackSchema } from "@/constants";
import { adminDb as db } from "@/firebase/admin";
import { google } from "@/lib/utils";
import { generateText, Output } from "ai";

export async function getInerviewsByUserId(
  userId: string,
): Promise<Interview[] | null> {
  if (!userId) return null;

  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams,
): Promise<Interview[] | null> {
  const { userId, limit: userLimit = 20 } = params;

  if (!userId) return null;

  const interviews = await db
    .collection("interviews")
    .where("finalized", "==", true)
    .where("userId", "!=", userId)
    .orderBy("userId")
    .orderBy("createdAt", "desc")
    .limit(userLimit)
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interviews = await db.collection("interviews").doc(id).get();

  return interviews.data() as Interview | null;
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`,
      )
      .join("");

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
              role: "system",
              content:
                "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed. Do not be lenient — point out mistakes and areas for improvement clearly.",
            },
            {
              role: "user",
              content: `Transcript:
${formattedTranscript}

Score the candidate from 0 to 100 in exactly these five categories (use these exact names, do not add others):
- Communication Skills: clarity, articulation, structured responses.
- Technical Knowledge: understanding of key concepts for the role.
- Problem-Solving: ability to analyze problems and propose solutions.
- Cultural & Role Fit: alignment with company values and job role.
- Confidence & Clarity: confidence in responses, engagement, and clarity.

Respond with ONLY valid JSON in exactly this shape:
{
  "totalScore": number,
  "categoryScores": [
    { "name": "Communication Skills", "score": number, "comment": "string" },
    { "name": "Technical Knowledge", "score": number, "comment": "string" },
    { "name": "Problem-Solving", "score": number, "comment": "string" },
    { "name": "Cultural & Role Fit", "score": number, "comment": "string" },
    { "name": "Confidence & Clarity", "score": number, "comment": "string" }
  ],
  "strengths": ["string"],
  "areasForImprovement": ["string"],
  "finalAssessment": "string"
}`,
            },
          ],
        }),
      },
    );

    const data = await response.json();
    console.log("Served by:", data.provider);
    console.log("OpenRouter feedback latency:", performance.now() - start);

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenRouter request failed");
    }

    const raw = data.choices[0].message.content;
    const {
      totalScore,
      categoryScores,
      strengths,
      areasForImprovement,
      finalAssessment,
    } = feedbackSchema.parse(JSON.parse(raw));

    const feedback = await db.collection("feedback").add({
      interviewId,
      userId,
      totalScore,
      categoryScores,
      strengths,
      areasForImprovement,
      finalAssessment,
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      feedbackId: feedback.id,
    };
  } catch (error) {
    console.error("Error saving feedback", error);
    return {
      success: false,
    };
  }
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams,
): Promise<Feedback | null> {
  const { userId, interviewId } = params;

  const feedback = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (feedback.empty) return null;

  const feedbackDoc = feedback.docs[0];
  return {
    id: feedbackDoc.id,
    ...feedbackDoc.data(),
  } as Feedback;
}
