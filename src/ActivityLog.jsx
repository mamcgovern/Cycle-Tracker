
import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Trash2,
  Pencil,
  X,
  Check,
  Save,
} from "lucide-react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./styles/activity-log.css";

const STORAGE_KEY = "petal-activity-entries";
const PERIOD_STORAGE_KEY = "petal-period-entries";
const COLLECTION_NAME = "activityEntries";
const MAX_CHART_DAYS = 60;

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function daysBetween(firstDate, secondDate) {
  return Math.round(
    (parseDate(secondDate).getTime() -
      parseDate(firstDate).getTime()) /
      86400000
  );
}

function formatDate(dateString, options = {}) {
  return parseDate(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

function readEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readPeriodEntries() {
  try {
    const saved = localStorage.getItem(PERIOD_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

// A cycle starts on the first day of light, medium, or heavy flow.
// Spotting alone does not establish a cycle start.
function getCycleStarts(periodEntries) {
  const bleedingDates = new Set(
    periodEntries
      .filter((entry) =>
        ["light", "medium", "heavy"].includes(entry.flow)
      )
      .map((entry) => entry.date || entry.id)
      .filter(Boolean)
  );

  return [...bleedingDates]
    .filter((date) => {
      const previous = parseDate(date);
      previous.setDate(previous.getDate() - 1);

      const previousDate = [
        previous.getFullYear(),
        String(previous.getMonth() + 1).padStart(2, "0"),
        String(previous.getDate()).padStart(2, "0"),
      ].join("-");

      return !bleedingDates.has(previousDate);
    })
    .sort();
}

function getCycleActivityData(activities, cycleStarts, cycleStart) {
  if (!cycleStart) {
    return {
      points: [],
      endDate: null,
      isCurrent: false,
    };
  }

  const cycleIndex = cycleStarts.indexOf(cycleStart);
  const nextStart = cycleStarts[cycleIndex + 1] || null;

  // Completed cycles end the day before the next period.
  // The current cycle ends today.
  const cycleLength = nextStart
    ? daysBetween(cycleStart, nextStart)
    : daysBetween(cycleStart, localDate()) + 1;

  const chartDays = Math.min(
    Math.max(cycleLength, 1),
    MAX_CHART_DAYS
  );

  const countsByDay = {};

  activities.forEach((entry) => {
    if (!entry.date) return;
    if (nextStart && entry.date >= nextStart) return;

    const cycleDay = daysBetween(cycleStart, entry.date) + 1;

    if (cycleDay < 1 || cycleDay > chartDays) return;

    countsByDay[cycleDay] = (countsByDay[cycleDay] || 0) + 1;
  });

  const points = Array.from({ length: chartDays }, (_, index) => {
    const day = index + 1;
    const date = parseDate(cycleStart);
    date.setDate(date.getDate() + index);

    return {
      day,
      date: localDate(date),
      count: countsByDay[day] || 0,
    };
  });

  const endDate = parseDate(cycleStart);
  endDate.setDate(endDate.getDate() + chartDays - 1);

  return {
    points,
    endDate: nextStart
      ? localDate(
          new Date(parseDate(nextStart).getTime() - 86400000)
        )
      : localDate(endDate),
    isCurrent: !nextStart,
  };
}

function getAverageByCycleDay(activities, periodEntries, cycleStarts) {
  if (!cycleStarts.length) return [];

  const cycles = cycleStarts.map((start) =>
    getCycleActivityData(activities, cycleStarts, start)
  );

  const maxDays = Math.max(
    0,
    ...cycles.map((cycle) => cycle.points.length)
  );

  return Array.from({ length: maxDays }, (_, index) => {
    const day = index + 1;

    // Only include cycles that actually reached this cycle day.
    const counts = cycles
      .filter((cycle) => cycle.points.length >= day)
      .map((cycle) => cycle.points[day - 1].count);

    return {
      day,
      average: counts.length
        ? counts.reduce((sum, count) => sum + count, 0) /
          counts.length
        : 0,
      cyclesIncluded: counts.length,
    };
  });
}

function ActivityCycleChart({ activities, periodEntries }) {
  const cycleStarts = useMemo(
    () => getCycleStarts(periodEntries),
    [periodEntries]
  );

  const [selectedCycleIndex, setSelectedCycleIndex] = useState(
    Math.max(0, cycleStarts.length - 1)
  );

  useEffect(() => {
    setSelectedCycleIndex(Math.max(0, cycleStarts.length - 1));
  }, [cycleStarts.length]);

  const selectedCycle =
    cycleStarts[selectedCycleIndex] || null;

  const chartData = useMemo(
    () =>
      getCycleActivityData(
        activities,
        cycleStarts,
        selectedCycle
      ),
    [activities, cycleStarts, selectedCycle]
  );

  const averageByCycleDay = useMemo(
    () =>
      getAverageByCycleDay(
        activities,
        periodEntries,
        cycleStarts
      ),
    [activities, periodEntries, cycleStarts]
  );

  const points = chartData.points;

  // Display the selected cycle and its average line over the same
  // cycle-day range. The average itself uses every recorded cycle
  // that has reached each day.
  const visibleAverage = averageByCycleDay.slice(0, points.length);

  const totalActivities = points.reduce(
    (total, point) => total + point.count,
    0
  );

  const width = 720;
  const height = 300;
  const left = 46;
  const right = 20;
  const top = 24;
  const bottom = 48;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const maxValue = Math.max(
    1,
    ...points.map((point) => point.count),
    ...visibleAverage.map((point) => point.average)
  );

  // Round the vertical scale up to a readable whole-number maximum.
  const chartMax = Math.max(1, Math.ceil(maxValue));
  const yTickCount = Math.min(chartMax + 1, 5);

  const yTicks = Array.from(
    { length: yTickCount },
    (_, index) =>
      Math.round(
        (chartMax * index) / (yTickCount - 1 || 1)
      )
  ).filter(
    (value, index, array) => array.indexOf(value) === index
  );

  const xPosition = (index, total) =>
    total <= 1
      ? left + plotWidth / 2
      : left + (index / (total - 1)) * plotWidth;

  const yPosition = (value) =>
    top + plotHeight - (value / chartMax) * plotHeight;

  const activityLinePoints = points
    .map(
      (point, index) =>
        `${xPosition(index, points.length)},${yPosition(point.count)}`
    )
    .join(" ");

  const averageLinePoints = visibleAverage
    .map(
      (point, index) =>
        `${xPosition(index, points.length)},${yPosition(point.average)}`
    )
    .join(" ");

  const xTickIndexes = useMemo(() => {
    if (!points.length) return [];

    const interval =
      points.length <= 14
        ? 2
        : points.length <= 28
          ? 4
          : 7;

    const indexes = [];

    for (let index = 0; index < points.length; index += interval) {
      indexes.push(index);
    }

    if (indexes[indexes.length - 1] !== points.length - 1) {
      indexes.push(points.length - 1);
    }

    return indexes;
  }, [points.length]);

  function changeCycle(direction) {
    setSelectedCycleIndex((current) =>
      Math.min(
        Math.max(current + direction, 0),
        cycleStarts.length - 1
      )
    );
  }

  return (
    <section className="activity-cycle-chart">
      <div className="activity-panel-heading">
        <div>
          <p className="eyebrow">YOUR PATTERNS</p>
          <h3>Activity by Cycle Day</h3>
        </div>
      </div>

      <p className="activity-chart-description">
        Compare your activity throughout the selected cycle with your
        average for each cycle day across your recorded cycles.
      </p>

      {cycleStarts.length === 0 ? (
        <div className="activity-chart-empty">
          <Heart size={27} strokeWidth={1.5} />
          <p>Log your period to start tracking cycle patterns.</p>
          <span>
            Your activity entries will be organized by cycle day once
            a period start has been recorded.
          </span>
        </div>
      ) : (
        <>
          <div className="activity-cycle-navigation">
            <button
              type="button"
              className="activity-cycle-nav-button"
              onClick={() => changeCycle(-1)}
              disabled={selectedCycleIndex === 0}
              aria-label="View previous cycle"
            >
              <ChevronLeft size={19} />
            </button>

            <div className="activity-cycle-selected">
              <strong>Cycle {selectedCycleIndex + 1}</strong>
              <span>
                {formatDate(selectedCycle, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" – "}
                {chartData.endDate
                  ? formatDate(chartData.endDate, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "In progress"}
              </span>
              <small>
                {chartData.isCurrent
                  ? "Current cycle"
                  : "Completed cycle"}
              </small>
            </div>

            <button
              type="button"
              className="activity-cycle-nav-button"
              onClick={() => changeCycle(1)}
              disabled={
                selectedCycleIndex >= cycleStarts.length - 1
              }
              aria-label="View next cycle"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          <div className="activity-cycle-chart-summary">
            <div>
              <span className="activity-chart-stat-value">
                {totalActivities}
              </span>
              <span className="activity-chart-stat-label">
                Activities logged
              </span>
            </div>

            <div>
              <span className="activity-chart-stat-value">
                {cycleStarts.length}
              </span>
              <span className="activity-chart-stat-label">
                Cycles recorded
              </span>
            </div>
          </div>

          {points.length > 0 && (
            <div className="activity-line-chart-wrap">
              <svg
                className="activity-line-chart"
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`Activity by cycle day for Cycle ${
                  selectedCycleIndex + 1
                }, compared with the average for each cycle day across ${
                  cycleStarts.length
                } recorded cycles`}
              >
                {yTicks.map((tick) => {
                  const y = yPosition(tick);

                  return (
                    <g key={tick}>
                      <line
                        x1={left}
                        x2={width - right}
                        y1={y}
                        y2={y}
                        className="activity-chart-gridline"
                      />
                      <text
                        x={left - 12}
                        y={y + 4}
                        textAnchor="end"
                        className="activity-chart-axis-text"
                      >
                        {tick}
                      </text>
                    </g>
                  );
                })}

                <line
                  x1={left}
                  x2={left}
                  y1={top}
                  y2={height - bottom}
                  className="activity-chart-axis"
                />

                <line
                  x1={left}
                  x2={width - right}
                  y1={height - bottom}
                  y2={height - bottom}
                  className="activity-chart-axis"
                />

                {/* Average for each cycle day across recorded cycles */}
                {visibleAverage.length > 1 && (
                  <polyline
                    points={averageLinePoints}
                    className="activity-chart-average-line"
                  />
                )}

                {visibleAverage.map((point, index) => (
                  <circle
                    key={`average-${point.day}`}
                    cx={xPosition(index, points.length)}
                    cy={yPosition(point.average)}
                    r={points.length > 35 ? 2.5 : 3.5}
                    className="activity-chart-average-point"
                  >
                    <title>
                      Cycle Day {point.day}: average{" "}
                      {point.average.toFixed(2)} activities across{" "}
                      {point.cyclesIncluded} cycles
                    </title>
                  </circle>
                ))}

                {/* Activity counts for the selected cycle */}
                {points.length > 1 && (
                  <polyline
                    points={activityLinePoints}
                    className="activity-chart-line"
                  />
                )}

                {points.map((point, index) => (
                  <circle
                    key={point.day}
                    cx={xPosition(index, points.length)}
                    cy={yPosition(point.count)}
                    r={points.length > 35 ? 2.5 : 4}
                    className="activity-chart-point"
                  >
                    <title>
                      Cycle Day {point.day}: {point.count}{" "}
                      {point.count === 1
                        ? "activity"
                        : "activities"}{" "}
                      logged ({formatDate(point.date)})
                    </title>
                  </circle>
                ))}

                {xTickIndexes.map((index) => (
                  <text
                    key={points[index].day}
                    x={xPosition(index, points.length)}
                    y={height - bottom + 23}
                    textAnchor="middle"
                    className="activity-chart-axis-text"
                  >
                    {points[index].day}
                  </text>
                ))}

                <text
                  x={width / 2}
                  y={height - 5}
                  textAnchor="middle"
                  className="activity-chart-axis-title"
                >
                  Cycle Day
                </text>
              </svg>

              <div className="activity-chart-legend">
                <span className="activity-chart-legend-item">
                  <span className="activity-chart-legend-line" />
                  Selected cycle
                </span>

                <span className="activity-chart-legend-item">
                  <span className="activity-chart-legend-line average" />
                  Average by cycle day
                </span>
              </div>
            </div>
          )}

          <p className="activity-chart-footnote">
            The solid line shows the selected cycle. The dashed line
            shows the average for each cycle day across recorded cycles.
            Each average includes cycles that have reached that day,
            including days with no logged activities.
          </p>
        </>
      )}
    </section>
  );
}

function ActivityLog() {
  const [entries, setEntries] = useState(readEntries);
  const [periodEntries, setPeriodEntries] = useState(readPeriodEntries);
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [selectedPeriod, setSelectedPeriod] = useState("AM");
  const [pendingType, setPendingType] = useState("");
  const [message, setMessage] = useState("");
  const [editingEntry, setEditingEntry] = useState(null);
  const [editPeriod, setEditPeriod] = useState("AM");
  const [storageError, setStorageError] = useState(false);
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [syncError, setSyncError] = useState("");
  const [isReady, setIsReady] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      setSyncStatus("local");
      setIsReady(true);
      return;
    }

    let cancelled = false;
    let unsubscribe = null;

    async function initializeSync() {
      setSyncStatus("connecting");
      setSyncError("");
      setIsReady(false);

      try {
        const entriesRef = collection(
          db,
          "users",
          user.uid,
          COLLECTION_NAME
        );

        const localEntries = readEntries();
        const cloudSnapshot = await getDocs(entriesRef);

        if (cancelled) return;

        const cloudEntries = cloudSnapshot.docs.map((snapshot) => ({
          ...snapshot.data(),
          id: snapshot.id,
        }));

        const cloudIds = new Set(
          cloudEntries.map((entry) => entry.id)
        );

        for (const entry of localEntries) {
          if (cancelled) return;
          if (!entry.id || cloudIds.has(entry.id)) continue;

          const safeEntry = {
            id: entry.id,
            date: entry.date,
            period: entry.period === "PM" ? "PM" : "AM",
            type: entry.type ?? "other",
            createdAt: entry.createdAt ?? Date.now(),
            updatedAt: new Date().toISOString(),
          };

          await setDoc(doc(entriesRef, entry.id), safeEntry);
        }

        if (cancelled) return;

        const mergedEntries = new Map();

        localEntries.forEach((entry) => {
          mergedEntries.set(entry.id, entry);
        });

        cloudEntries.forEach((entry) => {
          mergedEntries.set(entry.id, entry);
        });

        setEntries(Array.from(mergedEntries.values()));
        setSyncStatus("synced");
        setIsReady(true);

        unsubscribe = onSnapshot(
          entriesRef,
          (snapshot) => {
            if (cancelled) return;

            setEntries(
              snapshot.docs.map((entrySnapshot) => ({
                ...entrySnapshot.data(),
                id: entrySnapshot.id,
              }))
            );

            setSyncStatus("synced");
            setSyncError("");
          },
          (error) => {
            console.error("Activity Log sync listener error:", error);

            if (!cancelled) {
              setSyncStatus("error");
              setSyncError(
                "Cloud updates are unavailable. Your local entries are still available."
              );
            }
          }
        );
      } catch (error) {
        console.error("Unable to synchronize Activity Log:", error);

        if (!cancelled) {
          setSyncStatus("error");
          setSyncError(
            "Could not connect to cloud storage. Your local entries are still available."
          );
          setIsReady(true);
        }
      }
    }

    initializeSync();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [entries]);

  // Keep period entries synchronized for cycle-day calculations.
  useEffect(() => {
    if (!user) {
      setPeriodEntries(readPeriodEntries());
      return;
    }

    const periodEntriesRef = collection(
      db,
      "users",
      user.uid,
      "periodEntries"
    );

    return onSnapshot(
      periodEntriesRef,
      (snapshot) => {
        const latestPeriodEntries = snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
          date: item.data().date || item.id,
        }));

        setPeriodEntries(latestPeriodEntries);

        try {
          localStorage.setItem(
            PERIOD_STORAGE_KEY,
            JSON.stringify(latestPeriodEntries)
          );
        } catch (error) {
          console.error("Unable to cache period entries:", error);
        }
      },
      (error) => {
        console.error("Unable to load period entries:", error);
      }
    );
  }, [user?.uid]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date === selectedDate)
        .sort((a, b) => {
          if (a.period !== b.period) {
            return a.period === "AM" ? -1 : 1;
          }

          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        }),
    [entries, selectedDate]
  );

  function changeDate(amount) {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const nextDate = new Date(year, month - 1, day + amount);

    setSelectedDate(localDate(nextDate));
    setPendingType("");
    setMessage("");
    setEditingEntry(null);
  }

  function goToToday() {
    setSelectedDate(localDate());
    setPendingType("");
    setMessage("");
    setEditingEntry(null);
  }

  function selectType(type) {
    setPendingType(type);
    setMessage("");
  }

  async function saveEntry() {
    if (!pendingType) {
      setMessage("Choose an activity before saving.");
      return;
    }

    if (!isReady) {
      setMessage("Please wait until your entries finish loading.");
      return;
    }

    const entry = {
      id: makeId(),
      date: selectedDate,
      period: selectedPeriod,
      type: pendingType,
      createdAt: Date.now(),
    };

    setEntries((current) => [...current, entry]);
    setPendingType("");

    if (!user) {
      setMessage("Entry saved on this device.");
      return;
    }

    try {
      await setDoc(
        doc(db, "users", user.uid, COLLECTION_NAME, entry.id),
        {
          ...entry,
          updatedAt: new Date().toISOString(),
        }
      );

      setMessage("Entry saved and synced.");
      setSyncStatus("synced");
      setSyncError("");
    } catch (error) {
      console.error("Unable to save activity entry:", error);
      setMessage(
        "Entry saved locally, but cloud sync failed. Check your connection and try again."
      );
      setSyncStatus("error");
      setSyncError(
        "A recent change may not be available on other devices yet."
      );
    }
  }

  function cancelSelection() {
    setPendingType("");
    setMessage("");
  }

  function startEditing(entry) {
    setEditingEntry({ ...entry });
    setEditPeriod(entry.period);
    setMessage("");
  }

  async function saveEdit() {
    if (!editingEntry) return;

    if (!isReady) {
      setMessage("Please wait until your entries finish loading.");
      return;
    }

    const updatedEntry = {
      ...editingEntry,
      period: editPeriod,
    };

    setEntries((current) =>
      current.map((entry) =>
        entry.id === updatedEntry.id ? updatedEntry : entry
      )
    );

    setEditingEntry(null);

    if (!user) {
      setMessage("Changes saved on this device.");
      return;
    }

    try {
      await setDoc(
        doc(
          db,
          "users",
          user.uid,
          COLLECTION_NAME,
          updatedEntry.id
        ),
        {
          ...updatedEntry,
          updatedAt: new Date().toISOString(),
        }
      );

      setMessage("Changes saved and synced.");
      setSyncStatus("synced");
      setSyncError("");
    } catch (error) {
      console.error("Unable to update activity entry:", error);
      setMessage(
        "Changes saved locally, but cloud sync failed. Please try again."
      );
      setSyncStatus("error");
    }
  }

  async function deleteEntry(id) {
    if (!isReady) {
      setMessage("Please wait until your entries finish loading.");
      return;
    }

    if (user) {
      try {
        await deleteDoc(
          doc(db, "users", user.uid, COLLECTION_NAME, id)
        );
      } catch (error) {
        console.error("Unable to delete activity entry:", error);
        setMessage("Unable to delete the cloud entry. Please try again.");
        setSyncStatus("error");
        return;
      }
    }

    setEntries((current) =>
      current.filter((entry) => entry.id !== id)
    );

    if (editingEntry?.id === id) {
      setEditingEntry(null);
    }

    setMessage(
      user ? "Entry deleted." : "Entry deleted from this device."
    );
  }

  function activityLabel(type) {
    if (type === "condom") return "Condom";
    if (type === "other") return "Other Intimacy";
    return "Unprotected";
  }

  function ActivityIcon({ type, size = 22 }) {
    if (type === "condom") {
      return <ShieldCheck size={size} />;
    }

    return <Heart size={size} />;
  }

  return (
    <div className="activity-log">
      <section className="activity-log-header">
        <div>
          <p className="eyebrow">YOUR PERSONAL JOURNAL</p>
          <h2>Activity Log</h2>
          <p className="activity-subtitle">
            A simple way to keep track.
          </p>
        </div>

        <div className="activity-header-icon" aria-hidden="true">
          <Heart size={28} strokeWidth={1.5} />
        </div>
      </section>

      <p
        className="activity-sync-status"
        role="status"
        style={{
          fontSize: "13px",
          color: syncStatus === "error" ? "#a13c54" : "#766b7d",
          margin: "0 0 12px",
        }}
      >
        {syncStatus === "connecting" &&
          "Connecting your entries to your account..."}
        {syncStatus === "synced" &&
          "Your Activity Log is synced with your account."}
        {syncStatus === "local" &&
          "Your entries are saved on this device only."}
        {syncStatus === "error" && syncError}
      </p>

      <section className="activity-date-card">
        <div className="activity-date-row">
          <button
            type="button"
            className="activity-nav-button"
            onClick={() => changeDate(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft size={21} />
          </button>

          <div className="activity-date-label">
            <p className="eyebrow">LOGGING FOR</p>
            <h3>{formatDate(selectedDate, { weekday: "long" })}</h3>
            <p>{formatDate(selectedDate)}</p>
          </div>

          <button
            type="button"
            className="activity-nav-button"
            onClick={() => changeDate(1)}
            aria-label="Next day"
          >
            <ChevronRight size={21} />
          </button>
        </div>

        <button
          type="button"
          className="activity-today-button"
          onClick={goToToday}
        >
          Go to today
        </button>
      </section>

      <section className="activity-log-panel">
        <div className="activity-panel-heading">
          <div>
            <p className="eyebrow">QUICK ENTRY</p>
            <h3>What would you like to log?</h3>
          </div>
        </div>

        <p className="activity-instruction">
          First, choose the time of day.
        </p>

        <div className="activity-period-picker" aria-label="Time of day">
          {["AM", "PM"].map((period) => (
            <button
              key={period}
              type="button"
              className={`activity-period-button ${
                selectedPeriod === period ? "selected" : ""
              }`}
              aria-pressed={selectedPeriod === period}
              onClick={() => {
                setSelectedPeriod(period);
                setMessage("");
              }}
            >
              <Clock3 size={17} />
              {period}
            </button>
          ))}
        </div>

        <p className="activity-instruction activity-second-instruction">
          Select an activity below.
        </p>

        <div className="activity-choice-grid">
          <button
            type="button"
            className={`activity-choice-card activity-choice-unprotected ${
              pendingType === "unprotected" ? "chosen" : ""
            }`}
            aria-pressed={pendingType === "unprotected"}
            onClick={() => selectType("unprotected")}
          >
            <span className="activity-choice-icon">
              <Heart size={22} strokeWidth={1.7} />
            </span>
            <span className="activity-choice-title">Unprotected</span>
            <span className="activity-choice-caption">No condom</span>
          </button>

          <button
            type="button"
            className={`activity-choice-card activity-choice-condom ${
              pendingType === "condom" ? "chosen" : ""
            }`}
            aria-pressed={pendingType === "condom"}
            onClick={() => selectType("condom")}
          >
            <span className="activity-choice-icon">
              <ShieldCheck size={22} strokeWidth={1.7} />
            </span>
            <span className="activity-choice-title">Condom</span>
            <span className="activity-choice-caption">Condom used</span>
          </button>

          <button
            type="button"
            className={`activity-choice-card activity-choice-other ${
              pendingType === "other" ? "chosen" : ""
            }`}
            aria-pressed={pendingType === "other"}
            onClick={() => selectType("other")}
          >
            <span className="activity-choice-icon">
              <Heart size={22} strokeWidth={1.7} />
            </span>
            <span className="activity-choice-title">Other Intimacy</span>
            <span className="activity-choice-caption">Other activity</span>
          </button>
        </div>

        {pendingType && (
          <div className="activity-selection-summary">
            <div className="activity-selection-details">
              <span className="activity-selection-icon">
                <ActivityIcon type={pendingType} />
              </span>
              <span>
                <strong>{activityLabel(pendingType)}</strong>
                <small>
                  {formatDate(selectedDate, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {selectedPeriod}
                </small>
              </span>
            </div>

            <div className="activity-save-actions">
              <button
                type="button"
                className="activity-cancel-selection"
                onClick={cancelSelection}
              >
                Cancel
              </button>

              <button
                type="button"
                className="activity-save-entry"
                onClick={saveEntry}
                disabled={!isReady}
              >
                <Save size={17} />
                Save Entry
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className="activity-feedback" role="status">
            <Check size={17} />
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {storageError && (
          <p className="activity-storage-warning" role="alert">
            Your browser could not save the local backup. Check your
            storage settings.
          </p>
        )}
      </section>

      <section className="activity-log-panel">
        <div className="activity-panel-heading activity-entries-heading">
          <div>
            <p className="eyebrow">YOUR RECORDS</p>
            <h3>Entries for this day</h3>
          </div>

          <span className="activity-entry-count">
            {dayEntries.length}{" "}
            {dayEntries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {dayEntries.length === 0 ? (
          <div className="activity-empty-state">
            <Heart size={29} strokeWidth={1.4} />
            <p>Nothing logged yet.</p>
            <span>Your saved entries will appear here.</span>
          </div>
        ) : (
          <div className="activity-entry-list">
            {dayEntries.map((entry, index) => (
              <article className="activity-entry-row" key={entry.id}>
                <span className={`activity-entry-symbol ${entry.type}`}>
                  <ActivityIcon type={entry.type} />
                </span>

                <div className="activity-entry-details">
                  <strong>{activityLabel(entry.type)}</strong>
                  <span>
                    {entry.period} · Entry {index + 1}
                  </span>
                </div>

                <div className="activity-entry-actions">
                  <button
                    type="button"
                    onClick={() => startEditing(entry)}
                    aria-label="Edit entry time of day"
                    title="Edit entry"
                    disabled={!isReady}
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteEntry(entry.id)}
                    aria-label="Delete entry"
                    title="Delete entry"
                    disabled={!isReady}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {editingEntry && (
          <div className="activity-edit-panel">
            <div className="activity-edit-heading">
              <strong>Edit entry</strong>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                aria-label="Cancel editing"
              >
                <X size={17} />
              </button>
            </div>

            <p>{activityLabel(editingEntry.type)}</p>

            <div className="activity-period-picker activity-edit-period">
              {["AM", "PM"].map((period) => (
                <button
                  key={period}
                  type="button"
                  className={`activity-period-button ${
                    editPeriod === period ? "selected" : ""
                  }`}
                  aria-pressed={editPeriod === period}
                  onClick={() => setEditPeriod(period)}
                >
                  {period}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="activity-save-edit"
              onClick={saveEdit}
              disabled={!isReady}
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        )}
      </section>

      <p className="activity-disclaimer">
        Entries are saved to your account and backed up in this browser.
      </p>

      <ActivityCycleChart
        activities={entries}
        periodEntries={periodEntries}
      />
    </div>
  );
}

export default ActivityLog;
