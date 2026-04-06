const mongoose = require("mongoose");
const Booking = require("../models/BookingModel");
const Yard = require("../models/YardModel");
const Club = require("../models/ClubModel");

function timeToMinutes(t) {
  if (!t || typeof t !== "string") return 0;
  const [h, m] = t.trim().split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function timesOverlap(s1, e1, s2, e2) {
  const a = timeToMinutes(s1);
  const b = timeToMinutes(e1);
  const c = timeToMinutes(s2);
  const d = timeToMinutes(e2);
  return a < d && c < b;
}

function durationHours(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (e <= s) return 0;
  return (e - s) / 60;
}

/**
 * Shared logic for creating or full-updating a booking (e.g. from history edit).
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {String|null} idToUpdate - ID of existing booking to update, or null to create new.
 */
async function processBookingRequest(req, res, idToUpdate = null) {
  try {
    let old = null;
    if (idToUpdate) {
      old = await Booking.findById(idToUpdate).lean();
      if (!old) return res.status(404).json({ success: false, message: "Original booking not found" });
    }

    const {
      yardIds,
      yardId,
      clubId,
      start_time,
      end_time,
      bookingDate,
      userName,
      mobileNumber,
      userId,
      price,
      negotiatedAmount,
      advance_payment_received,
      advance_payment_online,
      advance_payment_cash
    } = req.body;

    if (req.user.role === "user") {
      return res.status(403).json({ success: false, message: "Users cannot book directly. Contact club owner." });
    }

    // Merge logic: use body value if provided (not undefined), else keep old value, else null/empty
    const f_userName = userName !== undefined ? userName : (old ? old.userName : "");
    const f_mobileNumber = mobileNumber !== undefined ? mobileNumber : (old ? old.mobileNumber : "");
    const f_st = start_time !== undefined ? start_time : (old ? old.start_time : "");
    const f_et = end_time !== undefined ? end_time : (old ? old.end_time : "");
    const f_date_val = bookingDate !== undefined ? bookingDate : (old ? old.bookingDate : null);
    const f_clubId = clubId !== undefined ? clubId : (old ? old.clubId : null);
    const f_userId = userId !== undefined ? userId : (old ? old.userId : req.user.id);

    let f_ids = [];
    if (yardIds !== undefined) {
      f_ids = Array.isArray(yardIds) ? yardIds : [];
    } else if (yardId !== undefined) {
      f_ids = yardId ? [yardId] : [];
    } else if (old) {
      f_ids = (Array.isArray(old.yardIds) && old.yardIds.length > 0) ? old.yardIds : (old.yardId ? [old.yardId] : []);
    }

    // Validation using final merged values
    if (!f_userName || !String(f_userName).trim()) return res.status(400).json({ success: false, message: "userName is required" });
    if (!f_mobileNumber || !String(f_mobileNumber).trim()) return res.status(400).json({ success: false, message: "mobileNumber is required" });
    if (!f_st || !String(f_st).trim()) return res.status(400).json({ success: false, message: "start_time is required" });
    if (!f_et || !String(f_et).trim()) return res.status(400).json({ success: false, message: "end_time is required" });
    if (f_ids.length === 0) return res.status(400).json({ success: false, message: "yardIds or yardId is required" });
    if (!f_clubId) return res.status(400).json({ success: false, message: "clubId is required" });

    const date = f_date_val ? new Date(f_date_val) : new Date();
    date.setHours(0, 0, 0, 0);

    const yards = await Yard.find({ _id: { $in: f_ids } }).lean();
    if (yards.length !== f_ids.length) return res.status(400).json({ success: false, message: "One or more yards not found" });

    const clubIdStr = yards[0].clubId.toString();
    for (const y of yards) {
      if (y.clubId.toString() !== clubIdStr) return res.status(400).json({ success: false, message: "All yards must belong to the same club" });
      if (f_clubId && y.clubId.toString() !== f_clubId.toString()) return res.status(400).json({ success: false, message: "Yard does not belong to the specified club" });
    }

    if (req.user.role === "club_owner") {
      const club = await Club.findById(clubIdStr).select("isActive").lean();
      if (club && club.isActive === false) return res.status(403).json({ success: false, message: "Your club is inactive. Contact admin." });
    }

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    for (const y of yards) {
      const match = {
        bookingStatus: { $nin: ["cancelled", "canceled", "Cancelled", "Canceled"] },
        $or: [{ yardId: y._id }, { yardIds: y._id }],
        bookingDate: { $gte: date, $lt: nextDay }
      };
      if (idToUpdate) match._id = { $ne: idToUpdate };

      const existing = await Booking.find(match).lean();
      for (const b of existing) {
        if (b.start_time && b.end_time && timesOverlap(f_st, f_et, b.start_time, b.end_time)) {
          return res.status(400).json({ success: false, message: `${b.start_time} to ${b.end_time} is already booked for this yard.` });
        }
      }
    }

    const durationH = durationHours(f_st, f_et);
    if (durationH <= 0) return res.status(400).json({ success: false, message: "end_time must be after start_time" });

    const yardBreakdown = [];
    let computedTotal = 0;
    for (const y of yards) {
      const perHour = Number(y.pricePerHour) || 0;
      const amount = Math.round(perHour * durationH);
      computedTotal += amount;
      yardBreakdown.push({ yardId: y._id, yardName: y.name || "Yard", amount });
    }

    // Resolve price and negotiated amount
    const f_price = price !== undefined ? price : (old ? old.originalAmount : computedTotal);
    let originalAmount = computedTotal;
    if (f_price != null && f_price !== "") {
      const passedPrice = Number(f_price);
      if (!Number.isNaN(passedPrice) && passedPrice >= 0) {
        originalAmount = passedPrice;
        if (yardBreakdown.length > 0 && computedTotal > 0) {
          const scale = originalAmount / computedTotal;
          for (const row of yardBreakdown) row.amount = Math.round((row.amount || 0) * scale);
          const sum = yardBreakdown.reduce((s, r) => s + (r.amount || 0), 0);
          if (sum !== originalAmount && yardBreakdown.length > 0) {
            yardBreakdown[0].amount = (yardBreakdown[0].amount || 0) + (originalAmount - sum);
          }
        }
      }
    }

    let totalAmount = originalAmount;
    let negotiatedDiscount = 0;
    const f_negotiated = negotiatedAmount !== undefined ? negotiatedAmount : (old ? (old.totalAmount - old.negotiatedDiscount) : null);
    
    if (f_negotiated != null) {
      const negotiated = Number(f_negotiated);
      if (negotiated < 0) throw new Error("Negotiated amount cannot be negative");
      if (negotiated < originalAmount) negotiatedDiscount = originalAmount - negotiated;
      if (negotiatedDiscount > originalAmount) negotiatedDiscount = originalAmount;
    }

    const f_adv_received = advance_payment_received !== undefined ? Boolean(advance_payment_received) : (old ? old.advancePaymentReceived : false);
    const f_adv_online = advance_payment_online !== undefined ? Number(advance_payment_online) : (old ? old.advancePaymentOnline : 0);
    const f_adv_cash = advance_payment_cash !== undefined ? Number(advance_payment_cash) : (old ? old.advancePaymentCash : 0);

    const bookingData = {
      userId: f_userId,
      clubId: yards[0].clubId,
      yardId: f_ids[0],
      yardIds: f_ids,
      start_time: String(f_st).trim(),
      end_time: String(f_et).trim(),
      bookingDate: date,
      userName: String(f_userName).trim(),
      mobileNumber: String(f_mobileNumber).trim(),
      yardBreakdown,
      originalAmount,
      totalAmount,
      negotiatedDiscount,
      advancePaymentReceived: f_adv_received,
      advancePaymentOnline: f_adv_online,
      advancePaymentCash: f_adv_cash,
      bookingStatus: "confirmed",
      settlementDone: false,
      paymentStatus: "pending"
    };

    let booking;
    if (idToUpdate) {
      booking = await Booking.findByIdAndUpdate(idToUpdate, { $set: bookingData }, { new: true });
    } else {
      bookingData.addOns = []; 
      booking = await Booking.create(bookingData);
    }

    const finalAmount = totalAmount - negotiatedDiscount;
    res.status(idToUpdate ? 200 : 201).json({
      success: true,
      message: idToUpdate ? "Booking updated successfully" : "Booking created successfully",
      originalAmount,
      totalAmount: finalAmount,
      negotiatedDiscount,
      yardBreakdown,
      booking
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

exports.createBooking = async (req, res) => {
  return processBookingRequest(req, res);
};


exports.rebookBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const oldBooking = await Booking.findById(id);
    if (!oldBooking) {
      return res.status(404).json({ success: false, message: "Original booking not found" });
    }

    if (req.user.role === "club_owner" && oldBooking.clubId.toString() !== req.user.clubId) {
      return res.status(403).json({ success: false, message: "Unauthorized. This booking record belongs to another club." });
    }

    // const isCancelled = ["cancelled", "canceled", "Cancelled", "Canceled"].includes(oldBooking.bookingStatus);
    // const isSettled = oldBooking.settlementDone === true;
    // if (!isCancelled && !isSettled) {
    //   return res.status(400).json({ success: false, message: "Only settled or cancelled bookings can be edited from history." });
    // }

    // Always update the existing record (PUT method behavior)
    return processBookingRequest(req, res, id);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, bookingStatus, start_time, end_time, addOns } = req.body;

    let booking = await Booking.findById(id).lean();
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (req.user.role === "club_owner" && booking.clubId.toString() !== req.user.clubId) {
      return res.status(403).json({ success: false, message: "Unauthorized to update this booking" });
    }

    const updateData = {};
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (bookingStatus) updateData.bookingStatus = bookingStatus;

    // Add add-ons (e.g. water, drink) to booking. Stored in addOns; totalAmount stays base only; addoneAmount = sum(addOns) shown in owner/bookings and owner/history.
    if (Array.isArray(addOns)) {
      const normalized = addOns.map((item) => ({
        name: String(item.name || "").trim() || "Add-on",
        price: Math.max(0, Number(item.price) || 0),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
      }));
      updateData.addOns = normalized;
      // totalAmount is NOT updated — base amount only; add-one total is in addoneAmount in list/history APIs
    }

    if (start_time != null && end_time != null) {
      const st = String(start_time).trim();
      const et = String(end_time).trim();
      if (!st || !et) {
        return res.status(400).json({ success: false, message: "start_time and end_time are required when updating time" });
      }
      if (durationHours(st, et) <= 0) {
        return res.status(400).json({ success: false, message: "end_time must be after start_time" });
      }
      const yardIdsToCheck = booking.yardIds?.length ? booking.yardIds : (booking.yardId ? [booking.yardId] : []);
      const date = new Date(booking.bookingDate);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      for (const yid of yardIdsToCheck) {
        const existing = await Booking.find({
          _id: { $ne: id },
          bookingStatus: { $nin: ["cancelled", "canceled", "Cancelled", "Canceled"] },
          $or: [{ yardId: yid }, { yardIds: yid }],
          bookingDate: { $gte: date, $lt: nextDay }
        }).lean();
        for (const b of existing) {
          const bStart = b.start_time || "";
          const bEnd = b.end_time || "";
          if (bStart && bEnd && timesOverlap(st, et, bStart, bEnd)) {
            return res.status(400).json({
              success: false,
              message: `${bStart} to ${bEnd} is already booked for this yard. Please book another time or choose a different yard.`
            });
          }
        }
      }
      updateData.start_time = st;
      updateData.end_time = et;
    }

    const updatedBooking = await Booking.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    const doc = updatedBooking.toObject ? updatedBooking.toObject() : updatedBooking;
    const addoneAmount = (Array.isArray(doc.addOns) ? doc.addOns : []).reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    res.json({
      success: true,
      data: { ...doc, addoneAmount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancel a booking. Sets bookingStatus to "cancelled".
 */
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (req.user.role === "club_owner" && booking.clubId.toString() !== req.user.clubId) {
      return res.status(403).json({ success: false, message: "Unauthorized to cancel this booking" });
    }

    if (["cancelled", "canceled", "Cancelled", "Canceled"].includes(booking.bookingStatus)) {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { $set: { bookingStatus: "cancelled" } },
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking cancelled",
      data: updatedBooking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Final settlement after match completion.
 * Captures remaining amount paid at settlement (online + cash).
 * Advance amounts are already stored at booking time.
 */
exports.settlementBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      settlement_remaining_online,
      settlement_remaining_cash
    } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (req.user.role === "club_owner" && booking.clubId.toString() !== req.user.clubId) {
      return res.status(403).json({ success: false, message: "Unauthorized to update this booking" });
    }

    const remainingOnline = Number(settlement_remaining_online || 0);
    const remainingCash = Number(settlement_remaining_cash || 0);
    const advanceOnline = booking.advancePaymentOnline || 0;
    const advanceCash = booking.advancePaymentCash || 0;

    const totalAmountPaid = advanceOnline + advanceCash + remainingOnline + remainingCash;
    const advanceAmountPaid = advanceOnline + advanceCash;
    const remainingAmountPaidAtSettlement = remainingOnline + remainingCash;
    const totalPaidOnline = advanceOnline + remainingOnline;
    const totalPaidCash = advanceCash + remainingCash;

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      {
        $set: {
          settlementDone: true,
          settlementRemainingOnline: remainingOnline,
          settlementRemainingCash: remainingCash,
          paymentStatus: "paid"
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Settlement recorded",
      data: updatedBooking,
      settlement: {
        totalAmountPaid,
        advanceAmountPaid,
        remainingAmountPaidAtSettlement,
        amountPaidOnline: totalPaidOnline,
        amountPaidOfflineCash: totalPaidCash
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate("clubId", "name")
      .populate("yardId", "name gameType")
      .populate("yardIds", "name gameType")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};