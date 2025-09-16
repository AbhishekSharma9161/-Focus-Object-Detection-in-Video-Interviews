import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import type {
  ProctorEvent,
  ProctorEventType,
  ProctorReport,
  ProctorSummaryCounts,
  SaveReportResponse,
} from "@shared/api";
import type {
  BlazeFaceModel,
  NormalizedFace,
} from "@tensorflow-models/blazeface";
import * as blazeface from "@tensorflow-models/blazeface";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { useToast } from "@/hooks/use-toast";

export type FocusStatus = "focused" | "looking_away" | "no_face";

export interface UseProctoringOptions {
  candidateName: string;
}

interface SuspiciousDetection {
  label: string;
  score: number;
  bbox: [number, number, number, number];
}

export function useProctoring(opts: UseProctoringOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [isInterviewRunning, setIsInterviewRunning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const [focusStatus, setFocusStatus] = useState<FocusStatus>("no_face");
  const [facesCount, setFacesCount] = useState(0);
  const [items, setItems] = useState<SuspiciousDetection[]>([]);
  const [events, setEvents] = useState<ProctorEvent[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [report, setReport] = useState<ProctorReport | null>(null);

  const faceModelRef = useRef<BlazeFaceModel | null>(null);
  const objectModelRef = useRef<cocoSsd.ObjectDetection | null>(null);

  const lastFaceSeenAtRef = useRef<number>(0);
  const lookingAwaySinceRef = useRef<number | null>(null);
  const lastMultipleFacesAtRef = useRef<number>(0);
  const lastClassLoggedAtRef = useRef<Record<string, number>>({});
  const closedEyeSinceRef = useRef<number | null>(null);
  const lastDrowsyAtRef = useRef<number>(0);
  const lastObjDetectAtRef = useRef<number>(0);

  const rafRef = useRef<number | null>(null);
  const lastDetectTsRef = useRef<number>(0);

  // audio detection
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioIntervalRef = useRef<number | null>(null);
  const lastLoudAtRef = useRef<number>(0);

  const { toast } = useToast();
  const sessionIdRef = useRef<string | null>(null);

  const addEvent = useCallback(
    (type: ProctorEventType, message: string) => {
      const now = Date.now();
      const start = startedAtRef.current ?? startedAt ?? now;
      const atMs = now - start;
      const ev = {
        id: `${now}-${type}`,
        type,
        message,
        atMs,
      } as const;

      setEvents((prev) => [ev as ProctorEvent, ...prev].slice(0, 200));

      // persist event to server session if available (best-effort, don't block)
      const sid = sessionIdRef.current;
      if (sid) {
        fetch(`/api/proctor/session/${encodeURIComponent(sid)}/event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ev),
        }).catch(() => {});
      }

      // show critical toasts for the interviewer
      if (
        [
          "LOOKING_AWAY",
          "NO_FACE",
          "MULTIPLE_FACES",
          "PHONE_DETECTED",
          "BOOK_DETECTED",
          "DEVICE_DETECTED",
          "DROWSINESS",
          "AUDIO_DETECTED",
        ].includes(type)
      ) {
        toast({ title: type.replace(/_/g, " "), description: message });
      }
    },
    [startedAt, toast],
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const drawOverlay = useCallback(
    (faces: NormalizedFace[], detections: SuspiciousDetection[]) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw faces
      ctx.lineWidth = 2;
      for (const f of faces) {
        const [x1, y1] = f.topLeft as [number, number];
        const [x2, y2] = f.bottomRight as [number, number];
        const w = x2 - x1;
        const h = y2 - y1;
        ctx.strokeStyle = "#22d3ee"; // cyan-400
        ctx.strokeRect(x1, y1, w, h);
      }
      // Draw detections
      for (const d of detections) {
        const [x, y, w, h] = d.bbox;
        ctx.strokeStyle = "#f59e0b"; // amber-500
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#f59e0b";
        ctx.font = "16px Inter";
        ctx.fillText(
          `${d.label} ${(d.score * 100).toFixed(0)}%`,
          x + 4,
          y + 18,
        );
      }
    },
    [],
  );

  const computeLookingAway = useCallback((face: NormalizedFace) => {
    // Heuristic using eyes and nose positions
    const landmarks = face.landmarks as [number, number, number][];
    // BlazeFace landmark order: [right eye, left eye, nose, mouth, right ear, left ear]
    if (!landmarks || landmarks.length < 3) return false;
    const [rightEye, leftEye, nose] = landmarks;
    const eyeMidX = (rightEye[0] + leftEye[0]) / 2;
    const eyeMidY = (rightEye[1] + leftEye[1]) / 2;
    const eyeDist = Math.hypot(
      rightEye[0] - leftEye[0],
      rightEye[1] - leftEye[1],
    );
    if (eyeDist === 0) return false;

    const offsetX = Math.abs(nose[0] - eyeMidX) / eyeDist;
    const offsetY = Math.abs(nose[1] - eyeMidY) / eyeDist;
    // Thresholds tuned empirically
    return offsetX > 0.35 || offsetY > 0.6;
  }, []);

  const suspiciousLabels = useMemo(() => new Set([
    "cell phone",
    "cellphone",
    "mobile phone",
    "mobile",
    "phone",
    "book",
    "notebook",
    "laptop",
    "tv",
    "keyboard",
    "mouse",
    "remote",
  ]), []);

  const mapDetectionType = (label: string): ProctorEventType | null => {
    const l = label.toLowerCase();
    if (["cell phone", "cellphone", "mobile phone", "mobile", "phone"].includes(l)) return "PHONE_DETECTED";
    if (["book", "notebook", "paper"].includes(l)) return "BOOK_DETECTED";
    if (["laptop", "tv", "keyboard", "mouse", "remote", "monitor", "tablet"].includes(l)) return "DEVICE_DETECTED";
    return null;
  };

  const detectLoop = useCallback(async () => {
    const now = performance.now();
    // Increase overall detection cadence
    if (now - lastDetectTsRef.current < 100) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }
    lastDetectTsRef.current = now;

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const faceModel = faceModelRef.current;
    const objModel = objectModelRef.current;
    if (!faceModel || !objModel) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const faces = (await faceModel.estimateFaces(
      video,
      false,
    )) as NormalizedFace[];
    setFacesCount(faces.length);

    const nowMs = Date.now();

    if (faces.length === 0) {
      // Immediately reflect no face in status badge
      if (focusStatus !== "no_face") setFocusStatus("no_face");
      if (lastFaceSeenAtRef.current === 0) lastFaceSeenAtRef.current = nowMs;
      // Log quickly when no face is visible (debounced)
      if (nowMs - lastFaceSeenAtRef.current > 2_000) {
        addEvent("NO_FACE", "No face detected");
        // reset timer so we don't spam
        lastFaceSeenAtRef.current = nowMs;
      }
    } else {
      lastFaceSeenAtRef.current = nowMs;
      // when face returns, restore focus status immediately
      if (focusStatus === "no_face") setFocusStatus("focused");
      // Multiple faces: update facesCount but do not emit a warning event to avoid unnecessary alerts
      if (faces.length > 1) {
        lastMultipleFacesAtRef.current = nowMs;
      }

      // Drowsiness / eye closure heuristic with debounce and cooldown
      try {
        const landmarks = faces[0].landmarks as [number, number][] | undefined;
        if (landmarks && landmarks.length >= 3) {
          const rEye = landmarks[0];
          const lEye = landmarks[1];
          const nose = landmarks[2];
          const eyeVert = Math.abs(rEye[1] - lEye[1]);
          const eyeToNose = Math.abs((rEye[1] + lEye[1]) / 2 - nose[1]);
          const nowMsInner = nowMs;
          const closedDetected = eyeToNose > 25 && eyeVert < 6;
          if (closedDetected) {
            if (closedEyeSinceRef.current == null) closedEyeSinceRef.current = nowMsInner;
            // require at least 2s of continuous closed eyes before flagging
            if (
              closedEyeSinceRef.current != null &&
              nowMsInner - closedEyeSinceRef.current > 2000 &&
              nowMsInner - lastDrowsyAtRef.current > 5000
            ) {
              addEvent("DROWSINESS", "Eyes appear closed or drowsy");
              lastDrowsyAtRef.current = nowMsInner;
              // leave closedEyeSinceRef as-is so we don't re-trigger immediately
            }
          } else {
            // reset closed eye timer when eyes open
            closedEyeSinceRef.current = null;
          }
        }
      } catch {
        // ignore
      }

      // Focus check on first face
      const away = computeLookingAway(faces[0]);
      if (away) {
        if (lookingAwaySinceRef.current == null) {
          lookingAwaySinceRef.current = nowMs;
        } else if (nowMs - lookingAwaySinceRef.current > 5_000) {
          if (focusStatus !== "looking_away") setFocusStatus("looking_away");
          addEvent("LOOKING_AWAY", "User looking away for over 5 seconds");
          lookingAwaySinceRef.current = nowMs; // prevent spamming by resetting baseline
        }
      } else {
        lookingAwaySinceRef.current = null;
        if (focusStatus !== "focused") setFocusStatus("focused");
      }
    }

    // Object detection (run more frequently for faster response)
    const detections: SuspiciousDetection[] = [];
    if (nowMs - lastObjDetectAtRef.current > 600) {
      lastObjDetectAtRef.current = nowMs;
      const preds = await objModel.detect(video);
      for (const p of preds) {
        const label = p.class.toLowerCase();
        if (suspiciousLabels.has(label) && p.score >= 0.5) {
          detections.push({
            label,
            score: p.score,
            bbox: p.bbox as [number, number, number, number],
          });
          const type = mapDetectionType(label);
          if (type) {
            const lastAt = lastClassLoggedAtRef.current[label] ?? 0;
            if (nowMs - lastAt > 3000) {
              const message =
                type === "PHONE_DETECTED"
                  ? "Mobile phone detected"
                  : type === "BOOK_DETECTED"
                  ? "Books / notes detected"
                  : "Electronic device detected";
              addEvent(type, message);
              lastClassLoggedAtRef.current[label] = nowMs;
            }
          }
        }
      }
      setItems(detections);
    }

    drawOverlay(faces, detections);

    rafRef.current = requestAnimationFrame(detectLoop);
  }, [addEvent, computeLookingAway, drawOverlay, focusStatus, suspiciousLabels]);

  const loadModels = useCallback(async () => {
    await tf.ready();
    // Use WebGL if available
    if (tf.getBackend() !== "webgl") {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
      } catch {}
    }
    faceModelRef.current = await blazeface.load();
    // Use a lighter base for faster inference; falls back if unavailable
    try {
      objectModelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" as cocoSsd.ModelConfig['base'] });
    } catch {
      objectModelRef.current = await cocoSsd.load({ base: "mobilenet_v2" });
    }
  }, []);

  const startInterview = useCallback(async () => {
    setReport(null);
    setEvents([]);
    setItems([]);
    setFacesCount(0);
    setRecordedUrl(null);
    lastFaceSeenAtRef.current = 0;
    lookingAwaySinceRef.current = null;
    lastMultipleFacesAtRef.current = 0;
    lastClassLoggedAtRef.current = {};

    // Start camera first to give immediate feedback, load models in background
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play();

    const startTs = Date.now();
    setStartedAt(startTs);
    startedAtRef.current = startTs;
    setIsInterviewRunning(true);

    // Create a server-side session for real-time logging (best-effort)
    fetch("/api/proctor/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateName: opts.candidateName,
        startedAt: new Date(startTs).toISOString(),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) sessionIdRef.current = data.id;
      })
      .catch(() => {});

    // load models but don't block UI; detectLoop will wait until models are ready
    loadModels()
      .then(async () => {
        // Warm up object detection once the video is ready to reduce first-call latency
        try {
          const objModel = objectModelRef.current;
          if (objModel && video.readyState >= 2) {
            await objModel.detect(video);
          }
        } catch {}
      })
      .catch(() => {});

    // setup audio analyser for background audio detection
    try {
      const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioIntervalRef.current = window.setInterval(() => {
        try {
          const a = analyserRef.current;
          if (!a) return;
          const arr = new Uint8Array(a.frequencyBinCount);
          a.getByteFrequencyData(arr);
          let sum = 0;
          for (let i = 0; i < arr.length; i++) sum += arr[i];
          const avg = sum / arr.length;
          const nowMs = Date.now();
          if (avg > 25) {
            if (nowMs - lastLoudAtRef.current > 3000) {
              addEvent(
                "AUDIO_DETECTED",
                `Background audio detected (level: ${Math.round(avg)})`,
              );
              lastLoudAtRef.current = nowMs;
            }
          }
        } catch {}
      }, 800);
    } catch {
      // audio context may be blocked in some browsers
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  }, [detectLoop, loadModels, addEvent, opts.candidateName]);

  const stopInterview = useCallback(() => {
    // Stop recording if active
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      setIsRecording(false);
    }

    const video = videoRef.current;
    if (video && video.srcObject) {
      const tracks = (video.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      video.srcObject = null;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // cleanup audio
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }

    setIsInterviewRunning(false);
    startedAtRef.current = null;

    // finalize report
    const rep = generateReport();
    if (rep) {
      setReport(rep);
      // persist final report to server (best-effort)
      saveReport().catch(() => {});
    }
  }, [generateReport, saveReport]);

  const startRecording = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;
    recordedChunksRef.current = [];
    const stream = video.srcObject as MediaStream;
    const mr = new MediaRecorder(stream, {
      mimeType: "video/webm; codecs=vp9",
    });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
    };
    mr.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.stop();
    setIsRecording(false);
    // generate a report snapshot at the end of recording so UI can show summary
    const rep = generateReport();
    if (rep) setReport(rep);
  }, [generateReport]);

  const computeCounts = useCallback((): ProctorSummaryCounts => {
    const counts: ProctorSummaryCounts = {
      focusLost: 0,
      absenceEvents: 0,
      multipleFaces: 0,
      phoneDetections: 0,
      bookDetections: 0,
      deviceDetections: 0,
    };
    for (const e of events) {
      if (e.type === "LOOKING_AWAY") counts.focusLost += 1;
      if (e.type === "NO_FACE") counts.absenceEvents += 1;
      // MULTIPLE_FACES events intentionally not counted to avoid unnecessary alerts
      if (e.type === "PHONE_DETECTED") counts.phoneDetections += 1;
      if (e.type === "BOOK_DETECTED") counts.bookDetections += 1;
      if (e.type === "DEVICE_DETECTED") counts.deviceDetections += 1;
    }
    return counts;
  }, [events]);

  const computeIntegrity = useCallback((counts: ProctorSummaryCounts) => {
    const deductions =
      counts.focusLost * 5 +
      counts.absenceEvents * 10 +
      counts.multipleFaces * 10 +
      counts.phoneDetections * 15 +
      counts.bookDetections * 8 +
      counts.deviceDetections * 10;
    const score = Math.max(0, 100 - deductions);
    return score;
  }, []);

  const generateReport = useCallback(() => {
    if (startedAt == null) return null;
    const ended = Date.now();
    const counts = computeCounts();
    const integrity = computeIntegrity(counts);
    const idBase = sessionIdRef.current ?? `${startedAt}-${opts.candidateName.replace(/\s+/g, "_").toLowerCase()}`;
    const rep: ProctorReport = {
      id: idBase,
      candidateName: opts.candidateName,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(ended).toISOString(),
      durationMs: ended - startedAt,
      events,
      counts,
      integrityScore: integrity,
    };
    setReport(rep);
    return rep;
  }, [computeCounts, computeIntegrity, events, opts.candidateName, startedAt]);

  const saveReport = useCallback(async () => {
    const rep = generateReport();
    if (!rep) return null;
    const res = await fetch("/api/proctor/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: rep }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SaveReportResponse;
    return data.id;
  }, [generateReport]);

  useEffect(() => {
    const currentVideo = videoRef.current;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (currentVideo && currentVideo.srcObject) {
        const tracks = (currentVideo.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    // refs
    videoRef,
    canvasRef,
    // controls
    startInterview,
    stopInterview,
    startRecording,
    stopRecording,
    saveReport,
    generateReport,
    // state
    isInterviewRunning,
    isRecording,
    recordedUrl,
    focusStatus,
    facesCount,
    items,
    events,
    report,
    // actions
    clearEvents,
  };
}
