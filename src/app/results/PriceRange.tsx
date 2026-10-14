"use client";

import { useState } from "react";

// Cross-links the two inputs' min/max attributes so the browser's native
// validation alert (same one min="0" already triggers) also fires when the
// minimum is set above the maximum.
export function PriceRange({ defaultMin, defaultMax }: { defaultMin?: number; defaultMax?: number }) {
  const [min, setMin] = useState(defaultMin != null ? String(defaultMin) : "");
  const [max, setMax] = useState(defaultMax != null ? String(defaultMax) : "");

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        type="number"
        name="minPrice"
        min="0"
        max={max !== "" ? max : undefined}
        placeholder="Min"
        aria-label="Minimum price per hour"
        value={min}
        onChange={(e) => setMin(e.target.value)}
        style={{ width: "50%" }}
      />
      <input
        type="number"
        name="maxPrice"
        min={min !== "" ? min : "0"}
        placeholder="Max"
        aria-label="Maximum price per hour"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        style={{ width: "50%" }}
      />
    </div>
  );
}
