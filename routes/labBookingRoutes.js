// routes/labBookingRoutes.js

const express = require("express");

const router = express.Router();

const {

  createLabBooking,

  verifyLabPayment,

  getMyLabBookings,

  getAllLabBookings,

} = require(
  "../controllers/labBookingController"
);


const {

  protect,

  userOnly,

  adminOnly,

} = require(
  "../middleware/authMiddleware"
);



// Optional auth middleware: extracts user if token provided, but doesn't block if absent
const optionalAuth = (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return protect(req, res, next);
  }
  next();
};

// ==========================================
// USER
// ==========================================

// CREATE BOOKING
router.post(
  "/create",
  optionalAuth,
  createLabBooking
);

// VERIFY PAYMENT
router.post(
  "/verify-payment",
  optionalAuth,
  verifyLabPayment
);


// MY BOOKINGS
router.get(
  "/my-bookings",
  protect,
  userOnly,
  getMyLabBookings
);



// ==========================================
// ADMIN
// ==========================================


// ALL BOOKINGS
router.get(
  "/all",
  protect,
  adminOnly,
  getAllLabBookings
);



module.exports = router;