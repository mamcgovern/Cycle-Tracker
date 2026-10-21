
import { useEffect, useMemo, useState } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Droplets,
    CalendarDays,
    Save,
    Trash2,
} from "lucide-react";

const STORAGE_KEY = "petal-period-entries";

const FLOW_OPTIONS = [
    { value: "none", label: "No flow" },
    { value: "spotting", label: "Spotting" },
    { value: "light", label: "Light" },
    { value: "medium", label: "Medium" },
    { value: "heavy", label: "Heavy" },
];

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function readEntries() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
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

function getMonthTitle(date) {
    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });
}

function PeriodTracker() {
    const [entries, setEntries] = useState(readEntries);
    const [viewedMonth, setViewedMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());
    const [flow, setFlow] = useState("none");
    const [spotting, setSpotting] = useState(false);
    const [notes, setNotes] = useState("");
    const [savedMessage, setSavedMessage] = useState("");

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch {
            setSavedMessage("Unable to save. Check your browser storage settings.");
        }
    }, [entries]);

    useEffect(() => {
        const existing = entries[selectedDate];
        setFlow(existing?.flow ?? "none");
        setSpotting(existing?.spotting ?? false);
        setNotes(existing?.notes ?? "");
        setSavedMessage("");
    }, [selectedDate, entries]);

    const calendarDays = useMemo(() => {
        const year = viewedMonth.getFullYear();
        const month = viewedMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Monday-first calendar
        const offset = (firstDay.getDay() + 6) % 7;
        const days = [];

        for (let i = 0; i < offset; i++) {
            days.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            days.push(
                `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            );
        }

        while (days.length % 7 !== 0) {
            days.push(null);
        }

        return days;
    }, [viewedMonth]);

    const savedDays = Object.entries(entries)
        .filter(([, entry]) => entry.flow !== "none" || entry.spotting || entry.notes)
        .sort(([a], [b]) => b.localeCompare(a));

    function changeMonth(amount) {
        setViewedMonth(
            (current) =>
                new Date(current.getFullYear(), current.getMonth() + amount, 1)
        );
    }

    function selectDay(dateString) {
        if (!dateString) return;

        setSelectedDate(dateString);
        const [year, month] = dateString.split("-").map(Number);
        setViewedMonth(new Date(year, month - 1, 1));
    }

    function saveEntry(event) {
        event.preventDefault();

        setEntries((current) => ({
            ...current,
            [selectedDate]: {
                flow,
                spotting,
                notes: notes.trim(),
            },
        }));

        setSavedMessage(
            flow === "none" && !spotting && !notes.trim()
                ? "No-flow day saved."
                : "Your entry has been saved."
        );
    }

    function deleteEntry() {
        setEntries((current) => {
            const updated = { ...current };
            delete updated[selectedDate];
            return updated;
        });
        setSavedMessage("Entry deleted.");
    }

    function getDayClass(dateString) {
        if (!dateString) return "period-day-empty";

        const entry = entries[dateString];
        const classes = ["period-day"];

        if (dateString === selectedDate) classes.push("period-day-selected");
        if (dateString === getLocalDateString()) classes.push("period-day-today");

        if (entry?.flow === "light") classes.push("flow-light");
        if (entry?.flow === "medium") classes.push("flow-medium");
        if (entry?.flow === "heavy") classes.push("flow-heavy");
        if (entry?.flow === "spotting" || entry?.spotting) {
            classes.push("flow-spotting");
        }

        return classes.join(" ");
    }

    return (
        <div className="period-tracker">
            <section className="period-intro">
                <div>
                    <p className="eyebrow">YOUR CYCLE JOURNAL</p>
                    <h2>Period calendar</h2>
                    <p>Keep track of your flow, spotting, and daily notes.</p>
                </div>
                <div className="period-intro-icon">
                    <Droplets size={32} strokeWidth={1.4} />
                </div>
            </section>

            <div className="period-layout">
                <section className="period-panel calendar-panel">
                    <div className="month-navigation">
                        <button
                            className="month-arrow"
                            onClick={() => changeMonth(-1)}
                            aria-label="Previous month"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <h3>{getMonthTitle(viewedMonth)}</h3>

                        <button
                            className="month-arrow"
                            onClick={() => changeMonth(1)}
                            aria-label="Next month"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="calendar-grid calendar-weekdays">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                            (day) => (
                                <div key={day}>{day}</div>
                            )
                        )}
                    </div>

                    <div className="calendar-grid calendar-dates">
                        {calendarDays.map((dateString, index) => (
                            <div key={dateString ?? `empty-${index}`} className="calendar-cell">
                                {dateString ? (
                                    <button
                                        className={getDayClass(dateString)}
                                        onClick={() => selectDay(dateString)}
                                        aria-label={formatDate(dateString)}
                                        aria-pressed={selectedDate === dateString}
                                    >
                                        <span>{Number(dateString.slice(-2))}</span>
                                        {entries[dateString] &&
                                            (entries[dateString].flow !== "none" ||
                                                entries[dateString].spotting) && (
                                                <span className="period-day-marker" />
                                            )}
                                    </button>
                                ) : (
                                    <span className="period-day-empty" />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="calendar-legend">
                        <span><i className="legend-dot legend-light" /> Light</span>
                        <span><i className="legend-dot legend-medium" /> Medium</span>
                        <span><i className="legend-dot legend-heavy" /> Heavy</span>
                        <span><i className="legend-dot legend-spotting" /> Spotting</span>
                    </div>

                    <button
                        className="today-button"
                        onClick={() => {
                            const today = new Date();
                            setViewedMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                            setSelectedDate(getLocalDateString());
                        }}
                    >
                        <CalendarDays size={16} />
                        Go to today
                    </button>
                </section>

                <section className="period-panel entry-panel">
                    <div className="entry-heading">
                        <p className="eyebrow">DAILY ENTRY</p>
                        <h3>{formatDate(selectedDate)}</h3>
                        <p className="entry-subtitle">How was this day for you?</p>
                    </div>

                    <form onSubmit={saveEntry}>
                        <fieldset className="flow-fieldset">
                            <legend>Flow intensity</legend>
                            <div className="flow-options">
                                {FLOW_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`flow-option flow-option-${option.value} ${flow === option.value ? "flow-option-active" : ""
                                            }`}
                                        onClick={() => {
                                            setFlow(option.value);
                                            if (option.value === "spotting") setSpotting(true);
                                        }}
                                        aria-pressed={flow === option.value}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <label className="spotting-toggle">
                            <input
                                type="checkbox"
                                checked={spotting}
                                onChange={(event) => setSpotting(event.target.checked)}
                            />
                            <span className="custom-checkbox" />
                            <span>
                                <strong>Spotting</strong>
                                <small>Record spotting separately from your flow level.</small>
                            </span>
                        </label>

                        <label className="notes-label" htmlFor="period-notes">
                            Notes <span>(optional)</span>
                        </label>
                        <textarea
                            id="period-notes"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Anything you want to remember about this day..."
                            rows={4}
                        />

                        <div className="entry-actions">
                            <button type="submit" className="button-primary save-entry">
                                <Save size={16} />
                                Save entry
                            </button>

                            {entries[selectedDate] && (
                                <button
                                    type="button"
                                    className="delete-entry"
                                    onClick={deleteEntry}
                                    aria-label="Delete this day's entry"
                                >
                                    <Trash2 size={17} />
                                </button>
                            )}
                        </div>

                        {savedMessage && (
                            <p className="save-message" role="status">{savedMessage}</p>
                        )}
                    </form>
                </section>
            </div>

            <section className="period-panel period-history">
                <div className="history-heading">
                    <div>
                        <p className="eyebrow">YOUR RECORDS</p>
                        <h3>Recent entries</h3>
                    </div>
                    <span className="history-count">
                        {savedDays.length} {savedDays.length === 1 ? "entry" : "entries"}
                    </span>
                </div>

                {savedDays.length === 0 ? (
                    <div className="empty-history">
                        <Droplets size={25} strokeWidth={1.4} />
                        <p>Your entries will appear here as you start logging.</p>
                    </div>
                ) : (
                    <div className="history-list">
                        {savedDays.slice(0, 10).map(([dateString, entry]) => (
                            <button
                                key={dateString}
                                className={`history-item ${dateString === selectedDate ? "history-item-active" : ""
                                    }`}
                                onClick={() => selectDay(dateString)}
                            >
                                <span className="history-date">
                                    {formatDate(dateString, {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                                <span className="history-detail">
                                    {entry.flow !== "none" ? entry.flow : ""}
                                    {entry.spotting
                                        ? `${entry.flow !== "none" ? " · " : ""}spotting`
                                        : ""}
                                    {!entry.flow || entry.flow === "none"
                                        ? entry.notes
                                            ? "Notes saved"
                                            : ""
                                        : ""}
                                </span>
                                <ChevronRight size={17} />
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default PeriodTracker;
