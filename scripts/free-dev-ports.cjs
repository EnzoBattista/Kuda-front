const { execSync } = require('child_process');

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();

    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Puerto ${port}: proceso ${pid} liberado`);
      } catch {
        // ya terminado
      }
    }
  } catch {
    // puerto libre
  }
}

for (const port of [4200, 4201]) {
  killPort(port);
}
