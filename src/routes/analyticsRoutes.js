const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const analyticsController = require("../controllers/analyticsController");

// Get booking analytics for a date range
// Query params: startDate, endDate (YYYY-MM-DD format), clubId (optional, for admins)
router.get("/bookings", auth(["club_owner", "super_admin", "admin"]), analyticsController.getBookingAnalytics);

// Get daily booking trends for a date range
// Query params: startDate, endDate (YYYY-MM-DD format), clubId (optional, for admins)
router.get("/trends", auth(["club_owner", "super_admin", "admin"]), analyticsController.getDailyTrends);

module.exports = router;
