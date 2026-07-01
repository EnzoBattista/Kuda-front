"use strict";

const { getLanIp } = require("./lan-ip.cjs");

const ip = getLanIp();
const line = "═".repeat(52);

console.log(`\n${line}`);
console.log("  Gimnasio Kuda — URLs de desarrollo");
console.log(line);
console.log("  PC:");
console.log("    http://localhost:4200");
console.log("    https://localhost:4201");
if (ip) {
  console.log("");
  console.log("  CELULAR (misma WiFi):");
  console.log(`    http://${ip}:4200`);
  console.log(`    https://${ip}:4201  ← QR / cámara`);
  console.log("");
  console.log("  En el celular, al abrir HTTPS aceptá el certificado");
  console.log("  de desarrollo (avanzado → continuar).");
} else {
  console.log("");
  console.log("  CELULAR: no se detectó IP de red local.");
  console.log("  Conectate a WiFi y reiniciá npm run start:all");
}
console.log(`${line}\n`);
