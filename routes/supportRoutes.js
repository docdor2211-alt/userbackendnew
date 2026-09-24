const express = require("express");

const router = express.Router();

// ================= MIDDLEWARE =================

const { protect } = require("../middleware/authMiddleware");

// ================= CONTROLLER =================

const {
  getFaqs,
  getContactInfo,
  createTicket,
  getMyTickets,
  getTicketById,
  closeTicket,
} = require("../controllers/supportController");

// ================= FAQS (PUBLIC) =================

router.get("/faqs", getFaqs);

// ================= CONTACT INFO (PUBLIC) =================

router.get("/contact", getContactInfo);

// ================= CREATE TICKET =================

router.post("/tickets", protect, createTicket);

// ================= MY TICKETS =================

router.get("/tickets/mine", protect, getMyTickets);

// ================= CLOSE TICKET =================

router.put("/tickets/close/:id", protect, closeTicket);

// ================= SINGLE TICKET =================

router.get("/tickets/:id", protect, getTicketById);

module.exports = router;