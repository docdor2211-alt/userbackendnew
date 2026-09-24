// models/legalPolicyModel.js

const mongoose = require("mongoose");

// ================= POLICY SECTION SCHEMA =================

const policySectionSchema = new mongoose.Schema(
  {
    heading: {
      type: String,
      default: "",
      trim: true,
    },

    content: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  }
);

// ================= LEGAL POLICY SCHEMA =================

const legalPolicySchema = new mongoose.Schema(
  {
    // ================= TITLE =================

    title: {
      type: String,
      required: true,
      trim: true,
    },

    // ================= SLUG =================

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // ================= SHORT DESCRIPTION =================

    summary: {
      type: String,
      default: "",
      trim: true,
    },

    // ================= CONTENT SECTIONS =================

    sections: [policySectionSchema],

    // ================= STATUS =================

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("LegalPolicy", legalPolicySchema);