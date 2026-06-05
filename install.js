const { spawn } = require('child_process');
console.log('Starting programmatic npm install in:', __dirname);

const child = spawn('npm.cmd', ['install', '--no-audit', '--no-fund', '--omit=dev'], {
  cwd: __dirname,
  shell: true
});

child.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data.toString().trim()}`);
});

child.stderr.on('data', (data) => {
  console.log(`STDERR: ${data.toString().trim()}`);
});

child.on('error', (err) => {
  console.error('FAILED TO START PROCESS:', err);
});

child.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
});
