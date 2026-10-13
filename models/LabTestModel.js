const mongoose = require("mongoose");

// ================= PARAMETERS =================
const parameterSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

// ================= GUIDELINES =================
const guidelineSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

// ================= MAIN MODEL =================
const labTestSchema = new mongoose.Schema(
  {
    // TITLE
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // SHORT DESCRIPTION
    shortDescription: {
      type: String,
      default: "",
    },

    // FULL DESCRIPTION
    description: {
      type: String,
      default: "",
    },

    // CHECKUP TYPE
    checkupType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CheckupType",
      required: true,
    },

    // CATEGORY (Supports both labCategory and category)
    labCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabCategory",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabCategory",
    },

    // IMAGE (String or Object { url, publicId })
    image: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ url: "", publicId: "" }),
    },

    // PRICE
    actualPrice: {
      type: Number,
      required: true,
      default: 0,
    },

    salePrice: {
      type: Number,
      required: true,
      default: 0,
    },

    // REPORT TIME
    reportTime: {
      type: String,
      default: "24 hours",
    },

    // TOTAL TESTS
    totalTests: {
      type: Number,
      default: 0,
    },

    // BADGES & FLAGS
    recommended: {
      type: Boolean,
      default: false,
    },

    bestSeller: {
      type: Boolean,
      default: false,
    },

    homeSample: {
      type: Boolean,
      default: true,
    },

    digitalReport: {
      type: Boolean,
      default: true,
    },

    nablCertified: {
      type: Boolean,
      default: true,
    },

    // GUIDELINES
    guidelines: [guidelineSchema],

    // PARAMETERS
    parameters: [parameterSchema],
  },
  {
    timestamps: true,
  }
);

// Ensure labCategory and category are always in sync
labTestSchema.pre("save", function () {
  if (this.labCategory && !this.category) {
    this.category = this.labCategory;
  } else if (this.category && !this.labCategory) {
    this.labCategory = this.category;
  }
});

module.exports =
  mongoose.models.LabTest || mongoose.model("LabTest", labTestSchema);