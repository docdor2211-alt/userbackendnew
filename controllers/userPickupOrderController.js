const mongoose = require("mongoose");
const PickupOrder = require("../models/userPickupOrderModel");
const PharmacyUser = require("../models/PharmacyUser");
const {
  parseNonNegativeNumber,
  reserveInventory,
  releaseInventory,
  emitStockUpdated,
} = require("../utils/pharmacyInventorySync");

// ==========================================
// CREATE USER PICKUP ORDER
// ==========================================

const createUserPickupOrder = async (req, res) => {
  let reservedItems = [];
  let validatedPharmacyId = null;

  try {
    const {
      pharmacy,
      customerName,
      customerPhone,
      pickupTime,
      items,
      totalAmount,
      address,
    } = req.body;

    // =========================
    // USER AUTH CHECK
    // =========================

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!pharmacy || !mongoose.Types.ObjectId.isValid(pharmacy)) {
      return res.status(400).json({
        success: false,
        message: "Valid pharmacy ID is required",
      });
    }
    validatedPharmacyId = pharmacy;

    const pharmacyExists = await PharmacyUser.exists({ _id: pharmacy });
    if (!pharmacyExists) {
      return res.status(404).json({
        success: false,
        message: "Pharmacy not found",
      });
    }

    if (
      !customerName?.trim() ||
      !customerPhone?.trim() ||
      !pickupTime?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer name, phone and pickup time are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one pickup item is required",
      });
    }

    for (const item of items) {
      if (item?.price !== undefined) {
        const parsedPrice = parseNonNegativeNumber(item.price);
        if (parsedPrice === null) {
          return res.status(400).json({
            success: false,
            message: "Item price must be a valid non-negative number",
          });
        }
      }
    }

    if (totalAmount !== undefined) {
      const parsedTotal = parseNonNegativeNumber(totalAmount);
      if (parsedTotal === null) {
        return res.status(400).json({
          success: false,
          message: "Total amount must be a valid non-negative number",
        });
      }
    }

    // =========================
    // RESERVE INVENTORY ATOMICALLY
    // =========================

    reservedItems = await reserveInventory(pharmacy, items);

    const computedTotal =
      Math.round(
        reservedItems.reduce(
          (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
          0
        ) * 100
      ) / 100;
    const requestedTotal =
      totalAmount !== undefined ? parseNonNegativeNumber(totalAmount) : null;
    const finalTotal =
      requestedTotal !== null && (requestedTotal > 0 || computedTotal === 0)
        ? requestedTotal
        : computedTotal;

    // =========================
    // GENERATE ORDER ID
    // =========================

    const orderId = "ORD-" + Date.now();

    // =========================
    // CREATE ORDER
    // =========================

    const order = await PickupOrder.create({
      user: req.user._id,
      pharmacy,
      orderId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      pickupTime: pickupTime.trim(),
      items: reservedItems,
      inventoryAdjusted: reservedItems.length > 0,
      totalAmount: finalTotal,
      address: address ? String(address).trim() : "",
      status: "pending",
    });

    emitStockUpdated(req, {
      source: "pickup_order_created",
      orderId: order._id.toString(),
      pharmacyId: pharmacy.toString(),
    });

    res.status(201).json({
      success: true,
      message: "Pickup order created successfully",
      data: order,
    });
  } catch (error) {
    if (reservedItems.length > 0) {
      try {
        await releaseInventory(validatedPharmacyId, reservedItems);
      } catch (releaseErr) {
        console.error("PICKUP INVENTORY ROLLBACK ERROR:", releaseErr);
      }
    }

    console.log("CREATE ORDER ERROR:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.productId ? { productId: error.productId } : {}),
      ...(error.availableStock !== undefined
        ? { availableStock: error.availableStock }
        : {}),
      ...(error.requestedQuantity !== undefined
        ? { requestedQuantity: error.requestedQuantity }
        : {}),
    });
  }
};

// ==========================================
// GET USER ORDERS
// ==========================================

const getUserOrders = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const orders = await PickupOrder.find({
      user: req.user._id,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      total: orders.length,
      data: orders,
    });
  } catch (error) {
    console.log("GET USER ORDERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET SINGLE USER ORDER
// ==========================================

const getSingleUserOrder = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await PickupOrder.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.log("GET SINGLE ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// CANCEL USER ORDER
// ==========================================

const cancelUserOrder = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const existing = await PickupOrder.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (existing.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed order cannot be cancelled",
      });
    }

    if (existing.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    const claimed = await PickupOrder.findOneAndUpdate(
      {
        _id: existing._id,
        user: req.user._id,
        status: { $nin: ["completed", "cancelled"] },
      },
      {
        $set: {
          status: "cancelled",
          inventoryAdjusted: false,
        },
      },
      { new: false }
    );

    if (!claimed) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled in its current state",
      });
    }

    if (claimed.inventoryAdjusted) {
      await releaseInventory(claimed.pharmacy, claimed.items);
      emitStockUpdated(req, {
        source: "pickup_order_cancelled",
        orderId: claimed._id.toString(),
        pharmacyId: claimed.pharmacy ? claimed.pharmacy.toString() : null,
      });
    }

    const updatedOrder = await PickupOrder.findById(claimed._id);

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.log("CANCEL ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createUserPickupOrder,
  getUserOrders,
  getSingleUserOrder,
  cancelUserOrder,
};
