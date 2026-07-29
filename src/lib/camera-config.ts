const SURFCHEX_HLS = "https://www.surfchex.com/hls/sciga/index.m3u8";

// HTTPS is required on the production site; an HTTP camera would be blocked as
// mixed content. Invalid values safely leave the Island tab in link-only mode.
function authorizedHlsUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.pathname.endsWith(".m3u8") ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const authorizedIslandHls = authorizedHlsUrl(process.env.NEXT_PUBLIC_AUTHORIZED_ISLAND_HLS_URL);
const surfchexEmbedApproved = process.env.NEXT_PUBLIC_SURFCHEX_EMBED_APPROVED === "true";

export const ISLAND_CAMERA_MODE = authorizedIslandHls
  ? ("authorized" as const)
  : surfchexEmbedApproved
    ? ("surfchex" as const)
    : ("link" as const);

export const ISLAND_HLS = authorizedIslandHls ?? SURFCHEX_HLS;
