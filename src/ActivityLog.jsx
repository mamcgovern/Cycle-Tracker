
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
import "./styles/activity-log.css";

const STORAGE_KEY = "petal-activity-entries";

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString, options = {}) {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
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

function makeId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ActivityLog() {
  const [entries, setEntries] = useState(readEntries);
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [selectedPeriod, setSelectedPeriod] = useState("AM");
  const [pendingType, setPendingType] = useState("");
  const [message, setMessage] = useState("");
  const [editingEntry, setEditingEntry] = useState(null);
  const [editPeriod, setEditPeriod] = useState("AM");
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [entries]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date === selectedDate)
        .sort((a, b) => {
          if (a.period !== b.period) {
            return a.period === "AM" ? -1 : 1;
          }
          return a.createdAt - b.createdAt;
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

  function saveEntry() {
    if (!pendingType) {
      setMessage("Choose an activity before saving.");
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
    setMessage("Entry saved.");
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

  function saveEdit() {
    if (!editingEntry) return;

    setEntries((current) =>
      current.map((entry) =>
        entry.id === editingEntry.id
          ? { ...entry, period: editPeriod }
          : entry
      )
    );

    setEditingEntry(null);
    setMessage("Changes saved.");
  }

  function deleteEntry(id) {
    setEntries((current) =>
      current.filter((entry) => entry.id !== id)
    );

    if (editingEntry?.id === id) {
      setEditingEntry(null);
    }

    setMessage("Entry deleted.");
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
            Your browser could not save this entry. Check your storage settings.
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
                <span
                  className={`activity-entry-symbol ${entry.type}`}
                >
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
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteEntry(entry.id)}
                    aria-label="Delete entry"
                    title="Delete entry"
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
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        )}
      </section>

      <p className="activity-disclaimer">
        Entries are saved in this browser. They do not sync between devices
        until cloud syncing is configured.
      </p>
    </div>
  );
}

export default ActivityLog;
