import { exec } from 'child_process';
import { platform } from 'os';

const isWindows = platform() === 'win32';

// Command to find and kill the process running rollup watch
const findCommand = isWindows 
  ? 'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH'
  : 'ps aux | grep "rollup -c rollup.config.mjs -w"';

const killCommand = pid => isWindows 
  ? `taskkill /F /PID ${pid}`
  : `kill -9 ${pid}`;

console.log('Stopping rollup watch process...');

exec(findCommand, (error, stdout) => {
  if (error) {
    console.error(`Error finding process: ${error.message}`);
    return;
  }
  
  // Parse the output to find the PID
  const lines = stdout.toString().split('\n');
  let foundPID = null;
  
  if (isWindows) {
    // Parse Windows CSV output
    for (const line of lines) {
      if (line.includes('node.exe')) {
        const parts = line.split('","');
        if (parts.length >= 2 && parts[1]) {
          const pid = parts[1].replace('"', '');
          
          // Check if this process is running rollup watch
          exec(`wmic process where "ProcessID=${pid}" get CommandLine`, (cmdError, cmdStdout) => {
            if (cmdStdout.includes('rollup') && cmdStdout.includes('-w')) {
              console.log(`Found rollup watch process with PID: ${pid}`);
              exec(killCommand(pid), (killError) => {
                if (killError) {
                  console.error(`Error stopping process: ${killError.message}`);
                } else {
                  console.log('Rollup watch process stopped successfully');
                }
              });
            }
          });
        }
      }
    }
  } else {
    // Parse Unix output
    for (const line of lines) {
      if (line.includes('rollup -c rollup.config.mjs -w') && !line.includes('grep')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          foundPID = parts[1];
          console.log(`Found rollup watch process with PID: ${foundPID}`);
          
          exec(killCommand(foundPID), (killError) => {
            if (killError) {
              console.error(`Error stopping process: ${killError.message}`);
            } else {
              console.log('Rollup watch process stopped successfully');
            }
          });
        }
      }
    }
  }
  
  if (!foundPID && !isWindows) {
    console.log('No rollup watch process found');
  }
});