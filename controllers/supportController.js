// controllers/supportController.js

const {
  Faq,
  Contact,
  SupportTicket,
} = require("../models/supportModel");

// ================= GET FAQS =================

exports.getFaqs = async (req, res) => {
  try {
    const faqs = await Faq.find({ isActive: true }).sort({ order: 1 });

    return res.status(200).json({
      success: true,
      count: faqs.length,
      data: faqs,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET CONTACT INFO =================

exports.getContactInfo = async (req, res) => {
  try {
    const contacts = await Contact.find({ isActive: true }).sort({ _id: 1 });

    return res.status(200).json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= CREATE SUPPORT TICKET =================

exports.createTicket = async (req, res) => {
  try {
    const { subject, category, message, priority } = req.body;

    if (!subject || subject.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Subject is required",
      });
    }

    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const ticket = await SupportTicket.create({
      user: req.user._id,
      subject: subject.trim(),
      category: category || "Other",
      message,
      priority: priority || "medium",
    });

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: ticket,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET MY TICKETS =================

exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET SINGLE TICKET =================

exports.getTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= CLOSE TICKET =================

exports.closeTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    ticket.status = "closed";
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Ticket closed",
      data: ticket,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};