"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";

type Slot = { date: string; startTime: string; endTime: string };
type Format = "ONLINE" | "IN_PERSON";

const DURATIONS = [30, 45, 60] as const;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Dates throughout this app are literal "YYYY-MM-DD" wall-clock strings
// (see data model doc's "no per-user timezone conversion" decision) — all
// the calendar math below stays in UTC to match that, the same way the
// existing date-formatting calls already pass timeZone: "UTC".
function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function SlotPicker({
  teacherId,
  hourlyRateMinorUnits,
  formatsOffered,
  locationText,
  isAuthenticated,
  isStudent,
}: {
  teacherId: string;
  teacherName: string;
  hourlyRateMinorUnits: number;
  formatsOffered: Format[];
  locationText: string | null;
  isAuthenticated: boolean;
  isStudent: boolean;
}) {
  const router = useRouter();
  const [duration, setDuration] = useState<30 | 45 | 60>(60);
  const [format, setFormat] = useState<Format>(formatsOffered[0]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const todayKey = dateKey(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [viewYear, setViewYear] = useState(now.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(now.getUTCMonth());

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedDate(null);
    setSelectedTime(null);
    fetch(`/api/teachers/${teacherId}/slots?duration=${duration}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [teacherId, duration]);

  const dates = new Set(slots.map((s) => s.date));
  const timesForDate = selectedDate ? slots.filter((s) => s.date === selectedDate) : [];
  const price = (hourlyRateMinorUnits * duration) / 100 / 60;

  function refreshSlots() {
    fetch(`/api/teachers/${teacherId}/slots?duration=${duration}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []));
  }

  function changeMonth(delta: number) {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  }

  const atCurrentMonth = viewYear === now.getUTCFullYear() && viewMonth === now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay() + 6) % 7; // 0 = Monday
  const monthLabel = new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  async function handleContinue() {
    if (!selectedDate || !selectedTime) return;
    setError(null);

    if (isAuthenticated && !isStudent) {
      setError("Only students can book lessons.");
      return;
    }

    if (!isAuthenticated) {
      const params = new URLSearchParams({
        teacherId,
        date: selectedDate,
        startTime: selectedTime,
        duration: String(duration),
        format,
      });
      router.push(`/auth?${params.toString()}`);
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, date: selectedDate, startTime: selectedTime, durationMinutes: duration, format }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't hold that slot — try again.");
      setSelectedTime(null);
      refreshSlots();
      return;
    }

    const { booking } = await res.json();
    router.push(`/checkout?bookingId=${booking.id}`);
  }

  return (
    <div>
      <div className="opt-row">
        {DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            className={`opt-pill${duration === d ? " sel" : ""}`}
            onClick={() => setDuration(d)}
          >
            {d} min
          </button>
        ))}
      </div>

      {formatsOffered.length > 1 && (
        <div className="opt-row" style={{ marginTop: 10 }}>
          {formatsOffered.map((f) => (
            <button
              key={f}
              type="button"
              className={`opt-pill${format === f ? " sel" : ""}`}
              onClick={() => setFormat(f)}
            >
              {f === "ONLINE" ? "Online" : "In person"}
            </button>
          ))}
        </div>
      )}
      {format === "IN_PERSON" && locationText && (
        <p className="field-hint" style={{ marginTop: 8 }}>
          {locationText}
        </p>
      )}

      {loadingSlots ? (
        <p className="t-soft" style={{ marginTop: 28 }}>
          <Spinner label="Loading availability…" />
        </p>
      ) : dates.size === 0 ? (
        <p className="t-soft" style={{ marginTop: 28 }}>
          No open slots in the next two weeks — check back soon or try another teacher.
        </p>
      ) : (
        <div className="cal-layout">
          <div>
            <div className="cal-card">
              <div className="cal-head">
                <h2>{monthLabel}</h2>
                <div className="cal-nav">
                  <button type="button" onClick={() => changeMonth(-1)} disabled={atCurrentMonth} aria-label="Previous month">
                    ‹
                  </button>
                  <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
                    ›
                  </button>
                </div>
              </div>
              <div className="cal-grid">
                {DOW.map((d) => (
                  <div key={d} className="cal-dow">
                    {d}
                  </div>
                ))}
                {Array.from({ length: firstWeekday }).map((_, i) => (
                  <div key={`pad-${i}`} className="cal-day empty" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const key = dateKey(viewYear, viewMonth, day);
                  const hasSlots = dates.has(key);
                  const isPast = key < todayKey;
                  const clickable = hasSlots && !isPast;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`cal-day${hasSlots ? " has-slots" : ""}${!clickable ? " disabled" : ""}${selectedDate === key ? " sel" : ""}`}
                      disabled={!clickable}
                      onClick={() => {
                        setSelectedDate(key);
                        setSelectedTime(null);
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="slot-section">
                <h3>
                  Times on{" "}
                  {new Date(selectedDate).toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  })}
                </h3>
                <div className="time-slots">
                  {timesForDate.map((s) => (
                    <button
                      key={s.startTime}
                      type="button"
                      className={`tslot${selectedTime === s.startTime ? " sel" : ""}`}
                      onClick={() => setSelectedTime(s.startTime)}
                    >
                      {s.startTime}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="summary-card">
            <div className="price">
              £{price.toFixed(2)} <span>/ {duration} min</span>
            </div>
            <div className="summary-row">
              <span className="k">Format</span>
              <span className="v">{format === "ONLINE" ? "Online" : "In person"}</span>
            </div>
            <div className="summary-row">
              <span className="k">Date &amp; time</span>
              <span className="v">
                {selectedDate && selectedTime
                  ? `${new Date(selectedDate).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}, ${selectedTime}`
                  : "Select a time"}
              </span>
            </div>

            {error && (
              <p className="field-error" style={{ marginTop: 12 }}>
                {error}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 18, width: "100%" }}
              disabled={!selectedDate || !selectedTime || submitting}
              onClick={handleContinue}
            >
              {submitting ? <Spinner label="Holding your slot…" /> : "Continue"}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
