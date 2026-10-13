

const mongoose = require("mongoose");

const labBookingSchema =
  new mongoose.Schema(

    {

      // =========================
      // USER
      // =========================

      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false,
      },


      // =========================
      // TEST DETAILS
      // =========================

      testName: {
        type: String,
        required: true,
        trim: true,
      },

      price: {
        type: Number,
        required: true,
      },


      // =========================
      // BOOKING STATUS
      // =========================

      status: {
        type: String,
        enum: [
          // DEFAULT
          "Pending",
          // LAB MANAGEMENT
          "Accepted",
          "Rejected",
          // LAB PROCESS
          "Confirmed",
          "Sample Collected",
          "Processing",
          "Completed",
          // CANCEL
          "Cancelled",
        ],
        default: "Pending",
      },


      // =========================
      // SAMPLE COLLECTION
      // =========================

      sampleCollectionType: {
        type: String,
        enum: [
          "Home",
          "Lab",
          "Lab Visit",
        ],
        default: "Home",
      },


      // =========================
      // DATE
      // =========================

      scheduledDate: {
        type: mongoose.Schema.Types.Mixed,
        default: "",
      },


      // =========================
      // REPORT
      // =========================

      reportUrl: {
        type: String,
        default: "",
      },


      // =========================
      // PAYMENT
      // =========================

      paymentMethod: {
        type: String,
        enum: [
          "COD",
          "ONLINE",
        ],
        default: "ONLINE",
      },


      paymentStatus: {
        type: String,
        enum: [
          "PENDING",
          "PAID",
          "FAILED",
        ],
        default: "PENDING",
      },


      // =========================
      // RAZORPAY
      // =========================

      razorpayOrderId: {
        type: String,
        default: "",
      },

      razorpayPaymentId: {
        type: String,
        default: "",
      },

      razorpaySignature: {
        type: String,
        default: "",
      },


      // =========================
      // COMPLETION
      // =========================

      isCompleted: {
        type: Boolean,
        default: false,
      },

    },

    {
      timestamps: true,
    }

  );

module.exports =
  mongoose.models.LabBooking ||
  mongoose.model("LabBooking", labBookingSchema);