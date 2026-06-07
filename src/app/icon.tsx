import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0ea5e9",
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
          <path d="M2 17 Q12 5 22 17" />
          <line x1="2" y1="17" x2="22" y2="17" />
          <line x1="8" y1="11.5" x2="8" y2="17" />
          <line x1="16" y1="11.5" x2="16" y2="17" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
