import { createHmac } from "node:crypto";

export function signOkxRequest(
  secretKey: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body = "",
): string {
  return createHmac("sha256", secretKey)
    .update(`${timestamp}${method.toUpperCase()}${requestPath}${body}`)
    .digest("base64");
}
