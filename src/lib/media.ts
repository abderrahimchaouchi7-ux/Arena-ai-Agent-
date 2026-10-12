import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { get, run, UPLOAD_DIR } from "./db";
import { MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES } from "./config";

export type MediaKind = "avatar" | "portfolio" | "certificate" | "chat";

type MediaRow = {
  id: number;
  kind: MediaKind;
  owner_id: number | null;
  filename: string;
  mime: string;
};

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export class UploadError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export async function saveUpload(kind: MediaKind, ownerId: number, file: File): Promise<number> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("TOO_BIG");

  // Browsers sometimes send an empty type for camera captures on mobile —
  // fall back to sniffing the magic bytes.
  const head = Buffer.from(await file.slice(0, 12).arrayBuffer());
  const sniffed = sniffMime(head);
  const mime = file.type && ALLOWED_IMAGE_TYPES.includes(file.type) ? file.type : sniffed;

  if (!mime || !ALLOWED_IMAGE_TYPES.includes(mime)) throw new UploadError("BAD_TYPE");

  const ext = EXT[mime] ?? "jpg";
  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  fs.writeFileSync(/*turbopackIgnore: true*/ path.join(UPLOAD_DIR, filename), buf);

  const info = run(
    "INSERT INTO media (kind, owner_id, filename, mime, bytes) VALUES (:k, :o, :f, :m, :b)",
    { k: kind, o: ownerId, f: filename, m: mime, b: buf.length }
  );
  return Number(info.lastInsertRowid);
}

function sniffMime(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.length >= 8 && head.toString("ascii", 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (head.length >= 12 && head.toString("ascii", 4, 8) === "ftyp") return "image/heic";
  if (head.length >= 12 && head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

export function getMedia(id: number): MediaRow | undefined {
  return get<MediaRow>("SELECT id, kind, owner_id, filename, mime FROM media WHERE id = :id", { id });
}

/**
 * Access rules:
 *   avatar      — public unless the owner's profile is private (then signed-in only)
 *   portfolio   — same as avatar
 *   certificate — signed-in users only (it is a personal document)
 *   chat        — conversation participants only
 */
export function canAccessMedia(media: MediaRow, viewerId: number | null): boolean {
  if (viewerId !== null && media.owner_id === viewerId) return true;

  switch (media.kind) {
    case "certificate":
      return viewerId !== null;

    case "chat": {
      if (viewerId === null) return false;
      const row = get(
        `SELECT 1 FROM conversation_participants p
           JOIN messages m ON m.conversation_id = p.conversation_id
          WHERE m.media_id = :mid AND p.user_id = :u`,
        { mid: media.id, u: viewerId }
      );
      return Boolean(row);
    }

    case "avatar":
    case "portfolio": {
      if (viewerId !== null) return true;
      if (!media.owner_id) return false;
      const owner = get<{ is_private: number }>(
        "SELECT is_private FROM trade_profiles WHERE user_id = :u",
        { u: media.owner_id }
      );
      // Public profiles expose their pictures; private ones do not.
      return !owner || owner.is_private === 0;
    }

    default:
      return false;
  }
}

export function mediaFilePath(media: MediaRow): string {
  return path.join(UPLOAD_DIR, media.filename);
}

export function mediaExists(media: MediaRow): boolean {
  return fs.existsSync(/*turbopackIgnore: true*/ mediaFilePath(media));
}

export function readMedia(media: MediaRow): Buffer {
  return fs.readFileSync(/*turbopackIgnore: true*/ mediaFilePath(media));
}
