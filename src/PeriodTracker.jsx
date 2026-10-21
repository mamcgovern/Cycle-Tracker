
import { useEffect, useMemo, useState } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Droplets,
    CalendarDays,
    Save,
    Trash2,
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

const STORAGE_KEY = "petal-period-entries";
const COLLECTION_NAME = "periodEntries";

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
    const [syncStatus, setSyncStatus] = useState("connecting");
    const [syncError, setSyncError] = useState("");
    const [isReady, setIsReady] = useState(false);

    const user = auth.currentUser;

    // Keep local entries available and synchronize them with this user's
    // Firestore collection. Existing cloud entries take precedence on dates
    // that already exist in both places.
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
                        flow: data.flow ?? "none",
                        spotting: data.spotting ?? false,
                        notes: data.notes ?? "",
                    };
                });

                // Upload local records only for dates absent from the cloud.
                // Existing cloud records are not overwritten by migration.
                const missingEntries = Object.entries(localEntries).filter(
                    ([date]) =>
                        !Object.prototype.hasOwnProperty.call(
                            cloudEntries,
                            date
                        )
                );

                for (const [date, entry] of missingEntries) {
                    if (cancelled) return;

                    await setDoc(doc(entriesRef, date), {
                        flow: entry.flow ?? "none",
                        spotting: entry.spotting ?? false,
                        notes: entry.notes ?? "",
                        updatedAt: new Date().toISOString(),
                    });
                }

                if (cancelled) return;

                // Combine local and cloud entries, preserving local entries
                // for dates that have not yet been written to the cloud.
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
                                flow: data.flow ?? "none",
                                spotting: data.spotting ?? false,
                                notes: data.notes ?? "",
                            };
                        });

                        if (cancelled) return;

                        // The cloud snapshot is authoritative after the
                        // initial migration has completed.
                        setEntries(latestEntries);
                        setSyncStatus("synced");
                        setSyncError("");
                    },
                    (error) => {
                        console.error(
                            "Period sync listener error:",
                            error
                        );
                        setSyncStatus("error");
                        setSyncError(
                            "Cloud updates are unavailable. Your local entries are still available."
                        );
                    }
                );
            } catch (error) {
                console.error(
                    "Unable to synchronize period entries:",
                    error
                );

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

    // Maintain local storage as a backup.
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch {
            setSavedMessage(
                "Unable to save a local backup. Check your browser storage settings."
            );
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

        // Monday-first calendar.
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
        .filter(([, entry]) =>
            entry.flow !== "none" || entry.spotting || entry.notes
        )
        .sort(([a], [b]) => b.localeCompare(a));

    function changeMonth(amount) {
        setViewedMonth(
            (current) =>
                new Date(
                    current.getFullYear(),
                    current.getMonth() + amount,
                    1
                )
        );
    }

    function selectDay(dateString) {
        if (!dateString) return;

        setSelectedDate(dateString);
        const [year, month] = dateString.split("-").map(Number);
        setViewedMonth(new Date(year, month - 1, 1));
    }

    async function saveEntry(event) {
        event.preventDefault();

        const entry = {
            flow,
            spotting,
            notes: notes.trim(),
        };

        // Save locally first, so the entry is not lost if the network fails.
        setEntries((current) => ({
            ...current,
            [selectedDate]: entry,
        }));

        if (!user) {
            setSavedMessage(
                flow === "none" && !spotting && !notes.trim()
                    ? "No-flow day saved locally."
                    : "Your entry has been saved locally."
            );
            return;
        }

        try {
            await setDoc(
                doc(
                    db,
                    "users",
                    user.uid,
                    COLLECTION_NAME,
                    selectedDate
                ),
                {
                    ...entry,
                    updatedAt: new Date().toISOString(),
                }
            );

            setSavedMessage(
                flow === "none" && !spotting && !notes.trim()
                    ? "No-flow day saved and synced."
                    : "Your entry has been saved and synced."
            );
            setSyncStatus("synced");
            setSyncError("");
        } catch (error) {
            console.error("Unable to save period entry:", error);
            setSavedMessage(
                "Saved locally, but cloud sync failed. Check your connection and try again."
            );
            setSyncStatus("error");
        }
    }

    async function deleteEntry() {
        if (user) {
            try {
                await deleteDoc(
                    doc(
                        db,
                        "users",
                        user.uid,
                        COLLECTION_NAME,
                        selectedDate
                    )
                );
            } catch (error) {
                console.error(
                    "Unable to delete cloud period entry:",
                    error
                );
                setSavedMessage(
                    "Unable to delete the cloud entry. Please try again."
                );
                return;
            }
        }

        setEntries((current) => {
            const updated = { ...current };
            delete updated[selectedDate];
            return updated;
        });

        setSavedMessage(
            user
                ? "Entry deleted."
                : "Entry deleted from this device."
        );
    }

    function getDayClass(dateString) {
        if (!dateString) return "period-day-empty";

        const entry = entries[dateString];
        const classes = ["period-day"];

        if (dateString === selectedDate) {
            classes.push("period-day-selected");
        }

        if (dateString === getLocalDateString()) {
            classes.push("period-day-today");
        }

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
                    <p>
                        Keep track of your flow, spotting, and daily notes.
                    </p>
                </div>
                <div className="period-intro-icon">
                    <Droplets size={32} strokeWidth={1.4} />
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
                    "Connecting your period entries to your account..."}
                {syncStatus === "synced" &&
                    "Your period entries are synced with your account."}
                {syncStatus === "local" &&
                    "Your entries are saved on this device only."}
                {syncStatus === "error" && syncError}
            </p>

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
                            <div
                                key={dateString ?? `empty-${index}`}
                                className="calendar-cell"
                            >
                                {dateString ? (
                                    <button
                                        className={getDayClass(dateString)}
                                        onClick={() => selectDay(dateString)}
                                        aria-label={formatDate(dateString)}
                                        aria-pressed={
                                            selectedDate === dateString
                                        }
                                    >
                                        <span>
                                            {Number(dateString.slice(-2))}
                                        </span>
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
                        <span>
                            <i className="legend-dot legend-light" /> Light
                        </span>
                        <span>
                            <i className="legend-dot legend-medium" /> Medium
                        </span>
                        <span>
                            <i className="legend-dot legend-heavy" /> Heavy
                        </span>
                        <span>
                            <i className="legend-dot legend-spotting" /> Spotting
                        </span>
                    </div>

                    <button
                        className="today-button"
                        onClick={() => {
                            const today = new Date();
                            setViewedMonth(
                                new Date(
                                    today.getFullYear(),
                                    today.getMonth(),
                                    1
                                )
                            );
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
                        <p className="entry-subtitle">
                            How was this day for you?
                        </p>
                    </div>

                    <form onSubmit={saveEntry}>
                        <fieldset className="flow-fieldset">
                            <legend>Flow intensity</legend>
                            <div className="flow-options">
                                {FLOW_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`flow-option flow-option-${option.value} ${
                                            flow === option.value
                                                ? "flow-option-active"
                                                : ""
                                        }`}
                                        onClick={() => {
                                            setFlow(option.value);
                                            if (option.value === "spotting") {
                                                setSpotting(true);
                                            }
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
                                onChange={(event) =>
                                    setSpotting(event.target.checked)
                                }
                            />
                            <span className="custom-checkbox" />
                            <span>
                                <strong>Spotting</strong>
                                <small>
                                    Record spotting separately from your flow
                                    level.
                                </small>
                            </span>
                        </label>

                        <label className="notes-label" htmlFor="period-notes">
                            Notes <span>(optional)</span>
                        </label>
                        <textarea
                            id="period-notes"
                            value={notes}
                            onChange={(event) =>
                                setNotes(event.target.value)
                            }
                            placeholder="Anything you want to remember about this day..."
                            rows={4}
                        />

                        <div className="entry-actions">
                            <button
                                type="submit"
                                className="button-primary save-entry"
                                disabled={!isReady}
                            >
                                <Save size={16} />
                                {isReady ? "Save entry" : "Loading entries..."}
                            </button>

                            {entries[selectedDate] && (
                                <button
                                    type="button"
                                    className="delete-entry"
                                    onClick={deleteEntry}
                                    aria-label="Delete this day's entry"
                                    disabled={!isReady}
                                >
                                    <Trash2 size={17} />
                                </button>
                            )}
                        </div>

                        {savedMessage && (
                            <p className="save-message" role="status">
                                {savedMessage}
                            </p>
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
                        {savedDays.length}{" "}
                        {savedDays.length === 1 ? "entry" : "entries"}
                    </span>
                </div>

                {savedDays.length === 0 ? (
                    <div className="empty-history">
                        <Droplets size={25} strokeWidth={1.4} />
                        <p>
                            Your entries will appear here as you start logging.
                        </p>
                    </div>
                ) : (
                    <div className="history-list">
                        {savedDays.slice(0, 10).map(([dateString, entry]) => (
                            <button
                                key={dateString}
                                className={`history-item ${
                                    dateString === selectedDate
                                        ? "history-item-active"
                                        : ""
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
