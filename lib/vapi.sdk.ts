import Vapi from "@vapi-ai/web";

export const createVapi = () =>
  new Vapi(process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN!);
