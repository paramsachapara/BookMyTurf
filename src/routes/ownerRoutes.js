const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const ownerController = require("../controllers/ownerController");
const historyController = require("../controllers/historyController");
const bookingController = require("../controllers/bookingController");


router.get("/club", auth(["club_owner"]), ownerController.getClub);
router.put("/club", auth(["club_owner"]), ownerController.updateClub);

router.post("/yard", auth(["club_owner"]), ownerController.createYard);
router.get("/yards", auth(["club_owner"]), ownerController.getYards);
router.put("/yard/:id", auth(["club_owner"]), ownerController.updateYard);
router.delete("/yard/:id", auth(["club_owner"]), ownerController.deleteYard);

router.get("/bookings", auth(["club_owner"]), ownerController.getBookings);
router.get("/history", auth(["club_owner"]), historyController.getOwnerHistory);
router.put("/history/rebook/:id", auth(["club_owner"]), bookingController.rebookBooking);
router.patch("/history/rebook/:id", auth(["club_owner"]), bookingController.rebookBooking);

module.exports = router;