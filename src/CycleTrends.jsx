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

/* Combined temperature, cycle, and activity chart */
function CombinedCycleChart({
  periodEntries,
  bbtEntries,
  activityEntries,
}) {
  const episodes = useMemo(
    () => buildPeriodEpisodes(getBleedingDays(periodEntries)),
    [periodEntries]
  );

  const cycleStarts = useMemo(
    () => episodes.map((episode) => episode[0]),
    [episodes]
  );

  const [selectedCycleIndex, setSelectedCycleIndex] = useState(
    Math.max(cycleStarts.length - 1, 0)
  );

  useEffect(() => {
    setSelectedCycleIndex(Math.max(cycleStarts.length - 1, 0));
  }, [cycleStarts.length]);

  const chartData = useMemo(() => {
    if (!cycleStarts.length) {
      return {
        days: [],
        cycleStart: null,
        cycleEnd: null,
        cycleIndex: 0,
        cycleCount: 0,
        isCurrentCycle: true,
      };
    }

    const safeCycleIndex = Math.min(
      selectedCycleIndex,
      cycleStarts.length - 1
    );

    const cycleStart = cycleStarts[safeCycleIndex];
    const nextCycleStart = cycleStarts[safeCycleIndex + 1];
    const isCurrentCycle = safeCycleIndex === cycleStarts.length - 1;

    const dates = [
      ...Object.keys(periodEntries),
      ...Object.keys(bbtEntries),
      ...activityEntries.map((entry) => entry.date).filter(Boolean),
    ]
      .filter(
        (date) =>
          date >= cycleStart &&
          (!nextCycleStart || date < nextCycleStart)
      )
      .sort();

    let latestDate;

    if (isCurrentCycle) {
      latestDate = dates.length
        ? dates[dates.length - 1]
        : cycleStart;
    } else {
      const endDate = parseDate(nextCycleStart);
      endDate.setDate(endDate.getDate() - 1);

      latestDate = [
        endDate.getFullYear(),
        String(endDate.getMonth() + 1).padStart(2, "0"),
        String(endDate.getDate()).padStart(2, "0"),
      ].join("-");
    }

    const totalDays = Math.min(
      Math.max(daysBetween(cycleStart, latestDate) + 1, 1),
      60
    );

    // Calculate average temperature for each cycle day
    // using readings from all recorded cycles.
    const averageBuckets = {};

    Object.entries(bbtEntries).forEach(([date, entry]) => {
      if (!Number.isFinite(Number(entry?.temperature))) return;

      const applicableStarts = cycleStarts.filter(
        (start) => start <= date
      );

      if (!applicableStarts.length) return;

      const start = applicableStarts[applicableStarts.length - 1];
      const cycleDay = daysBetween(start, date) + 1;

      if (cycleDay < 1 || cycleDay > 60) return;

      const temperature = getTemperatureFahrenheit(entry);

      if (!Number.isFinite(temperature)) return;

      if (!averageBuckets[cycleDay]) {
        averageBuckets[cycleDay] = [];
      }

      averageBuckets[cycleDay].push(temperature);
    });

    const averages = Object.fromEntries(
      Object.entries(averageBuckets).map(([day, values]) => [
        day,
        average(values),
      ])
    );

    const days = Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(
        parseDate(cycleStart).getTime() + index * 86400000
      );

      const dateString = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      const entry = bbtEntries[dateString];
      const cycleDay = index + 1;

      const activities = activityEntries.filter(
        (activity) => activity.date === dateString
      );

      const flow = periodEntries[dateString]?.flow ?? "";

      return {
        date: dateString,
        cycleDay,
        flow,
        spotting:
          Boolean(periodEntries[dateString]?.spotting) ||
          flow === "spotting",
        temperature:
          entry && Number.isFinite(Number(entry.temperature))
            ? getTemperatureFahrenheit(entry)
            : null,
        measurementTime: entry?.measurementTime ?? "",
        activityCount: activities.length,
        averageTemperature: averages[cycleDay] ?? null,
      };
    });

    return {
      days,
      cycleStart,
      cycleEnd: isCurrentCycle ? null : latestDate,
      cycleIndex: safeCycleIndex,
      cycleCount: cycleStarts.length,
      isCurrentCycle,
    };
  }, [
    periodEntries,
    bbtEntries,
    activityEntries,
    cycleStarts,
    selectedCycleIndex,
  ]);

  if (!chartData.days.length) {
    return (
      <div className="trends-empty">
        <CalendarDays size={28} strokeWidth={1.4} />
        <p>Log a period start to build your combined cycle chart.</p>
        <span>
          Once you have recorded period dates, your temperatures,
          measurement times, flow, and activity counts can be aligned
          by cycle day.
        </span>
      </div>
    );
  }

  const days = chartData.days;

  const values = days
    .flatMap((day) => [
      day.temperature,
      day.averageTemperature,
    ])
    .filter(Number.isFinite);

  const width = Math.max(900, days.length * 42 + 100);
  const height = 390;
  const left = 62;
  const right = 24;
  const plotTop = 30;
  const plotBottom = 205;
  const plotWidth = width - left - right;

  const x = (index) =>
    left +
    (index / Math.max(days.length - 1, 1)) * plotWidth;

  const minTemperature = values.length
    ? Math.min(...values) - 0.15
    : 96.5;

  const maxTemperature = values.length
    ? Math.max(...values) + 0.15
    : 99;

  const temperatureRange =
    maxTemperature - minTemperature || 1;

  const y = (temperature) =>
    plotTop +
    ((maxTemperature - temperature) / temperatureRange) *
      (plotBottom - plotTop);

  const gridValues = [0, 1, 2, 3].map(
    (index) =>
      maxTemperature - (temperatureRange * index) / 3
  );

  const temperatureSegments = [];
  let currentSegment = [];

  days.forEach((day, index) => {
    if (day.temperature === null) {
      if (currentSegment.length) {
        temperatureSegments.push(currentSegment);
      }

      currentSegment = [];
      return;
    }

    currentSegment.push({
      x: x(index),
      y: y(day.temperature),
      day,
    });
  });

  if (currentSegment.length) {
    temperatureSegments.push(currentSegment);
  }

  const averageSegments = [];
  currentSegment = [];

  days.forEach((day, index) => {
    if (day.averageTemperature === null) {
      if (currentSegment.length) {
        averageSegments.push(currentSegment);
      }

      currentSegment = [];
      return;
    }

    currentSegment.push({
      x: x(index),
      y: y(day.averageTemperature),
      day,
    });
  });

  if (currentSegment.length) {
    averageSegments.push(currentSegment);
  }

  return (
    <div className="combined-cycle-chart-wrap">
      <div className="combined-cycle-navigation">
        <button
          type="button"
          className="combined-cycle-nav-button"
          onClick={() =>
            setSelectedCycleIndex((index) => Math.max(0, index - 1))
          }
          disabled={chartData.cycleIndex <= 0}
        >
          ‹ Previous cycle
        </button>

        <div className="combined-cycle-selected">
          <strong>
            {chartData.isCurrentCycle
              ? "Current cycle"
              : `Previous cycle ${chartData.cycleIndex + 1}`}
          </strong>

          <span>
            {formatDate(chartData.cycleStart)}
            {" – "}
            {chartData.cycleEnd
              ? formatDate(chartData.cycleEnd)
              : "In progress"}
          </span>
        </div>

        <button
          type="button"
          className="combined-cycle-nav-button"
          onClick={() =>
            setSelectedCycleIndex((index) =>
              Math.min(chartData.cycleCount - 1, index + 1)
            )
          }
          disabled={
            chartData.cycleIndex >= chartData.cycleCount - 1
          }
        >
          Next cycle ›
        </button>
      </div>

      <div className="combined-cycle-legend">
        <span>
          <i className="combined-legend-dot" />
          Daily temperature
        </span>

        <span>
          <i className="combined-legend-average" />
          Average for cycle day
        </span>

        <span>
          <i className="combined-flow" />
          Period flow
        </span>
      </div>

      <div className="combined-cycle-scroll">
        <svg
          className="combined-cycle-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Temperature, cycle day, period flow, and activity chart"
        >
          {gridValues.map((value, index) => (
            <g key={index}>
              <line
                x1={left}
                y1={y(value)}
                x2={width - right}
                y2={y(value)}
                className="trends-grid-line"
              />

              <text
                x={left - 9}
                y={y(value) + 4}
                textAnchor="end"
                className="trends-axis-label"
              >
                {value.toFixed(1)}°
              </text>
            </g>
          ))}

          {days.map((day, index) => (
            <line
              key={`grid-${day.date}`}
              x1={x(index)}
              y1={plotTop}
              x2={x(index)}
              y2={height - 35}
              className="combined-cycle-day-grid"
            />
          ))}

          {averageSegments.map((segment, index) => (
            <path
              key={`average-${index}`}
              d={segment
                .map(
                  (point, pointIndex) =>
                    `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`
                )
                .join(" ")}
              className="combined-average-line"
            />
          ))}

          {temperatureSegments.map((segment, index) => (
            <path
              key={`temperature-${index}`}
              d={segment
                .map(
                  (point, pointIndex) =>
                    `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`
                )
                .join(" ")}
              className="combined-reading-line"
            />
          ))}

          {days.map((day, index) =>
            day.temperature === null ? null : (
              <circle
                key={`point-${day.date}`}
                cx={x(index)}
                cy={y(day.temperature)}
                r={3.5}
                className="combined-reading-point"
              >
                <title>
                  {formatDate(day.date)}:{" "}
                  {day.temperature.toFixed(2)}°F
                  {day.measurementTime
                    ? `, measured at ${day.measurementTime}`
                    : ""}
                </title>
              </circle>
            )
          )}

          <text
            x={8}
            y={plotTop + 4}
            className="combined-row-label"
          >
            °F
          </text>

          {days.map((day, index) => (
            <g key={`day-${day.date}`}>
              <text
                x={x(index)}
                y={plotBottom + 21}
                textAnchor="middle"
                className="combined-cycle-label"
              >
                {day.cycleDay}
              </text>

              <text
                x={x(index)}
                y={plotBottom + 36}
                textAnchor="middle"
                className="combined-date-label"
              >
                {parseDate(day.date).toLocaleDateString("en-US", {
                  month: "numeric",
                  day: "numeric",
                })}
              </text>

              {day.measurementTime && (
                <text
                  x={x(index)}
                  y={plotBottom + 51}
                  textAnchor="middle"
                  className="combined-time-label"
                >
                  {day.measurementTime}
                </text>
              )}

              <rect
                x={x(index) - 13}
                y={plotBottom + 61}
                width={26}
                height={14}
                rx={2}
                className={
                  ["light", "medium", "heavy"].includes(day.flow)
                    ? day.flow === "heavy"
                      ? "combined-flow-heavy"
                      : "combined-flow"
                    : day.spotting
                      ? "combined-flow-spotting"
                      : ""
                }
              />

              {day.spotting &&
                !["light", "medium", "heavy"].includes(day.flow) && (
                  <text
                    x={x(index)}
                    y={plotBottom + 72}
                    textAnchor="middle"
                    className="combined-time-label"
                  >
                    S
                  </text>
                )}

              <text
                x={x(index)}
                y={plotBottom + 95}
                textAnchor="middle"
                className="combined-activity-count"
              >
                {day.activityCount > 0 ? day.activityCount : ""}
              </text>
            </g>
          ))}

          <text
            x={8}
            y={plotBottom + 21}
            className="combined-row-label"
          >
            Cycle day
          </text>

          <text
            x={8}
            y={plotBottom + 51}
            className="combined-row-label"
          >
            Time
          </text>

          <text
            x={8}
            y={plotBottom + 72}
            className="combined-row-label"
          >
            Flow
          </text>

          <text
            x={8}
            y={plotBottom + 95}
            className="combined-row-label"
          >
            Activity
          </text>
        </svg>
      </div>

      <p className="trends-chart-caption">
        This cycle started {formatDate(chartData.cycleStart)}.
        Temperatures are displayed in °F. The faint line shows average
        temperatures for the same cycle day across recorded cycles.
        Missing readings are not estimated.
      </p>
    </div>
  );
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