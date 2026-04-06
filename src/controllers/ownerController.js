const Club = require("../models/ClubModel");
const Yard = require("../models/YardModel");
const Booking = require("../models/BookingModel");

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

exports.getClub = async (req, res) => {
  try {
    const club = await Club.findOne({ ownerId: req.user.id });
    if (!club) return res.status(404).json({ success: false, message: "Club not found" });

    res.json({ success: true, data: club });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.updateClub = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "Update body is empty. Ensure Content-Type is application/json" });
    }

    const club = await Club.findOneAndUpdate(
      { ownerId: req.user.id },
      req.body,
      { new: true }
    );

    if (!club) return res.status(404).json({ success: false, message: "Club not found" });

    res.json({ success: true, data: club });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.createYard = async (req, res) => {
  try {
    const club = await Club.findById(req.user.clubId).select("isActive").lean();
    if (club && club.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your club is inactive. Contact admin."
      });
    }

    const { name, gameType } = req.body;
    //  const { name, gameType, pricePerHour } = req.body;

    const yard = await Yard.create({
      clubId: req.user.clubId,
      name,
      gameType,
      // pricePerHour
    });

    res.status(201).json({
      success: true,
      data: yard
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getYards = async (req, res) => {
  try {
    let dateParam = (req.query.date ?? "").toString().trim();
    if (!dateParam) dateParam = getTodayYYYYMMDD();
    if (!isValidDateString(dateParam)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD format (e.g. 2024-02-20)."
      });
    }

    const yards = await Yard.find({ clubId: req.user.clubId }).lean();
    const clubId = req.user.clubId;

    const date = new Date(dateParam);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const match = { clubId, bookingStatus: { $nin: ["cancelled", "canceled", "Cancelled", "Canceled"] }, bookingDate: { $gte: date, $lt: nextDay } };

    const bookings = await Booking.find(match)
      .select("yardId yardIds start_time end_time bookingDate")
      .lean();

    const yardToSlots = new Map();
    for (const y of yards) {
      yardToSlots.set(y._id.toString(), []);
    }
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


exports.updateYard = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await Club.findById(req.user.clubId).select("isActive").lean();
    if (club && club.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your club is inactive. Contact admin."
      });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "Update body is empty. Ensure Content-Type is application/json" });
    }

    const yard = await Yard.findOneAndUpdate(
      { _id: id, clubId: req.user.clubId },
      req.body,
      { new: true }
    );

    if (!yard) {
      return res.status(404).json({ success: false, message: "Yard not found or unauthorized" });
    }

    res.json({ success: true, data: yard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.deleteYard = async (req, res) => {
  try {
    const yard = await Yard.findOneAndDelete({
      _id: req.params.id,
      clubId: req.user.clubId
    });

    if (!yard) {
      return res.status(404).json({ success: false, message: "Yard not found or unauthorized" });
    }

    res.json({ success: true, message: "Yard deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


function yardBreakdownWithAdvance(booking) {
  const advancePaid = (Number(booking.advancePaymentOnline) || 0) + (Number(booking.advancePaymentCash) || 0);
  const breakdown = Array.isArray(booking.yardBreakdown) && booking.yardBreakdown.length > 0
    ? booking.yardBreakdown
    : [{
        yardId: booking.yardId?._id || booking.yardId,
        yardName: booking.yardId?.name || "Yard",
        amount: Number(booking.originalAmount) || Number(booking.totalAmount) || 0
      }];
  const totalOriginal = breakdown.reduce((s, i) => s + (Number(i.amount) || 0), 0) || 1;
  return breakdown.map((row) => {
    const amount = Number(row.amount) || 0;
    const advanceApplied = totalOriginal > 0 ? (amount / totalOriginal) * advancePaid : 0;
    return {
      yardId: row.yardId,
      yardName: row.yardName || "Yard",
      amount,
      advanceApplied,
      amountAfterAdvance: Math.max(0, amount - advanceApplied)
    };
  });
}

exports.getBookings = async (req, res) => {
  try {
    let dateParam = (req.query.date ?? "").toString().trim();
    if (!dateParam) dateParam = getTodayYYYYMMDD();
    if (!isValidDateString(dateParam)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD format (e.g. 2024-02-20)."
      });
    }

    const date = new Date(dateParam);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const match = { clubId: req.user.clubId, bookingDate: { $gte: date, $lt: nextDay } };

    const bookings = await Booking.find(match)
      .populate("userId", "name email")
      .populate("clubId", "name")
      .populate("yardId", "name")
      .populate("yardIds", "name")
      .sort({ createdAt: -1 })
      .lean();

    let totalOriginalAmount = 0;
    let totalNegotiatedAmount = 0;
    let totalPaidAmount = 0;
    let totalCashAmount = 0;
    let totalOnlineAmount = 0;

    const data = bookings.map((b) => {
      const originalAmount = Number(b.originalAmount) || 0;
      const storedTotal = Number(b.totalAmount) || 0;
      const storedDiscount = Number(b.negotiatedDiscount) || 0;
      const addonceAmount = (Array.isArray(b.addOns) ? b.addOns : []).reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      );
      // totalAmount in DB = base only; bill = originalAmount + addoneAmount; amountToPay = bill - discount
      const billAmount = originalAmount + addonceAmount;
      const amountToPay = Math.max(0, billAmount - (Number(b.negotiatedDiscount) || 0));
      const negotiatedDiscountVal = Number(b.negotiatedDiscount) || 0;

      const advancePaid = (Number(b.advancePaymentOnline) || 0) + (Number(b.advancePaymentCash) || 0);
      const settlementPaid = (Number(b.settlementRemainingOnline) || 0) + (Number(b.settlementRemainingCash) || 0);
      const onlinePaid = (Number(b.advancePaymentOnline) || 0) + (Number(b.settlementRemainingOnline) || 0);
      const cashPaid = (Number(b.advancePaymentCash) || 0) + (Number(b.settlementRemainingCash) || 0);
      const totalPaid = advancePaid + settlementPaid;
      const remainingToPay = Math.max(0, amountToPay - totalPaid);

      totalOriginalAmount += billAmount;
      totalNegotiatedAmount += amountToPay;
      totalPaidAmount += totalPaid;
      totalCashAmount += cashPaid;
      totalOnlineAmount += onlinePaid;

      const yardBreakdown = Array.isArray(b.yardBreakdown) && b.yardBreakdown.length > 0
        ? b.yardBreakdown
        : (b.yardId ? [{ yardId: b.yardId._id || b.yardId, yardName: b.yardId.name || "Yard", amount: originalAmount || amountToPay }] : []);

      return {
        ...b,
        originalAmount: originalAmount > 0 ? originalAmount : billAmount,
        totalAmount: originalAmount,
        addonceAmount,
        yardBreakdown,
        yardBreakdownWithAdvance: yardBreakdownWithAdvance({ ...b, originalAmount: originalAmount > 0 ? originalAmount : billAmount }),
        negotiatedAmount: negotiatedDiscountVal,
        negotiatedDiscount: negotiatedDiscountVal,
        billAmount,
        amountToPay,
        advancePaid,
        onlinePaid,
        cashPaid,
        remainingToPay,
        totalPaid,
        settlementDone: Boolean(b.settlementDone)
      };
    });

    res.json({
      success: true,
      data,
      totalBookings: data.length,
      totalOriginalAmount,
      totalNegotiatedAmount,
      totalPaidAmount,
      totalCashAmount,
      totalOnlineAmount,
      totalRemainingAmount: totalNegotiatedAmount - totalPaidAmount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};