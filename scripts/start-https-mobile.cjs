"use strict";

const { spawn } = require("child_process");
const path = require("path");
const { getLanIp } = require("./lan-ip.cjs");

const ip = getLanIp();
const proxyMain = require.resolve("local-ssl-proxy/build/main.js");

const child = spawn(
  process.execPath,
  [proxyMain, "--source", "4201", "--target", "4200", "--hostname", "localhost"],
  {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: path.join(__dirname, ".."),
  },
);

const relay = (chunk) => process.stdout.write(chunk);

child.stdout.on("data", relay);
child.stderr.on("data", relay);

child.on("exit", (code) => process.exit(code ?? 0));

setTimeout(() => {
  console.log("");
  if (ip) {
    console.log(`📱 Celular HTTPS: https://${ip}:4201`);
    console.log(`📱 Celular HTTP:  http://${ip}:4200`);
  } else {
    console.log("📱 No se detectó IP LAN. Usá la línea Network de ng serve.");
  }
  console.log("");
}, 800);
