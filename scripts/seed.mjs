/**
 * Seeds RABT with realistic demo data so the app can be evaluated on a phone
 * straight away: 12 tradespeople, 3 customers, reviews, 2 teams and a chat.
 *
 *   npm run seed
 *
 * Demo password for every seeded account: rabt1234
 */
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { SCHEMA_SQL } from "../db/schema.mjs";

const DATA_DIR = process.env.RABT_DATA_DIR
  ? path.resolve(process.env.RABT_DATA_DIR)
  : path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "rabt.db"));
db.exec("PRAGMA foreign_keys = ON;");
db.exec(SCHEMA_SQL);

const DEMO_PASSWORD = "rabt1234";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const dk = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${dk}`;
}

/* ------------------------------------------------------------------ */
/* Placeholder image generation (no binary assets in git)              */
/* ------------------------------------------------------------------ */

function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** A deterministic abstract tile used as a stand-in for a work photo. */
function makeImage(seed, size = 320) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

  const base = [(h >> 0) & 0x9f, (h >> 8) & 0x9f, (h >> 16) & 0x9f].map((v) => 90 + (v % 110));
  const raw = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const stripe = (Math.floor((x + y) / 26) + (h % 5)) % 2 === 0;
      const shade = stripe ? 1 : 0.76;
      const p = rowStart + 1 + x * 4;
      raw[p] = Math.round(base[0] * shade);
      raw[p + 1] = Math.round(base[1] * shade);
      raw[p + 2] = Math.round(base[2] * shade);
      raw[p + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function addMedia(kind, ownerId, seed) {
  const filename = `seed-${crypto.randomBytes(6).toString("hex")}.png`;
  const buf = makeImage(seed);
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  const info = db
    .prepare("INSERT INTO media (kind, owner_id, filename, mime, bytes) VALUES (?, ?, ?, 'image/png', ?)")
    .run(kind, ownerId, filename, buf.length);
  return Number(info.lastInsertRowid);
}

/* ------------------------------------------------------------------ */
/* Reset                                                               */
/* ------------------------------------------------------------------ */

console.log("Clearing existing data…");
for (const t of [
  "messages",
  "conversation_participants",
  "conversations",
  "team_members",
  "teams",
  "reviews",
  "portfolio",
  "user_trades",
  "trade_profiles",
  "sessions",
  "media",
  "users",
]) {
  db.exec(`DELETE FROM ${t};`);
}
db.exec("DELETE FROM sqlite_sequence;");

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

const pw = hashPassword(DEMO_PASSWORD);

function createUser({ role, email, first, last, phone, address, city, bio, adult = true, lang = "fr" }) {
  const username = `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const info = db
    .prepare(
      `INSERT INTO users (role, email, password_hash, username, first_name, last_name,
                          phone, address, city, bio, is_18_plus, lang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(role, email, pw, username, first, last, phone, address, city, bio, adult ? 1 : 0, lang);
  return Number(info.lastInsertRowid);
}

function createTradeProfile({
  userId,
  trades,
  years,
  equipment,
  regions,
  isPrivate = 0,
  showPhone = 1,
  showRealName = 1,
  withCertificate = false,
  portfolioCaptions = [],
}) {
  let cert = null;
  if (withCertificate) cert = addMedia("certificate", userId, `cert-${userId}`);

  db.prepare(
    `INSERT INTO trade_profiles (user_id, years_experience, certificate_media, equipment,
                                 is_private, show_phone, show_real_name, regions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, years, cert, equipment, isPrivate, showPhone, showRealName, JSON.stringify(regions));

  for (const t of trades) {
    db.prepare("INSERT OR IGNORE INTO user_trades (user_id, trade) VALUES (?, ?)").run(userId, t);
  }

  for (const caption of portfolioCaptions) {
    const mediaId = addMedia("portfolio", userId, `work-${userId}-${caption}`);
    db.prepare("INSERT INTO portfolio (user_id, media_id, caption) VALUES (?, ?, ?)").run(userId, mediaId, caption);
  }

  // Avatar
  const avatar = addMedia("avatar", userId, `avatar-${userId}`);
  db.prepare("UPDATE users SET avatar_media = ? WHERE id = ?").run(avatar, userId);
}

console.log("Creating tradespeople…");

const trades = [
  {
    email: "youssef.amrani@rabt.test",
    first: "Youssef",
    last: "Amrani",
    phone: "+212612345678",
    address: "123 Boulevard Mohammed V",
    city: "Casablanca",
    bio: "Plombier depuis 12 ans. Intervention rapide 7j/7 pour fuites et installations.",
    trades: ["plumbing", "water"],
    years: 12,
    equipment: "professional",
    regions: ["casa", "rabat"],
    withCertificate: true,
    portfolioCaptions: ["Salle de bain complète — Casablanca", "Réseau d'eau — villa", "Réparation fuite urgente"],
  },
  {
    email: "karim.idrissi@rabt.test",
    first: "Karim",
    last: "Idrissi",
    phone: "+212623456789",
    address: "45 Avenue Hassan II",
    city: "Rabat",
    bio: "Électricien certifié. Installations neuves, mise aux normes et dépannage.",
    trades: ["electricity"],
    years: 8,
    equipment: "professional",
    regions: ["rabat", "casa"],
    withCertificate: true,
    portfolioCaptions: ["Tableau électrique — appartement", "Éclairage salon", "Mise aux normes — bureau"],
  },
  {
    email: "omar.benali@rabt.test",
    first: "Omar",
    last: "Benali",
    phone: "+212634567890",
    address: "8 Rue de la Plage",
    city: "Tanger",
    bio: "Technicien gaz agréé. Chaudières, cuisinières et détection de fuites.",
    trades: ["gas"],
    years: 15,
    equipment: "professional",
    regions: ["tanger"],
    withCertificate: true,
    portfolioCaptions: ["Installation chaudière", "Réseau gaz — restaurant"],
  },
  {
    email: "hassan.tazi@rabt.test",
    first: "Hassan",
    last: "Tazi",
    phone: "+212645678901",
    address: "22 Rue Jemaa El Fna",
    city: "Marrakech",
    bio: "Carreleur soigneux. Zellige traditionnel et carrelage moderne.",
    trades: ["tiling"],
    years: 6,
    equipment: "basic",
    regions: ["marrakech"],
    portfolioCaptions: ["Zellige — patio", "Carrelage cuisine"],
  },
  {
    email: "rachid.elamine@rabt.test",
    first: "Rachid",
    last: "El Amine",
    phone: "+212656789012",
    address: "15 Avenue des FAR",
    city: "Fès",
    bio: "Peintre en bâtiment. Intérieur, extérieur et finitions décoratives.",
    trades: ["painting"],
    years: 4,
    equipment: "basic",
    regions: ["fes"],
    portfolioCaptions: ["Peinture salon", "Façade — maison"],
  },
  {
    email: "mehdi.berrada@rabt.test",
    first: "Mehdi",
    last: "Berrada",
    phone: "+212667890123",
    address: "5 Boulevard d'Anfa",
    city: "Casablanca",
    bio: "Entreprise générale de construction. Gros œuvre, rénovation complète, 20 ans d'expérience.",
    trades: ["construction"],
    years: 20,
    equipment: "professional",
    regions: ["casa", "rabat", "marrakech"],
    withCertificate: true,
    portfolioCaptions: ["Construction villa — Bouskoura", "Rénovation immeuble", "Extension maison", "Dalle et fondations"],
  },
  {
    email: "said.ouahbi@rabt.test",
    first: "Said",
    last: "Ouahbi",
    phone: "+212678901234",
    address: "30 Avenue Mohammed VI",
    city: "Agadir",
    bio: "Spécialiste forage et pompes à eau.",
    trades: ["water"],
    years: 9,
    equipment: "professional",
    regions: ["souss"],
    isPrivate: 1, // private profile: absent from search, reachable by direct link
    portfolioCaptions: ["Pompage solaire", "Forage — zone rurale"],
  },
  {
    email: "bilal.chakir@rabt.test",
    first: "Bilal",
    last: "Chakir",
    phone: "+212689012345",
    address: "3 Rue Al Amal",
    city: "Salé",
    bio: "Jeune artisan sérieux. Petits travaux électricité et plomberie.",
    trades: ["electricity", "plumbing"],
    years: 3,
    equipment: "basic",
    regions: ["rabat"],
    portfolioCaptions: ["Installation prises", "Robinetterie"],
  },
  {
    email: "nabil.fassi@rabt.test",
    first: "Nabil",
    last: "Fassi",
    phone: "+212690123456",
    address: "77 Boulevard Pasteur",
    city: "Tanger",
    bio: "Peinture et carrelage. Travail propre et devis gratuit.",
    trades: ["painting", "tiling"],
    years: 11,
    equipment: "professional",
    regions: ["tanger", "oriental"],
    portfolioCaptions: ["Appartement complet", "Escalier en marbre", "Cuisine carrelée"],
  },
  {
    email: "hamza.lahlou@rabt.test",
    first: "Hamza",
    last: "Lahlou",
    phone: "+212691234567",
    address: "12 Rue Yougoslavie",
    city: "Marrakech",
    bio: "Maçon. Murs, terrasses et travaux de gros œuvre.",
    trades: ["construction"],
    years: 7,
    equipment: "basic",
    regions: ["marrakech"],
    showPhone: 0, // hides phone number
    showRealName: 0, // hides real name — username shown instead
    portfolioCaptions: ["Mur de clôture", "Terrasse"],
  },
  {
    email: "amina.zerhouni@rabt.test",
    first: "Amina",
    last: "Zerhouni",
    phone: "+212692345678",
    address: "9 Rue de Bourgogne",
    city: "Casablanca",
    bio: "Peintre décoratrice. Finitions soignées et conseils en couleurs.",
    trades: ["painting"],
    years: 5,
    equipment: "basic",
    regions: ["casa"],
    showRealName: 0,
    portfolioCaptions: ["Chambre enfant", "Salon — tons neutres"],
  },
  {
    email: "tarik.moussaoui@rabt.test",
    first: "Tarik",
    last: "Moussaoui",
    phone: "+212693456789",
    address: "4 Boulevard Zerktouni",
    city: "Oujda",
    bio: "Gaz et plomberie. Dépannage rapide dans tout l'Oriental.",
    trades: ["gas", "plumbing"],
    years: 13,
    equipment: "professional",
    regions: ["oriental"],
    withCertificate: true,
    portfolioCaptions: ["Installation gaz — villa", "Chauffe-eau"],
  },
];

const tradeIds = {};
for (const t of trades) {
  const id = createUser({
    role: "trade",
    email: t.email,
    first: t.first,
    last: t.last,
    phone: t.phone,
    address: t.address,
    city: t.city,
    bio: t.bio,
  });
  tradeIds[t.email] = id;
  createTradeProfile({ userId: id, ...t });
}

console.log("Creating customers…");

// Enough distinct authors so every seeded review is inserted (reviews are
// unique per (target, author) pair).
const customers = [
  { email: "salma.client@rabt.test", first: "Salma", last: "Bennani", city: "Casablanca", phone: "+212600112233" },
  { email: "nadia.client@rabt.test", first: "Nadia", last: "El Fassi", city: "Rabat", phone: "+212600223344" },
  { email: "imad.client@rabt.test", first: "Imad", last: "Chaabi", city: "Tanger", phone: "+212600334455" },
  { email: "khadija.client@rabt.test", first: "Khadija", last: "Ouazzani", city: "Marrakech", phone: "+212600445566" },
  { email: "yassine.client@rabt.test", first: "Yassine", last: "Bouzid", city: "Agadir", phone: "+212600556677" },
];

const customerIds = {};
for (const c of customers) {
  customerIds[c.email] = createUser({
    role: "customer",
    email: c.email,
    first: c.first,
    last: c.last,
    phone: c.phone,
    address: "",
    city: c.city,
    bio: "",
  });
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

console.log("Creating reviews…");

const REVIEWS = {
  "youssef.amrani@rabt.test": [
    [5, "Très professionnel, fuite réparée en une heure."],
    [5, "Ponctuel et propre. Je recommande."],
    [4, "Bon travail, un peu cher mais efficace."],
    [5, "Excellent artisan, très honnête."],
  ],
  "karim.idrissi@rabt.test": [
    [5, "Installation électrique impeccable."],
    [4, "Sérieux, respecte les délais."],
    [5, "Très bon contact et travail soigné."],
  ],
  "omar.benali@rabt.test": [
    [5, "Expert en gaz, rassurant et précis."],
    [5, "Chaudière installée parfaitement."],
  ],
  "hassan.tazi@rabt.test": [
    [4, "Beau zellige, travail minutieux."],
    [4, "Bon rapport qualité prix."],
  ],
  "rachid.elamine@rabt.test": [
    [4, "Peinture bien faite."],
    [3, "Bien mais un peu de retard."],
  ],
  "mehdi.berrada@rabt.test": [
    [5, "Entreprise très sérieuse, chantier livré à temps."],
    [5, "Excellente gestion de l'équipe."],
    [5, "Travail de qualité, je recommande vivement."],
    [4, "Très bien,Communication perfectible."],
  ],
  "nabil.fassi@rabt.test": [
    [5, "Travail propre et rapide."],
    [5, "Très bon artisan."],
    [4, "Bonne prestation."],
  ],
  "amina.zerhouni@rabt.test": [
    [5, "Finitions superbes."],
    [4, "Très bon goût pour les couleurs."],
  ],
  "tarik.moussaoui@rabt.test": [
    [5, "Dépannage rapide un week-end, merci !"],
    [4, "Bon travail."],
  ],
  "bilal.chakir@rabt.test": [[4, "Jeune artisan motivé et soigneux."]],
  "hamza.lahlou@rabt.test": [[4, "Maçonnerie solide."], [4, "Bien."]],
  "said.ouahbi@rabt.test": [[5, "Forage impeccable."]],
};

const authorIds = Object.values(customerIds);
let r = 0;
for (const [email, list] of Object.entries(REVIEWS)) {
  const targetId = tradeIds[email];
  for (const [rating, comment] of list) {
    const authorId = authorIds[r % authorIds.length];
    r += 1;
    db.prepare(
      "INSERT OR IGNORE INTO reviews (target_id, author_id, rating, comment) VALUES (?, ?, ?, ?)"
    ).run(targetId, authorId, rating, comment);
  }
}

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

console.log("Creating teams…");

function createTeam(name, trade, ownerId, memberIds, description, region) {
  const info = db
    .prepare("INSERT INTO teams (name, trade, owner_id, description, region) VALUES (?, ?, ?, ?, ?)")
    .run(name, trade, ownerId, description, region);
  const teamId = Number(info.lastInsertRowid);

  db.prepare("INSERT INTO team_members (team_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')").run(
    teamId,
    ownerId
  );
  for (const m of memberIds) {
    if (m === ownerId) continue;
    db.prepare("INSERT OR IGNORE INTO team_members (team_id, user_id, role, status) VALUES (?, ?, 'member', 'active')").run(
      teamId,
      m
    );
  }

  const conv = db.prepare("INSERT INTO conversations (type, team_id) VALUES ('team', ?)").run(teamId);
  const convId = Number(conv.lastInsertRowid);
  db.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(convId, ownerId);
  for (const m of memberIds) {
    db.prepare("INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(convId, m);
  }
  return { teamId, convId };
}

const mehdi = tradeIds["mehdi.berrada@rabt.test"];
const youssef = tradeIds["youssef.amrani@rabt.test"];
const karim = tradeIds["karim.idrissi@rabt.test"];
const hassan = tradeIds["hassan.tazi@rabt.test"];
const bilal = tradeIds["bilal.chakir@rabt.test"];

const reno = createTeam(
  "Équipe Rénovation Casa",
  "construction",
  mehdi,
  [mehdi, youssef, karim, hassan],
  "Rénovation complète d'un appartement de 120 m² à Casablanca. Gros œuvre, plomberie, électricité et carrelage.",
  "casa"
);

const elec = createTeam(
  "Groupe Élec Rabat",
  "electricity",
  karim,
  [karim, bilal],
  "Installation électrique d'un immeuble de 6 appartements à Rabat.",
  "rabat"
);

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

console.log("Creating conversations…");

const salma = customerIds["salma.client@rabt.test"];
const nadia = customerIds["nadia.client@rabt.test"];

function direct(a, b) {
  const conv = db.prepare("INSERT INTO conversations (type) VALUES ('direct')").run();
  const id = Number(conv.lastInsertRowid);
  db.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)").run(id, a, id, b);
  return id;
}

const c1 = direct(salma, youssef);
db.prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)").run(
  c1,
  salma,
  "Bonjour, j'ai une fuite sous l'évier. Vous pouvez passer cette semaine ?"
);
db.prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)").run(
  c1,
  youssef,
  "Bonjour, oui je peux passer demain vers 9h. Envoyez-moi une photo si possible."
);
db.prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)").run(c1, salma, "Parfait, à demain !");

const c2 = direct(nadia, karim);
db.prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)").run(
  c2,
  nadia,
  "Bonjour, besoin d'un devis pour refaire l'électricité d'un appartement."
);
db.prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)").run(
  c2,
  karim,
  "Bonjour, avec plaisir. C'est combien de pièces ?"
);

db.prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)").run(
  reno.convId,
  mehdi,
  "Bonjour l'équipe, on commence lundi 8h. Youssef s'occupe de la plomberie, Karim de l'électricité."
);
db.prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)").run(
  reno.convId,
  karim,
  "OK pour moi, j'apporte le matériel."
);

db.prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)").run(
  elec.convId,
  karim,
  "Bilal, on attaque par le tableau électrique du 3ème étage."
);

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

const count = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;

console.log("\n✅ Seed complete\n");
console.log(`   Tradespeople : ${Object.keys(tradeIds).length}`);
console.log(`   Customers    : ${Object.keys(customerIds).length}`);
console.log(`   Reviews      : ${count("reviews")}`);
console.log(`   Teams        : ${count("teams")}`);
console.log(`   Conversations: ${count("conversations")}`);
console.log(`   Images       : ${count("media")}`);
console.log(`\n   Demo password for all accounts: ${DEMO_PASSWORD}`);
console.log(`   Try an artisan : youssef.amrani@rabt.test`);
console.log(`   Try a customer : salma.client@rabt.test\n`);
