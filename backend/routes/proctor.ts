import type { RequestHandler } from "express";
import { promises as fs } from "fs";
import path from "path";
import {
  SaveReportRequest,
  SaveReportResponse,
  ListReportsResponse,
  ProctorReport,
  ProctorEvent,
} from "@shared/api";
import { getMongoClient } from "../lib/mongo";

const DATA_DIR = path.join(process.cwd(), "server", "data", "reports");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function saveReportFile(report: ProctorReport) {
  await ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, `${report.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
}

async function listReportsFiles() {
  await ensureDir(DATA_DIR);
  const files = await fs.readdir(DATA_DIR);
  const items = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const p = path.join(DATA_DIR, f);
        const content = JSON.parse(await fs.readFile(p, "utf-8")) as ProctorReport;
        return {
          id: content.id,
          candidateName: content.candidateName,
          startedAt: content.startedAt,
          endedAt: content.endedAt,
          integrityScore: content.integrityScore,
        };
      }),
  );
  return items.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

async function getReportFile(id: string) {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  const exists = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
  if (!exists) return null;
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as ProctorReport;
}

export const saveReport: RequestHandler = async (req, res) => {
  try {
    const body = req.body as SaveReportRequest;
    const report: ProctorReport = body.report;
    if (!report || !report.id) {
      res.status(400).json({ error: "Invalid report payload" });
      return;
    }

    // Try saving to MongoDB if configured, otherwise fallback to file
    const client = await getMongoClient();
    if (client) {
      const db = client.db(process.env.MONGODB_DB ?? "proctor");
      const col = db.collection<ProctorReport>("reports");
      const doc = { ...report };
      await col.updateOne({ id: report.id }, { $set: doc }, { upsert: true });
    } else {
      await saveReportFile(report);
    }

    const response: SaveReportResponse = { ok: true, id: report.id };
    res.status(200).json(response);
  } catch (err) {
    console.error("saveReport error", err);
    res.status(500).json({ error: "Failed to save report" });
  }
};

export const listReports: RequestHandler = async (_req, res) => {
  try {
    const client = await getMongoClient();
    if (client) {
      const db = client.db(process.env.MONGODB_DB ?? "proctor");
      const col = db.collection("reports");
      const rows = await col
        .find({}, { projection: { events: 0, counts: 0 } })
        .sort({ startedAt: -1 })
        .toArray();
      const items = rows.map((r: any) => ({
        id: r.id,
        candidateName: r.candidateName,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        integrityScore: r.integrityScore,
      }));
      const response: ListReportsResponse = { reports: items };
      res.status(200).json(response);
      return;
    }
    const items = await listReportsFiles();
    const response: ListReportsResponse = { reports: items };
    res.status(200).json(response);
  } catch (err) {
    console.error("listReports error", err);
    res.status(500).json({ error: "Failed to list reports" });
  }
};

export const getReport: RequestHandler = async (req, res) => {
  try {
    const id = req.params["id"];
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }

    const client = await getMongoClient();
    if (client) {
      const db = client.db(process.env.MONGODB_DB ?? "proctor");
      const col = db.collection<ProctorReport>("reports");
      const doc = await col.findOne({ id });
      if (!doc) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      res.status(200).json(doc as ProctorReport);
      return;
    }

    const report = await getReportFile(id);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.status(200).json(report);
  } catch (err) {
    console.error("getReport error", err);
    res.status(500).json({ error: "Failed to get report" });
  }
};

// New: get events for a report, with optional filtering by type
export const getReportEvents: RequestHandler = async (req, res) => {
  try {
    const id = req.params["id"];
    const type = (req.query.type as string) || undefined;
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }

    const client = await getMongoClient();
    if (client) {
      const db = client.db(process.env.MONGODB_DB ?? "proctor");
      const col = db.collection("reports");
      const proj: any = { events: 1, _id: 0 };
      const doc = await col.findOne({ id }, { projection: proj });
      if (!doc) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      let events: ProctorEvent[] = doc.events || [];
      if (type) events = events.filter((e) => e.type === type);
      res.status(200).json({ events });
      return;
    }

    const report = await getReportFile(id);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    let events = report.events || [];
    if (type) events = events.filter((e) => e.type === type);
    res.status(200).json({ events });
  } catch (err) {
    console.error("getReportEvents error", err);
    res.status(500).json({ error: "Failed to get events" });
  }
};

// New: get aggregated focus and item detection report
export const getReportSummary: RequestHandler = async (req, res) => {
  try {
    const id = req.params["id"];
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }

    const client = await getMongoClient();
    let report: ProctorReport | null = null;
    if (client) {
      const db = client.db(process.env.MONGODB_DB ?? "proctor");
      const col = db.collection("reports");
      const doc = await col.findOne({ id });
      if (!doc) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      report = (doc as unknown as ProctorReport) ?? null;
    } else {
      report = await getReportFile(id);
      if (!report) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
    }

    // Build summary payload with counts and key events
    const focusEvents = report.events.filter((e) => e.type === "LOOKING_AWAY");
    const absenceEvents = report.events.filter((e) => e.type === "NO_FACE");
    const phoneDetections = report.events.filter((e) => e.type === "PHONE_DETECTED");
    const bookDetections = report.events.filter((e) => e.type === "BOOK_DETECTED");
    const deviceDetections = report.events.filter((e) => e.type === "DEVICE_DETECTED");

    res.status(200).json({
      id: report.id,
      candidateName: report.candidateName,
      startedAt: report.startedAt,
      endedAt: report.endedAt,
      durationMs: report.durationMs,
      counts: report.counts,
      focusEvents: focusEvents.length,
      absenceEvents: absenceEvents.length,
      phoneDetections: phoneDetections.length,
      bookDetections: bookDetections.length,
      deviceDetections: deviceDetections.length,
      events: report.events,
    });
  } catch (err) {
    console.error("getReportSummary error", err);
    res.status(500).json({ error: "Failed to build summary" });
  }
};

// Create a new session/report placeholder (returns id)
export const createSession: RequestHandler = async (req, res) => {
  try {
    const { candidateName, startedAt } = req.body as { candidateName?: string; startedAt?: string };
    const id = `${Date.now()}-${(candidateName || 'candidate').replace(/\s+/g,'_').toLowerCase()}`;
    const doc: ProctorReport = {
      id,
      candidateName: candidateName || "",
      startedAt: startedAt || new Date().toISOString(),
      endedAt: "",
      durationMs: 0,
      events: [],
      counts: {
        focusLost: 0,
        absenceEvents: 0,
        multipleFaces: 0,
        phoneDetections: 0,
        bookDetections: 0,
        deviceDetections: 0,
      },
      integrityScore: 100,
    };

    const client = await getMongoClient();
    if (client) {
      const db = client.db(process.env.MONGODB_DB ?? "proctor");
      const col = db.collection("reports");
      await col.updateOne({ id }, { $set: doc }, { upsert: true });
    } else {
      await saveReportFile(doc);
    }

    res.status(200).json({ id });
  } catch (err) {
    console.error("createSession error", err);
    res.status(500).json({ error: "Failed to create session" });
  }
};

// Append an event to a session/report
export const appendEventToSession: RequestHandler = async (req, res) => {
  try {
    const id = req.params["id"];
    const ev = req.body as ProctorEvent;
    if (!id || !ev || !ev.id) {
      res.status(400).json({ error: "Missing id or event" });
      return;
    }

    const client = await getMongoClient();
    if (client) {
      const db = client.db(process.env.MONGODB_DB ?? "proctor");
      const col = db.collection<ProctorReport>("reports");
      await col.updateOne({ id }, { $push: { events: ev as ProctorEvent } });
      res.status(200).json({ ok: true });
      return;
    }

    const report = await getReportFile(id);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    report.events = (report.events || []) as ProctorEvent[];
    report.events.push(ev as ProctorEvent);
    await saveReportFile(report);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("appendEventToSession error", err);
    res.status(500).json({ error: "Failed to append event" });
  }
};
