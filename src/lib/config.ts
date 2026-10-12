/**
 * RABT domain configuration.
 *
 * Everything that is "content" rather than "code" lives here so that the
 * platform can be re-targeted at another country just by editing this file.
 */

export type Lang = "fr" | "ar";

export const LANGS: Lang[] = ["fr", "ar"];

export const DEFAULT_LANG: Lang = "fr";

export const LANG_META: Record<Lang, { label: string; native: string; dir: "ltr" | "rtl" }> = {
  fr: { label: "Français", native: "Français", dir: "ltr" },
  ar: { label: "Arabic", native: "العربية", dir: "rtl" },
};

/* ------------------------------------------------------------------ */
/* Trades                                                              */
/* ------------------------------------------------------------------ */

export type TradeId =
  | "water"
  | "gas"
  | "electricity"
  | "plumbing"
  | "tiling"
  | "painting"
  | "construction";

export const TRADES: { id: TradeId; icon: string; fr: string; ar: string }[] = [
  { id: "water", icon: "💧", fr: "Eau", ar: "الماء" },
  { id: "gas", icon: "🔥", fr: "Gaz", ar: "الغاز" },
  { id: "electricity", icon: "⚡", fr: "Électricité", ar: "الكهرباء" },
  { id: "plumbing", icon: "🚿", fr: "Plomberie", ar: "السباكة" },
  { id: "tiling", icon: "🧱", fr: "Carrelage", ar: "الزليج" },
  { id: "painting", icon: "🎨", fr: "Peinture", ar: "الصباغة" },
  { id: "construction", icon: "🏗️", fr: "Construction", ar: "البناء" },
];

export const TRADE_IDS: TradeId[] = TRADES.map((t) => t.id);

export function tradeLabel(id: string | null | undefined, lang: Lang): string {
  const t = TRADES.find((x) => x.id === id);
  if (!t) return "";
  return lang === "ar" ? t.ar : t.fr;
}

export function tradeIcon(id: string | null | undefined): string {
  return TRADES.find((x) => x.id === id)?.icon ?? "🔧";
}

export function isValidTrade(id: string): id is TradeId {
  return (TRADE_IDS as string[]).includes(id);
}

/* ------------------------------------------------------------------ */
/* Equipment rating — always public, never hideable                    */
/* ------------------------------------------------------------------ */

export type EquipmentLevel = "basic" | "professional";

export const EQUIPMENT: { id: EquipmentLevel; icon: string; fr: string; ar: string; hintFr: string; hintAr: string }[] = [
  {
    id: "basic",
    icon: "🧰",
    fr: "Basique",
    ar: "أساسي",
    hintFr: "Outils de base — petits travaux",
    hintAr: "أدوات أساسية — أشغال صغيرة",
  },
  {
    id: "professional",
    icon: "⚙️",
    fr: "Professionnel",
    ar: "محترف",
    hintFr: "Équipement complet — grands chantiers",
    hintAr: "معدات كاملة — أوراش كبيرة",
  },
];

export function equipmentLabel(id: string | null | undefined, lang: Lang): string {
  const e = EQUIPMENT.find((x) => x.id === id);
  if (!e) return "";
  return lang === "ar" ? e.ar : e.fr;
}

export function equipmentIcon(id: string | null | undefined): string {
  return EQUIPMENT.find((x) => x.id === id)?.icon ?? "🧰";
}

export function isValidEquipment(id: string): id is EquipmentLevel {
  return id === "basic" || id === "professional";
}

/* ------------------------------------------------------------------ */
/* Regions — swap this list to re-target another country               */
/* ------------------------------------------------------------------ */

export const REGIONS: { id: string; fr: string; ar: string }[] = [
  { id: "tanger", fr: "Tanger-Tétouan-Al Hoceïma", ar: "طنجة-تطوان-الحسيمة" },
  { id: "oriental", fr: "L'Oriental", ar: "الجهة الشرقية" },
  { id: "fes", fr: "Fès-Meknès", ar: "فاس-مكناس" },
  { id: "rabat", fr: "Rabat-Salé-Kénitra", ar: "الرباط-سلا-القنيطرة" },
  { id: "beni", fr: "Béni Mellal-Khénifra", ar: "بني ملال-خنيفرة" },
  { id: "casa", fr: "Casablanca-Settat", ar: "الدار البيضاء-سطات" },
  { id: "marrakech", fr: "Marrakech-Safi", ar: "مراكش-آسفي" },
  { id: "draa", fr: "Drâa-Tafilalet", ar: "درعة-تافيلالت" },
  { id: "souss", fr: "Souss-Massa", ar: "سوس-ماسة" },
  { id: "guelmim", fr: "Guelmim-Oued Noun", ar: "كلميم-واد نون" },
  { id: "laayoune", fr: "Laâyoune-Sakia El Hamra", ar: "العيون-الساقية الحمراء" },
  { id: "dakhla", fr: "Dakhla-Oued Ed-Dahab", ar: "الداخلة-وادي الذهب" },
];

export const REGION_IDS = REGIONS.map((r) => r.id);

export function regionLabel(id: string | null | undefined, lang: Lang): string {
  const r = REGIONS.find((x) => x.id === id);
  if (!r) return "";
  return lang === "ar" ? r.ar : r.fr;
}

export function isValidRegion(id: string): boolean {
  return REGION_IDS.includes(id);
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export type Role = "trade" | "customer";

export function isValidRole(r: string): r is Role {
  return r === "trade" || r === "customer";
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB — safe for free-tier storage
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function minAgeDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}
