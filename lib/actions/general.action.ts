"use server";

import { feedbackSchema } from "@/constants";
import { adminDb as db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { generateJson } from "@/lib/llm";

export async function getInterviewsByUserId(
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

  // Firestore forces the first orderBy onto the field used in a `!=` filter,
  // which would sort by userId instead of recency. So sort by date and drop
  // the user's own interviews in memory.
  const interviews = await db
    .collection("interviews")
    .orderBy("createdAt", "desc")
    .limit(userLimit * 3)
    .get();

  return interviews.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Interview)
    .filter((interview) => interview.finalized && interview.userId !== userId)
    .slice(0, userLimit);
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const doc = await db.collection("interviews").doc(id).get();

  return doc.exists ? ({ id: doc.id, ...doc.data() } as Interview) : null;
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, transcript } = params;

  // Identity comes from the session cookie, never from the client.
  const user = await getCurrentUser();
  if (!user) return { success: false };

  // Nothing to evaluate if the candidate never spoke.
  if (!transcript.some((message) => message.role === "user")) {
    return { success: false };
  }

  try {
    const formattedTranscript = transcript
      .map((sentence) => `- ${sentence.role}: ${sentence.content}\n`)
      .join("");

    const feedback = await generateJson(
      [
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
      feedbackSchema,
    );

    const doc = await db.collection("feedback").add({
      ...feedback,
      interviewId,
      userId: user.id,
      createdAt: new Date().toISOString(),
    });

    return { success: true, feedbackId: doc.id };
  } catch (error) {
    console.error("Error saving feedback", error);
    return { success: false };
  }
}

// Newest first. Sorted in memory (a user has only a handful of attempts per
// interview) so we don't need an extra composite Firestore index.
export async function getFeedbacksByInterviewId(
  params: GetFeedbackByInterviewIdParams,
): Promise<Feedback[]> {
  const { userId, interviewId } = params;

  const feedback = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .get();

  return feedback.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Feedback)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams,
): Promise<Feedback | null> {
  const [latest] = await getFeedbacksByInterviewId(params);
  return latest ?? null;
}
