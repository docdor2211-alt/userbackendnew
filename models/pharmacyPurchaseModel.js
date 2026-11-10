const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PharmacyProduct",
      required: true,
    },
    productTitle: { type: String, required: true },
    batchNumber: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    remainingQuantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    expiryDate: { type: String, default: "" },
  },
  { _id: true }
);

const pharmacyPurchaseSchema = new mongoose.Schema(
  {
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PharmacyUser",
      required: true,
      index: true,
    },
    distributorName: { type: String, required: true, trim: true },
    invoiceNumber: { type: String, default: "", trim: true },
    purchaseDate: { type: Date, required: true },
    items: { type: [purchaseItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PharmacyPurchase ||
  mongoose.model("PharmacyPurchase", pharmacyPurchaseSchema);

