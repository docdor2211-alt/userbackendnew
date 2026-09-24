// models/addressModel.js

const mongoose = require("mongoose");

// ================= ADDRESS SCHEMA =================

const addressSchema = new mongoose.Schema(
  {
    // ================= USER =================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ================= ADDRESS TYPE =================

    type: {
      type: String,
      enum: ["Home", "Office", "Other"],
      default: "Home",
    },

    // ================= FULL ADDRESS =================

    fullAddress: {
      type: String,
      required: true,
      trim: true,
    },

    // ================= LANDMARK =================

    landmark: {
      type: String,
      default: "",
      trim: true,
    },

    // ================= CITY =================

    city: {
      type: String,
      default: "",
      trim: true,
    },

    // ================= STATE =================

    state: {
      type: String,
      default: "",
      trim: true,
    },

    // ================= PINCODE =================

    pincode: {
      type: String,
      default: "",
      trim: true,
    },

    // ================= RECIPIENT =================

    recipientName: {
      type: String,
      default: "",
      trim: true,
    },

    recipientPhone: {
      type: String,
      default: "",
      trim: true,
    },

    // ================= DEFAULT =================

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Address", addressSchema);