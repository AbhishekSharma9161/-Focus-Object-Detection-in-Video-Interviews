import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { getReport, listReports, saveReport, getReportEvents, getReportSummary, createSession, appendEventToSession } from "./routes/proctor";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Proctoring API
  app.post("/api/proctor/report", saveReport);
  app.get("/api/proctor/reports", listReports);
  app.get("/api/proctor/reports/:id", getReport);
  app.get("/api/proctor/reports/:id/events", getReportEvents);
  app.get("/api/proctor/reports/:id/summary", getReportSummary);

  // Session endpoints for real-time logging
  app.post("/api/proctor/session", createSession);
  app.post("/api/proctor/session/:id/event", appendEventToSession);

  return app;
}
