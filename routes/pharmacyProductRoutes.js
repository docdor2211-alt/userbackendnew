const express = require("express");
const router = express.Router();

const {
  getPharmacyProducts,
  getProductsByPharmacy,
  getSinglePharmacyProduct,
} = require("../controllers/pharmacyProductController");

router.get("/", getPharmacyProducts);
router.get("/all", getPharmacyProducts);
router.get("/pharmacy/:pharmacyId", getProductsByPharmacy);
router.get("/:id", getSinglePharmacyProduct);

module.exports = router;

