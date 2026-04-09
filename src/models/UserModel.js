const mongoose = require("mongoose");

const usersSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["super_admin", "club_owner", "user"],
      default: "user",
      index: true,
    },
    club: {
      type: String,
    },
    clubAddress: {
      type: String,
    },
    clubCity: {
      type: String,
    },
    clubState: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);
usersSchema.index({ role: 1, isActive: 1 });
module.exports = mongoose.model("User", usersSchema);
