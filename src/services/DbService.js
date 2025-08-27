// src/services/DbService.js
// --------------------------------------------------------------------
// JSON Database Service using lowdb v6+
// Works with pure ESM and Node.js 18+
// Handles:
//   - registry.json (available apps metadata)
//   - apps.json     (installed apps state)
//
// Auto-creates missing files with defaults.
// --------------------------------------------------------------------

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node"; // <- correct adapter for v6+

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to data directory
const dataDir = join(__dirname, "../data");

// Ensure /data folder exists
fs.ensureDirSync(dataDir);

// --------------------------------------------------------------------
// Helper: create LowDB instance with auto-init
// --------------------------------------------------------------------
async function createDb(filename, defaults) {
  const fullPath = join(dataDir, filename);
  const adapter = new JSONFile(fullPath);
  const db = new Low(adapter, defaults);

  await db.read();
  if (db.data === null) {
    db.data = defaults;
    await db.write();
    console.log(`📂 Created ${filename} with defaults.`);
  }

  return db;
}

// --------------------------------------------------------------------
// Create DBs
// --------------------------------------------------------------------
const registryDb = await createDb("registry.json", []); // like app catalog
const appsDb = await createDb("apps.json", []);         // installed apps

// --------------------------------------------------------------------
// Service API
// --------------------------------------------------------------------
const DbService = {
  // ----- Registry -----
  async getRegistry() {
    await registryDb.read();
    return registryDb.data;
  },

  async saveRegistry(data) {
    registryDb.data = data;
    await registryDb.write();
  },

  // ----- Apps -----
  async getApps() {
    await appsDb.read();
    return appsDb.data;
  },

  async saveApps(data) {
    appsDb.data = data;
    await appsDb.write();
  }
};

export default DbService;
