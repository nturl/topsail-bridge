import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/icon-art";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(iconArt(512), { width: 512, height: 512 });
}
