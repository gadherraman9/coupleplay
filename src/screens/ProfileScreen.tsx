import { useState } from "react";
import type { FormEvent } from "react";
import { Dices, Heart, LogOut, Palette, ShieldCheck } from "lucide-react";
import { UserAvatar } from "../components/Avatar";
import { api, friendIds, randomGuestName } from "../backend/store";
import { attempt, useApp } from "../context";

const HUES = [330, 285, 215, 190, 160, 40, 20, 0];

export default function ProfileScreen({ onOpenShop }: { onOpenShop: () => void }) {
  const { db, me, notify } = useApp();
  const [name, setName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    attempt(notify, () => {
      api.updateProfile(me.id, {
        displayName: name,
        ...(me.isGuest ? { username } : {}),
      });
      notify("Profile saved");
    });
  };

  const signUp = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.upgradeGuest(me.id, username, password);
      notify("Account saved! +50 hearts 🎉");
      setPassword("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't sign up");
    } finally {
      setBusy(false);
    }
  };

  const randomName = () => {
    const next = randomGuestName();
    setName(next);
    if (me.isGuest) setUsername(next.toLowerCase());
  };

  return (
    <div className="screen profile-screen">
      <header className="profile-head">
        <UserAvatar id={me.id} size={84} />
        <h1>{me.displayName}</h1>
        <p>{me.isGuest ? "Guest account" : `@${me.username}`}</p>
        <div className="profile-stats">
          <span><Heart size={14} fill="currentColor" /> {me.hearts} hearts</span>
          <span>{friendIds(db, me.id).length} friends</span>
          <span>🔥 {me.streak} days</span>
        </div>
      </header>

      {me.isGuest && (
        <form className="card signup-card" onSubmit={signUp}>
          <h3><ShieldCheck size={17} /> Save your account</h3>
          <p>Guests lose everything when they log out. Pick a password to keep your friends, chats, hearts and themes (+50 hearts).</p>
          <label className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete="new-password" />
          </label>
          <button type="submit" className="primary-btn" disabled={busy || password.length < 6}>
            {busy ? "Saving…" : "Sign up & keep my data"}
          </button>
        </form>
      )}

      <form className="card profile-form" onSubmit={saveProfile}>
        <h3>Profile</h3>
        <label className="field">
          <span>Display name</span>
          <span className="field-row">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
            <button type="button" className="round-btn round-btn--small" onClick={randomName} aria-label="Random name">
              <Dices size={16} />
            </button>
          </span>
        </label>
        {me.isGuest && (
          <label className="field">
            <span>Temporary username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
          </label>
        )}
        <div className="field">
          <span>Avatar color</span>
          <div className="hue-row">
            {HUES.map((hue) => (
              <button
                key={hue}
                type="button"
                className={`hue-dot ${me.hue === hue ? "is-active" : ""}`}
                style={{ background: `linear-gradient(140deg, hsl(${hue} 88% 76%), hsl(${hue + 32} 78% 60%))` }}
                onClick={() => api.updateProfile(me.id, { hue })}
                aria-label={`Avatar color ${hue}`}
              />
            ))}
          </div>
        </div>
        <button type="submit" className="primary-btn">Save</button>
      </form>

      <div className="card menu-list">
        <button type="button" onClick={onOpenShop}>
          <Palette size={18} /> Theme shop
        </button>
        <button type="button" className="is-danger" onClick={() => (me.isGuest && !confirmLogout ? setConfirmLogout(true) : api.logOut())}>
          <LogOut size={18} /> {confirmLogout ? "Tap again — guest data will be lost" : "Log out"}
        </button>
      </div>
    </div>
  );
}
