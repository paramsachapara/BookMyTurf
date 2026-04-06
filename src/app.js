const express = require("express");

const app = express();

app.use(express.json());


app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/owner", require("./routes/ownerRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/booking", require("./routes/bookingRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));


module.exports = app;
