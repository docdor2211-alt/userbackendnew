const mongoose = require("mongoose");

const bankDetailsSchema = new mongoose.Schema({
  accountHolderName: {
    type: String,
    default: "",
  },
  bankName: {
    type: String,
    default: "",
  },
  accountNumber: {
    type: String,
    default: "",
  },
  ifscCode: {
    type: String,
    default: "",
  },
  accountType: {
    type: String,
    default: "",
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
});

const inventorySettingsSchema = new mongoose.Schema({
  lowStockAlert: {
    type: Boolean,
    default: false,
  },
  expiryReminders: {
    type: Boolean,
    default: false,
  },
  showOutOfStock: {
    type: Boolean,
    default: false,
  },
  autoSyncPOS: {
    type: Boolean,
    default: false,
  },
  minStockLevel: {
    type: Number,
    default: 0,
  },
  gstRate: {
    type: Number,
    default: 0,
  },
});

const storePerformanceSchema = new mongoose.Schema({
  totalRevenue: {
    type: String,
    default: "",
  },
  growthRate: {
    type: String,
    default: "",
  },
  orderSuccess: {
    type: Number,
    default: 0,
  },
  patientSatisfaction: {
    type: Number,
    default: 0,
  },
  inventoryTurnover: {
    type: Number,
    default: 0,
  },
  totalOrders: {
    type: Number,
    default: 0,
  },
  activePatients: {
    type: Number,
    default: 0,
  },
  averageRating: {
    type: Number,
    default: 0,
  },
  refunds: {
    type: String,
    default: "",
  },
});

const pharmacyUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    licenseNumber: {
      type: String,
      default: "",
    },
    rating: {
      type: String,
      default: "",
    },
    totalOrders: {
      type: String,
      default: "",
    },
    reliability: {
      type: String,
      default: "",
    },
    storePerformance: storePerformanceSchema,
    inventorySettings: inventorySettingsSchema,
    bankDetails: bankDetailsSchema,
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.PharmacyUser ||
  mongoose.model("PharmacyUser", pharmacyUserSchema);

