const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const bookingController = require("../controllers/bookingController");


router.post("/", auth(["club_owner", "super_admin"]), bookingController.createBooking);
router.put("/:id", auth(["club_owner", "super_admin"]), bookingController.updateBooking);
router.put("/rebook/:id", auth(["club_owner", "super_admin"]), bookingController.rebookBooking);
router.patch("/rebook/:id", auth(["club_owner", "super_admin"]), bookingController.rebookBooking);
router.put("/:id/cancel", auth(["club_owner", "super_admin"]), bookingController.cancelBooking);
router.put("/:id/settlement", auth(["club_owner", "super_admin"]), bookingController.settlementBooking);
router.get("/my-bookings", auth(["user", "club_owner", "super_admin"]), bookingController.getUserBookings);

module.exports = router;