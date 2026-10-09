"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createVapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";
import { toast } from "sonner";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const Agent = ({
  userName,
  userId,
  type,
  interviewId,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const vapiRef = useRef<ReturnType<typeof createVapi> | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  // The effect below re-runs whenever messages change; this stops a late
  // transcript from creating a second feedback document.
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    const vapi = createVapi();
    vapiRef.current = vapi;

    const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
    const onCallEnd = () => setCallStatus(CallStatus.FINISHED);

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };

        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);

    const onError = (error: Error) => {
      console.error("Vapi error", error);
      toast.error("The call ran into a problem. Please try again.");
      setCallStatus(CallStatus.INACTIVE);
      setIsSpeaking(false);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
      vapiRef.current = null;
    };
  }, []);

  const handleGenerateFeedback = async (messages: SavedMessage[]) => {
    if (!messages.some((message) => message.role === "user")) {
      toast.error("No answers were recorded, so there is nothing to evaluate.");
      router.push("/");
      return;
    }

    const { success, feedbackId: id } = await createFeedback({
      interviewId: interviewId!,
      transcript: messages,
    });

    if (success && id) {
      router.push(`/interview/${interviewId}/feedback`);
    } else {
      toast.error("Couldn't generate your feedback. Please try again.");
      router.push("/");
    }
  };

  useEffect(() => {
    if (callStatus === CallStatus.FINISHED && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      if (type === "generate") {
        router.push("/");
      } else {
        handleGenerateFeedback(messages);
      }
    }
  }, [messages, callStatus, type, userId]);

  const handleCall = async () => {
    const vapi = vapiRef.current;

    if (!vapi) {
      console.log("Vapi is not ready yet.");
      return;
    }

    setCallStatus(CallStatus.CONNECTING);

    try {
      await startCall(vapi);
    } catch (error) {
      console.error("Failed to start call", error);
      toast.error("Couldn't start the call. Check your microphone and try again.");
      setCallStatus(CallStatus.INACTIVE);
    }
  };

  const startCall = async (vapi: NonNullable<typeof vapiRef.current>) => {
    if (type === "generate") {
      await vapi.start(
        undefined,
        {
          variableValues: {
            username: userName,
            userid: userId,
          },
        },
        process.env.NEXT_PUBLIC_VAPI_SQUAD_ID!,
      );
    } else {
      let formattedQuestions = "";

      if (questions) {
        formattedQuestions = questions
          .map((question) => `- ${question}`)
          .join("\n");
      }

      await vapi.start(interviewer, {
        variableValues: {
          questions: formattedQuestions,
        },
      });
    }
  };

  const handleDisconnect = async () => {
    setCallStatus(CallStatus.FINISHED);

    vapiRef.current?.stop();
  };

  const latestMessage = messages[messages.length - 1]?.content;
  const isCallInactiveOrFinished =
    callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED;

  return (
    <>
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="vapi"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="user avatar"
              width={540}
              height={540}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>
      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={latestMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100",
              )}
            >
              {latestMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus === CallStatus.FINISHED && type === "interview" ? (
          <p className="animate-pulse">Generating your feedback...</p>
        ) : callStatus !== "ACTIVE" ? (
          <button className="relative btn-call" onClick={handleCall}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden",
              )}
            />

            <span>{isCallInactiveOrFinished ? "Call" : ". . ."}</span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleDisconnect}>
            End
          </button>
        )}
      </div>
    </>
  );
};
export default Agent;
