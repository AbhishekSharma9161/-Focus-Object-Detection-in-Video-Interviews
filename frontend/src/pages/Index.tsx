"use client";

import { useMemo, useRef, useState } from "react";
import { useProctoring } from "@/features/proctoring/useProctoring";
import { StatusBadges } from "@/features/proctoring/StatusBadges";
import { EventLog } from "@/features/proctoring/EventLog";
import { ReportCard } from "@/features/proctoring/ReportCard";

export default function Index() {
  const [name, setName] = useState("Candidate");
  const [showReport, setShowReport] = useState(false);
  const {
    videoRef,
    canvasRef,
    startInterview,
    stopInterview,
    startRecording,
    stopRecording,
    generateReport,
    isInterviewRunning,
    isRecording,
    recordedUrl,
    focusStatus,
    facesCount,
    items,
    events,
    report,
    clearEvents,
  } = useProctoring({ candidateName: name });

  const containerRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(
    () => "Focus & Object Detection in Video Interviews",
    [],
  );

  function formatMs(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_0%_0%,hsl(var(--accent))/30_0%,transparent_60%),radial-gradient(1200px_600px_at_100%_0%,hsl(var(--primary))/20_0%,transparent_60%),radial-gradient(1200px_600px_at_50%_100%,hsl(var(--muted))/20_0%,transparent_60%)]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-white/50 backdrop-blur supports-[backdrop-filter]:bg-white/30">
        <div
          className="w-full flex items-center justify-between px-4 md:px-8 py-3"
          style={{
            backgroundColor: "rgba(181, 199, 199, 1)",
          }}
        >
          <div className="flex items-center gap-3" style={{ marginLeft: "93px" }}>
            <div
              style={{
                backgroundImage:
                  "url(https://cdn.builder.io/api/v1/image/assets%2F52ecdb53561243bcb31e3b6763cc049f%2Faeb28a06cae2434598416d48b20715d2)",
                borderRadius: "12px",
                height: "36px",
                width: "36px",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            />
            <div>
              <h1
                className="text-base font-semibold leading-tight"
                style={{
                  color: "rgba(0,70,255,1)",
                  fontFamily: "Alef, sans-serif",
                }}
              >
                {title}
              </h1>
              <p className="text-xs text-slate-600" style={{ marginRight: "auto" }}>
                Real-time proctoring and object detection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isInterviewRunning ? (
              <button
                onClick={startInterview}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 active:bg-indigo-800 transition duration-75 transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                Start Interview
              </button>
            ) : (
              <button
                onClick={stopInterview}
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-transform transform hover:-translate-y-0.5 hover:shadow-sm"
              >
                Stop Interview
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        className="container mx-auto grid gap-6 p-4 md:p-8 pb-24"
        ref={containerRef}
      >
        <section className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/40 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/20 bg-white/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Candidate name"
                />
                <StatusBadges
                  focusStatus={focusStatus}
                  facesCount={facesCount}
                  items={items}
                />
              </div>
              <div className="flex items-center gap-2">
                {/* Start/Stop Recording (Save Report removed) */}
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={!isInterviewRunning}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition duration-75 transform hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      stopRecording();
                      const rep = generateReport();
                      if (rep) setShowReport(true);
                    }}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition-transform transform hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Stop Recording
                  </button>
                )}
              </div>
            </div>
            <div className="relative bg-slate-950 min-h-[480px] md:min-h-[420px]">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div
              className="flex items-center justify-between border-t border-white/20 bg-white/60 px-4 py-3"
              style={{ color: "rgba(225,228,235,1)" }}
            >
              <div className="flex items-center gap-2">
                {recordedUrl ? (
                  <>
                    <a
                      href={recordedUrl}
                      download={`interview-${name.replace(/\s+/g, "_").toLowerCase()}.webm`}
                      className="rounded-full bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
                    >
                      Download Video
                    </a>
                    <button
                      onClick={async () => {
                        let rep = report;
                        if (!rep) {
                          rep = generateReport();
                        }
                        if (!rep) return;
                        const { jsPDF } = await import("jspdf");
                        const doc = new jsPDF();
                        doc.setFontSize(14);
                        doc.text("Proctoring Report", 14, 20);
                        doc.setFontSize(10);
                        doc.text(`Candidate: ${rep.candidateName}`, 14, 30);
                        doc.text(`Duration: ${Math.round(rep.durationMs / 1000)}s`, 14, 36);
                        doc.text(`Integrity Score: ${rep.integrityScore}`, 14, 42);
                        doc.text("\nCounts:", 14, 52);
                        let y = 58;
                        Object.entries(rep.counts).forEach(([k, v]) => {
                          doc.text(`${k}: ${v}`, 14, y);
                          y += 6;
                        });
                        y += 4;
                        doc.text("Events:", 14, y);
                        y += 6;
                        rep.events.forEach((e) => {
                          if (y > 270) {
                            doc.addPage();
                            y = 20;
                          }
                          doc.text(`${formatMs(e.atMs)} - ${e.type} - ${e.message}`, 14, y);
                          y += 6;
                        });
                        doc.save(`proctor-report-${rep.id}.pdf`);
                      }}
                      className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:shadow-md transition-transform transform hover:-translate-y-0.5 ml-2"
                    >
                      Download Report
                    </button>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">Interview video will be available after recording</div>
                )}
              </div>
              <span className="text-sm text-slate-500">
                Tip: keep your face centered and look at the screen
              </span>
            </div>
          </div>

          <div className="grid gap-4 pb-40">
            <div
              className="rounded-2xl border border-white/20 p-4 shadow-sm backdrop-blur-sm"
              style={{ backgroundColor: "rgba(242,222,222,0.6)" }}
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Live Events
              </h3>
              <div className="mt-3">
                <EventLog events={events} onClear={clearEvents} />
              </div>
            </div>

            {/* After recording ends or after interview ends show summary only when a report snapshot is available */}
            {report || showReport ? (
              <>
                <ReportCard report={report ?? generateReport()!} />
              </>
            ) : (
              <div />
            )}
          </div>
        </section>
      </main>

      <footer
        className="fixed bottom-0 left-0 right-0 border-t border-white/10 py-3 text-center text-xs text-slate-600 backdrop-blur"
        style={{ backgroundColor: "#9d9d9d" }}
      >
        Built for secure, fair interviews — All rights reserved 2025
      </footer>
    </div>
  );
}


