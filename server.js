// server.js — run with: node server.js
// Serves the React build and persists calendar events to events.json

import express from "express";
import fs      from "fs";
import path    from "path";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const app        = express();
const PORT       = process.env.PORT || 3000;
const DATA_FILE  = path.join(__dirname, "events.json");

app.use(express.json());

// Serve the React production build from ./dist
app.use(express.static(path.join(__dirname, "dist")));

// ── Helpers ──────────────────────────────────────────────────────────────────

function readEvents() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeEvents(data) {
  // Write to a temp file first, then rename — prevents corruption if the Pi
  // loses power mid-write
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

// ── API routes ────────────────────────────────────────────────────────────────

// GET /api/events — return all saved events
app.get("/api/events", (req, res) => {
  res.json(readEvents());
});

// POST /api/events — replace all events (full save)
app.post("/api/events", (req, res) => {
  const data = req.body;
  if (typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ error: "Expected a JSON object" });
  }
  writeEvents(data);
  res.json({ ok: true });
});

// Fallback — send index.html for any non-API route (SPA routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Calendar running on http://localhost:${PORT}`);
  console.log(`Events stored at: ${DATA_FILE}`);
});
