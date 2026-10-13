
const mongoose = require("mongoose");

const medicineCategorySchema = new mongoose.Schema(
  {
    // ✅ MAIN CATEGORY (optional)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: false,
    },

    // ✅ TAB TITLE
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // ✅ IMAGE (supports object or string)
    image: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        url: "",
        publicId: "",
      },
    },

    // ✅ IS FREE FLAG
    isFree: {
      type: Boolean,
      default: false,
    },

    // ✅ IS ACTIVE
    isActive: {
      type: Boolean,
      default: true,
    },

    // ✅ PARENT CATEGORY (optional)
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicineCategory",
      default: null,
    },

    // ✅ SLUG
    slug: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.MedicineCategory ||
  mongoose.model("MedicineCategory", medicineCategorySchema);

