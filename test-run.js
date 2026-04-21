const { spawn } = require('child_process');
const http = require('http');

console.log('Starting Nest server...');
const server = spawn('npx', ['nest', 'start']);
let isUp = false;

server.stdout.on('data', async (data) => {
  const out = data.toString();
  console.log(out);
  if (out.includes('Application is running on') || out.includes('Nest application successfully started')) {
    if (isUp) return;
    isUp = true;
    console.log('--- SERVER IS UP ---');
    console.log('Pinging auth...');
    
    const req = http.request('http://localhost:3000/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      console.log('Status: ' + res.statusCode);
      server.kill();
      process.exit(res.statusCode === 400 || res.statusCode === 201 ? 0 : 1);
    });
    
    req.on('error', (e) => {
      console.error(e);
      server.kill();
      process.exit(1);
    });
    
    req.write(JSON.stringify({ email: "test@domain.com", password: "pwd", name: "test" }));
    req.end();
  }
});
server.stderr.on('data', data => console.error(data.toString()));
