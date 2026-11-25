const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'dist');
const outFile = path.join(outDir, 'lambda.zip');

fs.mkdirSync(outDir, { recursive: true });

const output = fs.createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log('Created dist/lambda.zip (' + archive.pointer() + ' bytes)');
});
archive.on('error', (err) => { throw err; });

archive.pipe(output);

['app.js', 'lambda.js', 'db.js', 'package.json'].forEach((file) => {
  archive.file(path.join(root, file), { name: file });
});

['routes', 'services', 'repositories', 'middleware', 'utils'].forEach((dir) => {
  archive.directory(path.join(root, dir), dir);
});

archive.glob('**/*', { cwd: path.join(root, 'node_modules'), dot: true }, { prefix: 'node_modules' });

archive.finalize();