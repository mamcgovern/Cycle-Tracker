
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
} from "lucide-react";
import { useState } from "react";
import PeriodTracker from "./PeriodTracker";
import BBTTracker from "./BBTTracker";
import ActivityLog from "./ActivityLog";
import "./styles/dashboard.css";

const navigation = [
  { label: "Overview", icon: House },
  { label: "Calendar", icon: CalendarDays },
  { label: "BBT Tracking", icon: Thermometer },
  { label: "Activity Log", icon: Heart },
  { label: "Cycle Trends", icon: ChartNoAxesCombined },
];

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);

  function navigateTo(page) {
    setActivePage(page);
    setMenuOpen(false);
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

              {activePage === label && (
                <span className="nav-indicator" />
              )}
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

                <div
                  className="banner-decoration"
                  aria-hidden="true"
                >
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
          ) : (
            <section className="placeholder-page">
              <div className="placeholder-icon">
                {activePage === "Cycle Trends" && (
                  <ChartNoAxesCombined size={30} />
                )}

                {activePage === "Settings" && (
                  <Settings size={30} />
                )}
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
