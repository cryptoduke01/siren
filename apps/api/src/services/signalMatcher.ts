import type { SurfacedToken } from "@siren/shared";

/** Token surfacing removed — prediction markets only. Signals keep an empty list for API shape compatibility. */
export async function getMatchedTokensForQuestion(_question: string): Promise<SurfacedToken[]> {
  void _question;
  return [];
}
