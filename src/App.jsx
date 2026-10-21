
import {
  CalendarDays,
  ChartNoAxesCombined,
  Droplets,
  Heart,
  House,
  Settings,
  Thermometer,
  ChevronRight,
  Plus,
  Menu,
  X,
  Flower2,
  LogOut,
  Mail,
  LockKeyhole,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import PeriodTracker from "./PeriodTracker";
import BBTTracker from "./BBTTracker";
import ActivityLog from "./ActivityLog";
import CycleTrends from "./CycleTrends";
import "./styles/dashboard.css";

const navigation = [
  { label: "Overview", icon: House },
  { label: "Calendar", icon: CalendarDays },
  { label: "BBT Tracking", icon: Thermometer },
  { label: "Activity Log", icon: Heart },
  { label: "Cycle Trends", icon: ChartNoAxesCombined },
];

function AuthScreen() {
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (isCreatingAccount) {
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
      }
    } catch (err) {
      const messages = {
        "auth/email-already-in-use":
          "An account already exists with this email. Try signing in instead.",
        "auth/invalid-email":
          "Please enter a valid email address.",
        "auth/weak-password":
          "Your password must be at least 6 characters long.",
        "auth/invalid-credential":
          "Your email or password is incorrect. Please try again.",
        "auth/user-not-found":
          "No account was found with that email. You can create an account instead.",
        "auth/wrong-password":
          "Your email or password is incorrect. Please try again.",
        "auth/too-many-requests":
          "There have been too many attempts. Please wait a little before trying again.",
        "auth/network-request-failed":
          "Unable to connect. Check your internet connection and try again.",
        "auth/operation-not-allowed":
          "Email and password sign-in is not enabled in Firebase Authentication.",
      };

      setError(
        messages[err.code] ||
          "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    border: "1px solid #eee4f0",
    borderRadius: "10px",
    background: "#fffafd",
    color: "#352b3a",
    fontFamily: "inherit",
    fontSize: "15px",
    outlineOffset: "3px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        background:
          "linear-gradient(145deg, #fffafd 0%, #f8effa 55%, #fdf1f6 100%)",
        color: "#352b3a",
        fontFamily: "'Playfair Display', serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px",
          boxSizing: "border-box",
          background: "#ffffff",
          border: "1px solid #eee4f0",
          borderRadius: "22px",
          boxShadow: "0 16px 45px rgba(91, 64, 105, 0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div
            style={{
              width: "58px",
              height: "58px",
              margin: "0 auto 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "18px",
              background: "#f5eafa",
              color: "#9b78ad",
            }}
          >
            <Flower2 size={32} strokeWidth={1.4} />
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "36px",
              fontWeight: 500,
              letterSpacing: "1px",
            }}
          >
            petal
          </h1>

          <p
            style={{
              margin: 0,
              color: "#766b7d",
              fontSize: "12px",
              letterSpacing: "2px",
            }}
          >
            YOUR CYCLE JOURNAL
          </p>
        </div>

        <h2
          style={{
            margin: "0 0 8px",
            fontSize: "23px",
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          {isCreatingAccount ? "Create your account" : "Welcome back"}
        </h2>

        <p
          style={{
            margin: "0 0 26px",
            color: "#766b7d",
            textAlign: "center",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          {isCreatingAccount
            ? "Create your personal space to keep your cycle journal with you."
            : "Sign in to access your personal cycle journal."}
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="petal-email"
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
            }}
          >
            Email address
          </label>

          <div style={{ position: "relative", marginBottom: "20px" }}>
            <Mail
              size={18}
              strokeWidth={1.6}
              style={{
                position: "absolute",
                left: "13px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9a8ba1",
                pointerEvents: "none",
              }}
            />
            <input
              id="petal-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              style={{ ...inputStyle, paddingLeft: "42px" }}
            />
          </div>

          <label
            htmlFor="petal-password"
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
            }}
          >
            Password
          </label>

          <div style={{ position: "relative", marginBottom: "16px" }}>
            <LockKeyhole
              size={18}
              strokeWidth={1.6}
              style={{
                position: "absolute",
                left: "13px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9a8ba1",
                pointerEvents: "none",
              }}
            />
            <input
              id="petal-password"
              type="password"
              autoComplete={
                isCreatingAccount ? "new-password" : "current-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              style={{ ...inputStyle, paddingLeft: "42px" }}
            />
          </div>

          {error && (
            <p
              role="alert"
              style={{
                margin: "0 0 16px",
                padding: "12px",
                borderRadius: "9px",
                background: "#fff0f2",
                color: "#a13c54",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "14px",
              border: "none",
              borderRadius: "10px",
              background: isSubmitting ? "#cdb4db" : "#b994ca",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: "15px",
              cursor: isSubmitting ? "wait" : "pointer",
              marginTop: "8px",
            }}
          >
            {isSubmitting
              ? "Please wait..."
              : isCreatingAccount
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p
          style={{
            margin: "24px 0 0",
            textAlign: "center",
            fontSize: "14px",
            color: "#766b7d",
            lineHeight: 1.8,
          }}
        >
          {isCreatingAccount
            ? "Already have an account?"
            : "New to petal?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsCreatingAccount(!isCreatingAccount);
              setError("");
            }}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              color: "#9369a8",
              fontFamily: "inherit",
              fontSize: "14px",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {isCreatingAccount ? "Sign in" : "Create an account"}
          </button>
        </p>

        <p
          style={{
            margin: "28px 0 0",
            color: "#938698",
            fontSize: "12px",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          Your personal space to learn about your cycle.
        </p>
      </section>
    </main>
  );
}

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  async function handleSignOut() {
    setSignOutError("");

    try {
      await signOut(auth);
    } catch {
      setSignOutError("Unable to sign out. Please try again.");
    }
  }

  function navigateTo(page) {
    setActivePage(page);
    setMenuOpen(false);
  }

  if (authLoading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          background: "#fffafd",
          color: "#766b7d",
          fontFamily: "'Playfair Display', serif",
        }}
      >
        <Flower2 size={38} strokeWidth={1.3} color="#b994ca" />
        <p>Opening your personal space...</p>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Flower2 size={27} strokeWidth={1.5} />
          </div>

          <div>
            <h2 className="brand-name">petal</h2>
            <p className="brand-subtitle">YOUR CYCLE JOURNAL</p>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <p className="nav-heading">YOUR SPACE</p>

        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-link ${
                activePage === label ? "nav-link-active" : ""
              }`}
              onClick={() => navigateTo(label)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>

              {activePage === label && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Flower2 size={23} strokeWidth={1.4} />
            <p>
              Every cycle is different.
              <br />
              Get to know yours.
            </p>
          </div>

          <button
            className={`nav-link ${
              activePage === "Settings" ? "nav-link-active" : ""
            }`}
            onClick={() => navigateTo("Settings")}
          >
            <Settings size={19} strokeWidth={1.7} />
            <span>Settings</span>

            {activePage === "Settings" && (
              <span className="nav-indicator" />
            )}
          </button>

          <button
            className="nav-link"
            onClick={handleSignOut}
            style={{ marginTop: "8px" }}
          >
            <LogOut size={19} strokeWidth={1.7} />
            <span>Sign out</span>
          </button>

          {signOutError && (
            <p role="alert" style={{ fontSize: "12px", color: "#a13c54" }}>
              {signOutError}
            </p>
          )}

          <p className="sidebar-footer">YOUR BODY, YOUR STORY.</p>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={23} />
          </button>

          <span className="topbar-label">
            YOUR PERSONAL CYCLE TRACKER
          </span>

          <div className="topbar-status">
            <span className="status-dot" />
            Your personal space
          </div>
        </header>

        <div className="page-content">
          {activePage === "Overview" ? (
            <>
              <section className="welcome-section">
                <div>
                  <p className="eyebrow">A LITTLE SPACE FOR YOU</p>
                  <h1>Hello, lovely.</h1>
                  <p className="welcome-description">
                    Your cycle, at a glance.
                  </p>
                </div>

                <div className="welcome-flower" aria-hidden="true">
                  <Flower2 size={76} strokeWidth={0.8} />
                </div>
              </section>

              <section className="cycle-banner">
                <div className="cycle-banner-copy">
                  <span className="banner-label">YOUR CYCLE</span>
                  <h2>Your story starts here.</h2>
                  <p>
                    Log your cycle and temperature to start
                    discovering your personal patterns.
                  </p>

                  <button
                    className="button-primary"
                    onClick={() => navigateTo("Calendar")}
                  >
                    <Plus size={17} />
                    Log your cycle
                  </button>
                </div>

                <div className="banner-decoration" aria-hidden="true">
                  <div className="banner-circle banner-circle-one" />
                  <div className="banner-circle banner-circle-two" />
                  <Flower2 size={100} strokeWidth={0.8} />
                </div>
              </section>

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">YOUR DAILY JOURNAL</p>
                    <h2>Quick log</h2>
                  </div>

                  <span className="section-caption">
                    Start wherever you are
                  </span>
                </div>

                <div className="quick-log-grid">
                  <button
                    className="quick-log-card quick-log-period"
                    onClick={() => navigateTo("Calendar")}
                  >
                    <span className="quick-log-icon">
                      <Droplets size={22} />
                    </span>
                    <span className="quick-log-title">
                      Period &amp; flow
                    </span>
                    <span className="quick-log-description">
                      Record your flow
                    </span>
                    <ChevronRight
                      className="quick-log-arrow"
                      size={19}
                    />
                  </button>

                  <button
                    className="quick-log-card quick-log-bbt"
                    onClick={() => navigateTo("BBT Tracking")}
                  >
                    <span className="quick-log-icon">
                      <Thermometer size={22} />
                    </span>
                    <span className="quick-log-title">
                      Temperature
                    </span>
                    <span className="quick-log-description">
                      Log your BBT
                    </span>
                    <ChevronRight
                      className="quick-log-arrow"
                      size={19}
                    />
                  </button>

                  <button
                    className="quick-log-card quick-log-activity"
                    onClick={() => navigateTo("Activity Log")}
                  >
                    <span className="quick-log-icon">
                      <Heart size={22} />
                    </span>
                    <span className="quick-log-title">
                      Activity Log
                    </span>
                    <span className="quick-log-description">
                      Add a personal entry
                    </span>
                    <ChevronRight
                      className="quick-log-arrow"
                      size={19}
                    />
                  </button>
                </div>
              </section>

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">GETTING TO KNOW YOU</p>
                    <h2>Your cycle at a glance</h2>
                  </div>
                </div>

                <div className="stats-grid">
                  <article className="stat-card">
                    <span className="stat-icon stat-icon-pink">
                      <CalendarDays size={20} />
                    </span>
                    <p className="stat-label">Average cycle</p>
                    <p className="stat-value">
                      -- <span>days</span>
                    </p>
                    <p className="stat-note">
                      Build your history first
                    </p>
                  </article>

                  <article className="stat-card">
                    <span className="stat-icon stat-icon-purple">
                      <Droplets size={20} />
                    </span>
                    <p className="stat-label">Average period</p>
                    <p className="stat-value">
                      -- <span>days</span>
                    </p>
                    <p className="stat-note">
                      Based on your entries
                    </p>
                  </article>

                  <article className="stat-card">
                    <span className="stat-icon stat-icon-blue">
                      <Thermometer size={20} />
                    </span>
                    <p className="stat-label">Latest BBT</p>
                    <p className="stat-value">
                      -- <span>°F</span>
                    </p>
                    <p className="stat-note">
                      Your latest reading
                    </p>
                  </article>
                </div>
              </section>

              <section className="getting-started">
                <div className="getting-started-icon">
                  <Heart size={22} strokeWidth={1.5} />
                </div>
                <div>
                  <h3>A note to remember</h3>
                  <p>
                    Your patterns take time to emerge. Start logging
                    when you're ready, and your personal trends will
                    grow with you.
                  </p>
                </div>
              </section>
            </>
          ) : activePage === "Calendar" ? (
            <PeriodTracker />
          ) : activePage === "BBT Tracking" ? (
            <BBTTracker />
          ) : activePage === "Activity Log" ? (
            <ActivityLog />
          ) : activePage === "Cycle Trends" ? (
            <CycleTrends />
          ) : (
            <section className="placeholder-page">
              <div className="placeholder-icon">
                {activePage === "Settings" && <Settings size={30} />}
              </div>

              <h2>{activePage}</h2>

              <p>
                This is where your {activePage.toLowerCase()} tools
                will live. We'll build this section next.
              </p>

              <button
                className="button-primary"
                onClick={() => navigateTo("Overview")}
              >
                Back to overview
              </button>
            </section>
          )}

          <footer className="app-footer">
            <span>petal · YOUR PERSONAL CYCLE JOURNAL</span>
            <span>Made for you, with care.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
