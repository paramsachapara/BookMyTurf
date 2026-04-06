const User = require("../models/UserModel");
const Club = require("../models/ClubModel");
const bcrypt = require("bcryptjs");
const { successResponse, errorResponse } = require("../utils/responseHandler");
const { generateToken } = require("../utils/jwtUtils");
const asyncHandler = require("../utils/asyncHandler");

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return errorResponse(res, 400, "User not found");
  }

  if (!user.isActive && user.role !== "super_admin") {
    return errorResponse(res, 400, "User is not active contact to admin");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return errorResponse(res, 400, "Invalid credentials");
  }

  let clubId = null;
  if (user.role === "club_owner") {
    const club = await Club.findOne({ ownerId: user._id });
    clubId = club ? club._id : null;
  }

  const token = generateToken({
    id: user._id,
    email: user.email,
    role: user.role,
    clubId: clubId,
  });

  return successResponse(res, 200, "Login successful", {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedShops: user.assignedShops,
    },
  });
});

exports.register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    club,
    clubAddress,
    clubCity,
    clubState,
    isActive,
  } = req.body;

  //   const allowedRoles = ["super_admin", "club_owner"];
  if (!role.includes(role)) {
    return errorResponse(res, 400, "Invalid role");
  }

  // Check if name already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return errorResponse(
      res,
      400,
      "Email already registered. Please use a different email.",
    );
  }
  // Check if email already exists
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    return errorResponse(
      res,
      400,
      "Email already registered. Please use a different email.",
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    club,
    clubAddress,
    clubCity,
    clubState,
    isActive,
  });

  // Automatically create Club if owner
  if (role === "club_owner") {
    await Club.create({
      name: club,
      ownerId: user._id,
      address: clubAddress,
      city: clubCity,
      state: clubState,
      isActive: true,
    });
  }

  return successResponse(res, 201, "User registered successfully", {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      club: user.club,
      clubAddress: user.clubAddress,
      clubCity: user.clubCity,
      clubState: user.clubState,
      isActive: user.isActive,
    },
  });
});
