// NCDOT DriveNC snapshot cameras on the routes to the island, nearest the
// bridge first. Shared by the /api/cam proxy (as its allowlist), the /api/cams
// health check, and the camera UI. Snapshots only: NCDOT's terms allow
// unaltered non-commercial reuse of the images, but nothing grants embedding
// their live video, so live video links out to DriveNC.
export type NcdotCam = {
  key: string;
  id: string;
  label: string;
  caption: string;
  alt: string;
};

export const NCDOT_CAMS: NcdotCam[] = [
  {
    key: "surfcity",
    id: "6157",
    label: "Surf City",
    caption: "NC-50/210 on the Surf City mainland, the last stretch of lights before the bridge.",
    alt: "NC-50/210 traffic on the Surf City mainland approach to the bridge",
  },
  {
    key: "nc210",
    id: "5400",
    label: "NC-210",
    caption: "NC-210 at JH Batts Rd, the mainland approach from I-40.",
    alt: "NC-210 at JH Batts Road, the mainland approach to the Surf City bridge",
  },
  {
    key: "porters",
    id: "6141",
    label: "Porters Neck",
    caption: "US-17 at Porters Neck, the approach from Wilmington.",
    alt: "US-17 at Porters Neck, the approach to Topsail Island from Wilmington",
  },
  {
    key: "ogden",
    id: "4781",
    label: "Ogden",
    caption: "US-17 (Market St) at Torchwood in Ogden, where Wilmington-side backups start.",
    alt: "US-17 Market Street at Torchwood in Ogden, where Wilmington-side congestion begins",
  },
  {
    key: "i40",
    id: "6116",
    label: "I-40",
    caption: "I-40 Exit 408 at NC-210, the approach from Raleigh.",
    alt: "I-40 Exit 408 at NC-210, the approach to Topsail Island from Raleigh",
  },
];

export const NCDOT_CAM_IDS = new Set(NCDOT_CAMS.map((c) => c.id));

export function snapshotUrl(id: string): string {
  return `https://www.drivenc.gov/map/Cctv/${id}`;
}

// A down camera comes back as a stand-in graphic, not an error: statewide cams
// serve a 15,136-byte "no live feed" PNG, and the Wilmington signal cams a
// ~4 KB dark frame. Real frames run 30 KB and up, even at night.
export function isPlaceholder(bytes: number): boolean {
  return bytes === 15136 || bytes < 8000;
}
