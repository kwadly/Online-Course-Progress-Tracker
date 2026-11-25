require('dotenv').config();

if (!process.env.JWT_SECRET || !process.env.INTERNAL_API_KEY || !process.env.DATABASE_URL) {
  console.error('DATABASE_URL, JWT_SECRET and INTERNAL_API_KEY must be set in .env');
  process.exit(1);
}

const app = require('./app');

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});