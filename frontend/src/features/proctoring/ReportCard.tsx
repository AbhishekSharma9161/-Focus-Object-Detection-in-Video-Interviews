import type { ProctorReport } from "@shared/api";

interface Props {
  report: ProctorReport | null;
}

export function ReportCard({ report }: Props) {
  if (!report) return null;
  const duration = formatDuration(report.durationMs);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            Proctoring Report
          </h3>
          <p className="text-slate-600">
            Candidate: {report.candidateName} • Duration: {duration}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreBadge score={report.integrityScore} />
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat label="Focus Lost" value={report.counts.focusLost} />
        <Stat label="Absence Events" value={report.counts.absenceEvents} />
        <Stat label="Multiple Faces" value={report.counts.multipleFaces} />
        <Stat label="Phone Detected" value={report.counts.phoneDetections} />
        <Stat label="Books/Notes" value={report.counts.bookDetections} />
        <Stat label="Devices" value={report.counts.deviceDetections} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-emerald-100 text-emerald-800"
      : score >= 60
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";
  return (
    <div className={`rounded-full px-4 py-2 text-sm font-semibold ${color}`}>
      Integrity Score: {score}
    </div>
  );
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [] as string[];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
