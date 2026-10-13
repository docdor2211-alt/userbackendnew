const mongoose = require("mongoose");

const checkupTypeSchema = new mongoose.Schema({

  title: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },

  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },

  image: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({ url: "", publicId: "" }),
  },

}, {
  timestamps: true,
});

// Auto-generate slug before validation if not provided
checkupTypeSchema.pre("validate", function () {
  if (this.title && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "");
  }
});

module.exports =
  mongoose.models.CheckupType ||
  mongoose.model("CheckupType", checkupTypeSchema);