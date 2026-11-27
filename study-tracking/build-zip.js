const fs = require('fs');
const archiver = require('archiver');

const out = fs.createWriteStream('function.zip');
const zip = archiver('zip', { zlib: { level: 9 } });

out.on('close', () => console.log('function.zip created:', zip.pointer(), 'bytes'));
zip.on('error', (err) => { throw err; });
zip.pipe(out);

for (const f of ['app.js', 'lambda.js', 'jobHandler.js', 'db.js', 'package.json']) {
  zip.file(f, { name: f });
}
for (const d of ['routes', 'services', 'repositories', 'middleware', 'utils', 'node_modules']) {
  zip.directory(d, d);
}
zip.finalize();