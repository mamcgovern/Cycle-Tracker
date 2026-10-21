
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

    const totalToday = dayEntries.length;

    function changeDate(amount) {
        const [year, month, day] = selectedDate.split("-").map(Number);
        const nextDate = new Date(year, month - 1, day + amount);

        setSelectedDate(localDate(nextDate));
        setMessage("");
        setEditingEntry(null);
    }

    function goToToday() {
        setSelectedDate(localDate());
        setMessage("");
        setEditingEntry(null);
    }

    function addEntry(type) {
        const entry = {
            id: makeId(),
            date: selectedDate,
            period: selectedPeriod,
            type,
            createdAt: Date.now(),
        };

        setEntries((current) => [...current, entry]);
        setMessage(
            `${type === "condom" ? "Condom" : "Unprotected"} entry added for ${selectedPeriod}.`
        );
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
        setMessage("Entry updated.");
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
                            className={`activity-period-button ${selectedPeriod === period ? "selected" : ""
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
                    Then, tap an option to save an entry.
                </p>

                <div className="activity-choice-grid">
                    <button
                        type="button"
                        className="activity-choice-card activity-choice-unprotected"
                        onClick={() => addEntry("unprotected")}
                    >
                        <span className="activity-choice-icon">
                            <Heart size={34} strokeWidth={1.7} />
                        </span>
                        <span className="activity-choice-title">Unprotected</span>
                        <span className="activity-choice-caption">No condom</span>
                    </button>

                    <button
                        type="button"
                        className="activity-choice-card activity-choice-condom"
                        onClick={() => addEntry("condom")}
                    >
                        <span className="activity-choice-icon">
                            <ShieldCheck size={34} strokeWidth={1.7} />
                        </span>
                        <span className="activity-choice-title">Condom</span>
                        <span className="activity-choice-caption">Condom used</span>
                    </button>

                    <button
                        type="button"
                        className="activity-choice-card activity-choice-other"
                        onClick={() => addEntry("other")}
                    >
                        <span className="activity-choice-icon">
                            <Heart size={34} strokeWidth={1.7} />
                        </span>
                        <span className="activity-choice-title">Other Intimacy</span>
                        <span className="activity-choice-caption">No condom needed</span>
                    </button>
                </div>

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
                        {totalToday} {totalToday === 1 ? "entry" : "entries"}
                    </span>
                </div>

                {dayEntries.length === 0 ? (
                    <div className="activity-empty-state">
                        <Heart size={29} strokeWidth={1.4} />
                        <p>Nothing logged yet.</p>
                        <span>Your entries will appear here.</span>
                    </div>
                ) : (
                    <div className="activity-entry-list">
                        {dayEntries.map((entry, index) => (
                            <article className="activity-entry-row" key={entry.id}>
                                <span
                                    className={`activity-entry-symbol ${entry.type === "condom" ? "condom" : "unprotected"
                                        }`}
                                >
                                    {entry.type === "condom" ? (
                                        <ShieldCheck size={22} />
                                    ) : entry.type === "other" ? (
                                        <Heart size={22} />
                                    ) : (
                                        <Heart size={22} />
                                    )}
                                </span>

                                <div className="activity-entry-details">
                                    <strong>
                                        {entry.type === "condom"
                                            ? "Condom"
                                            : entry.type === "other"
                                                ? "Other Intimacy"
                                                : "Unprotected"}
                                    </strong>
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

                        <p>
                            {editingEntry.type === "condom" ? "Condom" : "Unprotected"}
                        </p>

                        <div className="activity-period-picker activity-edit-period">
                            {["AM", "PM"].map((period) => (
                                <button
                                    key={period}
                                    type="button"
                                    className={`activity-period-button ${editPeriod === period ? "selected" : ""
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
                            Save changes
                        </button>
                    </div>
                )}
            </section>

            <p className="activity-disclaimer">
                Entries are currently saved in this browser and do not sync between
                devices. The icons are quick labels for your records, not a medical
                assessment of pregnancy risk.
            </p>
        </div>
    );
}

export default ActivityLog;
