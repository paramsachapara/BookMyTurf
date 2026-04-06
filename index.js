require('dotenv').config();
const app = require('./src/app');

const  connectDB = require('./src/config/database');

// Connect to MongoDB
connectDB();
const PORT = process.env.PORT || 3000;   // ← falls back to 3000 if no .env value

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on http://localhost:${PORT}`);
});


