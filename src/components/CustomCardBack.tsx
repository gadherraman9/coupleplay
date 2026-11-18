import { useEffect, useId, useRef, useState } from "react";
import { useApp } from "../context";
import { compressImage } from "../lib/media";
import { isCardPhoto, MAX_CARD_PHOTO_BYTES, saveCustomCardBack, useCustomCardBack } from "../skins";
import "./CustomCardBack.css";

export async function prepareCardPhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image.");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image no larger than 5 MB.");
  let photo: string;
  try {
    photo = await compressImage(file, 320, .7);
  } catch {
    throw new Error("Couldn't read that image. Try another JPEG, PNG or WebP.");
  }
  if (photo.length > MAX_CARD_PHOTO_BYTES) throw new Error("That photo is still over 150 KB after resizing. Try a simpler image.");
  if (!isCardPhoto(photo)) throw new Error("Couldn't resize that image. Try another photo.");
  try {
    const image = new Image();
    image.src = photo;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Empty image");
  } catch {
    throw new Error("Couldn't read that image. Try another photo.");
  }
  return photo;
}

// Key the editor by account so a draft can never be applied to the next user.
export default function CustomCardBack() {
  const { me } = useApp();
  return <PhotoEditor key={me.id} userId={me.id} />;
}

function PhotoEditor({ userId }: { userId: string }) {
  const photo = useCustomCardBack(userId);
  const [draft, setDraft] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const id = useId();
  useEffect(() => () => { request.current += 1; }, []);

  const select = async (file: File) => {
    const ticket = ++request.current;
    setBusy(true);
    setError("");
    try {
      const next = await prepareCardPhoto(file);
      if (ticket === request.current) setDraft(next);
    } catch (err) {
      if (ticket === request.current) setError(err instanceof Error ? err.message : "Couldn't read that image.");
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  };

  const save = (remove = false) => {
    setError("");
    try {
      if (!remove && !draft) return;
      if (!remove || photo) saveCustomCardBack(userId, remove ? undefined : draft);
      setDraft(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the photo setting.");
    }
  };

  const preview = draft ?? photo;
  const isDraft = Boolean(draft && draft !== photo);
  return (
    <section className={`custom-card-back ${photo ? "is-active" : ""}`} aria-label="Custom photo card back" aria-busy={busy}>
      <div className="custom-card-back__preview">
        {preview ? <img src={preview} alt="Custom card back preview" /> : <span>Your<br />photo</span>}
      </div>
      <div className="custom-card-back__body">
        <strong>Photo card back</strong>
        <p id={`${id}-privacy`}>Only visible on this device; not uploaded</p>
        <p id={`${id}-limits`}>JPEG, PNG or WebP · up to 5 MB. Cropped to fill the card.</p>
        <label className="custom-card-back__choose" htmlFor={id}>Choose image</label>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-describedby={`${id}-privacy ${id}-limits`} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void select(file);
        }} />
        <div className="custom-card-back__actions">
          <button type="button" disabled={busy || !isDraft} onClick={() => save()}>Apply photo</button>
          <button type="button" disabled={busy || !preview} onClick={() => save(true)}>Remove photo</button>
        </div>
        <small role="status">{busy ? "Preparing preview…" : isDraft ? "Preview · not applied" : photo ? "In use on this device" : "Your catalog back is in use"}</small>
        {error && <p className="custom-card-back__error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
