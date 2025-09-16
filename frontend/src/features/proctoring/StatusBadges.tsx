import { FocusStatus } from "./useProctoring";

interface Props {
  focusStatus: FocusStatus;
  facesCount: number;
  items: { label: string; score: number }[];
}

export function StatusBadges({ focusStatus, facesCount, items }: Props) {
  const focusColor =
    focusStatus === "focused"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : focusStatus === "looking_away"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-rose-100 text-rose-700 border-rose-200";
  const focusLabel =
    focusStatus === "focused"
      ? "Focused"
      : focusStatus === "looking_away"
        ? "Looking Away"
        : "No Face";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
        <span className="h-2 w-2 rounded-full bg-slate-400" /> Faces:{" "}
        {facesCount}
      </span>
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${focusColor}`}
      >
        <span className="h-2 w-2 rounded-full bg-current/60" /> {focusLabel}
      </span>
      {items.slice(0, 3).map((d, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800"
        >
          <span className="h-2 w-2 rounded-full bg-indigo-500" /> {d.label}{" "}
          {Math.round(d.score * 100)}%
        </span>
      ))}
      {items.length > 3 && (
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
          +{items.length - 3} more
        </span>
      )}
    </div>
  );
}
