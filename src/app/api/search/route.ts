import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { searchTrades } from "@/lib/model";
import { isValidEquipment, isValidRegion, isValidTrade } from "@/lib/config";

export async function GET(req: NextRequest) {
  try {
    const viewer = await getCurrentUser();
    const sp = new URL(req.url).searchParams;

    const trade = sp.get("trade") ?? "";
    const region = sp.get("region") ?? "";
    const equipment = sp.get("equipment") ?? "";
    const minRating = Number(sp.get("minRating") ?? 0);
    const minExperience = Number(sp.get("minExperience") ?? 0);

    const results = searchTrades(
      {
        q: sp.get("q") ?? undefined,
        trade: isValidTrade(trade) ? trade : undefined,
        region: isValidRegion(region) ? region : undefined,
        equipment: isValidEquipment(equipment) ? equipment : undefined,
        minRating: Number.isFinite(minRating) ? minRating : 0,
        minExperience: Number.isFinite(minExperience) ? minExperience : 0,
      },
      viewer?.id ?? null
    );

    return ok({ results, count: results.length });
  } catch (e) {
    return handleError(e);
  }
}
