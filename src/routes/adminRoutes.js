const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const adminController = require("../controllers/adminController");
const historyController = require("../controllers/historyController");
const bookingController = require("../controllers/bookingController");


router.get("/clubs", auth(["super_admin"]), adminController.getAllClubs);
router.get("/clubs/:clubId/yards", auth(["super_admin"]), adminController.getYardsByClub);

router.put("/club/:id", auth(["super_admin", "club_owner"]), adminController.updateClub);
router.delete("/club/:id", auth(["super_admin"]), adminController.deleteClub);

router.get("/yards", auth(["super_admin"]), adminController.getYardsByClub);
router.put("/yard/:id", auth(["super_admin"]), adminController.updateYard);

router.delete("/yard/:id", auth(["super_admin", "club_owner"]), adminController.deleteYard);

router.get("/bookings", auth(["super_admin"]), adminController.getAllBookings);
router.get("/history", auth(["super_admin"]), historyController.getAdminHistory);
router.put("/history/rebook/:id", auth(["super_admin"]), bookingController.rebookBooking);
router.patch("/history/rebook/:id", auth(["super_admin"]), bookingController.rebookBooking);

router.post("/subscription", auth(["super_admin"]), adminController.createSubscription);
router.get("/subscriptions", auth(["super_admin"]), adminController.getSubscriptions);

module.exports = router;