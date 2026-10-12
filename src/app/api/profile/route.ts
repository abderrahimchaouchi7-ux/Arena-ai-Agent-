import { NextRequest } from "next/server";
import { ok, fail, handleError, requireUser, readJson, str, int } from "@/lib/api";
import { get, run } from "@/lib/db";
import {
  ensureTradeProfile,
  getTradesOf,
  parseRegions,
  portfolioOf,
  ratingOf,
  setTradesOf,
} from "@/lib/model";
import {
  isValidEquipment,
  isValidTrade,
  REGION_IDS,
  TRADE_IDS,
} from "@/lib/config";

export async function GET() {
  try {
    const user = await requireUser();

    const me = get(
      `SELECT id, role, email, username, first_name, last_name, phone, address,
              city, avatar_media, bio, birthdate, is_18_plus, lang
         FROM users WHERE id = :id`,
      { id: user.id }
    );

    let trade = null;
    if (user.role === "trade") {
      ensureTradeProfile(user.id);
      const tp = get(
        `SELECT years_experience, certificate_media, equipment, is_private,
                show_phone, show_real_name, regions
           FROM trade_profiles WHERE user_id = :id`,
        { id: user.id }
      );
      const rating = ratingOf(user.id);
      trade = {
        ...tp,
        regions: parseRegions(tp?.regions ?? "[]"),
        trades: getTradesOf(user.id),
        portfolio: portfolioOf(user.id),
        ratingAvg: rating.avg,
        ratingCount: rating.count,
      };
    }

    return ok({ me, trade });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson(req);

    // ---- personal information (both roles) ----
    const firstName = body.firstName === undefined ? null : str(body.firstName);
    const lastName = body.lastName === undefined ? null : str(body.lastName);
    const phone = body.phone === undefined ? null : str(body.phone);
    const address = body.address === undefined ? null : str(body.address);
    const city = body.city === undefined ? null : str(body.city);
    const bio = body.bio === undefined ? null : str(body.bio);

    if (firstName !== null) run("UPDATE users SET first_name = :v WHERE id = :id", { v: firstName, id: user.id });
    if (lastName !== null) run("UPDATE users SET last_name = :v WHERE id = :id", { v: lastName, id: user.id });
    if (phone !== null) run("UPDATE users SET phone = :v WHERE id = :id", { v: phone, id: user.id });
    if (address !== null) run("UPDATE users SET address = :v WHERE id = :id", { v: address, id: user.id });
    if (city !== null) run("UPDATE users SET city = :v WHERE id = :id", { v: city, id: user.id });
    if (bio !== null) run("UPDATE users SET bio = :v WHERE id = :id", { v: bio, id: user.id });

    // ---- professional record (tradespeople only) ----
    if (user.role === "trade") {
      ensureTradeProfile(user.id);

      if (body.trades !== undefined) {
        const list = Array.isArray(body.trades) ? body.trades.filter((t: unknown) => typeof t === "string") : [];
        const valid = list.filter(isValidTrade);
        if (valid.length === 0) return fail("NEEDS_TRADE");
        if (valid.length > TRADE_IDS.length) return fail("TOO_MANY_TRADES");
        setTradesOf(user.id, valid);
      }

      if (body.yearsExperience !== undefined) {
        const y = Math.max(0, Math.min(60, int(body.yearsExperience, 0)));
        run("UPDATE trade_profiles SET years_experience = :v WHERE user_id = :id", { v: y, id: user.id });
      }

      if (body.equipment !== undefined) {
        if (!isValidEquipment(str(body.equipment))) return fail("BAD_EQUIPMENT");
        run("UPDATE trade_profiles SET equipment = :v WHERE user_id = :id", { v: str(body.equipment), id: user.id });
      }

      // ---- privacy switches ----
      if (body.isPrivate !== undefined) {
        run("UPDATE trade_profiles SET is_private = :v WHERE user_id = :id", {
          v: body.isPrivate ? 1 : 0,
          id: user.id,
        });
      }
      if (body.showPhone !== undefined) {
        run("UPDATE trade_profiles SET show_phone = :v WHERE user_id = :id", {
          v: body.showPhone ? 1 : 0,
          id: user.id,
        });
      }
      if (body.showRealName !== undefined) {
        run("UPDATE trade_profiles SET show_real_name = :v WHERE user_id = :id", {
          v: body.showRealName ? 1 : 0,
          id: user.id,
        });
      }
      if (body.regions !== undefined) {
        const list = Array.isArray(body.regions)
          ? body.regions.filter((r: unknown) => typeof r === "string" && REGION_IDS.includes(r))
          : [];
        run("UPDATE trade_profiles SET regions = :v WHERE user_id = :id", {
          v: JSON.stringify(list),
          id: user.id,
        });
      }
    }

    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
