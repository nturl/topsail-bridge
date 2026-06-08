import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/icon-art";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(iconArt(32), { ...size });
}
