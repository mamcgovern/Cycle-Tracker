import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import "./styles/cycle-trends.css";

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
    (parseDate(secondDate).getTime() - parseDate(firstDate).getTime()) /
      86400000
  );
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getBleedingDays(periodEntries) {
  return Object.entries(periodEntries)
    .filter(([, entry]) => ["light", "medium", "heavy"].includes(entry?.flow))
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

  return entry.unit === "°C" ? (temperature * 9) / 5 + 32 : temperature;
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


export default CombinedCycleChart;
