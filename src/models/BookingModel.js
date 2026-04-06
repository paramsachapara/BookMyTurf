const mongoose = require("mongoose");
const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      index: true
    },
    yardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Yard",
      index: true
    },
    yardIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Yard" }
    ],
    start_time: { type: String, trim: true },
    end_time: { type: String, trim: true },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },
    bookingDate: {
      type: Date,
      required: true,
      index: true
    },
    yardBreakdown: [
      { yardId: mongoose.Schema.Types.ObjectId, yardName: String, amount: Number }
    ],
    userName: {
      type: String,
      trim: true,
      default: ""
    },
    mobileNumber: {
      type: String,
      trim: true,
      default: ""
    },
    addOns: [
      {
        addOnId: mongoose.Schema.Types.ObjectId,
        name: String,
        quantity: Number,
        price: Number
      }
    ],
    // Price handling: original amount (from price at booking or sum of yards) vs final agreed amount
    originalAmount: {
      type: Number,
      default: 0,
      index: true
    },
    totalAmount: {
      type: Number,
      required: true
    },
    // Stored discount: final = totalAmount (bill) - negotiatedDiscount.
    negotiatedDiscount: {
      type: Number,
      default: 0
    },
    // Advance payment at booking time
    advancePaymentReceived: {
      type: Boolean,
      default: false,
      index: true
    },
    advancePaymentOnline: {
      type: Number,
      default: 0
    },
    advancePaymentCash: {
      type: Number,
      default: 0
    },
    // Final settlement (after match completion)
    settlementDone: {
      type: Boolean,
      default: false,
      index: true
    },
    settlementRemainingOnline: {
      type: Number,
      default: 0
    },
    settlementRemainingCash: {
      type: Number,
      default: 0
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true
    },
    bookingStatus: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
      index: true
    }
  },
  { timestamps: true }
);

bookingSchema.index({ yardId: 1, bookingDate: 1 });
bookingSchema.index({ yardIds: 1, bookingDate: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);