import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/icon-art";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(iconArt(192), { width: 192, height: 192 });
}
