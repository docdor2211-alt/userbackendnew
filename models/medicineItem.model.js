
const mongoose = require("mongoose");

const medicineItemSchema = new mongoose.Schema(
  {
    // ✅ CATEGORY REFERENCE (optional)
    medicineCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicineCategory",
      required: false,
    },

    // ✅ SUB CATEGORY (both medicineSubCategory & subCategoryId supported)
    medicineSubCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicineSubCategory",
      required: false,
    },

    subCategoryId: {
      type: mongoose.Schema.Types.Mixed,
      default: "",
    },

    // ✅ PRODUCT NAME & DESCRIPTION (frontend uses description as product name)
    name: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ FORM FACTOR
    type: {
      type: String,
      default: "Strip of tablets",
      trim: true,
    },

    // ✅ DELIVERY ESTIMATE
    delivery: {
      type: String,
      default: "Delivery by Tomorrow 9 PM",
      trim: true,
    },

    // ✅ PRICING (supports newPrice, price, mrp, oldPrice, originalPrice)
    newPrice: {
      type: Number,
      default: 0,
    },

    oldPrice: {
      type: Number,
      default: 0,
    },

    price: {
      type: Number,
      default: 0,
    },

    mrp: {
      type: Number,
      default: 0,
    },

    // ✅ DISCOUNT ("X% OFF")
    discount: {
      type: String,
      default: "",
      trim: true,
    },

    // ✅ PRESCRIPTION REQUIRED BADGE
    prescription: {
      type: Boolean,
      default: false,
    },

    // ✅ DIRECT IMAGE URL
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },

    // ✅ IMAGE (supports string or { url, publicId })
    image: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        url: "",
        publicId: "",
      },
    },

    // ✅ MEDICINE ITEMS PACK
    medicineItems: {
      type: [String],
      default: [],
    },

    // ✅ QUANTITY
    quantity: {
      type: Number,
      default: 1,
    },

    // ✅ STOCK (null = unknown/enabled, 0 = out of stock/disabled, >0 = available)
    stock: {
      type: Number,
      default: null,
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

// Pre-save hook to synchronize aliases and computed fields
medicineItemSchema.pre("save", function (next) {
  // Sync name and description
  if (!this.description && this.name) {
    this.description = this.name;
  }
  if (!this.name && this.description) {
    this.name = this.description;
  }

  // Sync pricing aliases
  if (this.newPrice === 0 && this.price > 0) {
    this.newPrice = this.price;
  } else if (this.price === 0 && this.newPrice > 0) {
    this.price = this.newPrice;
  }

  if (this.oldPrice === 0 && this.mrp > 0) {
    this.oldPrice = this.mrp;
  } else if (this.mrp === 0 && this.oldPrice > 0) {
    this.mrp = this.oldPrice;
  }

  // Compute discount if missing: ((oldPrice - newPrice) / oldPrice) * 100 -> "X% OFF"
  if (
    !this.discount &&
    this.oldPrice > this.newPrice &&
    this.oldPrice > 0 &&
    this.newPrice > 0
  ) {
    const pct = Math.round(
      ((this.oldPrice - this.newPrice) / this.oldPrice) * 100
    );
    if (pct > 0) {
      this.discount = `${pct}% OFF`;
    }
  }

  // Sync subcategory
  if (!this.subCategoryId && this.medicineSubCategory) {
    this.subCategoryId = this.medicineSubCategory.toString();
  } else if (!this.medicineSubCategory && this.subCategoryId) {
    if (mongoose.Types.ObjectId.isValid(this.subCategoryId)) {
      this.medicineSubCategory = this.subCategoryId;
    }
  }

  // Sync image and imageUrl
  if (!this.imageUrl) {
    if (typeof this.image === "string") {
      this.imageUrl = this.image;
    } else if (this.image && this.image.url) {
      this.imageUrl = this.image.url;
    }
  }
  if (!this.image || (typeof this.image === "object" && !this.image.url)) {
    if (this.imageUrl) {
      this.image = { url: this.imageUrl, publicId: "" };
    }
  }

  next();
});

module.exports =
  mongoose.models.MedicineItem ||
  mongoose.model("MedicineItem", medicineItemSchema);

