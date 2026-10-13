const mongoose = require("mongoose");

const labCategorySchema = new mongoose.Schema(
  {
    // 🔹 Category Name
    name: {
      type: String,
      required: [true, "Category name required"],
      trim: true,
    },

    // 🔹 Image (icon)
    image: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ url: "", publicId: "" }),
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.LabCategory ||
  mongoose.model("LabCategory", labCategorySchema);