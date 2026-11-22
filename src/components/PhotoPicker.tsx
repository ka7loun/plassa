"use client";

import { useRef, useState } from "react";
import { api, errorText, useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { Alert } from "./Shell";
import { thumbUrl } from "./SpotThumb";

export const MAX_PHOTOS = 6;
const MAX_SIDE = 1200;

/** Phone photos are often 4000 px and 5 MB: shrink to 1200 px JPEG before upload. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82));
}

export function PhotoPicker({ value, onChange }: { value: string[]; onChange: (photos: string[]) => void }) {
  const { t } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - value.length)) {
        const blob = await shrink(file);
        const r = await api<{ url: string }>("/api/photos", { method: "POST", body: blob, headers: { "content-type": "image/jpeg" } });
        added.push(r.url);
      }
    } catch (e) {
      setErr(e);
    } finally {
      onChange([...value, ...added]);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-3 gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl(url)} alt="" className="aspect-[4/3] w-full rounded-xl bg-blue-50 object-cover" />
            <button
              type="button"
              aria-label={t.host.fRemovePhoto}
              onClick={() => onChange(value.filter((_, k) => k !== i))}
              className="absolute end-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-navy/80 text-white"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
        {value.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="grid aspect-[4/3] w-full place-items-center rounded-xl border-2 border-dashed border-line text-xs font-semibold text-navy-50 hover:border-blue hover:text-blue"
            data-testid="add-photo"
          >
            <span className="grid justify-items-center gap-1">
              <Icon name="camera" size={22} />
              {busy ? t.host.uploading : t.host.fAddPhoto}
            </span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => add(e.target.files)} data-testid="photo-input" />
      {err ? <Alert>{errorText(t, err)}</Alert> : null}
    </div>
  );
}
