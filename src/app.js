const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Security Middleware
app.use(helmet());
app.use(express.json());


// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per 15 mins
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
});
app.use("/api/", limiter);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/owner", require("./routes/ownerRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/booking", require("./routes/bookingRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

module.exports = app;

