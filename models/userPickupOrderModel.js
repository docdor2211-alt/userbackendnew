const mongoose = require("mongoose");

const pickupItemSchema =
  new mongoose.Schema({

    name: {
      type: String,
      required: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PharmacyProduct",
      default: null,
    },

    productModel: {
      type: String,
      enum: ["PharmacyProduct", "MedicineItem"],
      default: "PharmacyProduct",
    },

    inventoryAllocations: [
      {
        purchaseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PharmacyPurchase",
        },
        purchaseItemId: {
          type: mongoose.Schema.Types.ObjectId,
        },
        quantity: {
          type: Number,
          min: 1,
        },
      },
    ],

    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },

    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },

    prescriptionId: {
      type: String,
      default: "",
    },

  });

const pickupOrderSchema =
  new mongoose.Schema(

    {

      // USER
      user: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,

      },

      // PHARMACY
      pharmacy: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref: "PharmacyUser",

        required: true,

      },

      orderId: {

        type: String,

        required: true,

      },

      customerName: {

        type: String,

        required: true,

      },

      customerPhone: {

        type: String,

        required: true,

      },

      pickupTime: {

        type: String,

        required: true,

      },

      status: {

        type: String,

        enum: [
          "pending",
          "ready",
          "completed",
          "cancelled",
          "delivery",
        ],

        default: "pending",

      },

      items: [pickupItemSchema],

      inventoryAdjusted: {
        type: Boolean,
        default: false,
      },

      totalAmount: {

        type: Number,

        default: 0,

        min: 0,

      },

      address: {

        type: String,

        default: "",

      },

    },

    {
      timestamps: true,
    }

  );

// IMPORTANT
module.exports =
  mongoose.models.PickupOrder ||
  mongoose.model(
    "PickupOrder",
    pickupOrderSchema
  );