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

function getPaymentType(booking) {
  const online = (booking.advancePaymentOnline || 0) + (booking.settlementRemainingOnline || 0);
  const cash = (booking.advancePaymentCash || 0) + (booking.settlementRemainingCash || 0);
  if (cash > online) return "cash";
  if (online > cash) return "online";
  return "mixed";
}


function getAmountToPay(booking) {
  const originalAmount = Number(booking.originalAmount) || 0;
  const addonceAmount = (Array.isArray(booking.addOns) ? booking.addOns : []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0
  );
  const bill = originalAmount + addonceAmount;
  const storedDiscount = Number(booking.negotiatedDiscount) || 0;
  return Math.max(0, bill - storedDiscount);
}


function yardBreakdownWithAdvance(booking, amountToPay) {
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


function buildHistoryResponse(bookings, filters) {
  let totalBookings = 0;
  let totalAmount = 0;
  let totalCashAmount = 0;
  let totalOnlineAmount = 0;
  const paymentBreakdown = { cash: 0, online: 0, mixed: 0 };
  const yardMap = new Map();

  for (const b of bookings) {
    const amountToPay = getAmountToPay(b);
    totalBookings += 1;
    totalAmount += amountToPay;
    
    const online = (Number(b.advancePaymentOnline) || 0) + (Number(b.settlementRemainingOnline) || 0);
    const cash = (Number(b.advancePaymentCash) || 0) + (Number(b.settlementRemainingCash) || 0);
    totalCashAmount += cash;
    totalOnlineAmount += online;

    const type = getPaymentType(b);
    paymentBreakdown[type] += 1;

    const breakdown = Array.isArray(b.yardBreakdown) && b.yardBreakdown.length > 0
      ? b.yardBreakdown
      : [{ yardId: b.yardId?._id ?? b.yardId, yardName: b.yardId?.name || "Unknown", amount: amountToPay }];
    for (const row of breakdown) {
      const yardId = (row.yardId && row.yardId.toString && row.yardId.toString()) || String(row.yardId);
      const yardName = row.yardName || "Unknown";
      if (!yardMap.has(yardId)) {
        yardMap.set(yardId, {
          yardId,
          yardName,
          totalBookings: 0,
          totalAmount: 0,
          paymentBreakdown: { cash: 0, online: 0, mixed: 0 }
        });
      }
      const yardRow = yardMap.get(yardId);
      yardRow.totalBookings += 1;
      yardRow.totalAmount += (Number(row.amount) || amountToPay);
      yardRow.paymentBreakdown[type] += 1;
    }
  }

  const yardWise = Array.from(yardMap.values());

  const bookingsWithType = bookings.map((b) => {
    const originalAmount = Number(b.originalAmount) || 0;
    const addonceAmount = (Array.isArray(b.addOns) ? b.addOns : []).reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
    const billAmount = originalAmount + addonceAmount;
    const amountToPay = getAmountToPay(b);
    const negotiatedDiscountVal = Number(b.negotiatedDiscount) || 0;
    const advancePaid = (b.advancePaymentOnline || 0) + (b.advancePaymentCash || 0);
    const settlementPaid = (b.settlementRemainingOnline || 0) + (b.settlementRemainingCash || 0);
    const totalPaid = advancePaid + settlementPaid;
    const remainingToPay = Math.max(0, amountToPay - totalPaid);
    const onlinePaid = (b.advancePaymentOnline || 0) + (b.settlementRemainingOnline || 0);
    const cashPaid = (b.advancePaymentCash || 0) + (b.settlementRemainingCash || 0);

    const yardBreakdown = Array.isArray(b.yardBreakdown) && b.yardBreakdown.length > 0
      ? b.yardBreakdown
      : (b.yardId ? [{ yardId: b.yardId._id || b.yardId, yardName: b.yardId.name || "Yard", amount: originalAmount || amountToPay }] : []);

    return {
      ...b,
      paymentType: getPaymentType(b),
      originalAmount: originalAmount > 0 ? originalAmount : billAmount,
      totalAmount: originalAmount,
      addonceAmount,
      yardBreakdown,
      yardBreakdownWithAdvance: yardBreakdownWithAdvance(b, amountToPay),
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

  return {
    success: true,
    filters,
    totalBookings,
    totalAmount,
    paymentBreakdown: {
      cashBookings: paymentBreakdown.cash,
      onlineBookings: paymentBreakdown.online,
      mixedBookings: paymentBreakdown.mixed,
      totalCashReceived: totalCashAmount,
      totalOnlineReceived: totalOnlineAmount
    },
    yardWise,
    bookings: bookingsWithType
  };
}


exports.getOwnerHistory = async (req, res) => {
  try {
    const fromDate = req.query.start_date || req.query.fromDate;
    const toDate = req.query.end_date || req.query.toDate;
    const yardId = req.query.yardId;
    const clubId = req.user.clubId;
    if (!clubId) {
      return res.status(403).json({ success: false, message: "Club not found for owner" });
    }

    let fromTrimmed = fromDate ? String(fromDate).trim() : "";
    if (!fromTrimmed) fromTrimmed = getTodayYYYYMMDD();
    if (!isValidDateString(fromTrimmed)) {
      return res.status(400).json({
        success: false,
        message: "Invalid start_date. Use YYYY-MM-DD format (e.g. 2024-02-01)."
      });
    }

    const match = { clubId };
    if (yardId) match.$or = [{ yardId }, { yardIds: yardId }];
    match.bookingDate = {};
    const start = new Date(fromTrimmed);
    start.setHours(0, 0, 0, 0);
    match.bookingDate.$gte = start;
    if (toDate) {
      const toTrimmed = String(toDate).trim();
      if (!isValidDateString(toTrimmed)) {
        return res.status(400).json({
          success: false,
          message: "Invalid end_date. Use YYYY-MM-DD format (e.g. 2024-02-28)."
        });
      }
      const end = new Date(toTrimmed);
      end.setHours(23, 59, 59, 999);
      match.bookingDate.$lte = end;
    }

    const bookings = await Booking.find(match)
      .populate("userId", "name email")
      .populate("clubId", "name")
      .populate("yardId", "name gameType")
      .populate("yardIds", "name gameType")
      .sort({ bookingDate: -1, createdAt: -1 })
      .lean();

    const filters = { start_date: fromTrimmed, end_date: toDate || null, yardId: yardId || null };
    const response = buildHistoryResponse(bookings, filters);
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getAdminHistory = async (req, res) => {
  try {
    const fromDate = req.query.start_date || req.query.fromDate;
    const toDate = req.query.end_date || req.query.toDate;
    const yardId = req.query.yardId;
    const clubId = req.query.clubId;

    let fromTrimmed = fromDate ? String(fromDate).trim() : "";
    if (!fromTrimmed) fromTrimmed = getTodayYYYYMMDD();
    if (!isValidDateString(fromTrimmed)) {
      return res.status(400).json({
        success: false,
        message: "Invalid start_date. Use YYYY-MM-DD format (e.g. 2024-02-01)."
      });
    }

    const match = {};
    if (clubId) match.clubId = clubId;
    if (yardId) match.$or = [{ yardId }, { yardIds: yardId }];
    match.bookingDate = {};
    const start = new Date(fromTrimmed);
    start.setHours(0, 0, 0, 0);
    match.bookingDate.$gte = start;
    if (toDate) {
      const toTrimmed = String(toDate).trim();
      if (!isValidDateString(toTrimmed)) {
        return res.status(400).json({
          success: false,
          message: "Invalid end_date. Use YYYY-MM-DD format (e.g. 2024-02-28)."
        });
      }
      const end = new Date(toTrimmed);
      end.setHours(23, 59, 59, 999);
      match.bookingDate.$lte = end;
    }

    const bookings = await Booking.find(match)
      .populate("userId", "name email")
      .populate("yardId", "name gameType")
      .populate("clubId", "name")
      .populate("yardIds", "name gameType")
      .sort({ bookingDate: -1, createdAt: -1 })
      .lean();

    const filters = {
      start_date: fromTrimmed,
      end_date: toDate || null,
      yardId: yardId || null,
      clubId: clubId || null
    };
    const response = buildHistoryResponse(bookings, filters);
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
