import { useState } from "react";
import type { FormEvent } from "react";
import { Check, Gamepad2, Heart, Lock, ShieldCheck, Sparkles } from "lucide-react";
import hero from "../assets/coupleplay-hero.jpg";

interface LoginScreenProps {
  onLogin: () => void;
}

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3a7.19 7.19 0 0 1-10.72-3.78H1.32v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.35 14.31a7.2 7.2 0 0 1 0-4.62V6.6H1.32a12 12 0 0 0 0 10.8l4.03-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.32 6.6l4.03 3.09A7.17 7.17 0 0 1 12 4.75z"
      />
    </svg>
  );
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!ageConfirmed) {
      setError(true);
      return;
    }
    setLoading(true);
    window.setTimeout(onLogin, 750);
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
          <Gamepad2 size={13} /> Game nights
        </span>
      </div>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <label className={`age-confirm ${error ? "has-error" : ""}`}>
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(event) => {
              setAgeConfirmed(event.target.checked);
              if (error) setError(false);
            }}
          />
          <span className="checkbox-ui">
            <Check size={12} strokeWidth={3.2} />
          </span>
          <span>I confirm I am 18 years or older</span>
        </label>

        {error && (
          <p className="login-error" role="alert">
            Please confirm you're 18+ to continue.
          </p>
        )}

        <button className="google-btn" type="submit" disabled={loading}>
          {loading ? <span className="spinner" aria-hidden="true" /> : <GoogleMark />}
          {loading ? "Signing you in..." : "Continue with Google"}
        </button>

        <p className="login-legal">
          By continuing you agree to our <span>Terms</span> &amp; <span>Privacy Policy</span>.
        </p>
      </form>
    </div>
  );
}
