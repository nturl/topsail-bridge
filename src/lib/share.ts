// Native share where it exists (every phone, Safari/Chrome on macOS),
// clipboard fallback elsewhere.
export async function sharePage(): Promise<"shared" | "copied" | "failed"> {
  const data = {
    title: "Topsail Traffic",
    text: "Know the best time to cross the Surf City bridge.",
    url: "https://topsailtraffic.com",
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
    await navigator.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
