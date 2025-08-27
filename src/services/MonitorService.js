// src/services/MonitorService.js
// ----------------------------------------------------
// Service responsible for fetching system information.
// Uses Node's built-in 'os' module for system stats
// and 'child_process' to list running processes.
// ----------------------------------------------------

import os from "os";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export async function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  let privateIp = "N/A";
  let ifaceName = "N/A";

  for (const [name, addrs] of Object.entries(interfaces)) {
    const addr = addrs.find(a => a.family === "IPv4" && !a.internal);
    if (addr) {
      privateIp = addr.address;
      ifaceName = name;
      break;
    }
  }

  let publicIp = "N/A";
  try {
    const { stdout } = await execAsync("curl -s https://api.ipify.org");
    publicIp = stdout.trim();
  } catch (err) {
    console.error("Public IP fetch error:", err);
  }

  let gateway = "N/A";
  try {
    const { stdout } = await execAsync("ip route | grep default | awk '{print $3}'");
    gateway = stdout.trim();
  } catch (err) {
    console.error("Gateway fetch error:", err);
  }

  return { privateIp, publicIp, gateway, ifaceName };
}


// --- Get basic system stats ---
export async function getSystemStats() {
  return {
    uptime: (os.uptime() / 60).toFixed(1) + " mins",
    load: os.loadavg().map(v => v.toFixed(2)),
    memory: {
      total: (os.totalmem() / 1024 / 1024).toFixed(1) + " MB",
      free: (os.freemem() / 1024 / 1024).toFixed(1) + " MB",
      used: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1) + " %"
    },
    cpus: os.cpus().length
  };
}

// --- Get process list with CPU & MEM ---
export async function getProcessList(limit = 20, offset = 0) {
  try {
    const { stdout } = await execAsync(`ps -eo pid,pcpu,pmem,comm --sort=-pcpu`);
    const lines = stdout.trim().split("\n").slice(1); // skip header
    const processes = lines.map(line => {
      const parts = line.trim().split(/\s+/, 4);
      return {
        pid: parts[0],
        cpu: parts[1] + " %",
        mem: parts[2] + " %",
        command: parts[3]
      };
    });
    return processes.slice(offset, offset + limit);
  } catch (err) {
    console.error("Process fetch error:", err);
    return [];
  }
}
