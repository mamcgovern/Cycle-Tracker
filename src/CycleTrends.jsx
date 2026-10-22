import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Droplets,
  Thermometer,
  TrendingUp,
  Heart,
  Activity,
} from "lucide-react";
import "./styles/cycle-trends.css";
import CombinedCycleChart from "./CombinedCycleChart";

const PERIOD_STORAGE_KEY = "petal-period-entries";
const BBT_STORAGE_KEY = "petal-bbt-entries";
const ACTIVITY_STORAGE_KEY = "petal-activity-entries";

function readStorage(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function readActivityStorage() {
  try {
    const saved = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(dateString, options = {}) {
  return parseDate(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
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

function getTemperatureReadings(entries) {
  return Object.entries(entries)
    .map(([date, entry]) => ({
      date,
      temperature: getTemperatureFahrenheit(entry),
      measurementTime: entry?.measurementTime ?? "",
    }))
    .filter(
      (reading) =>
        reading.temperature !== null &&
        Number.isFinite(reading.temperature)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function findPossibleTemperatureShift(readings) {
  if (readings.length < 9) return null;

  for (let index = 6; index <= readings.length - 3; index++) {
    const window = readings.slice(index - 6, index + 3);

    const consecutiveDays = window.every(
      (reading, windowIndex) =>
        windowIndex === 0 ||
        daysBetween(
          window[windowIndex - 1].date,
          reading.date
        ) === 1
    );

    if (!consecutiveDays) continue;

    const baseline = window.slice(0, 6);
    const higherReadings = window.slice(6, 9);

    const baselineAverage = average(
      baseline.map((reading) => reading.temperature)
    );

    const sustainedRise = higherReadings.every(
      (reading) =>
        reading.temperature >= baselineAverage + 0.3
    );

    if (sustainedRise) {
      return {
        firstHigherDate: higherReadings[0].date,
        thirdHigherDate: higherReadings[2].date,
      };
    }
  }

  return null;
}

function TemperatureChart({ entries }) {
  const points = useMemo(
    () => getTemperatureReadings(entries).slice(-30),
    [entries]
  );

  if (points.length < 2) {
    return (
      <div className="trends-chart-empty">
        <Thermometer size={28} strokeWidth={1.4} />
        <p>Your temperature chart will appear here.</p>
        <span>
          Record at least two BBT readings to see your trend.
        </span>
      </div>
    );
  }

  const width = 680;
  const height = 260;
  const padding = { top: 20, right: 22, bottom: 38, left: 48 };

  const values = points.map((point) => point.temperature);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 0.2;
  const min = low - Math.max(range * 0.2, 0.1);
  const max = high + Math.max(range * 0.2, 0.1);

  const x = (index) =>
    padding.left +
    (index / Math.max(points.length - 1, 1)) *
      (width - padding.left - padding.right);

  const y = (value) =>
    padding.top +
    ((max - value) / (max - min)) *
      (height - padding.top - padding.bottom);

  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.temperature)}`
    )
    .join(" ");

  const gridValues = [0, 1, 2, 3].map(
    (index) => max - ((max - min) * index) / 3
  );

  const labelIndices = [
    ...new Set([
      0,
      Math.floor((points.length - 1) / 2),
      points.length - 1,
    ]),
  ];

  return (
    <div className="trends-chart-wrap">
      <svg
        className="trends-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Basal body temperature readings over time, displayed in Fahrenheit"
      >
        {gridValues.map((value, index) => (
          <g key={index}>
            <line
              x1={padding.left}
              y1={y(value)}
              x2={width - padding.right}
              y2={y(value)}
              className="trends-grid-line"
            />
            <text
              x={padding.left - 8}
              y={y(value) + 4}
              textAnchor="end"
              className="trends-axis-label"
            >
              {value.toFixed(1)}°
            </text>
          </g>
        ))}

        <path d={line} className="trends-temperature-line" />

        {points.map((point, index) => (
          <circle
            key={point.date}
            cx={x(index)}
            cy={y(point.temperature)}
            r={index === points.length - 1 ? 5 : 3.5}
            className="trends-temperature-point"
          >
            <title>
              {formatDate(point.date)}:{" "}
              {point.temperature.toFixed(2)}°F
            </title>
          </circle>
        ))}

        {labelIndices.map((index) => (
          <text
            key={points[index].date}
            x={x(index)}
            y={height - 12}
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
            className="trends-axis-label"
          >
            {formatDate(points[index].date, {
              year: undefined,
              month: "numeric",
              day: "numeric",
            })}
          </text>
        ))}
      </svg>

      <p className="trends-chart-caption">
        Last {points.length} readings · displayed in °F
      </p>
    </div>
  );
}

function CycleTrends() {
  const [periodEntries, setPeriodEntries] = useState(() =>
    readStorage(PERIOD_STORAGE_KEY)
  );

  const [bbtEntries, setBbtEntries] = useState(() =>
    readStorage(BBT_STORAGE_KEY)
  );

  const [activityEntries, setActivityEntries] = useState(
    readActivityStorage
  );

  const [syncStatus, setSyncStatus] = useState(
    "Connecting to your account..."
  );

  useEffect(() => {
    let unsubscribePeriodEntries = null;
    let unsubscribeBbtEntries = null;
    let unsubscribeActivityEntries = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribePeriodEntries?.();
      unsubscribeBbtEntries?.();
      unsubscribeActivityEntries?.();

      unsubscribePeriodEntries = null;
      unsubscribeBbtEntries = null;
      unsubscribeActivityEntries = null;

      if (!user) {
        setPeriodEntries(readStorage(PERIOD_STORAGE_KEY));
        setBbtEntries(readStorage(BBT_STORAGE_KEY));
        setActivityEntries(readActivityStorage());
        setSyncStatus("Sign in to sync your trends");
        return;
      }

      setSyncStatus("Syncing your data...");

      unsubscribePeriodEntries = onSnapshot(
        collection(db, "users", user.uid, "periodEntries"),
        (snapshot) => {
          const entries = {};

          snapshot.forEach((entryDoc) => {
            entries[entryDoc.id] = entryDoc.data();
          });

          setPeriodEntries(entries);
          localStorage.setItem(
            PERIOD_STORAGE_KEY,
            JSON.stringify(entries)
          );
          setSyncStatus("Synced with your account");
        },
        (error) => {
          console.error("Cycle Trends period sync error:", error);
          setSyncStatus("Unable to sync period data");
        }
      );

      unsubscribeBbtEntries = onSnapshot(
        collection(db, "users", user.uid, "bbtEntries"),
        (snapshot) => {
          const entries = {};

          snapshot.forEach((entryDoc) => {
            entries[entryDoc.id] = entryDoc.data();
          });

          setBbtEntries(entries);
          localStorage.setItem(
            BBT_STORAGE_KEY,
            JSON.stringify(entries)
          );
          setSyncStatus("Synced with your account");
        },
        (error) => {
          console.error("Cycle Trends BBT sync error:", error);
          setSyncStatus("Unable to sync temperature data");
        }
      );

      unsubscribeActivityEntries = onSnapshot(
        collection(db, "users", user.uid, "activityEntries"),
        (snapshot) => {
          const entries = snapshot.docs.map((entryDoc) => ({
            ...entryDoc.data(),
            id: entryDoc.id,
          }));

          setActivityEntries(entries);
          localStorage.setItem(
            ACTIVITY_STORAGE_KEY,
            JSON.stringify(entries)
          );
          setSyncStatus("Synced with your account");
        },
        (error) => {
          console.error("Cycle Trends Activity Log sync error:", error);
          setSyncStatus("Unable to sync activity data");
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribePeriodEntries?.();
      unsubscribeBbtEntries?.();
      unsubscribeActivityEntries?.();
    };
  }, []);

  const bleedingDays = useMemo(
    () => getBleedingDays(periodEntries),
    [periodEntries]
  );

  const episodes = useMemo(
    () => buildPeriodEpisodes(bleedingDays),
    [bleedingDays]
  );

  const cycleStarts = useMemo(
    () => episodes.map((episode) => episode[0]),
    [episodes]
  );

  const cycleLengths = useMemo(
    () =>
      cycleStarts.slice(1).map((date, index) => ({
        startDate: date,
        previousStartDate: cycleStarts[index],
        length: daysBetween(cycleStarts[index], date),
      })),
    [cycleStarts]
  );

  const periodLengths = useMemo(
    () =>
      episodes
        .filter((episode) => {
          const lastBleedingDate = episode[episode.length - 1];
          const nextDate = parseDate(lastBleedingDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const nextDateString = [
            nextDate.getFullYear(),
            String(nextDate.getMonth() + 1).padStart(2, "0"),
            String(nextDate.getDate()).padStart(2, "0"),
          ].join("-");

          return periodEntries[nextDateString]?.flow === "none";
        })
        .map((episode) => ({
          startDate: episode[0],
          endDate: episode[episode.length - 1],
          length: episode.length,
        })),
    [episodes, periodEntries]
  );

  const ascendingBBTReadings = useMemo(
    () => getTemperatureReadings(bbtEntries),
    [bbtEntries]
  );

  const bbtReadings = useMemo(
    () => [...ascendingBBTReadings].reverse(),
    [ascendingBBTReadings]
  );

  const possibleShift = useMemo(
    () => findPossibleTemperatureShift(ascendingBBTReadings),
    [ascendingBBTReadings]
  );

  const averageCycleLength = average(
    cycleLengths.map((cycle) => cycle.length)
  );

  const averagePeriodLength = average(
    periodLengths.map((period) => period.length)
  );

  const shortestCycle = cycleLengths.length
    ? Math.min(...cycleLengths.map((cycle) => cycle.length))
    : null;

  const longestCycle = cycleLengths.length
    ? Math.max(...cycleLengths.map((cycle) => cycle.length))
    : null;

  const cycleVariation =
    shortestCycle !== null && longestCycle !== null
      ? longestCycle - shortestCycle
      : null;

  const latestBBT = bbtReadings[0] ?? null;

  const recentCycleLengths = [...cycleLengths]
    .reverse()
    .slice(-6)
    .reverse();

  const recentPeriodLengths = [...periodLengths]
    .reverse()
    .slice(-6);

  return (
    <div className="cycle-trends">
      <section className="trends-intro">
        <div>
          <p className="eyebrow">GETTING TO KNOW YOUR PATTERNS</p>
          <h2>Cycle trends</h2>
          <p>
            A closer look at your cycle history and temperature readings.
          </p>
          <p className="trends-chart-caption" aria-live="polite">
            {syncStatus}
          </p>
        </div>

        <div className="trends-intro-icon">
          <ChartNoAxesCombined size={32} strokeWidth={1.4} />
        </div>
      </section>

      <section className="trends-panel">
        <div className="trends-section-heading">
          <div>
            <p className="eyebrow">YOUR CYCLE AT A GLANCE</p>
            <h3>Temperature, cycle, and activity</h3>
          </div>
          <span className="trends-count">
            {activityEntries.length} activities logged
          </span>
        </div>

        <CombinedCycleChart
          periodEntries={periodEntries}
          bbtEntries={bbtEntries}
          activityEntries={activityEntries}
        />
      </section>

      <section className="trends-stat-grid">
        <article className="trends-stat-card">
          <span className="trends-stat-icon trends-icon-pink">
            <CalendarDays size={20} />
          </span>
          <p>Average cycle length</p>
          <strong>
            {averageCycleLength === null
              ? "—"
              : averageCycleLength.toFixed(1)}
            {averageCycleLength !== null && <small> days</small>}
          </strong>
          <span className="trends-stat-note">
            {cycleLengths.length
              ? `Based on ${cycleLengths.length} cycle interval${cycleLengths.length === 1 ? "" : "s"}`
              : "Log at least two period starts"}
          </span>
        </article>

        <article className="trends-stat-card">
          <span className="trends-stat-icon trends-icon-purple">
            <Droplets size={20} />
          </span>
          <p>Average period length</p>
          <strong>
            {averagePeriodLength === null
              ? "—"
              : averagePeriodLength.toFixed(1)}
            {averagePeriodLength !== null && <small> days</small>}
          </strong>
          <span className="trends-stat-note">
            {periodLengths.length
              ? `Based on ${periodLengths.length} recorded period${periodLengths.length === 1 ? "" : "s"}`
              : "Save a no-flow day after bleeding"}
          </span>
        </article>

        <article className="trends-stat-card">
          <span className="trends-stat-icon trends-icon-blue">
            <Thermometer size={20} />
          </span>
          <p>Latest temperature</p>
          <strong>
            {latestBBT ? latestBBT.temperature.toFixed(2) : "—"}
            {latestBBT && <small> °F</small>}
          </strong>
          <span className="trends-stat-note">
            {latestBBT
              ? formatDate(latestBBT.date)
              : "No readings recorded"}
          </span>
        </article>
      </section>

      <section className="trends-panel">
        <div className="trends-section-heading">
          <div>
            <p className="eyebrow">CYCLE COMPARISONS</p>
            <h3>Your cycle consistency</h3>
          </div>
          <Activity size={22} strokeWidth={1.5} />
        </div>

        {cycleLengths.length === 0 ? (
          <div className="trends-empty">
            <CalendarDays size={28} strokeWidth={1.4} />
            <p>More cycle data is needed for comparisons.</p>
            <span>
              Once you have recorded at least two period start dates,
              petal can calculate cycle length and begin comparing cycles.
            </span>
          </div>
        ) : (
          <>
            <div className="trends-stat-grid">
              <article className="trends-stat-card">
                <p>Shortest cycle</p>
                <strong>
                  {shortestCycle}
                  <small> days</small>
                </strong>
              </article>

              <article className="trends-stat-card">
                <p>Longest cycle</p>
                <strong>
                  {longestCycle}
                  <small> days</small>
                </strong>
              </article>

              <article className="trends-stat-card">
                <p>Cycle range</p>
                <strong>
                  {cycleVariation}
                  <small> days</small>
                </strong>
              </article>
            </div>

            <p className="trends-chart-caption">
              The cycle range is the difference between your longest
              and shortest recorded cycle. More records will make this
              comparison more useful.
            </p>

            <div className="cycle-length-list">
              {recentCycleLengths.map((cycle) => (
                <div className="cycle-length-row" key={cycle.startDate}>
                  <div className="cycle-length-date">
                    <span>Period started</span>
                    <strong>{formatDate(cycle.startDate)}</strong>
                  </div>

                  <div className="cycle-length-meter">
                    <div className="cycle-length-track">
                      <span
                        style={{
                          width: `${Math.min(
                            (cycle.length / 45) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <strong className="cycle-length-value">
                    {cycle.length} days
                  </strong>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="trends-panel">
        <div className="trends-section-heading">
          <div>
            <p className="eyebrow">PERIOD COMPARISONS</p>
            <h3>Period duration over time</h3>
          </div>
          <span className="trends-count">
            {periodLengths.length} recorded
          </span>
        </div>

        {recentPeriodLengths.length === 0 ? (
          <div className="trends-empty">
            <Droplets size={28} strokeWidth={1.4} />
            <p>Your period history will appear here.</p>
            <span>
              Record each bleeding day and save a No flow entry on the
              day after your period ends to mark the period as complete.
            </span>
          </div>
        ) : (
          <>
            <div className="cycle-length-list">
              {recentPeriodLengths.map((period) => (
                <div className="cycle-length-row" key={period.startDate}>
                  <div className="cycle-length-date">
                    <span>Period started</span>
                    <strong>{formatDate(period.startDate)}</strong>
                  </div>

                  <div className="cycle-length-meter">
                    <div className="cycle-length-track">
                      <span
                        style={{
                          width: `${Math.min(
                            (period.length / 10) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <strong className="cycle-length-value">
                    {period.length} days
                  </strong>
                </div>
              ))}
            </div>

            <p className="trends-chart-caption">
              Average recorded period length:{" "}
              {averagePeriodLength.toFixed(1)} days.
            </p>
          </>
        )}
      </section>

      <section className="trends-panel">
        <div className="trends-section-heading">
          <div>
            <p className="eyebrow">TEMPERATURE JOURNAL</p>
            <h3>Basal body temperature</h3>
          </div>
          <span className="trends-count">
            {bbtReadings.length} reading
            {bbtReadings.length === 1 ? "" : "s"}
          </span>
        </div>

        <TemperatureChart entries={bbtEntries} />

        <div className="trends-info-note">
          <TrendingUp size={19} />
          <p>
            A sustained temperature rise may help identify a possible
            ovulation shift retrospectively. Temperature patterns alone
            cannot confirm ovulation, and missing readings or changes
            in sleep and measurement time can affect what you see.
          </p>
        </div>
      </section>

      <section className="trends-panel">
        <div className="trends-section-heading">
          <div>
            <p className="eyebrow">OVULATION PATTERN</p>
            <h3>Temperature shift insight</h3>
          </div>
          <span className="trends-count">
            {possibleShift ? "Possible shift found" : "Tracking"}
          </span>
        </div>

        {possibleShift ? (
          <div className="trends-info-note">
            <TrendingUp size={19} />
            <p>
              Your recorded temperatures show a sustained rise beginning
              around{" "}
              <strong>
                {formatDate(possibleShift.firstHigherDate)}
              </strong>
              , with three higher readings through{" "}
              <strong>
                {formatDate(possibleShift.thirdHigherDate)}
              </strong>
              . This may be consistent with a temperature shift after
              ovulation, but it cannot confirm whether or when ovulation
              occurred.
            </p>
          </div>
        ) : (
          <div className="trends-empty">
            <Thermometer size={28} strokeWidth={1.4} />
            <p>No clear sustained temperature shift detected yet.</p>
            <span>
              Keep recording your temperature each morning as
              consistently as possible. This check needs six consecutive
              baseline days followed by three consecutive higher days.
              A shift may not be detected even if ovulation occurred.
            </span>
          </div>
        )}
      </section>

      <section className="trends-panel trends-insight-panel">
        <div className="trends-insight-icon">
          <Heart size={22} strokeWidth={1.5} />
        </div>
        <div>
          <p className="eyebrow">A NOTE TO REMEMBER</p>
          <h3>Your patterns take time.</h3>
          <p>
            Cycle averages become more useful as you collect more
            complete records. These summaries are based only on the
            information you've logged, not on unrecorded days.
          </p>
        </div>
      </section>

      <p className="trends-disclaimer">
        Cycle lengths are calculated as the number of days between
        recorded period starts. Period duration is estimated from
        recorded bleeding days. The temperature shift insight is a
        simple pattern check, not a medical assessment or confirmation
        of ovulation. Missing days or spotting logged separately may
        affect these estimates.
      </p>
    </div>
  );
}

export default CycleTrends;