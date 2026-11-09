// // models/medicineOrderModel.js

// const mongoose = require("mongoose");

// const medicineOrderSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },

//     items: [
//       {
//         product: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "Medicine",
//           required: true,
//         },

//         name: {
//           type: String,
//           required: true,
//         },

//         image: {
//           type: String,
//           default: "",
//         },

//         quantity: {
//           type: Number,
//           required: true,
//           default: 1,
//         },

//         price: {
//           type: Number,
//           required: true,
//         },

//         totalPrice: {
//           type: Number,
//           required: true,
//         },
//       },
//     ],

//     totalAmount: {
//       type: Number,
//       required: true,
//     },

//     paymentMethod: {
//       type: String,
//       enum: ["COD", "ONLINE", "WALLET"],
//       default: "COD",
//     },

//     paymentStatus: {
//       type: String,
//       enum: ["PENDING", "PAID", "FAILED"],
//       default: "PENDING",
//     },

//     orderStatus: {
//       type: String,
//       enum: [
//         "PLACED",
//         "CONFIRMED",
//         "PROCESSING",
//         "SHIPPED",
//         "DELIVERED",
//         "CANCELLED",
//       ],
//       default: "PLACED",
//     },

//     deliveryAddress: {
//       type: String,
//       required: true,
//       trim: true,
//     },

//     // Razorpay Details
//     razorpayOrderId: {
//       type: String,
//       default: "",
//     },

//     razorpayPaymentId: {
//       type: String,
//       default: "",
//     },

//     razorpaySignature: {
//       type: String,
//       default: "",
//     },

//     paidAt: {
//       type: Date,
//     },

//     deliveredAt: {
//       type: Date,
//     },

//     isCompleted: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// module.exports = mongoose.model(
//   "MedicineOrder",
//   medicineOrderSchema
// );



// models/medicineOrderModel.js

const mongoose = require("mongoose");

// ======================================================
// ORDER ITEM
// ======================================================

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    productModel: {
      type: String,
      enum: ["MedicineItem", "PharmacyProduct"],
      default: "MedicineItem",
    },

    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PharmacyUser",
      default: null,
    },

    name: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      default: "",
    },

    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },

    qty: {
      type: Number,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },

    totalPrice: {
      type: Number,
      required: true,
      min: [0, "Total price cannot be negative"],
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
  },
  {
    _id: true,
  }
);

// ======================================================
// MEDICINE ORDER
// ======================================================

const medicineOrderSchema = new mongoose.Schema(
  {
    // ===========================
    // USER
    // ===========================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ===========================
    // PHARMACY
    // ===========================

    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PharmacyUser",
      default: null,
      index: true,
    },

    // ===========================
    // RIDER
    // ===========================

    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },

    // ===========================
    // ORDER ITEMS
    // ===========================

    items: {
      type: [orderItemSchema],
      default: [],
    },

    inventoryAdjusted: {
      type: Boolean,
      default: false,
    },

    // ===========================
    // TOTAL
    // ===========================

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ===========================
    // DELIVERY ADDRESS
    // ===========================

    deliveryAddress: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    // ===========================
    // PAYMENT
    // ===========================

    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE", "WALLET"],
      default: "COD",
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },

    // ===========================
    // ORDER STATUS
    // ===========================

    orderStatus: {
      type: String,
      enum: [
        "PLACED",
        "CONFIRMED",
        "PACKED",
        "PICKED_UP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PLACED",
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Packed",
        "Out For Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },

    // ===========================
    // MANAGEMENT STATUS
    // ===========================

    pharmacyStatus: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Rejected",
      ],
      default: "Pending",
    },

    // ===========================
    // DELIVERY STATUS
    // ===========================

    deliveryStatus: {
      type: String,
      enum: [
        "Pending",
        "Assigned",
        "Picked Up",
        "Out For Delivery",
        "Delivered",
      ],
      default: "Pending",
    },

    // ===========================
    // OTP
    // ===========================

    deliveryOTP: {
      type: String,
      default: "",
    },

    // ===========================
    // RAZORPAY
    // ===========================

    razorpayOrderId: {
      type: String,
      default: "",
    },

    razorpayPaymentId: {
      type: String,
      default: "",
    },

    razorpaySignature: {
      type: String,
      default: "",
    },

    // ===========================
    // TIMELINE
    // ===========================

    acceptedAt: Date,

    packedAt: Date,

    pickedUpAt: Date,

    outForDeliveryAt: Date,

    deliveredAt: Date,

    cancelledAt: Date,

    paidAt: Date,

    // ===========================
    // COMPLETED
    // ===========================

    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.MedicineOrder ||
  mongoose.model("MedicineOrder", medicineOrderSchema);