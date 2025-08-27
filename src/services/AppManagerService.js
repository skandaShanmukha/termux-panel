// src/services/AppManagerService.js
// --------------------------------------------------------------------
// AppManagerService: Core backend logic for Termux Panel apps.
// Handles:
//   - Installing apps (npm/other types)
//   - Managing lifecycle (start, stop, restart, uninstall)
//   - Persisting installed apps to apps.json
//
// Notes:
//   - Installs npm packages locally to avoid permission issues.
//   - Merges user-provided configuration with default app config.
//   - Uses PM2 for process management.
//   - Returns detailed app objects to frontend for HTMX rendering.
// --------------------------------------------------------------------

import { exec } from "child_process";
import pm2 from "pm2";
import util from "util";
import DbService from "./DbService.js";

const execAsync = util.promisify(exec);

class AppManagerService {

  // ------------------------------------------------------------------
  // Get all apps: combines registry (available apps) + installed apps
  // ------------------------------------------------------------------
  static async getAllApps() {
    try {
      const registry = await DbService.getRegistry(); // Catalog of all apps
      const installed = await DbService.getApps();    // Apps installed by the user

      return {
        registry,
        installed,
      };
    } catch (err) {
      console.error("Error fetching all apps:", err);
      throw new Error("Failed to fetch apps");
    }
  }

  // ------------------------------------------------------------------
  // Install an app by its ID with optional user configuration
  // ------------------------------------------------------------------
  static async installApp(appId, userConfig = {}) {
    // --- 1. Lookup app in registry ---
    const registry = await DbService.getRegistry();
    const appDef = registry.find((a) => a.id === appId);
    if (!appDef) throw new Error(`App '${appId}' not found in registry.`);

    // --- 2. Validate userConfig (example: port) ---
    if (userConfig.port && isNaN(Number(userConfig.port))) {
      throw new Error("Invalid port value. Must be a number.");
    }

    // --- 3. Merge default app config with user-provided config ---
    const mergedConfig = { ...appDef.config, ...userConfig };

    // Replace placeholders like {{port}} in args
    if (Array.isArray(appDef.config.args)) {
      mergedConfig.args = appDef.config.args.map((arg) =>
        typeof arg === "string" && arg.includes("{{port}}")
          ? arg.replace("{{port}}", userConfig.port || "8080")
          : arg
      );
    }

    // --- 4. Run installation command ---
    try {
      if (appDef.install.type === "npm") {
        // Install locally to avoid permission issues
        const cmd = `npm install ${appDef.install.package}`;
        console.log(`[AppManager] Installing locally: ${cmd}`);
        const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd() });
        console.log(stdout);
        if (stderr) console.error(stderr);
      }
      // Future: add support for "apt", "binary", etc.
    } catch (err) {
      throw new Error(`Failed to install package: ${err.message}`);
    }

    // --- 5. Start app using PM2 ---
    await new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);

        // Determine script path (local or global)
        const scriptPath = mergedConfig.script.startsWith("./") 
          ? mergedConfig.script 
          : `./node_modules/.bin/${appDef.install.package}`;

        pm2.start(
          {
            name: appDef.id,
            script: scriptPath,
            args: mergedConfig.args || [],
            env: mergedConfig.env || {},
            cwd: mergedConfig.cwd || process.cwd(),
          },
          (err) => {
            pm2.disconnect();
            if (err) return reject(err);
            resolve();
          }
        );
      });
    });

    // --- 6. Persist installed app ---
    const installedApps = await DbService.getApps();
    const installedApp = {
      id: appDef.id,
      name: appDef.name,
      description: appDef.description,
      category: appDef.category,
      config: mergedConfig,
    };
    installedApps.push(installedApp);
    await DbService.saveApps(installedApps);

    return installedApp;
  }

  // ------------------------------------------------------------------
  // Uninstall an app by its ID
  // Stops PM2 process and removes from apps.json
  // ------------------------------------------------------------------
  static async uninstallApp(appId) {
    // --- Stop app in PM2 ---
    await new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.delete(appId, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve();
        });
      });
    });

    // --- Remove app from installed list ---
    const installedApps = await DbService.getApps();
    const updatedApps = installedApps.filter((a) => a.id !== appId);
    await DbService.saveApps(updatedApps);
  }

  // ------------------------------------------------------------------
  // Start, Stop, Restart app using PM2
  // ------------------------------------------------------------------
  static async startApp(appId) {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.start(appId, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  static async stopApp(appId) {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.stop(appId, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  static async restartApp(appId) {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.restart(appId, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }
}

export default AppManagerService;
