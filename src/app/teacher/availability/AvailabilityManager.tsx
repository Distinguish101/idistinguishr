"use client";

import { useState, type FormEvent } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Rule = { id: string; dayOfWeek: number; startTime: string; endTime: string };
type Exception = {
  id: string;
  date: string;
  type: "BLOCKED" | "ADDED";
  startTime: string | null;
  endTime: string | null;
};

export function AvailabilityManager({
  initialRules,
  initialExceptions,
}: {
  initialRules: Rule[];
  initialExceptions: Exception[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [error, setError] = useState<string | null>(null);

  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [addingRule, setAddingRule] = useState(false);

  const [excDate, setExcDate] = useState("");
  const [excType, setExcType] = useState<"BLOCKED" | "ADDED">("BLOCKED");
  const [excAllDay, setExcAllDay] = useState(true);
  const [excStart, setExcStart] = useState("09:00");
  const [excEnd, setExcEnd] = useState("17:00");
  const [addingExc, setAddingExc] = useState(false);

  async function addRule(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }
    setAddingRule(true);
    const res = await fetch("/api/teacher/availability/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayOfWeek, startTime, endTime }),
    });
    setAddingRule(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that slot.");
      return;
    }
    const { rule } = await res.json();
    setRules((prev) =>
      [...prev, rule].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
    );
  }

  async function deleteRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/teacher/availability/rules/${id}`, { method: "DELETE" });
  }

  async function addException(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!excDate) {
      setError("Pick a date.");
      return;
    }
    if (!excAllDay && excStart >= excEnd) {
      setError("End time must be after start time.");
      return;
    }
    setAddingExc(true);
    const res = await fetch("/api/teacher/availability/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: excDate,
        type: excType,
        startTime: excAllDay ? null : excStart,
        endTime: excAllDay ? null : excEnd,
      }),
    });
    setAddingExc(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that exception.");
      return;
    }
    const { exception } = await res.json();
    setExceptions((prev) => [...prev, exception].sort((a, b) => a.date.localeCompare(b.date)));
  }

  async function deleteException(id: string) {
    setExceptions((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/teacher/availability/exceptions/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <section className="card" style={{ marginBottom: 32 }}>
        <h2 className="t-display-m" style={{ marginBottom: 16 }}>
          Weekly hours
        </h2>
        {rules.length === 0 && <p className="t-soft">No recurring hours set yet.</p>}
        {rules.map((r) => (
          <div key={r.id} className="day-row">
            <span className="day-label">{DAYS[r.dayOfWeek]}</span>
            <span className="chip">
              {r.startTime}–{r.endTime}
              <button type="button" onClick={() => deleteRule(r.id)} aria-label="Remove">
                ×
              </button>
            </span>
          </div>
        ))}

        <form
          onSubmit={addRule}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 20, flexWrap: "wrap" }}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Day</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Start</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>End</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={addingRule}>
            Add hours
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="t-display-m" style={{ marginBottom: 16 }}>
          Exceptions
        </h2>
        <p className="t-soft" style={{ marginBottom: 16 }}>
          Block a date you&apos;re normally free, or open an extra slot outside your usual week.
        </p>
        {exceptions.length === 0 && <p className="t-soft">No exceptions yet.</p>}
        {exceptions.map((e) => (
          <div key={e.id} className="day-row">
            <span className="day-label">{e.date}</span>
            <span className="chip">
              {e.type === "BLOCKED" ? "Blocked" : "Added"}
              {e.startTime ? ` ${e.startTime}–${e.endTime}` : " (all day)"}
              <button type="button" onClick={() => deleteException(e.id)} aria-label="Remove">
                ×
              </button>
            </span>
          </div>
        ))}

        <form
          onSubmit={addException}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 20, flexWrap: "wrap" }}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Date</label>
            <input type="date" value={excDate} onChange={(e) => setExcDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={excType} onChange={(e) => setExcType(e.target.value as "BLOCKED" | "ADDED")}>
              <option value="BLOCKED">Blocked</option>
              <option value="ADDED">Added</option>
            </select>
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={excAllDay} onChange={(e) => setExcAllDay(e.target.checked)} /> All
            day
          </label>
          {!excAllDay && (
            <>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Start</label>
                <input type="time" value={excStart} onChange={(e) => setExcStart(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>End</label>
                <input type="time" value={excEnd} onChange={(e) => setExcEnd(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn btn-secondary" disabled={addingExc}>
            Add exception
          </button>
        </form>
      </section>

      {error && (
        <p className="field-error" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  );
}
