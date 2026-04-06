const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      index: true
    },
    subscriptionType: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
      index: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    periodYear: {
      type: Number,
      required: true,
      index: true
    },
    periodMonth: {
      type: Number,
      min: 0,
      max: 12,
      default: null
    }
  },
  { timestamps: true }
);

// One subscription per club per period: monthly = (clubId, monthly, year, 1-12), yearly = (clubId, yearly, year, 0)
subscriptionSchema.index({ clubId: 1, subscriptionType: 1, periodYear: 1, periodMonth: 1 }, { unique: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);
