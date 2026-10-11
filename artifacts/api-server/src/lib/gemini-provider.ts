/** Pinned to the replacement named by Google's model-retirement response. */
export const GEMINI_ANALYSIS_MODEL = "gemini-3.8-flash";

/** Classify provider failures without exposing SDK messages, keys, or payloads. */
export function geminiFailure(error: unknown) {
  const source = error as { status?: number; message?: string } | null;
  let detail: { code?: number; status?: string; details?: { reason?: string }[] } = {};
  try { detail = JSON.parse(source?.message ?? "{}").error ?? {}; } catch { /* Network errors need no provider body. */ }
  const providerStatus = source?.status ?? detail.code;
  const reasons = Array.isArray(detail.details) ? detail.details.map(d => d.reason) : [];
  if (reasons.some(r => r === "API_KEY_INVALID" || r === "API_KEY_EXPIRED")) {
    return { providerStatus, category: "credentials", httpStatus: 503, message: "Gemini rejected the API key. Update the Gemini key in workspace Secrets, then try again." };
  }
  if (providerStatus === 401 || providerStatus === 403) {
    return { providerStatus, category: "permissions", httpStatus: 503, message: "Gemini denied access. Check the API key's permissions and server-side restrictions in Google Cloud." };
  }
  if (providerStatus === 404) {
    return { providerStatus, category: "model", httpStatus: 503, message: "The configured Gemini analysis model is unavailable. The app's model configuration needs updating; replacing your API key will not fix this." };
  }
  if (providerStatus === 429) {
    return { providerStatus, category: "quota", httpStatus: 429, message: "Gemini's quota or rate limit was reached. Check your Google AI Studio quota and billing, or try again after the limit resets." };
  }
  if (providerStatus === 503) {
    return { providerStatus, category: "overloaded", httpStatus: 503, message: "Gemini is temporarily overloaded. Try Analyze again later. Your existing regions have not been changed." };
  }
  return { providerStatus, category: "request", httpStatus: 502, message: "Gemini could not complete the artwork analysis. Your existing regions have not been changed. Please try again later." };
}
