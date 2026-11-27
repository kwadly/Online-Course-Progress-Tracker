const fs = require('fs');
const { execFileSync } = require('child_process');

const ROLE_ARN = 'arn:aws:iam::000000000000:role/study-tracking-role';

// 1) read .env without printing it
const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
// Lambda runs inside Docker, so localhost must become host.docker.internal
if (env.INTERNAL_API_URL) {
  env.INTERNAL_API_URL = env.INTERNAL_API_URL.replace('localhost', 'host.docker.internal');
}

// 2) write the environment to a temp file (so values never appear in a command line)
fs.writeFileSync('lambda-env.json', JSON.stringify({ Variables: env }));

function deploy(name, handler, timeout) {
  console.log('Creating ' + name + ' ...');
  execFileSync('aws', [
    'lambda', 'create-function',
    '--function-name', name,
    '--runtime', 'nodejs20.x',
    '--role', ROLE_ARN,
    '--handler', handler,
    '--timeout', String(timeout),
    '--memory-size', '256',
    '--zip-file', 'fileb://function.zip',
    '--environment', 'file://lambda-env.json',
    '--query', 'FunctionArn',
    '--output', 'text',
  ], { stdio: 'inherit' });
}

try {
  deploy('study-tracking-api', 'lambda.handler', 30);
  deploy('study-tracking-job', 'jobHandler.handler', 120);
} finally {
  fs.unlinkSync('lambda-env.json'); // delete the secrets file
}