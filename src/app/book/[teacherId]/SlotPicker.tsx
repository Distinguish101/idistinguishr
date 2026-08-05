"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Slot = { date: string; startTime: string; endTime: string };
type Format = "ONLINE" | "IN_PERSON";

const DURATIONS = [30, 45, 60] as const;

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

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedDate(null);
    setSelectedTime(null);
    fetch(`/api/teachers/${teacherId}/slots?duration=${duration}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [teacherId, duration]);

  const dates = Array.from(new Set(slots.map((s) => s.date)));
  const timesForDate = selectedDate ? slots.filter((s) => s.date === selectedDate) : [];
  const price = (hourlyRateMinorUnits * duration) / 100 / 60;

  function refreshSlots() {
    fetch(`/api/teachers/${teacherId}/slots?duration=${duration}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []));
  }

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

      <div style={{ marginTop: 28 }}>
        {loadingSlots ? (
          <p className="t-soft">Loading availability…</p>
        ) : dates.length === 0 ? (
          <p className="t-soft">No open slots in the next two weeks — check back soon or try another teacher.</p>
        ) : (
          <>
            <div className="date-row">
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`date-pill${selectedDate === d ? " sel" : ""}`}
                  onClick={() => {
                    setSelectedDate(d);
                    setSelectedTime(null);
                  }}
                >
                  {new Date(d).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </button>
              ))}
            </div>

            {selectedDate && (
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
            )}
          </>
        )}
      </div>

      {selectedDate && selectedTime && (
        <div className="price-summary">
          <span>
            {new Date(selectedDate).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            })}{" "}
            at {selectedTime} · {duration} min · {format === "ONLINE" ? "Online" : "In person"}
          </span>
          <span>£{price.toFixed(2)}</span>
        </div>
      )}

      {error && (
        <p className="field-error" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 24 }}
        disabled={!selectedDate || !selectedTime || submitting}
        onClick={handleContinue}
      >
        {submitting ? "Holding your slot…" : "Continue"}
      </button>
    </div>
  );
}
