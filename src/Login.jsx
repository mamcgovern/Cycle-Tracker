import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Flower2 } from "lucide-react";
import { auth } from "./firebase";
import "./styles/login.css";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Your password must be at least 6 characters long.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (authError) {
      const messages = {
        "auth/invalid-email": "Enter a valid email address.",
        "auth/user-not-found": "No account was found with that email. Check it or create an account.",
        "auth/invalid-credential": "Your email or password is incorrect.",
        "auth/wrong-password": "Your email or password is incorrect.",
        "auth/email-already-in-use": "An account already exists for this email. Try signing in instead.",
        "auth/weak-password": "Choose a stronger password with at least 6 characters.",
        "auth/too-many-requests": "Too many attempts. Please wait a little while and try again.",
        "auth/operation-not-allowed": "Email and password sign-in is not enabled in Firebase yet. Enable it in Firebase Console under Authentication, Sign-in method.",
      };
      setError(messages[authError.code] || authError.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand-mark"><Flower2 size={32} strokeWidth={1.4} /></div>
        <p className="login-eyebrow">YOUR PERSONAL CYCLE JOURNAL</p>
        <h1 id="login-title">petal</h1>
        <p className="login-intro">
          {mode === "login" ? "Welcome back to your space." : "Create your personal cycle journal."}
        </p>

        <div className="login-tabs" role="group" aria-label="Account options">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Sign in</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Create account</button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="petal-email">Email address</label>
          <input id="petal-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

          <label htmlFor="petal-password">Password</label>
          <input id="petal-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />

          {mode === "signup" && <>
            <label htmlFor="petal-confirm-password">Confirm password</label>
            <input id="petal-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
          </>}

          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="login-footnote">Your cycle journal is personal. Sign in to access your records.</p>
      </section>
    </main>
  );
}
