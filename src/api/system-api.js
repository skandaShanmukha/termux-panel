// src/api/system-api.js
// ----------------------------------------------------
// API Router for system monitoring endpoints.
// Supports both JSON and HTML fragment responses.
// ----------------------------------------------------

import express from "express";
import { getSystemStats, getNetworkInfo, getProcessList } from "../services/MonitorService.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

const router = express.Router();

// --- GET /api/system/stats ---
router.get("/stats", async (req, res) => {
  try {
    const stats = await getSystemStats();
    const network = await getNetworkInfo();

    if (req.accepts("html")) {
      const partialPath = path.join(process.cwd(), "src/public/views/partials/stats.html");
      let html = await fs.readFile(partialPath, "utf8");

      // Make load human-friendly
      const load1 = stats.load[0];  // 1-min
      const load5 = stats.load[1];  // 5-min
      const load15 = stats.load[2]; // 15-min

      // Wrap stats partial with data attributes
      html = html
        .replace(/{{uptime}}/g, stats.uptime)
        .replace(/{{load}}/g, stats.load.join(", "))
        .replace(/{{totalMem}}/g, stats.memory.total)
        .replace(/{{freeMem}}/g, stats.memory.free)
        .replace(/{{usedPercent}}/g, stats.memory.used)
        .replace(/{{cpus}}/g, stats.cpus)
        .replace(/{{load1}}/g, load1)
        .replace(/{{load5}}/g, load5)
        .replace(/{{load15}}/g, load15)
        // Add network placeholders
        .replace(/{{privateIp}}/g, network.privateIp)
        .replace(/{{publicIp}}/g, network.publicIp)
        .replace(/{{gateway}}/g, network.gateway)
        .replace(/{{ifaceName}}/g, network.ifaceName);

      return res.send(html);
    }

    // JSON response (now includes network)
    res.json({ stats, network });

  } catch (err) {
    console.error("Error in /api/system/stats:", err);
    res.status(500).send("Failed to fetch system stats.");
  }
});

// --- GET /api/system/processes ---
router.get("/processes", async (req, res) => {
  const page = parseInt(req.query.page || "1");
  const limit = 10;
  const offset = (page - 1) * limit;

  const processes = await getProcessList(limit, offset);

  if (req.accepts("html")) {
    let html = `
      <table class="min-w-full text-sm">
        <thead>
          <tr class="bg-gray-200">
            <th class="px-2 py-1 text-left">PID</th>
            <th class="px-2 py-1">CPU %</th>
            <th class="px-2 py-1">MEM %</th>
            <th class="px-2 py-1 text-left">Command</th>
          </tr>
        </thead>
        <tbody>
          ${processes.map(p => `
            <tr class="border-b">
              <td class="px-2 py-1">${p.pid}</td>
              <td class="px-2 py-1 text-center">${p.cpu}</td>
              <td class="px-2 py-1 text-center">${p.mem}</td>
              <td class="px-2 py-1">${p.command}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="flex justify-between mt-3">
        <button hx-get="/api/system/processes?page=${page - 1}" 
                hx-target="#processes" 
                class="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                ${page <= 1 ? "disabled" : ""}>Previous</button>
        <button hx-get="/api/system/processes?page=${page + 1}" 
                hx-target="#processes" 
                class="px-3 py-1 bg-gray-200 rounded">Next</button>
      </div>
    `;
    return res.send(html);
  }

  res.json(processes);
});

export default router;
