import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "../../db/schema.mjs";

/**
 * SQLite storage via the built-in `node:sqlite` module — no native
 * dependencies, so `npm install` stays tiny and the whole thing runs on any
 * free tier. Swap this file for Postgres/Supabase/Firestore when scaling.
 */

export const DATA_DIR = process.env.RABT_DATA_DIR
  ? path.resolve(process.env.RABT_DATA_DIR)
  : path.join(process.cwd(), "data");

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

function ensureDirs() {
  // turbopackIgnore keeps the bundler from tracing the entire project just
  // because we touch the filesystem at startup.
  for (const d of [DATA_DIR, UPLOAD_DIR]) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ d)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ d, { recursive: true });
    }
  }
}

ensureDirs();

const DB_PATH = path.join(DATA_DIR, "rabt.db");

declare global {
  // eslint-disable-next-line no-var
  var __rabtDb: DatabaseSync | undefined;
}

export const db: DatabaseSync = global.__rabtDb ?? new DatabaseSync(DB_PATH);

if (process.env.NODE_ENV !== "production") global.__rabtDb = db;

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

db.exec(SCHEMA_SQL);

/* ------------------------------------------------------------------ */
/* Tiny query helpers                                                  */
/* ------------------------------------------------------------------ */

export function all<T = any>(sql: string, params: Record<string, any> = {}): T[] {
  return db.prepare(sql).all(params) as T[];
}

export function get<T = any>(sql: string, params: Record<string, any> = {}): T | undefined {
  return db.prepare(sql).get(params) as T | undefined;
}

export function run(sql: string, params: Record<string, any> = {}) {
  return db.prepare(sql).run(params);
}

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw e;
  }
}
