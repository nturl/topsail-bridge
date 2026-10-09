// Native share where it exists (every phone, Safari/Chrome on macOS),
// clipboard fallback elsewhere. Callers pass the live verdict when they have
// it, so a shared link says what the bridge is doing, not just what the app is.
export async function sharePage(
  live?: { text: string; url?: string },
): Promise<"shared" | "copied" | "failed"> {
  const data = {
    title: "Topsail Traffic",
    text: live?.text ?? "Know the best time to cross the Surf City bridge.",
    url: live?.url ?? "https://topsailtraffic.com",
  };
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(data);
    } catch {
      /* user closed the share sheet; nothing to do */
    }
    return "shared";
  }
  try {
    await navigator.clipboard.writeText(live ? `${data.text} ${data.url}` : data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
