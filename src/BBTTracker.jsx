
import { useEffect, useMemo, useState } from "react";
import {
  Thermometer,
  ChevronLeft,
  ChevronRight,
  Save,
  Trash2,
  Clock,
  Moon,
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

const STORAGE_KEY = "petal-bbt-entries";
const COLLECTION_NAME = "bbtEntries";

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString, options = {}) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

function readEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function BBTChart({ entries, unit }) {
  const points = useMemo(
    () =>
      Object.entries(entries)
        .filter(([, entry]) => Number.isFinite(Number(entry.temperature)))
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30),
    [entries]
  );

  if (points.length < 2) {
    return (
      <div className="bbt-chart-empty">
        <Thermometer size={30} strokeWidth={1.4} />
        <p>Your temperature chart will appear here.</p>
        <span>Log at least two readings to see your trend.</span>
      </div>
    );
  }

  const width = 640;
  const height = 260;
  const padLeft = 48;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 36;

  const values = points.map(([, entry]) => Number(entry.temperature));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 0.2;
  const min = low - Math.max(range * 0.25, unit === "°F" ? 0.1 : 0.05);
  const max = high + Math.max(range * 0.25, unit === "°F" ? 0.1 : 0.05);

  const x = (index) =>
    padLeft +
    (index / Math.max(points.length - 1, 1)) *
      (width - padLeft - padRight);

  const y = (value) =>
    padTop +
    ((max - value) / (max - min)) * (height - padTop - padBottom);

  const line = points
    .map(([, entry], index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${x(index)} ${y(Number(entry.temperature))}`;
    })
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
    <div className="bbt-chart-wrap">
      <svg
        className="bbt-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Basal body temperature chart showing ${points.length} readings in ${unit}`}
      >
        {gridValues.map((value, index) => (
          <g key={index}>
            <line
              x1={padLeft}
              y1={y(value)}
              x2={width - padRight}
              y2={y(value)}
              className="bbt-grid-line"
            />
            <text
              x={padLeft - 8}
              y={y(value) + 4}
              className="bbt-axis-label"
              textAnchor="end"
            >
              {value.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={line} className="bbt-line" />

        {points.map(([date, entry], index) => (
          <circle
            key={date}
            cx={x(index)}
            cy={y(Number(entry.temperature))}
            r={index === points.length - 1 ? 5 : 3.5}
            className="bbt-point"
          >
            <title>
              {formatDate(date)}: {entry.temperature} {entry.unit ?? unit}
            </title>
          </circle>
        ))}

        {labelIndices.map((index) => (
          <text
            key={points[index][0]}
            x={x(index)}
            y={height - 12}
            className="bbt-axis-label"
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
          >
            {formatDate(points[index][0], {
              month: "numeric",
              day: "numeric",
              year: undefined,
            })}
          </text>
        ))}
      </svg>
      <p className="bbt-chart-caption">
        Last {points.length} recorded readings · {unit}
      </p>
    </div>
  );
}

function BBTTracker() {
  const [entries, setEntries] = useState(readEntries);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [temperature, setTemperature] = useState("");
  const [unit, setUnit] = useState("°F");
  const [measurementTime, setMeasurementTime] = useState("06:00");
  const [sleepQuality, setSleepQuality] = useState("normal");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [syncError, setSyncError] = useState("");
  const [isReady, setIsReady] = useState(false);

  const user = auth.currentUser;

  // Migrate local readings without overwriting existing cloud records,
  // then listen for changes from this user's other devices.
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

        const cloudEntries = {};

        cloudSnapshot.forEach((snapshot) => {
          const data = snapshot.data();

          cloudEntries[snapshot.id] = {
            temperature: data.temperature,
            unit: data.unit ?? "°F",
            measurementTime: data.measurementTime ?? "06:00",
            sleepQuality: data.sleepQuality ?? "normal",
            notes: data.notes ?? "",
          };
        });

        // Preserve existing cloud entries. Upload local entries only for
        // dates that are not already present in the cloud.
        for (const [date, entry] of Object.entries(localEntries)) {
          if (cancelled) return;

          if (
            !Object.prototype.hasOwnProperty.call(cloudEntries, date)
          ) {
            await setDoc(doc(entriesRef, date), {
              temperature: Number(entry.temperature),
              unit: entry.unit ?? "°F",
              measurementTime: entry.measurementTime ?? "06:00",
              sleepQuality: entry.sleepQuality ?? "normal",
              notes: entry.notes ?? "",
              updatedAt: new Date().toISOString(),
            });
          }
        }

        if (cancelled) return;

        setEntries({
          ...localEntries,
          ...cloudEntries,
        });

        setSyncStatus("synced");
        setIsReady(true);

        unsubscribe = onSnapshot(
          entriesRef,
          (snapshot) => {
            const latestEntries = {};

            snapshot.forEach((entrySnapshot) => {
              const data = entrySnapshot.data();

              latestEntries[entrySnapshot.id] = {
                temperature: data.temperature,
                unit: data.unit ?? "°F",
                measurementTime: data.measurementTime ?? "06:00",
                sleepQuality: data.sleepQuality ?? "normal",
                notes: data.notes ?? "",
              };
            });

            if (cancelled) return;

            setEntries(latestEntries);
            setSyncStatus("synced");
            setSyncError("");
          },
          (error) => {
            console.error("BBT sync listener error:", error);
            setSyncStatus("error");
            setSyncError(
              "Cloud updates are unavailable. Your local readings are still available."
            );
          }
        );
      } catch (error) {
        console.error("Unable to synchronize BBT entries:", error);

        if (!cancelled) {
          setSyncStatus("error");
          setSyncError(
            "Could not connect to cloud storage. Your local readings are still available."
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

  // Keep a local backup of the readings.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      setMessage("Unable to save a local backup. Check your browser storage settings.");
    }
  }, [entries]);

  useEffect(() => {
    const entry = entries[selectedDate];

    setTemperature(entry ? String(entry.temperature) : "");
    setUnit(entry?.unit ?? "°F");
    setMeasurementTime(entry?.measurementTime ?? "06:00");
    setSleepQuality(entry?.sleepQuality ?? "normal");
    setNotes(entry?.notes ?? "");
    setMessage("");
  }, [selectedDate, entries]);

  const sortedEntries = useMemo(
    () =>
      Object.entries(entries)
        .filter(([, entry]) => Number.isFinite(Number(entry.temperature)))
        .sort(([a], [b]) => b.localeCompare(a)),
    [entries]
  );

  const latestEntry = sortedEntries[0];
  const recentValues = sortedEntries.slice(0, 7);
  const average = recentValues.length
    ? recentValues.reduce(
        (sum, [, entry]) => sum + Number(entry.temperature),
        0
      ) / recentValues.length
    : null;

  async function saveEntry(event) {
    event.preventDefault();

    const value = Number(temperature);

    if (!temperature.trim() || !Number.isFinite(value)) {
      setMessage("Please enter a valid temperature.");
      return;
    }

    if (unit === "°F" && (value < 90 || value > 110)) {
      setMessage("Check your temperature. Enter a value between 90°F and 110°F.");
      return;
    }

    if (unit === "°C" && (value < 32 || value > 43.5)) {
      setMessage("Check your temperature. Enter a value between 32°C and 43.5°C.");
      return;
    }

    const entry = {
      temperature: value,
      unit,
      measurementTime,
      sleepQuality,
      notes: notes.trim(),
    };

    setEntries((current) => ({
      ...current,
      [selectedDate]: entry,
    }));

    if (!user) {
      setMessage("Temperature entry saved locally.");
      return;
    }

    try {
      await setDoc(
        doc(db, "users", user.uid, COLLECTION_NAME, selectedDate),
        {
          ...entry,
          updatedAt: new Date().toISOString(),
        }
      );

      setMessage("Temperature entry saved and synced.");
      setSyncStatus("synced");
      setSyncError("");
    } catch (error) {
      console.error("Unable to save BBT entry:", error);
      setMessage(
        "Saved locally, but cloud sync failed. Check your connection and try again."
      );
      setSyncStatus("error");
    }
  }

  async function deleteEntry(date = selectedDate) {
    if (user) {
      try {
        await deleteDoc(
          doc(db, "users", user.uid, COLLECTION_NAME, date)
        );
      } catch (error) {
        console.error("Unable to delete BBT entry:", error);
        setMessage("Unable to delete the cloud reading. Please try again.");
        return;
      }
    }

    setEntries((current) => {
      const updated = { ...current };
      delete updated[date];
      return updated;
    });

    setMessage(
      user ? "Temperature entry deleted." : "Reading deleted from this device."
    );
  }

  function changeDate(amount) {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const date = new Date(year, month - 1, day + amount);
    setSelectedDate(getLocalDateString(date));
  }

  async function changeUnit(option) {
    if (unit === option) return;

    const existing = entries[selectedDate];

    if (existing) {
      const oldUnit = existing.unit ?? unit;

      if (oldUnit === option) {
        setUnit(option);
        setTemperature(String(existing.temperature));
        return;
      }

      const converted =
        option === "°C"
          ? (Number(existing.temperature) - 32) * 5 / 9
          : Number(existing.temperature) * 9 / 5 + 32;

      const updatedEntry = {
        ...existing,
        temperature: Number(converted.toFixed(2)),
        unit: option,
      };

      setTemperature(converted.toFixed(2));
      setUnit(option);
      setEntries((current) => ({
        ...current,
        [selectedDate]: updatedEntry,
      }));

      if (user) {
        try {
          await setDoc(
            doc(db, "users", user.uid, COLLECTION_NAME, selectedDate),
            {
              ...updatedEntry,
              updatedAt: new Date().toISOString(),
            }
          );
          setSyncStatus("synced");
          setSyncError("");
        } catch (error) {
          console.error("Unable to sync temperature unit change:", error);
          setSyncStatus("error");
          setMessage(
            "Unit changed on this device, but cloud sync failed. Save the reading again when connected."
          );
        }
      }
    } else {
      setTemperature((current) => {
        if (!current.trim() || !Number.isFinite(Number(current))) {
          return "";
        }

        const converted =
          option === "°C"
            ? (Number(current) - 32) * 5 / 9
            : Number(current) * 9 / 5 + 32;

        return converted.toFixed(2);
      });

      setUnit(option);
    }
  }

  function displayTemperature(entry) {
    if (!entry) return "—";
    return `${Number(entry.temperature).toFixed(2)} ${entry.unit ?? unit}`;
  }

  return (
    <div className="bbt-tracker">
      <section className="bbt-intro">
        <div>
          <p className="eyebrow">YOUR TEMPERATURE JOURNAL</p>
          <h2>Basal body temperature</h2>
          <p>Small daily readings can help you understand your patterns.</p>
        </div>
        <div className="bbt-intro-icon">
          <Thermometer size={32} strokeWidth={1.4} />
        </div>
      </section>

      <p
        role="status"
        style={{
          fontSize: "13px",
          color: syncStatus === "error" ? "#a13c54" : "#766b7d",
          margin: "0 0 12px",
        }}
      >
        {syncStatus === "connecting" &&
          "Connecting your temperature readings to your account..."}
        {syncStatus === "synced" &&
          "Your temperature readings are synced with your account."}
        {syncStatus === "local" &&
          "Your readings are saved on this device only."}
        {syncStatus === "error" && syncError}
      </p>

      <section className="bbt-panel bbt-entry-panel">
        <div className="bbt-date-navigation">
          <button
            type="button"
            className="bbt-icon-button"
            onClick={() => changeDate(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft size={20} />
          </button>

          <div>
            <p className="eyebrow">DAILY READING</p>
            <h3>{formatDate(selectedDate, { weekday: "long" })}</h3>
            <p className="bbt-selected-date">{formatDate(selectedDate)}</p>
          </div>

          <button
            type="button"
            className="bbt-icon-button"
            onClick={() => changeDate(1)}
            aria-label="Next day"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <button
          type="button"
          className="bbt-today-button"
          onClick={() => setSelectedDate(getLocalDateString())}
        >
          Return to today
        </button>

        <form className="bbt-form" onSubmit={saveEntry}>
          <div className="bbt-temperature-label">
            <label htmlFor="bbt-temperature">Your temperature</label>
            <div className="bbt-unit-toggle" aria-label="Temperature unit">
              {["°F", "°C"].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={unit === option ? "unit-active" : ""}
                  onClick={() => changeUnit(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="bbt-input-with-unit">
            <input
              id="bbt-temperature"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
              placeholder={unit === "°F" ? "97.50" : "36.40"}
              required
            />
            <span>{unit}</span>
          </div>

          <p className="bbt-helper">
            Take your temperature as soon as you wake up, before getting out
            of bed, and use the same thermometer when possible.
          </p>

          <div className="bbt-form-grid">
            <label className="bbt-field" htmlFor="bbt-time">
              <span><Clock size={16} /> Measurement time</span>
              <input
                id="bbt-time"
                type="time"
                value={measurementTime}
                onChange={(event) => setMeasurementTime(event.target.value)}
                required
              />
            </label>

            <label className="bbt-field" htmlFor="bbt-sleep">
              <span><Moon size={16} /> Sleep quality</span>
              <select
                id="bbt-sleep"
                value={sleepQuality}
                onChange={(event) => setSleepQuality(event.target.value)}
              >
                <option value="normal">Typical sleep</option>
                <option value="poor">Poor sleep</option>
                <option value="interrupted">Interrupted sleep</option>
                <option value="ill">Feeling unwell</option>
                <option value="alcohol">Alcohol the night before</option>
                <option value="other">Other / unusual</option>
              </select>
            </label>
          </div>

          <label className="bbt-field" htmlFor="bbt-notes">
            <span>Notes <small>(optional)</small></span>
            <textarea
              id="bbt-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything that might have affected your reading..."
            />
          </label>

          <div className="bbt-form-actions">
            <button
              type="submit"
              className="button-primary"
              disabled={!isReady}
            >
              <Save size={16} />
              {isReady ? "Save reading" : "Loading readings..."}
            </button>

            {entries[selectedDate] && (
              <button
                type="button"
                className="bbt-delete-button"
                onClick={() => deleteEntry()}
                disabled={!isReady}
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
          </div>

          {message && (
            <p className="bbt-message" role="status">{message}</p>
          )}
        </form>
      </section>

      <section className="bbt-panel">
        <div className="bbt-section-heading">
          <div>
            <p className="eyebrow">YOUR HISTORY</p>
            <h3>Temperature trends</h3>
          </div>
          <span className="bbt-record-count">
            {sortedEntries.length} readings
          </span>
        </div>

        <BBTChart entries={entries} unit={unit} />

        <div className="bbt-summary-grid">
          <article className="bbt-summary-card">
            <span>Latest reading</span>
            <strong>
              {latestEntry ? displayTemperature(latestEntry[1]) : "—"}
            </strong>
            <small>
              {latestEntry ? formatDate(latestEntry[0]) : "No readings yet"}
            </small>
          </article>

          <article className="bbt-summary-card">
            <span>Recent average</span>
            <strong>
              {average === null
                ? "—"
                : `${average.toFixed(2)} ${unit}`}
            </strong>
            <small>Up to 7 most recent readings</small>
          </article>
        </div>
      </section>

      <section className="bbt-panel bbt-history-panel">
        <div className="bbt-section-heading">
          <div>
            <p className="eyebrow">DAILY RECORDS</p>
            <h3>Recent readings</h3>
          </div>
        </div>

        {sortedEntries.length === 0 ? (
          <div className="bbt-chart-empty">
            <Thermometer size={28} />
            <p>No readings recorded yet.</p>
            <span>Your saved temperatures will appear here.</span>
          </div>
        ) : (
          <div className="bbt-history-list">
            {sortedEntries.slice(0, 14).map(([date, entry]) => (
              <div className="bbt-history-item" key={date}>
                <button
                  type="button"
                  className="bbt-history-date"
                  onClick={() => {
                    setSelectedDate(date);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <span>{formatDate(date, { weekday: "short" })}</span>
                  <strong>{formatDate(date)}</strong>
                </button>

                <div className="bbt-history-value">
                  <strong>{displayTemperature(entry)}</strong>
                  <span>{entry.measurementTime}</span>
                </div>

                <button
                  type="button"
                  className="bbt-history-delete"
                  onClick={() => deleteEntry(date)}
                  aria-label={`Delete reading for ${formatDate(date)}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="bbt-disclaimer">
        Temperature patterns can help identify a possible ovulation shift
        retrospectively, but a single reading or average cannot confirm
        ovulation. Unusual sleep, illness, and measurement timing may affect
        readings.
      </p>
    </div>
  );
}

export default BBTTracker;
