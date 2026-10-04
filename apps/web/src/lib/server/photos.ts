/**
 * Where item photos live, behind one small interface.
 *
 * - Local (PGlite, dev, demo): files under .data/uploads/, served by
 *   /api/photos/... only with a valid signature that expires.
 * - Supabase (production): the private `item-photos` bucket. Only the server
 *   (secret key) can read or write it; browsers get signed URLs.
 *
 * Either way a photo URL is short-lived and unguessable, and the server only
 * hands one out for a photo the viewer may see (students: Full items only;
 * the data layer never even gives us the path for Limited items).
 *
 * Paths always look like "<school_id>/<random>.<ext>". The database checks
 * that prefix too (constraint photo_in_school_folder).
 */
import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "@/lib/db/data-dir";
import { appEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/repo/supabase";

export type PhotoExt = "jpg" | "svg";

export interface PhotoStore {
  save(schoolId: string, bytes: Uint8Array, ext: PhotoExt): Promise<string>;
  url(photoPath: string): Promise<string | null>;
  /** Deletes the file. Throws if storage refuses; a file that's already gone is fine. */
  remove(photoPath: string): Promise<void>;
}

export const PHOTO_BUCKET = "item-photos";
const URL_TTL_SECONDS = 60 * 60;
const CONTENT_TYPES: Record<PhotoExt, string> = { jpg: "image/jpeg", svg: "image/svg+xml" };

const SAFE_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,80}\.(jpg|svg)$/;

export function isSafePhotoPath(p: string): boolean {
  return SAFE_PATH.test(p);
}

export function newPhotoPath(schoolId: string, ext: PhotoExt): string {
  return `${schoolId}/${randomUUID()}.${ext}`;
}

/**
 * URLs expire at the end of the next full hour, so the same photo gets the
 * same URL for a while and the browser can cache it.
 */
function expiry(now = Date.now()): number {
  return Math.ceil((now / 1000 + URL_TTL_SECONDS) / URL_TTL_SECONDS) * URL_TTL_SECONDS;
}

export function signLocalPhoto(photoPath: string, exp: number, secret: string): string {
  return createHmac("sha256", secret).update(`photo:${photoPath}:${exp}`).digest("base64url");
}

export function verifyLocalPhoto(photoPath: string, exp: number, sig: string, secret: string, now = Date.now()): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = Buffer.from(signLocalPhoto(photoPath, exp, secret));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function localUploadsDir(): string {
  return uploadsDir();
}

export function contentTypeFor(photoPath: string): string {
  return CONTENT_TYPES[photoPath.split(".").pop() as PhotoExt] ?? "application/octet-stream";
}

/** Exported for tests, which point it at a temporary folder. */
export function localStore(secret: string, root: string = localUploadsDir()): PhotoStore {
  return {
    async save(schoolId, bytes, ext) {
      const p = newPhotoPath(schoolId, ext);
      await mkdir(path.join(root, schoolId), { recursive: true });
      await writeFile(path.join(root, p), bytes);
      return p;
    },
    async url(photoPath) {
      if (!isSafePhotoPath(photoPath)) return null;
      const exp = expiry();
      return `/api/photos/${photoPath}?exp=${exp}&sig=${signLocalPhoto(photoPath, exp, secret)}`;
    },
    async remove(photoPath) {
      if (isSafePhotoPath(photoPath)) await rm(path.join(root, photoPath), { force: true });
    },
  };
}

export async function readLocalPhoto(photoPath: string): Promise<Buffer | null> {
  if (!isSafePhotoPath(photoPath)) return null;
  try {
    return await readFile(path.join(localUploadsDir(), photoPath));
  } catch {
    return null;
  }
}

function supabaseStore(): PhotoStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("DATA_ADAPTER=supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  const bucket = () => createServiceClient(url, secretKey).storage.from(PHOTO_BUCKET);
  return {
    async save(schoolId, bytes, ext) {
      const p = newPhotoPath(schoolId, ext);
      const { error } = await bucket().upload(p, bytes, { contentType: CONTENT_TYPES[ext], upsert: false });
      if (error) throw new Error(`Photo upload failed: ${error.message}`);
      return p;
    },
    async url(photoPath) {
      if (!isSafePhotoPath(photoPath)) return null;
      const { data, error } = await bucket().createSignedUrl(photoPath, URL_TTL_SECONDS);
      return error ? null : data.signedUrl;
    },
    async remove(photoPath) {
      if (!isSafePhotoPath(photoPath)) return;
      // Removing a file that's already gone is not an error in Supabase Storage.
      const { error } = await bucket().remove([photoPath]);
      if (error) throw new Error(`Photo delete failed: ${error.message}`);
    },
  };
}

const globalForPhotos = globalThis as unknown as { lostboxPhotos?: PhotoStore };

export function photoStore(): PhotoStore {
  const env = appEnv();
  globalForPhotos.lostboxPhotos ??= env.dataAdapter === "supabase" ? supabaseStore() : localStore(env.sessionSecret);
  return globalForPhotos.lostboxPhotos;
}
