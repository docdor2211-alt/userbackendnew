// controllers/labBookingController.js

const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");

const LabBooking = require("../models/labBookingModel");

// IMPORT USER MODEL
require("../models/userModel");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper to format booking to match frontend documentation
const formatBooking = (booking) => {
  if (!booking) return null;
  const doc = booking.toObject ? booking.toObject() : { ...booking };

  let dateStr = "";
  if (doc.scheduledDate) {
    if (doc.scheduledDate instanceof Date) {
      dateStr = doc.scheduledDate.toISOString().split("T")[0];
    } else {
      dateStr = String(doc.scheduledDate).split("T")[0];
    }
  }

  return {
    _id: doc._id ? doc._id.toString() : "",
    testName: doc.testName || "",
    price: typeof doc.price === "number" ? doc.price : Number(doc.price) || 0,
    sampleCollectionType: doc.sampleCollectionType || "Home",
    scheduledDate: dateStr,
    paymentMethod: doc.paymentMethod || "ONLINE",
    razorpayOrderId: doc.razorpayOrderId || "",
    paymentStatus: doc.paymentStatus || "PENDING",
    status: doc.status || "Pending",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

// ======================================================
// CREATE LAB BOOKING
// ======================================================

exports.createLabBooking = async (req, res) => {
  try {
    const {
      testName,
      price,
      sampleCollectionType,
      scheduledDate,
      paymentMethod,
    } = req.body;

    if (!testName) {
      return res.status(400).json({
        success: false,
        message: "testName is required",
      });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid price is required",
      });
    }

    // Determine user: token or body
    let userId = req.user?._id || req.body.user || req.body.userId;
    if (!userId) {
      const User = require("../models/userModel");
      const firstUser = await User.findOne();
      if (firstUser) userId = firstUser._id;
    }

    // Normalize sampleCollectionType ("Home" or "Lab")
    const collectionType =
      sampleCollectionType === "Lab" || sampleCollectionType === "Lab Visit"
        ? "Lab"
        : "Home";

    let dateStr = "";
    if (scheduledDate) {
      if (typeof scheduledDate === "string") {
        dateStr = scheduledDate.trim();
      } else if (scheduledDate instanceof Date) {
        dateStr = scheduledDate.toISOString().split("T")[0];
      }
    }

    const method = (paymentMethod || "ONLINE").toUpperCase();

    // =====================================
    // COD BOOKING
    // =====================================
    if (method === "COD") {
      const booking = await LabBooking.create({
        user: userId || undefined,
        testName: testName.trim(),
        price: numericPrice,
        sampleCollectionType: collectionType,
        scheduledDate: dateStr,
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        status: "Pending",
      });

      return res.status(201).json({
        success: true,
        message: "Lab Booking Created",
        booking: formatBooking(booking),
      });
    }

    // =====================================
    // ONLINE PAYMENT (RAZORPAY)
    // =====================================
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(numericPrice * 100),
        currency: "INR",
        receipt: `receipt_lab_${Date.now()}`,
      });
    } catch (rzpErr) {
      console.error("Razorpay order creation error:", rzpErr);
      return res.status(500).json({
        success: false,
        message:
          "Razorpay error: " +
          (rzpErr.error?.description || rzpErr.message || "Failed to create order"),
      });
    }

    const booking = await LabBooking.create({
      user: userId || undefined,
      testName: testName.trim(),
      price: numericPrice,
      sampleCollectionType: collectionType,
      scheduledDate: dateStr,
      paymentMethod: "ONLINE",
      razorpayOrderId: razorpayOrder.id,
      paymentStatus: "PENDING",
      status: "Pending",
    });

    const formattedBooking = formatBooking(booking);

    res.status(201).json({
      success: true,
      message: "Razorpay Order Created",
      booking: formattedBooking,
      razorpayOrderId: razorpayOrder.id,
      razorpayOrder,
    });
  } catch (error) {
    console.error("CREATE LAB BOOKING ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// VERIFY PAYMENT
// ======================================================

exports.verifyLabPayment = async (req, res) => {
  try {
    const bookingId = req.body.bookingId || req.body.booking_id || req.body.id;
    const razorpay_order_id =
      req.body.razorpay_order_id || req.body.razorpayOrderId;
    const razorpay_payment_id =
      req.body.razorpay_payment_id || req.body.razorpayPaymentId;
    const razorpay_signature =
      req.body.razorpay_signature || req.body.razorpaySignature;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay verification fields",
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: "Invalid Signature",
      });
    }

    let query = null;
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      query = { _id: bookingId };
    } else if (razorpay_order_id) {
      query = { razorpayOrderId: razorpay_order_id };
    }

    let booking = null;
    if (query) {
      booking = await LabBooking.findOneAndUpdate(
        query,
        {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paymentStatus: "PAID",
          status: "Confirmed",
        },
        { new: true, returnDocument: "after" }
      );
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      booking: formatBooking(booking),
    });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET MY BOOKINGS
// ======================================================

exports.getMyLabBookings = async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
      });
    }

    const bookings = await LabBooking.find({ user: userId })
      .populate("user", "fullname email phone role")
      .sort({ createdAt: -1 });

    const formatted = bookings.map(formatBooking);

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET ALL BOOKINGS
// ======================================================

exports.getAllLabBookings = async (req, res) => {
  try {
    const bookings = await LabBooking.find()
      .populate({
        path: "user",
        select: "fullname email phone role",
      })
      .sort({ createdAt: -1 });

    const formatted = bookings.map(formatBooking);

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};