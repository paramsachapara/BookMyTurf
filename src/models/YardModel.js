const mongoose = require("mongoose");
const yardSchema = new mongoose.Schema(
  {
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    gameType: {
      type: String,
      required: true,
      index: true
    },
    pricePerHour: {
      type: Number,
      // required: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);


yardSchema.index({ clubId: 1, gameType: 1 });

module.exports = mongoose.model("Yard", yardSchema);