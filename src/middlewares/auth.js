const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");

const auth = (roles = []) => {
  return async (req, res, next) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "No token, authorization denied",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found or unauthorized. Please login again.",
        });
      }
      if (!user.isActive && user.role !== "super_admin") {
        return res.status(401).json({
          success: false,
          message: "User is not active. Please contact admin.",
        });
      }

      req.user = decoded;

      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" ? "Token is not valid or expired" : "Unauthorized",
      });
    }
  };
};

module.exports = auth;