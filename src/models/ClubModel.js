const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    address: String,
    city: {
      type: String,
      index: true
    },
    state: {
      type: String,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

clubSchema.index({ ownerId: 1, isActive: 1 });

module.exports = mongoose.model("Club", clubSchema);