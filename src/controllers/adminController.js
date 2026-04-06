const Club = require("../models/ClubModel");
const Yard = require("../models/YardModel");
const Booking = require("../models/BookingModel");
const Subscription = require("../models/SubscriptionModel");

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function isValidDateString(str) {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!DATE_REGEX.test(trimmed)) return false;
  const d = new Date(trimmed);
  return !Number.isNaN(d.getTime());
}

function getTodayYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

exports.getAllClubs = async (req, res) => {
  try {
    const clubs = await Club.find().lean();

    res.json({ success: true, data: clubs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.updateClub = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "Update body is empty. Ensure Content-Type is application/json" });
    }

    // Security Check: Club Owners can only edit their own club
    if (req.user.role === "club_owner" && req.user.clubId !== id) {
      return res.status(403).json({ success: false, message: "Unauthorized: You can only edit your own club" });
    }

    const club = await Club.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!club) {
      return res.status(404).json({ success: false, message: "Club not found" });
    }

    res.json({ success: true, data: club });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Super Admin only: delete a club. Fails if club has any yards. */
exports.deleteClub = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await Club.findById(id);
    if (!club) {
      return res.status(404).json({ success: false, message: "Club not found" });
    }

    const yardCount = await Yard.countDocuments({ clubId: id });
    if (yardCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete club: it has yards. Delete all yards first."
      });
    }

    await Club.findByIdAndDelete(id);
    res.json({ success: true, message: "Club deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Super Admin: get all yards for a club (club-wise). Optional date for bookedSlots. */
exports.getYardsByClub = async (req, res) => {
  try {
    const clubId = req.params.clubId || req.query.clubId;
    if (!clubId) {
      return res.status(400).json({ success: false, message: "clubId is required (path: /admin/clubs/:clubId/yards or query: ?clubId=...)" });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: "Club not found" });
    }

    let dateParam = (req.query.date || "").toString().trim();
    const useDate = dateParam ? isValidDateString(dateParam) : false;
    if (dateParam && !useDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD format (e.g. 2024-02-20)."
      });
    }
    if (!dateParam && useDate === false) {
      dateParam = getTodayYYYYMMDD();
    }

    const yards = await Yard.find({ clubId }).lean();

    let yardToSlots = new Map();
    for (const y of yards) {
      yardToSlots.set(y._id.toString(), []);
    }

    if (useDate || dateParam) {
      const date = new Date(dateParam);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const match = { clubId, bookingStatus: { $nin: ["cancelled", "canceled", "Cancelled", "Canceled"] }, bookingDate: { $gte: date, $lt: nextDay } };
      const bookings = await Booking.find(match)
        .select("yardId yardIds start_time end_time bookingDate")
        .lean();

      for (const b of bookings) {
        if (!b.start_time || !b.end_time) continue;
        const d = b.bookingDate ? new Date(b.bookingDate) : null;
        const dateStr = d && !Number.isNaN(d.getTime())
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          : null;
        const slot = {
          start_time: b.start_time,
          end_time: b.end_time,
          bookingDate: b.bookingDate,
          date: dateStr
        };
        const yardIds = Array.isArray(b.yardIds) && b.yardIds.length > 0
          ? b.yardIds
          : (b.yardId ? [b.yardId] : []);
        for (const yid of yardIds) {
          const key = yid.toString();
          if (yardToSlots.has(key)) {
            yardToSlots.get(key).push(slot);
          }
        }
      }
    }

    const data = yards.map((y) => {
      const id = y._id.toString();
      return {
        ...y,
        bookedSlots: yardToSlots.get(id) || []
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Super Admin: update any yard by id. */
exports.updateYard = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "Update body is empty. Ensure Content-Type is application/json" });
    }

    const yard = await Yard.findByIdAndUpdate(id, req.body, { new: true });

    if (!yard) {
      return res.status(404).json({ success: false, message: "Yard not found" });
    }

    res.json({ success: true, data: yard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteYard = async (req, res) => {
  try {
    const { id } = req.params;

   if (req.user.role === "club_owner") {
      const yard = await Yard.findOne({ _id: id, clubId: req.user.clubId });
      if (!yard) return res.status(403).json({ success: false, message: "Unauthorized yard access" });
    }

    await Yard.findByIdAndDelete(id);
    res.json({ success: true, message: "Yard deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const { clubId, date, yardId } = req.query;

    if (clubId) filter.clubId = clubId;
    if (yardId) filter.$or = [{ yardId }, { yardIds: yardId }];
    if (date) {
      const dateStr = String(date).trim();
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date. Use YYYY-MM-DD format (e.g. 2024-02-20)."
        });
      }
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.bookingDate = { $gte: d, $lt: nextDay };
    }

    const bookings = await Booking.find(filter)
      .populate("userId", "name email")
      .populate("clubId", "name")
      .populate("yardId", "name gameType")
      .populate("yardIds", "name gameType")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Super Admin: create subscription for a club (monthly or yearly) with price. */
exports.createSubscription = async (req, res) => {
  try {
    const { clubId, subscriptionType, price, periodYear, periodMonth } = req.body;

    if (!clubId) {
      return res.status(400).json({ success: false, message: "clubId is required" });
    }
    if (!subscriptionType || !["monthly", "yearly"].includes(subscriptionType)) {
      return res.status(400).json({ success: false, message: "subscriptionType is required and must be 'monthly' or 'yearly'" });
    }
    if (price == null || Number(price) < 0 || Number.isNaN(Number(price))) {
      return res.status(400).json({ success: false, message: "price is required and must be a non-negative number" });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: "Club not found" });
    }

    const yearNum = Number(periodYear);
    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ success: false, message: "periodYear is required and must be a valid year (e.g. 2024)" });
    }

    let monthNum = null;
    if (subscriptionType === "monthly") {
      if (periodMonth == null) {
        return res.status(400).json({ success: false, message: "periodMonth is required for monthly subscription (1-12)" });
      }
      monthNum = Number(periodMonth);
      if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ success: false, message: "periodMonth must be between 1 and 12" });
      }
    } else {
      monthNum = 0;
    }

    const existing = await Subscription.findOne({
      clubId,
      subscriptionType,
      periodYear: yearNum,
      periodMonth: monthNum
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: subscriptionType === "monthly"
          ? `Subscription already exists for this club for ${yearNum}-${String(monthNum).padStart(2, "0")}. Update or use a different period.`
          : `Subscription already exists for this club for year ${yearNum}. Update or use a different year.`
      });
    }

    const subscription = await Subscription.create({
      clubId,
      subscriptionType,
      price: Number(price),
      periodYear: yearNum,
      periodMonth: monthNum
    });

    const populated = await Subscription.findById(subscription._id)
      .populate("clubId", "name")
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Subscription already exists for this club and period" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Super Admin: list all subscriptions with optional filters (clubId, subscriptionType, periodYear, periodMonth). */
exports.getSubscriptions = async (req, res) => {
  try {
    const { clubId, subscriptionType, periodYear, periodMonth } = req.query;
    const filter = {};
    if (clubId) filter.clubId = clubId;
    if (subscriptionType) filter.subscriptionType = subscriptionType;
    if (periodYear) filter.periodYear = Number(periodYear);
    if (periodMonth != null && periodMonth !== "") filter.periodMonth = Number(periodMonth);

    const subscriptions = await Subscription.find(filter)
      .populate("clubId", "name address city state")
      .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 })
      .lean();

    const data = subscriptions.map((s) => ({
      ...s,
      periodLabel: s.subscriptionType === "monthly"
        ? `${s.periodYear}-${String(s.periodMonth).padStart(2, "0")} (${getMonthName(s.periodMonth)})`
        : `Year ${s.periodYear}`
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function getMonthName(month) {
  const names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[month] || "";
}