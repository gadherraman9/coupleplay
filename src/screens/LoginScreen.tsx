import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Check, Gamepad2, Heart, Lock, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import hero from "../assets/coupleplay-hero.jpg";
import { api } from "../backend/store";

type Mode = "welcome" | "signup" | "login";

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("welcome");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageError, setAgeError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const needAge = () => {
    if (ageConfirmed) return false;
    setAgeError(true);
    return true;
  };

  const run = async (fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const submitAccount = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "signup" && needAge()) return;
    void run(() => (mode === "signup" ? api.signUp(username, password, displayName) : api.logIn(username, password)));
  };

  return (
    <div className="login-screen">
      <span className="floating-heart floating-heart--one" aria-hidden="true">
        <Heart size={18} fill="currentColor" />
      </span>
      <span className="floating-heart floating-heart--two" aria-hidden="true">
        <Heart size={12} fill="currentColor" />
      </span>
      <span className="floating-heart floating-heart--three" aria-hidden="true">
        <Heart size={14} fill="currentColor" />
      </span>
      <span className="floating-heart floating-heart--four" aria-hidden="true">
        <Sparkles size={18} />
      </span>

      <header className="login-brand">
        <div className="brand-mark">
          <Heart size={30} fill="currentColor" strokeWidth={1.5} />
          <span className="brand-spark">
            <Sparkles size={13} />
          </span>
        </div>
        <h1>
          Couple<span>Play</span>
        </h1>
        <p>Connect · Play · Chat · Create Memories</p>
      </header>

      {mode === "welcome" ? (
        <>
          <div className="login-hero">
            <img src={hero} alt="A couple sharing earbuds and looking at a phone together" />
            <span className="hero-pill">
              <Heart size={12} fill="currentColor" />
              Made for two
            </span>
          </div>

          <div className="login-chips" aria-hidden="true">
            <span>
              <ShieldCheck size={13} /> 18+ only
            </span>
            <span>
              <Lock size={13} /> Private chats
            </span>
            <span>
              <Gamepad2 size={13} /> 6 games
            </span>
          </div>

          <div className="login-form">
            <label className={`age-confirm ${ageError ? "has-error" : ""}`}>
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => {
                  setAgeConfirmed(event.target.checked);
                  setAgeError(false);
                }}
              />
              <span className="checkbox-ui">
                <Check size={12} strokeWidth={3.2} />
              </span>
              <span>I confirm I am 18 years or older</span>
            </label>
            {ageError && (
              <p className="login-error" role="alert">
                Please confirm you're 18+ to continue.
              </p>
            )}
            {error && <p className="login-error" role="alert">{error}</p>}

            <button
              className="google-btn guest-btn"
              type="button"
              disabled={loading}
              onClick={() => !needAge() && void run(() => api.continueAsGuest())}
            >
              {loading ? <span className="spinner" aria-hidden="true" /> : <UserRound size={18} />}
              Play as guest
            </button>
            <button className="primary-btn" type="button" onClick={() => !needAge() && setMode("signup")}>
              Create account
            </button>
            <button className="text-link login-switch" type="button" onClick={() => setMode("login")}>
              I already have an account — Log in
            </button>
            <p className="login-legal">
              Guests get a random name. Sign up any time to keep your friends and chats.
            </p>
          </div>
        </>
      ) : (
        <form className="login-form account-form" onSubmit={submitAccount}>
          <button type="button" className="round-btn" onClick={() => setMode("welcome")} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <h2>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. rama_22"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </label>
          {mode === "signup" && (
            <label className="field">
              <span>Display name</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="What friends see" maxLength={24} />
            </label>
          )}
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "signup" ? "Sign up" : "Log in"}
          </button>
          <button className="text-link login-switch" type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
            {mode === "signup" ? "Have an account? Log in" : "New here? Create an account"}
          </button>
        </form>
      )}
    </div>
  );
}
