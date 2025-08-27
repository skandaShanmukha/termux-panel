// src/api/apps-api.js
// --------------------------------------------------------------------
// Apps API for Termux Panel
// Handles HTTP requests for installed apps and registry apps.
// Supports both JSON (API) and HTML (HTMX partial) responses.
// --------------------------------------------------------------------

import express from "express";
import AppManagerService from "../services/AppManagerService.js";
import fs from "fs/promises";
import path from "path";
import DbService from "../services/DbService.js";

const router = express.Router();

// --------------------------------------------------------------------
// expanded registry 
// This could be read from registry.json
// --------------------------------------------------------------------
const registry = await DbService.getRegistry();


// --------------------------------------------------------------------
// GET /api/apps
// Returns all installed apps. HTMX requests return HTML fragment.
// --------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const allApps = await AppManagerService.getAllApps(); // { registry, installed }

    // HTMX request returns HTML partial
    if (req.headers["hx-request"]) {
      const partialPath = path.join(process.cwd(), "src/public/views/partials/app-list.html");
      let html = await fs.readFile(partialPath, "utf8");

      // Render installed apps
      if (allApps.installed.length > 0) {
        html = allApps.installed.map(app =>
          html
            .replace(/{{id}}/g, app.id)
            .replace(/{{name}}/g, app.name)
            .replace(/{{description}}/g, app.description)
            .replace(/{{status}}/g, app.status || "stopped")
            .replace(/{{version}}/g, app.version || "N/A")
        ).join("\n");
      } else {
        html = `<p class="text-gray-500">No apps installed yet.</p>`;
      }

      return res.send(html);
    }

    // Default JSON response
    res.json({ success: true, data: allApps });

  } catch (err) {
    console.error("Error fetching all apps:", err);
    res.status(500).json({ success: false, error: "Failed to fetch apps" });
  }
});

// --------------------------------------------------------------------
// GET /api/apps/registry
// Returns all available apps from the registry
// --------------------------------------------------------------------
router.get("/registry", async (req, res) => {
  try {
    // HTMX request returns HTML partial
    if (req.headers["hx-request"]) {
      const partialPath = path.join(process.cwd(), "src/public/views/partials/registry-list.html");
      let html = await fs.readFile(partialPath, "utf8");

      if (registry.length > 0) {
        html = registry.map(app =>
          html
            .replace(/{{id}}/g, app.id)
            .replace(/{{name}}/g, app.name)
            .replace(/{{description}}/g, app.description)
            .replace(/{{category}}/g, app.category)
        ).join("\n");
      } else {
        html = `<p class="text-gray-500">No apps available in registry.</p>`;
      }

      return res.send(html);
    }

    res.json({ success: true, data: registry });

  } catch (err) {
    console.error("Error fetching registry apps:", err);
    res.status(500).json({ success: false, error: "Failed to fetch registry apps" });
  }
});

// --------------------------------------------------------------------
// GET /api/apps/registry/:id/form
// Returns HTML fragment for dynamic installation modal
// --------------------------------------------------------------------
router.get("/registry/:id/form", async (req, res) => {
  try {
    const app = registry.find(a => a.id === req.params.id);
    if (!app) return res.status(404).send("<p>App not found.</p>");

    const partialPath = path.join(process.cwd(), "src/public/views/partials/install-modal.html");
    let htmlTemplate = await fs.readFile(partialPath, "utf8");

    htmlTemplate = htmlTemplate
      .replace(/{{id}}/g, app.id)
      .replace(/{{name}}/g, app.name)
      .replace(/{{description}}/g, app.description)
      .replace(/{{defaultPort}}/g, app.config?.args?.[1] || 8080);

    res.send(htmlTemplate);

  } catch (err) {
    console.error("Error generating install form:", err);
    res.status(500).send("<p>Failed to load install form.</p>");
  }
});

// --------------------------------------------------------------------
// POST /api/apps/:id/:action
// Start / Stop / Restart / Delete installed apps
// --------------------------------------------------------------------
router.post("/:id/:action", async (req, res) => {
  const { id, action } = req.params;
  try {
    switch (action) {
      case "start": await AppManagerService.startApp(id); break;
      case "stop": await AppManagerService.stopApp(id); break;
      case "restart": await AppManagerService.restartApp(id); break;
      case "delete": await AppManagerService.uninstallApp(id); break;
      default: return res.status(400).json({ success: false, error: "Invalid action" });
    }

    // Return updated installed apps HTML fragment for HTMX
    const updatedApps = await AppManagerService.getAllApps();
    const partialPath = path.join(process.cwd(), "src/public/views/partials/app-list.html");
    let html = await fs.readFile(partialPath, "utf8");

    if (updatedApps.installed.length > 0) {
      html = updatedApps.installed.map(app =>
        html
          .replace(/{{id}}/g, app.id)
          .replace(/{{name}}/g, app.name)
          .replace(/{{description}}/g, app.description)
          .replace(/{{status}}/g, app.status || "stopped")
          .replace(/{{version}}/g, app.version || "N/A")
      ).join("\n");
    } else {
      html = `<p class="text-gray-500">No apps installed yet.</p>`;
    }

    res.send(html);

  } catch (err) {
    console.error(`Error performing action '${action}' on app '${id}':`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------------------------
// POST /api/apps/:id/install
// Installs an app from the registry
// --------------------------------------------------------------------
router.post("/:id/install", async (req, res) => {
  const { id } = req.params;
  const userConfig = req.body || {};

  try {
    const installedApp = await AppManagerService.installApp(id, userConfig);
    res.json({ success: true, data: installedApp });

  } catch (err) {
    console.error(`Error installing app '${id}':`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
