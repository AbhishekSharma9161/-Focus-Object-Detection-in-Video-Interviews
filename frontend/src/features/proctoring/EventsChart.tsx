import React from "react";
import type { ProctorEvent } from "@shared/api";

interface Props {
  events: ProctorEvent[];
}

export function EventsChart({ events }: Props) {
  const counts = React.useMemo(() => {
    const map: Record<string, number> = {
      LOOKING_AWAY: 0,
      NO_FACE: 0,
      MULTIPLE_FACES: 0,
      PHONE_DETECTED: 0,
      BOOK_DETECTED: 0,
      DEVICE_DETECTED: 0,
      DROWSINESS: 0,
      AUDIO_DETECTED: 0,
    };
    for (const e of events) {
      map[e.type] = (map[e.type] || 0) + 1;
    }
    return map;
  }, [events]);

  const items = Object.entries(counts);
  const max = Math.max(1, ...items.map(([, v]) => v));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-800">Event Summary</h4>
      <div className="mt-3 space-y-3">
        {items.map(([key, value]) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-28 text-xs text-slate-600">
              {key.replace(/_/g, " ")}
            </div>
            <div className="flex-1">
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-indigo-600"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="w-8 text-right text-sm font-medium text-slate-700">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
