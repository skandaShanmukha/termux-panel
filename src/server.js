// src/server.js
// ----------------------------------------------------
// Main Express server entry point for Termux Panel.
// Serves both API endpoints and static HTML pages.
// ----------------------------------------------------

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// --- API Routers ---
import systemApi from "./api/system-api.js";  // System stats endpoints
import appsApi from "./api/apps-api.js";      // ✅ Apps management endpoints

const app = express();
const PORT = 3000;

// ----------------------------------------------------
// Resolve __dirname for ES modules (since it's not
// available by default in ESM like in CommonJS).
// ----------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------------------------------
// Middleware
// ----------------------------------------------------
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data

// Serve static assets (CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname, "public")));

// ----------------------------------------------------
// API Routes
// ----------------------------------------------------
app.use("/api/system", systemApi); // System info (CPU, memory, processes)
app.use("/api/apps", appsApi);     // ✅ Apps lifecycle (install, start, stop)

// ----------------------------------------------------
// Frontend Routes - Serve static HTML views
// ----------------------------------------------------
// Each route corresponds to a page in /public/views
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/views/dashboard.html"));
});

app.get("/system", (req, res) => {
  res.sendFile(path.join(__dirname, "public/views/system.html"));
});

app.get("/apps", (req, res) => {
  res.sendFile(path.join(__dirname, "public/views/apps.html"));
});

app.get("/logs", (req, res) => {
  res.sendFile(path.join(__dirname, "public/views/logs.html"));
});

app.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "public/views/settings.html"));
});

// ----------------------------------------------------
// Start Server
// ----------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Termux Panel running at: http://localhost:${PORT}`);
  console.log(`📡 System API: http://localhost:${PORT}/api/system`);
  console.log(`📡 Apps API:   http://localhost:${PORT}/api/apps`);
});
