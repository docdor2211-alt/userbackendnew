// models/supportModel.js

const mongoose = require("mongoose");

// ================= FAQ SCHEMA =================

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },

    answer: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      default: "General",
      trim: true,
    },

    order: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ================= CONTACT INFO SCHEMA =================

const contactSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["phone", "email", "whatsapp", "chat"],
      required: true,
    },

    value: {
      type: String,
      required: true,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ================= SUPPORT TICKET SCHEMA =================

const supportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: [
        "Booking",
        "Payment",
        "Medicines",
        "Lab Tests",
        "Account",
        "Other",
      ],
      default: "Other",
    },

    message: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["new", "in-progress", "resolved", "closed"],
      default: "new",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    adminReply: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = {
  Faq: mongoose.model("Faq", faqSchema),
  Contact: mongoose.model("SupportContact", contactSchema),
  SupportTicket: mongoose.model("SupportTicket", supportTicketSchema),
};