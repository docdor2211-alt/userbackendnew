
const mongoose = require("mongoose");

const medicineSubCategorySchema = new mongoose.Schema(
  {
    // ✅ TOP CATEGORY
    medicineCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicineCategory",
      required: true,
    },

    // ✅ DISPLAY NAME (used by frontend)
    name: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ CARD TITLE (legacy alias)
    title: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ IMAGE (supports object or string)
    image: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        url: "",
        publicId: "",
      },
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

// Keep name and title in sync before save
medicineSubCategorySchema.pre("save", function (next) {
  if (!this.name && this.title) {
    this.name = this.title;
  }
  if (!this.title && this.name) {
    this.title = this.name;
  }
  next();
});

module.exports =
  mongoose.models.MedicineSubCategory ||
  mongoose.model("MedicineSubCategory", medicineSubCategorySchema);

