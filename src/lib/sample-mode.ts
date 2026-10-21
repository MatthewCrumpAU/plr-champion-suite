/**
 * Sample content switch. Sample content (the studio's sample project and each membership's sample
 * library) is created on first use so everything can be tried straight away. Set
 * NEXT_PUBLIC_PLR_SAMPLE_CONTENT=off on a deployment to start every browser completely empty —
 * the way a new customer's copy should look.
 */
export function sampleContentEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PLR_SAMPLE_CONTENT ?? "").trim().toLowerCase() !== "off";
}
