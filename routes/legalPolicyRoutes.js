const express = require("express");

const router = express.Router();

// ================= MIDDLEWARE =================

const { protect, adminOnly } = require("../middleware/authMiddleware");

// ================= CONTROLLER =================

const {
  getPolicies,
  getPolicyBySlug,
  createPolicy,
  updatePolicy,
  deletePolicy,
} = require("../controllers/legalPolicyController");

// ================= GET ALL POLICIES (PUBLIC) =================

router.get("/", getPolicies);

// ================= GET SINGLE POLICY (PUBLIC) =================

router.get("/:slug", getPolicyBySlug);

// ================= CREATE POLICY (ADMIN) =================

router.post("/create", protect, adminOnly, createPolicy);

// ================= UPDATE POLICY (ADMIN) =================

router.put("/update/:id", protect, adminOnly, updatePolicy);

// ================= DELETE POLICY (ADMIN) =================

router.delete("/delete/:id", protect, adminOnly, deletePolicy);

module.exports = router;