const dotenv = require('dotenv');

// Load env based on NODE_ENV
dotenv.config({
  path: `.env.${process.env.NODE_ENV || 'development'}`
});

const app = require('./src/app');
const connectDB = require('./src/config/database');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});