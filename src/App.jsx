
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
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import PeriodTracker from "./PeriodTracker";
import BBTTracker from "./BBTTracker";
import ActivityLog from "./ActivityLog";
import CycleTrends from "./CycleTrends";
import "./styles/dashboard.css";

const PERIOD_STORAGE_KEY = "petal-period-entries";
const BBT_STORAGE_KEY = "petal-bbt-entries";

const navigation = [
  { label: "Overview", icon: House },
  { label: "Calendar", icon: CalendarDays },
  { label: "BBT Tracking", icon: Thermometer },
  { label: "Activity Log", icon: Heart },
  { label: "Cycle Trends", icon: ChartNoAxesCombined },
];

function readStorage(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(firstDate, secondDate) {
  return Math.round(
    (parseDate(secondDate).getTime() -
      parseDate(firstDate).getTime()) /
      86400000
  );
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getBleedingDays(periodEntries) {
  return Object.entries(periodEntries)
    .filter(([, entry]) =>
      ["light", "medium", "heavy"].includes(entry?.flow)
    )
    .map(([date]) => date)
    .sort((a, b) => a.localeCompare(b));
}

function buildPeriodEpisodes(bleedingDays) {
  const episodes = [];

  bleedingDays.forEach((date) => {
    const currentEpisode = episodes[episodes.length - 1];

    if (
      !currentEpisode ||
      daysBetween(currentEpisode[currentEpisode.length - 1], date) !== 1
    ) {
      episodes.push([date]);
    } else {
      currentEpisode.push(date);
    }
  });

  return episodes;
}

function getTemperatureFahrenheit(entry) {
  const temperature = Number(entry?.temperature);

  if (!Number.isFinite(temperature)) return null;

  return entry.unit === "°C"
    ? (temperature * 9) / 5 + 32
    : temperature;
}

function formatDate(dateString) {
  return parseDate(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [periodEntries, setPeriodEntries] = useState(() =>
    readStorage(PERIOD_STORAGE_KEY)
  );

  const [bbtEntries, setBbtEntries] = useState(() =>
    readStorage(BBT_STORAGE_KEY)
  );

  function navigateTo(page) {
    setActivePage(page);
    setMenuOpen(false);
  }

  // Keep overview data synchronized with the same Firestore collections
  // used by the period tracker and BBT tracker.
  useEffect(() => {
    let unsubscribePeriod = null;
    let unsubscribeBBT = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribePeriod?.();
      unsubscribeBBT?.();

      unsubscribePeriod = null;
      unsubscribeBBT = null;

      if (!user) {
        setPeriodEntries(readStorage(PERIOD_STORAGE_KEY));
        setBbtEntries(readStorage(BBT_STORAGE_KEY));
        return;
      }

      unsubscribePeriod = onSnapshot(
        collection(db, "users", user.uid, "periodEntries"),
        (snapshot) => {
          const entries = {};

          snapshot.forEach((entryDoc) => {
            entries[entryDoc.id] = entryDoc.data();
          });

          setPeriodEntries(entries);

          try {
            localStorage.setItem(
              PERIOD_STORAGE_KEY,
              JSON.stringify(entries)
            );
          } catch (error) {
            console.error("Unable to cache period entries:", error);
          }
        },
        (error) => {
          console.error("Overview period sync error:", error);
        }
      );

      unsubscribeBBT = onSnapshot(
        collection(db, "users", user.uid, "bbtEntries"),
        (snapshot) => {
          const entries = {};

          snapshot.forEach((entryDoc) => {
            entries[entryDoc.id] = entryDoc.data();
          });

          setBbtEntries(entries);

          try {
            localStorage.setItem(
              BBT_STORAGE_KEY,
              JSON.stringify(entries)
            );
          } catch (error) {
            console.error("Unable to cache BBT entries:", error);
          }
        },
        (error) => {
          console.error("Overview BBT sync error:", error);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribePeriod?.();
      unsubscribeBBT?.();
    };
  }, []);

  const cycleStats = useMemo(() => {
    const bleedingDays = getBleedingDays(periodEntries);
    const episodes = buildPeriodEpisodes(bleedingDays);
    const cycleStarts = episodes.map((episode) => episode[0]);

    const cycleLengths = cycleStarts.slice(1).map((date, index) =>
      daysBetween(cycleStarts[index], date)
    );

    const periodLengths = episodes
      .filter((episode) => {
        const lastBleedingDate = episode[episode.length - 1];
        const nextDate = parseDate(lastBleedingDate);
        nextDate.setDate(nextDate.getDate() + 1);

        const nextDateString = [
          nextDate.getFullYear(),
          String(nextDate.getMonth() + 1).padStart(2, "0"),
          String(nextDate.getDate()).padStart(2, "0"),
        ].join("-");

        // Only count a period as completed when the following day
        // has explicitly been logged as a no-flow day.
        return periodEntries[nextDateString]?.flow === "none";
      })
      .map((episode) => episode.length);

    const readings = Object.entries(bbtEntries)
      .map(([date, entry]) => ({
        date,
        temperature: getTemperatureFahrenheit(entry),
      }))
      .filter(
        (reading) =>
          reading.temperature !== null &&
          Number.isFinite(reading.temperature)
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      averageCycle: average(cycleLengths),
      averagePeriod: average(periodLengths),
      latestBBT: readings[0] ?? null,
      cycleCount: cycleLengths.length,
      periodCount: periodLengths.length,
    };
  }, [periodEntries, bbtEntries]);

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
                      {cycleStats.averageCycle === null
                        ? "--"
                        : cycleStats.averageCycle.toFixed(1)}
                      <span> days</span>
                    </p>
                    <p className="stat-note">
                      {cycleStats.cycleCount
                        ? `Based on ${cycleStats.cycleCount} cycle ${
                            cycleStats.cycleCount === 1
                              ? "interval"
                              : "intervals"
                          }`
                        : "Log at least two period starts"}
                    </p>
                  </article>

                  <article className="stat-card">
                    <span className="stat-icon stat-icon-purple">
                      <Droplets size={20} />
                    </span>
                    <p className="stat-label">Average period</p>
                    <p className="stat-value">
                      {cycleStats.averagePeriod === null
                        ? "--"
                        : cycleStats.averagePeriod.toFixed(1)}
                      <span> days</span>
                    </p>
                    <p className="stat-note">
                      {cycleStats.periodCount
                        ? `Based on ${cycleStats.periodCount} completed ${
                            cycleStats.periodCount === 1
                              ? "period"
                              : "periods"
                          }`
                        : "Log a no-flow day after bleeding"}
                    </p>
                  </article>

                  <article className="stat-card">
                    <span className="stat-icon stat-icon-blue">
                      <Thermometer size={20} />
                    </span>
                    <p className="stat-label">Latest BBT</p>
                    <p className="stat-value">
                      {cycleStats.latestBBT
                        ? cycleStats.latestBBT.temperature.toFixed(2)
                        : "--"}
                      <span> °F</span>
                    </p>
                    <p className="stat-note">
                      {cycleStats.latestBBT
                        ? formatDate(cycleStats.latestBBT.date)
                        : "Your latest reading"}
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
