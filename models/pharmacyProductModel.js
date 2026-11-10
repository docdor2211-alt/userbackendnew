const mongoose = require("mongoose");

const pharmacyProductSchema = new mongoose.Schema(
  {
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PharmacyUser",
      required: true,
      index: true,
    },
    productTitle: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    mrp: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
      validate: {
        validator: (value) => Number.isInteger(value) && value >= 0,
        message: "Stock must be a non-negative whole number",
      },
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, "Low stock threshold cannot be negative"],
      validate: {
        validator: (value) => Number.isInteger(value) && value >= 0,
        message: "Low stock threshold must be a non-negative whole number",
      },
    },
    gst: { type: String, default: "" },
    expiryDate: { type: String, default: "" },
    prescriptionRequired: { type: Boolean, default: false },
    image: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PharmacyProduct ||
  mongoose.model("PharmacyProduct", pharmacyProductSchema);

