"use strict";

const os = require("os");

/** IP IPv4 de la red local (Wi‑Fi/Ethernet), ignorando adaptadores virtuales. */
function getLanIp() {
  const ifaces = os.networkInterfaces();
  const preferred = [];
  const fallback = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    const lower = name.toLowerCase();
    if (
      lower.includes("virtual") ||
      lower.includes("vethernet") ||
      lower.includes("wsl") ||
      lower.includes("vmware") ||
      lower.includes("hyper-v") ||
      lower.includes("loopback")
    ) {
      continue;
    }

    for (const iface of addrs || []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      if (
        lower.includes("wi-fi") ||
        lower.includes("wifi") ||
        lower.includes("wlan") ||
        lower.includes("wireless")
      ) {
        preferred.push(iface.address);
      } else {
        fallback.push(iface.address);
      }
    }
  }

  return preferred[0] || fallback[0] || null;
}

module.exports = { getLanIp };
