import type { ProctorEvent } from "@shared/api";

interface Props {
  events: ProctorEvent[];
  onClear?: () => void;
}

const typeColor: Record<string, string> = {
  LOOKING_AWAY: "bg-amber-500",
  NO_FACE: "bg-rose-500",
  MULTIPLE_FACES: "bg-fuchsia-500",
  PHONE_DETECTED: "bg-indigo-600",
  BOOK_DETECTED: "bg-cyan-600",
  DEVICE_DETECTED: "bg-sky-600",
  DROWSINESS: "bg-rose-600",
  AUDIO_DETECTED: "bg-yellow-600",
  INFO: "bg-slate-400",
};

export function EventLog({ events, onClear }: Props) {
  return (
    <div className="flex h-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/60">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="text-sm font-medium text-slate-700">Events</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onClear?.()}
            className="rounded-full px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="h-full overflow-auto p-3">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500 text-sm">
            No events yet
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[80px_1fr] items-start gap-3 rounded-lg border border-slate-200 bg-white p-2"
              >
                <div className="text-xs tabular-nums text-slate-500">
                  {formatMs(e.atMs)}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${typeColor[e.type] || "bg-slate-400"}`}
                  />
                  <span
                    className={`text-sm ${["PHONE_DETECTED", "BOOK_DETECTED", "DEVICE_DETECTED"].includes(e.type) ? "text-rose-700 font-semibold" : "text-slate-800"}`}
                  >
                    {e.message}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
