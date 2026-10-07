"use client";

/**
 * Photo picker for item intake. On phones it opens the camera.
 *
 * Before upload, the photo is shrunk in the browser to at most 1600px. That
 * keeps uploads small (Vercel limits request size to 4.5MB) and fast on school
 * Wi-Fi. The server still checks, rotates, re-encodes, and strips EXIF itself
 * (src/lib/server/images.ts); this step is only for speed.
 *
 * TODO(SPEC T0.4, face blur): blur faces HERE, on the device, before the photo
 * is uploaded, so an unblurred face never leaves the phone. Not built yet.
 * Until then the help text asks staff to keep people out of the shot, and
 * staff can remove any item.
 */
import { useId, useRef, useState } from "react";
import { t } from "@/lib/i18n";

const MAX_SIDE = 1600;

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
}

export function PhotoInput({ currentUrl, error }: { currentUrl?: string | null; error?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const shown = preview ?? (removed ? null : currentUrl ?? null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const small = await shrink(file);
      // Swap the shrunk file into the input so the form submits it instead.
      const dt = new DataTransfer();
      dt.items.add(small);
      e.target.files = dt.files;
      setPreview(URL.createObjectURL(small));
      setRemoved(false);
    } catch {
      setPreview(URL.createObjectURL(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium" id={`${id}-label`}>
        {t("intake.photo")} <span className="font-normal text-muted">({t("common.optional")})</span>
      </span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex aspect-square w-full max-w-48 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-tint bg-background">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <svg aria-hidden viewBox="0 0 24 24" className="size-12 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor={id}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border-tint bg-background px-4 font-semibold hover:bg-accent-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
          >
            {busy ? "…" : shown ? t("intake.photo.replace") : t("intake.photo.take")}
            <input
              ref={input}
              id={id}
              name="photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
              onChange={onChange}
            />
          </label>
          {currentUrl && !preview ? (
            <label className="inline-flex min-h-11 items-center gap-2">
              <input type="checkbox" name="removePhoto" className="size-5" checked={removed} onChange={(e) => setRemoved(e.target.checked)} />
              {t("intake.photo.remove")}
            </label>
          ) : null}
          <p id={`${id}-help`} className="max-w-sm text-sm text-muted">
            {t("intake.photo.help")}
          </p>
          {error ? (
            <p id={`${id}-error`} className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
