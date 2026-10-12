import { all, get, run, transaction } from "./db";
import type { EquipmentLevel, Lang, TradeId } from "./config";
import { regionLabel, tradeIcon, tradeLabel, equipmentLabel } from "./config";

/**
 * All read paths that expose a tradesperson go through `serializeTrade()`.
 * Privacy switches are applied HERE, on the server, so a client cannot
 * simply call the API and read hidden fields.
 *
 * Never hideable (product rule):
 *   - username
 *   - rating
 *   - equipment level
 *   - years of experience
 */

export type TradeRow = {
  id: number;
  role: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  avatar_media: number | null;
  bio: string;
  years_experience: number;
  certificate_media: number | null;
  equipment: EquipmentLevel;
  is_private: number;
  show_phone: number;
  show_real_name: number;
  regions: string;
  created_at: string;
};

export type PublicTrade = {
  id: number;
  username: string;
  displayName: string;
  realNameVisible: boolean;
  avatarUrl: string | null;
  trades: TradeId[];
  tradeLabels: Record<Lang, string[]>;
  tradeIcons: string[];
  yearsExperience: number;
  equipment: EquipmentLevel;
  equipmentLabel: Record<Lang, string>;
  ratingAvg: number | null;
  ratingCount: number;
  regions: string[];
  regionLabels: Record<Lang, string[]>;
  bio: string;
  phone: string | null;
  city: string | null;
  certificateUrl: string | null;
  portfolio: { id: number; url: string; caption: string }[];
  isPrivate: boolean;
};

export function getTradesOf(userId: number): TradeId[] {
  return all<{ trade: string }>("SELECT trade FROM user_trades WHERE user_id = :u", { u: userId }).map(
    (r) => r.trade as TradeId
  );
}

export function setTradesOf(userId: number, trades: string[]) {
  run("DELETE FROM user_trades WHERE user_id = :u", { u: userId });
  for (const t of trades) {
    run("INSERT OR IGNORE INTO user_trades (user_id, trade) VALUES (:u, :t)", { u: userId, t });
  }
}

export function ratingOf(userId: number): { avg: number | null; count: number } {
  const row = get<{ c: number; a: number | null }>(
    "SELECT COUNT(*) AS c, AVG(rating) AS a FROM reviews WHERE target_id = :u",
    { u: userId }
  );
  const count = row?.c ?? 0;
  const avg = row?.a == null ? null : Math.round(row.a * 10) / 10;
  return { avg, count };
}

export function portfolioOf(userId: number) {
  return all<{ id: number; media_id: number; caption: string }>(
    "SELECT id, media_id, caption FROM portfolio WHERE user_id = :u ORDER BY id DESC",
    { u: userId }
  ).map((p) => ({ id: p.id, url: `/api/media/${p.media_id}`, caption: p.caption }));
}

export function parseRegions(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function baseTradeQuery(): string {
  return `
    SELECT u.id, u.role, u.email, u.username, u.first_name, u.last_name,
           u.phone, u.address, u.city, u.avatar_media, u.bio,
           tp.years_experience, tp.certificate_media, tp.equipment,
           tp.is_private, tp.show_phone, tp.show_real_name, tp.regions,
           u.created_at
      FROM users u
      JOIN trade_profiles tp ON tp.user_id = u.id
     WHERE u.role = 'trade'`;
}

export function serializeTrade(row: TradeRow, viewerId: number | null): PublicTrade {
  const trades = getTradesOf(row.id);
  const regions = parseRegions(row.regions);
  const { avg, count } = ratingOf(row.id);

  const realNameVisible = row.show_real_name === 1;
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();

  // Contact details: hidden when the switch is off, OR when the profile is
  // private and the viewer is anonymous (not signed in).
  const contactVisible = row.show_phone === 1 && (row.is_private === 0 || viewerId !== null);
  const portfolioVisible = row.is_private === 0 || viewerId !== null;

  // Certificate: sensitive document — only shown to signed-in users.
  const certificateUrl = viewerId !== null && row.certificate_media ? `/api/media/${row.certificate_media}` : null;

  const displayName = realNameVisible ? fullName || row.username : row.username;

  return {
    id: row.id,
    username: row.username,
    displayName,
    realNameVisible,
    avatarUrl: row.avatar_media ? `/api/media/${row.avatar_media}` : null,
    trades,
    tradeLabels: {
      fr: trades.map((t) => tradeLabel(t, "fr")),
      ar: trades.map((t) => tradeLabel(t, "ar")),
    },
    tradeIcons: trades.map(tradeIcon),
    // ---- always public ----
    yearsExperience: row.years_experience,
    equipment: row.equipment,
    equipmentLabel: { fr: equipmentLabel(row.equipment, "fr"), ar: equipmentLabel(row.equipment, "ar") },
    ratingAvg: avg,
    ratingCount: count,
    // -----------------------
    regions,
    regionLabels: {
      fr: regions.map((r) => regionLabel(r, "fr")),
      ar: regions.map((r) => regionLabel(r, "ar")),
    },
    bio: row.bio,
    phone: contactVisible && row.phone ? row.phone : null,
    city: contactVisible && row.city ? row.city : null,
    certificateUrl,
    portfolio: portfolioVisible ? portfolioOf(row.id) : [],
    isPrivate: row.is_private === 1,
  };
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export type SearchParams = {
  q?: string;
  trade?: string;
  region?: string;
  equipment?: string;
  minRating?: number;
  minExperience?: number;
};

export function searchTrades(params: SearchParams, viewerId: number | null): PublicTrade[] {
  let sql = baseTradeQuery();
  const p: Record<string, any> = {};

  // Private profiles are never listed in search results.
  sql += " AND tp.is_private = 0";

  if (params.trade) {
    sql += " AND EXISTS (SELECT 1 FROM user_trades ut WHERE ut.user_id = u.id AND ut.trade = :trade)";
    p.trade = params.trade;
  }

  if (params.region) {
    // JSON array membership: regions is stored as '["casa","rabat"]'
    sql += " AND tp.regions LIKE :regionLike";
    p.regionLike = `%"${params.region}"%`;
  }

  if (params.equipment) {
    sql += " AND tp.equipment = :equipment";
    p.equipment = params.equipment;
  }

  if (typeof params.minExperience === "number" && params.minExperience > 0) {
    sql += " AND tp.years_experience >= :minExp";
    p.minExp = params.minExperience;
  }

  if (params.q && params.q.trim()) {
    const q = `%${params.q.trim().toLowerCase()}%`;
    sql += ` AND (lower(u.username) LIKE :q
                  OR lower(u.first_name) LIKE :q
                  OR lower(u.last_name) LIKE :q
                  OR lower(u.city) LIKE :q
                  OR lower(u.bio) LIKE :q
                  OR EXISTS (SELECT 1 FROM user_trades ut2
                             WHERE ut2.user_id = u.id AND lower(ut2.trade) LIKE :q))`;
    p.q = q;
  }

  if (typeof params.minRating === "number" && params.minRating > 0) {
    sql += ` AND (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.target_id = u.id) >= :minRating`;
    p.minRating = params.minRating;
  }

  sql += " ORDER BY (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.target_id = u.id) DESC, u.id DESC";

  const rows = all<TradeRow>(sql, p);
  return rows.map((r) => serializeTrade(r, viewerId));
}

export function getTradeByUsername(username: string, viewerId: number | null): PublicTrade | null {
  const row = get<TradeRow>(`${baseTradeQuery()} AND lower(u.username) = lower(:u)`, { u: username });
  return row ? serializeTrade(row, viewerId) : null;
}

export function getTradeById(id: number, viewerId: number | null): PublicTrade | null {
  const row = get<TradeRow>(`${baseTradeQuery()} AND u.id = :id`, { id });
  return row ? serializeTrade(row, viewerId) : null;
}

export function ensureTradeProfile(userId: number) {
  run("INSERT OR IGNORE INTO trade_profiles (user_id) VALUES (:id)", { id: userId });
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export function addReview(targetId: number, authorId: number, rating: number, comment: string) {
  if (targetId === authorId) throw new Error("SELF_REVIEW");
  transaction(() => {
    run(
      `INSERT INTO reviews (target_id, author_id, rating, comment)
       VALUES (:t, :a, :r, :c)
       ON CONFLICT (target_id, author_id)
       DO UPDATE SET rating = :r, comment = :c, created_at = datetime('now')`,
      { t: targetId, a: authorId, r: rating, c: comment }
    );
  });
}

export function reviewsOf(targetId: number) {
  return all<{ id: number; rating: number; comment: string; created_at: string; author: string }>(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), u.username) AS author
       FROM reviews r
       JOIN users u ON u.id = r.author_id
      WHERE r.target_id = :t
      ORDER BY r.created_at DESC`,
    { t: targetId }
  );
}

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

export type TeamRow = {
  id: number;
  name: string;
  trade: string;
  owner_id: number;
  description: string;
  region: string;
  created_at: string;
};

export function createTeam(args: {
  name: string;
  trade: string;
  ownerId: number;
  description?: string;
  region?: string;
}): number {
  return transaction(() => {
    const info = run(
      `INSERT INTO teams (name, trade, owner_id, description, region)
       VALUES (:n, :t, :o, :d, :r)`,
      { n: args.name, t: args.trade, o: args.ownerId, d: args.description ?? "", r: args.region ?? "" }
    );
    const teamId = Number(info.lastInsertRowid);

    run("INSERT INTO team_members (team_id, user_id, role, status) VALUES (:t, :u, 'owner', 'active')", {
      t: teamId,
      u: args.ownerId,
    });

    // Every team gets a group conversation.
    const conv = run("INSERT INTO conversations (type, team_id) VALUES ('team', :t)", { t: teamId });
    const convId = Number(conv.lastInsertRowid);
    run("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (:c, :u)", {
      c: convId,
      u: args.ownerId,
    });

    return teamId;
  });
}

export function listTeams(userId: number) {
  return all<TeamRow & { role: string; member_count: number; conversation_id: number | null }>(
    `SELECT t.*, tm.role,
            (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id AND m.status = 'active') AS member_count,
            (SELECT c.id FROM conversations c WHERE c.team_id = t.id) AS conversation_id
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = :u
      ORDER BY t.created_at DESC`,
    { u: userId }
  );
}

export function listOpenTeams(userId: number) {
  return all<TeamRow & { member_count: number }>(
    `SELECT t.*, (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id AND m.status='active') AS member_count
       FROM teams t
      WHERE NOT EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = t.id AND m.user_id = :u)
      ORDER BY t.created_at DESC
      LIMIT 50`,
    { u: userId }
  );
}

export function getTeam(teamId: number) {
  return get<TeamRow>("SELECT * FROM teams WHERE id = :id", { id: teamId });
}

export function teamMembers(teamId: number) {
  return all<{ user_id: number; username: string; first_name: string; last_name: string; role: string; status: string; avatar_media: number | null }>(
    `SELECT m.user_id, m.role, m.status, u.username, u.first_name, u.last_name, u.avatar_media
       FROM team_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.team_id = :t
      ORDER BY (m.role = 'owner') DESC, m.joined_at ASC`,
    { t: teamId }
  );
}

export function addTeamMember(teamId: number, userId: number) {
  transaction(() => {
    run(
      `INSERT INTO team_members (team_id, user_id, role, status)
       VALUES (:t, :u, 'member', 'active')
       ON CONFLICT (team_id, user_id) DO UPDATE SET status = 'active'`,
      { t: teamId, u: userId }
    );
    const conv = get<{ id: number }>("SELECT id FROM conversations WHERE team_id = :t", { t: teamId });
    if (conv) {
      run("INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (:c, :u)", {
        c: conv.id,
        u: userId,
      });
    }
  });
}

export function removeTeamMember(teamId: number, userId: number) {
  run("DELETE FROM team_members WHERE team_id = :t AND user_id = :u AND role <> 'owner'", {
    t: teamId,
    u: userId,
  });
  const conv = get<{ id: number }>("SELECT id FROM conversations WHERE team_id = :t", { t: teamId });
  if (conv) {
    run("DELETE FROM conversation_participants WHERE conversation_id = :c AND user_id = :u", {
      c: conv.id,
      u: userId,
    });
  }
}

export function isTeamMember(teamId: number, userId: number): boolean {
  return Boolean(
    get("SELECT 1 FROM team_members WHERE team_id = :t AND user_id = :u AND status = 'active'", {
      t: teamId,
      u: userId,
    })
  );
}

export function isTeamOwner(teamId: number, userId: number): boolean {
  return Boolean(
    get("SELECT 1 FROM team_members WHERE team_id = :t AND user_id = :u AND role = 'owner'", {
      t: teamId,
      u: userId,
    })
  );
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export function findDirectConversation(a: number, b: number): number | null {
  const row = get<{ id: number }>(
    `SELECT c.id FROM conversations c
      WHERE c.type = 'direct'
        AND EXISTS (SELECT 1 FROM conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = :a)
        AND EXISTS (SELECT 1 FROM conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = :b)
        AND (SELECT COUNT(*) FROM conversation_participants p WHERE p.conversation_id = c.id) = 2`,
    { a, b }
  );
  return row?.id ?? null;
}

export function createDirectConversation(a: number, b: number): number {
  const existing = findDirectConversation(a, b);
  if (existing) return existing;
  return transaction(() => {
    const conv = run("INSERT INTO conversations (type) VALUES ('direct')");
    const id = Number(conv.lastInsertRowid);
    run("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (:c, :a), (:c, :b)", {
      c: id,
      a,
      b,
    });
    return id;
  });
}

export function listConversations(userId: number) {
  return all<{
    id: number;
    type: string;
    team_id: number | null;
    last_body: string | null;
    last_at: string | null;
    peer_name: string | null;
    peer_username: string | null;
    peer_avatar: number | null;
    team_name: string | null;
  }>(
    `SELECT c.id, c.type, c.team_id,
            (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_at,
            (SELECT COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), u.username)
               FROM conversation_participants p JOIN users u ON u.id = p.user_id
              WHERE p.conversation_id = c.id AND p.user_id <> :u
              LIMIT 1) AS peer_name,
            (SELECT u.username FROM conversation_participants p JOIN users u ON u.id = p.user_id
              WHERE p.conversation_id = c.id AND p.user_id <> :u LIMIT 1) AS peer_username,
            (SELECT u.avatar_media FROM conversation_participants p JOIN users u ON u.id = p.user_id
              WHERE p.conversation_id = c.id AND p.user_id <> :u LIMIT 1) AS peer_avatar,
            (SELECT t.name FROM teams t WHERE t.id = c.team_id) AS team_name
       FROM conversations c
      WHERE EXISTS (SELECT 1 FROM conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = :u)
      ORDER BY COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1), c.created_at) DESC`,
    { u: userId }
  );
}

export function isParticipant(conversationId: number, userId: number): boolean {
  return Boolean(
    get("SELECT 1 FROM conversation_participants WHERE conversation_id = :c AND user_id = :u", {
      c: conversationId,
      u: userId,
    })
  );
}

export function messagesOf(conversationId: number, sinceId = 0) {
  return all<{
    id: number;
    sender_id: number;
    body: string;
    media_id: number | null;
    created_at: string;
    sender_name: string;
    sender_avatar: number | null;
  }>(
    `SELECT m.id, m.sender_id, m.body, m.media_id, m.created_at,
            COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), u.username) AS sender_name,
            u.avatar_media AS sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = :c AND m.id > :since
      ORDER BY m.id ASC`,
    { c: conversationId, since: sinceId }
  );
}

export function postMessage(conversationId: number, senderId: number, body: string, mediaId: number | null) {
  const info = run(
    "INSERT INTO messages (conversation_id, sender_id, body, media_id) VALUES (:c, :s, :b, :m)",
    { c: conversationId, s: senderId, b: body, m: mediaId }
  );
  return Number(info.lastInsertRowid);
}
