import { HomePage } from "@/components/HomePage";
import { loadMeasured, typicalSummary } from "@/lib/measured";

// The live numbers load in the browser; this hourly server pass puts the
// measured summary in the HTML for search engines and no-JS readers.
export const revalidate = 3600;

export default async function Page() {
  return <HomePage typical={typicalSummary(await loadMeasured())} />;
}
