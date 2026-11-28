const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
const values = dotenv.parse(fs.readFileSync(path.join(root, '.env')));

const names = ['DATABASE_URL', 'JWT_SECRET', 'INTERNAL_API_KEY'];
const secret = {};
names.forEach((name) => {
  if (!values[name]) {
    console.error(name + ' is missing from .env');
    process.exit(1);
  }
  secret[name] = values[name];
});

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'secret.json'), JSON.stringify(secret));
console.log('Created dist/secret.json with ' + names.join(', '));