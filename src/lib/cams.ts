// NCDOT DriveNC snapshot cameras on the routes to the island, nearest the
// bridge first (locations checked against OpenStreetMap). Shared by the
// /api/cam proxy (as its allowlist), the /api/cams health check, and the
// camera UI. Snapshots only: NCDOT's terms allow
// unaltered non-commercial reuse of the images; live video plays through
// NCDOT's own embeddable map (liveMapUrl), never by pulling their streams.
export type NcdotCam = {
  key: string;
  id: string;
  label: string;
  caption: string;
  alt: string;
  lat: number;
  lng: number;
};

export const NCDOT_CAMS: NcdotCam[] = [
  {
    key: "roland",
    id: "5400",
    label: "Roland Ave",
    caption: "NC-50/210 (Roland Ave) at JH Batts Rd, the last stretch before the bridge.",
    alt: "Roland Avenue (NC-50/210) at JH Batts Road, the mainland approach to the Surf City bridge",
    lat: 34.44142,
    lng: -77.55779,
  },
  {
    key: "surfcity",
    id: "6157",
    label: "Surf City",
    caption: "Where NC-50 and NC-210 meet at Roland Ave on the Surf City mainland. Traffic from Hampstead and Holly Ridge merges here.",
    alt: "The NC-50 and NC-210 junction at Roland Avenue on the Surf City mainland",
    lat: 34.450111,
    lng: -77.563028,
  },
  {
    key: "porters",
    id: "6141",
    label: "Porters Neck",
    caption: "US-17 at Porters Neck, the approach from Wilmington.",
    alt: "US-17 at Porters Neck, the approach to Topsail Island from Wilmington",
    lat: 34.30164,
    lng: -77.78769,
  },
  {
    key: "ogden",
    id: "4781",
    label: "Ogden",
    caption: "US-17 (Market St) at Torchwood in Ogden, on the Wilmington end of the trip.",
    alt: "US-17 Market Street at Torchwood in Ogden, Wilmington",
    lat: 34.27953,
    lng: -77.81292,
  },
  {
    key: "i40",
    id: "6116",
    label: "I-40",
    caption: "I-40 Exit 408 at NC-210, the approach from Raleigh.",
    alt: "I-40 Exit 408 at NC-210, the approach to Topsail Island from Raleigh",
    lat: 34.44275,
    lng: -77.87449,
  },
];

export const NCDOT_CAM_IDS = new Set(NCDOT_CAMS.map((c) => c.id));

// NCDOT's own "Embed Map On Your Site" map (drivenc.gov/map/embeddedmapsetup),
// cameras layer only, centered on one camera. It is the sanctioned way to show
// their live video: tapping the pin, then Show Video, plays the stream inside
// DriveNC's own frame. The embed has no parameter to open a camera directly
// (it reads only Latitude/Longitude/Zoom/SelectedLayers/size/width/height/
// bgColour/showAlert/showLegend), so it opens zoomed in on the pin with the
// alert banner and legend hidden.
export function liveMapUrl(cam: Pick<NcdotCam, "lat" | "lng">): string {
  return `https://www.drivenc.gov/Map/EmbeddedMap?lat=${cam.lat}&lng=${cam.lng}&zoom=16&layers=Cameras&size=4&showAlert=false&showLegend=false`;
}

export function snapshotUrl(id: string): string {
  return `https://www.drivenc.gov/map/Cctv/${id}`;
}

// A down camera comes back as a stand-in graphic, not an error: statewide cams
// serve a 15,136-byte "no live feed" PNG, and the Wilmington signal cams a
// ~4 KB dark frame. Real frames run 30 KB and up, even at night.
export function isPlaceholder(bytes: number): boolean {
  return bytes === 15136 || bytes < 8000;
}
