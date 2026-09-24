const express = require("express");

const router = express.Router();

// ================= MIDDLEWARE =================

const { protect } = require("../middleware/authMiddleware");

// ================= CONTROLLER =================

const {
  createAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} = require("../controllers/addressController");

// ================= CREATE ADDRESS =================

router.post("/create", protect, createAddress);

// ================= GET ALL ADDRESSES (MY) =================

router.get("/mine", protect, getAddresses);

// ================= GET SINGLE ADDRESS =================

router.get("/:id", protect, getAddressById);

// ================= UPDATE ADDRESS =================

router.put("/update/:id", protect, updateAddress);

// ================= SET DEFAULT ADDRESS =================

router.put("/default/:id", protect, setDefaultAddress);

// ================= DELETE ADDRESS =================

router.delete("/:id", protect, deleteAddress);

module.exports = router;