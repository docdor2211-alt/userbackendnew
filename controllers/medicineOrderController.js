// controllers/medicineOrderController.js

const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const MedicineOrder = require("../models/medicineOrderModel");

const {
  debitWallet,
  creditWallet,
} = require("../services/walletService");

const {
  parseNonNegativeNumber,
  reserveInventory,
  releaseInventory,
  emitStockUpdated,
} = require("../utils/pharmacyInventorySync");

const getRazorpayClient = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

const VALID_PAYMENT_METHODS = ["COD", "WALLET", "ONLINE"];

// ==========================================
// CREATE MEDICINE ORDER
// ==========================================

exports.createMedicineOrder = async (req, res) => {
  let reservedItems = [];
  let orderPharmacyId = null;
  let walletDebited = false;
  let debitedUserId = null;
  let debitedAmount = 0;
  let adminCredited = false;
  let adminCreditedId = null;

  try {
    const {
      user: bodyUser,
      pharmacy: bodyPharmacy,
      pharmacyId: bodyPharmacyId,
      items,
      totalAmount,
      paymentMethod = "COD",
      deliveryAddress,
    } = req.body;

    const userId = req.user?._id || bodyUser;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are required",
      });
    }

    if (!deliveryAddress || !String(deliveryAddress).trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required",
      });
    }

    const normalizedPaymentMethod = String(paymentMethod || "COD")
      .trim()
      .toUpperCase();
    if (!VALID_PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const rawPharmacyId = bodyPharmacy || bodyPharmacyId || null;
    if (rawPharmacyId && !mongoose.Types.ObjectId.isValid(rawPharmacyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pharmacy ID",
      });
    }
    orderPharmacyId = rawPharmacyId || null;

    if (totalAmount !== undefined) {
      const parsedInputTotal = parseNonNegativeNumber(totalAmount);
      if (parsedInputTotal === null) {
        return res.status(400).json({
          success: false,
          message: "Total amount must be a valid non-negative number",
        });
      }
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
      if (item?.totalPrice !== undefined) {
        const parsedLineTotal = parseNonNegativeNumber(item.totalPrice);
        if (parsedLineTotal === null) {
          return res.status(400).json({
            success: false,
            message: "Item totalPrice must be a valid non-negative number",
          });
        }
      }
    }

    reservedItems = await reserveInventory(orderPharmacyId, items);

    const pharmacyIds = [
      ...new Set(
        reservedItems.map((it) => it.pharmacy?.toString()).filter(Boolean)
      ),
    ];
    const resolvedPharmacyId =
      orderPharmacyId || (pharmacyIds.length === 1 ? pharmacyIds[0] : null);
    orderPharmacyId = resolvedPharmacyId;

    const computedTotal =
      Math.round(
        reservedItems.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0) * 100
      ) / 100;
    const requestedTotal =
      totalAmount !== undefined ? parseNonNegativeNumber(totalAmount) : null;
    const parsedTotal =
      requestedTotal !== null && (requestedTotal > 0 || computedTotal === 0)
        ? requestedTotal
        : computedTotal;

    const trimmedAddress = String(deliveryAddress).trim();

    // ==========================================
    // COD ORDER
    // ==========================================

    if (normalizedPaymentMethod === "COD") {
      const order = await MedicineOrder.create({
        user: userId,
        pharmacy: resolvedPharmacyId,
        items: reservedItems,
        inventoryAdjusted: reservedItems.length > 0,
        totalAmount: parsedTotal,
        total: parsedTotal,
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        deliveryAddress: trimmedAddress,
        address: trimmedAddress,
        orderStatus: "PLACED",
        status: "Pending",
        pharmacyStatus: "Pending",
        deliveryStatus: "Pending",
      });

      emitStockUpdated(req, {
        source: "medicine_order_created",
        orderId: order._id.toString(),
        pharmacyId: resolvedPharmacyId ? resolvedPharmacyId.toString() : null,
      });

      return res.status(201).json({
        success: true,
        message: "COD Order Placed Successfully",
        order,
        data: order,
      });
    }

    // ==========================================
    // WALLET ORDER
    // ==========================================

    if (normalizedPaymentMethod === "WALLET") {
      try {
        await debitWallet({
          userId,
          amount: parsedTotal,
          title: "Medicine Order",
          subtitle: "Wallet Payment",
        });
        walletDebited = true;
        debitedUserId = userId;
        debitedAmount = parsedTotal;
      } catch (walletErr) {
        walletErr.statusCode = 400;
        throw walletErr;
      }

      if (process.env.ADMIN_ID) {
        try {
          await creditWallet({
            userId: process.env.ADMIN_ID,
            amount: parsedTotal,
            title: "Medicine Sale",
            subtitle: "Wallet Received",
          });
          adminCredited = true;
          adminCreditedId = process.env.ADMIN_ID;
        } catch (adminWalletErr) {
          console.warn(
            "ADMIN WALLET CREDIT SKIPPED:",
            adminWalletErr.message
          );
        }
      }

      const order = await MedicineOrder.create({
        user: userId,
        pharmacy: resolvedPharmacyId,
        items: reservedItems,
        inventoryAdjusted: reservedItems.length > 0,
        totalAmount: parsedTotal,
        total: parsedTotal,
        paymentMethod: "WALLET",
        paymentStatus: "PAID",
        deliveryAddress: trimmedAddress,
        address: trimmedAddress,
        orderStatus: "CONFIRMED",
        status: "Accepted",
        pharmacyStatus: "Accepted",
        deliveryStatus: "Pending",
        acceptedAt: new Date(),
        paidAt: new Date(),
      });

      emitStockUpdated(req, {
        source: "medicine_order_created",
        orderId: order._id.toString(),
        pharmacyId: resolvedPharmacyId ? resolvedPharmacyId.toString() : null,
      });

      return res.status(201).json({
        success: true,
        message: "Wallet Payment Successful",
        order,
        data: order,
      });
    }

    // ==========================================
    // ONLINE PAYMENT
    // ==========================================

    const razorpay = getRazorpayClient();
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(parsedTotal * 100),
      currency: "INR",
      receipt: `MED-${Date.now()}`,
    });

    const order = await MedicineOrder.create({
      user: userId,
      pharmacy: resolvedPharmacyId,
      items: reservedItems,
      inventoryAdjusted: reservedItems.length > 0,
      totalAmount: parsedTotal,
      total: parsedTotal,
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      deliveryAddress: trimmedAddress,
      address: trimmedAddress,
      razorpayOrderId: razorpayOrder.id,
      orderStatus: "PLACED",
      status: "Pending",
      pharmacyStatus: "Pending",
      deliveryStatus: "Pending",
    });

    emitStockUpdated(req, {
      source: "medicine_order_created",
      orderId: order._id.toString(),
      pharmacyId: resolvedPharmacyId ? resolvedPharmacyId.toString() : null,
    });

    return res.status(201).json({
      success: true,
      message: "Razorpay Order Created",
      order,
      data: order,
      razorpayOrder,
    });
  } catch (error) {
    if (adminCredited && adminCreditedId && debitedAmount > 0) {
      try {
        await debitWallet({
          userId: adminCreditedId,
          amount: debitedAmount,
          title: "Medicine Sale Reversal",
          subtitle: "Order creation failed",
        });
      } catch (adminRollbackErr) {
        console.error("ADMIN WALLET ROLLBACK ERROR:", adminRollbackErr);
      }
    }

    if (walletDebited && debitedUserId && debitedAmount > 0) {
      try {
        await creditWallet({
          userId: debitedUserId,
          amount: debitedAmount,
          title: "Medicine Order Refund",
          subtitle: "Order creation failed",
        });
      } catch (refundErr) {
        console.error("WALLET ROLLBACK ERROR:", refundErr);
      }
    }

    if (reservedItems.length > 0) {
      try {
        await releaseInventory(orderPharmacyId, reservedItems);
      } catch (releaseErr) {
        console.error("INVENTORY ROLLBACK ERROR:", releaseErr);
      }
    }

    return res.status(error.statusCode || 500).json({
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
// VERIFY PAYMENT
// ==========================================

exports.verifyMedicinePayment = async (req, res) => {
  let newlyReserved = null;
  let existingOrder = null;

  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const targetOrderId = orderId || req.body.order_id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Razorpay order ID, payment ID and signature are required",
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid Payment Signature",
      });
    }

    const filter = {};
    if (targetOrderId) {
      if (!mongoose.Types.ObjectId.isValid(targetOrderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID",
        });
      }
      filter._id = targetOrderId;
    } else {
      filter.razorpayOrderId = razorpay_order_id;
    }

    existingOrder = await MedicineOrder.findOne(filter);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found to verify",
      });
    }

    if (
      existingOrder.orderStatus === "CANCELLED" ||
      existingOrder.status === "Cancelled"
    ) {
      return res.status(409).json({
        success: false,
        message: "Cannot verify payment for a cancelled order",
      });
    }

    if (existingOrder.paymentStatus === "PAID") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        order: existingOrder,
        data: existingOrder,
      });
    }

    const updatePayload = {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
      status: "Accepted",
      pharmacyStatus: "Accepted",
      acceptedAt: new Date(),
      paidAt: new Date(),
    };

    if (!existingOrder.inventoryAdjusted && existingOrder.items?.length > 0) {
      newlyReserved = await reserveInventory(
        existingOrder.pharmacy,
        existingOrder.items
      );
      updatePayload.items = newlyReserved;
      updatePayload.inventoryAdjusted = true;
    }

    const order = await MedicineOrder.findOneAndUpdate(
      {
        _id: existingOrder._id,
        paymentStatus: { $ne: "PAID" },
        orderStatus: { $ne: "CANCELLED" },
      },
      { $set: updatePayload },
      { new: true }
    );

    if (!order) {
      if (newlyReserved?.length) {
        await releaseInventory(existingOrder.pharmacy, newlyReserved);
      }
      return res.status(409).json({
        success: false,
        message: "Order status changed during payment verification",
      });
    }

    if (newlyReserved?.length) {
      emitStockUpdated(req, {
        source: "medicine_payment_verified",
        orderId: order._id.toString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order,
      data: order,
    });
  } catch (error) {
    if (newlyReserved?.length && existingOrder) {
      try {
        await releaseInventory(existingOrder.pharmacy, newlyReserved);
      } catch (_) {}
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
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
// GET ALL MEDICINE ORDERS (ADMIN)
// ==========================================

exports.getAllMedicineOrders = async (req, res) => {
  try {
    const orders = await MedicineOrder.find()
      .populate("user", "name email phone")
      .populate("rider", "name phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET MY ORDERS (USER)
// ==========================================

exports.getMyMedicineOrders = async (req, res) => {
  try {
    const orders = await MedicineOrder.find({
      user: req.user._id,
    })
      .populate("rider", "name phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET SINGLE ORDER / USER ORDERS
// (Supports GET /medicine-orders/:userId & :orderId)
// ==========================================

exports.getSingleMedicineOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Check if ID is a user in User collection
    const User = require("../models/userModel");
    const isUser = await User.exists({ _id: id });

    if (isUser) {
      const orders = await MedicineOrder.find({ user: id })
        .populate("user", "name email phone")
        .populate("rider", "name phone")
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: orders.length,
        data: orders,
      });
    }

    // Otherwise check for single order by _id
    const order = await MedicineOrder.findById(id)
      .populate("user", "name email phone")
      .populate("rider", "name phone");

    if (order) {
      return res.status(200).json({
        success: true,
        data: order,
        order,
      });
    }

    // If order not found, check if any orders exist for this user ID
    const userOrders = await MedicineOrder.find({ user: id })
      .populate("user", "name email phone")
      .populate("rider", "name phone")
      .sort({ createdAt: -1 });

    if (userOrders.length > 0) {
      return res.status(200).json({
        success: true,
        count: userOrders.length,
        data: userOrders,
      });
    }

    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET ORDERS BY USER ID (EXPLICIT)
// ==========================================

exports.getOrdersByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const orders = await MedicineOrder.find({ user: userId })
      .populate("user", "name email phone")
      .populate("rider", "name phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// UPDATE ORDER STATUS
// ==========================================

exports.updateMedicineOrderStatus = async (req, res) => {
  let newlyReserved = null;
  let orderPharmacyId = null;

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const { status } = req.body;

    const validStatus = [
      "CONFIRMED",
      "PACKED",
      "CANCELLED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ];

    if (!validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order Status",
      });
    }

    const existing = await MedicineOrder.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      existing.orderStatus === "CANCELLED" ||
      existing.status === "Cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cancelled order status cannot be updated",
      });
    }

    if (
      (existing.orderStatus === "DELIVERED" ||
        existing.status === "Delivered") &&
      status === "CANCELLED"
    ) {
      return res.status(400).json({
        success: false,
        message: "Delivered order cannot be cancelled",
      });
    }

    if (status === "CANCELLED") {
      const claimed = await MedicineOrder.findOneAndUpdate(
        {
          _id: existing._id,
          orderStatus: { $nin: ["DELIVERED", "CANCELLED"] },
        },
        {
          $set: {
            orderStatus: "CANCELLED",
            status: "Cancelled",
            pharmacyStatus: "Rejected",
            cancelledAt: new Date(),
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
          source: "medicine_order_cancelled",
          orderId: claimed._id.toString(),
          pharmacyId: claimed.pharmacy ? claimed.pharmacy.toString() : null,
        });
      }

      const updatedOrder = await MedicineOrder.findById(claimed._id);
      return res.status(200).json({
        success: true,
        message: "Order Status Updated Successfully",
        data: updatedOrder,
      });
    }

    // Reserve stock if legacy order had not yet reserved inventory
    orderPharmacyId = existing.pharmacy || null;
    const statusUpdateFields = {
      orderStatus: status,
    };
    if (!existing.inventoryAdjusted && existing.items?.length > 0) {
      newlyReserved = await reserveInventory(
        existing.pharmacy,
        existing.items
      );
      statusUpdateFields.items = newlyReserved;
      statusUpdateFields.inventoryAdjusted = true;
    }

    switch (status) {
      case "CONFIRMED":
        statusUpdateFields.status = "Accepted";
        statusUpdateFields.pharmacyStatus = "Accepted";
        statusUpdateFields.acceptedAt = new Date();
        break;

      case "PACKED":
        statusUpdateFields.status = "Packed";
        statusUpdateFields.packedAt = new Date();
        break;

      case "PICKED_UP":
        statusUpdateFields.deliveryStatus = "Picked Up";
        statusUpdateFields.pickedUpAt = new Date();
        break;

      case "OUT_FOR_DELIVERY":
        statusUpdateFields.status = "Out For Delivery";
        statusUpdateFields.deliveryStatus = "Out For Delivery";
        statusUpdateFields.outForDeliveryAt = new Date();
        break;

      case "DELIVERED":
        statusUpdateFields.status = "Delivered";
        statusUpdateFields.deliveryStatus = "Delivered";
        statusUpdateFields.deliveredAt = new Date();
        statusUpdateFields.isCompleted = true;
        break;
    }

    const updatedOrder = await MedicineOrder.findOneAndUpdate(
      {
        _id: existing._id,
        orderStatus: { $nin: ["CANCELLED", "DELIVERED"] },
        status: { $nin: ["Cancelled", "Delivered"] },
        ...(newlyReserved ? { inventoryAdjusted: { $ne: true } } : {}),
      },
      { $set: statusUpdateFields },
      { new: true }
    );

    if (!updatedOrder) {
      if (newlyReserved?.length) {
        await releaseInventory(orderPharmacyId, newlyReserved);
        newlyReserved = null;
      }
      return res.status(409).json({
        success: false,
        message: "Order state changed concurrently; status could not be updated",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order Status Updated Successfully",
      data: updatedOrder,
    });
  } catch (error) {
    if (newlyReserved?.length) {
      try {
        await releaseInventory(orderPharmacyId, newlyReserved);
      } catch (_) {}
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  }
};

// ==========================================
// ASSIGN RIDER
// ==========================================

exports.assignRider = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const { riderId } = req.body;

    const order = await MedicineOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus === "CANCELLED" || order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot assign rider to a cancelled order",
      });
    }

    order.rider = riderId;
    order.deliveryStatus = "Assigned";

    await order.save();

    res.status(200).json({
      success: true,
      message: "Rider Assigned Successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// RIDER ACCEPT ORDER
// ==========================================

exports.riderAcceptOrder = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await MedicineOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus === "CANCELLED" || order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled order cannot be accepted",
      });
    }

    order.rider = req.user._id;
    order.deliveryStatus = "Assigned";

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order Accepted Successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// PICKUP ORDER
// ==========================================

exports.pickupOrder = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await MedicineOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus === "CANCELLED" || order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled order cannot be picked up",
      });
    }

    order.orderStatus = "PICKED_UP";
    order.deliveryStatus = "Picked Up";
    order.pickedUpAt = new Date();

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order Picked Successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// OUT FOR DELIVERY
// ==========================================

exports.outForDelivery = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await MedicineOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus === "CANCELLED" || order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled order cannot move out for delivery",
      });
    }

    order.orderStatus = "OUT_FOR_DELIVERY";
    order.status = "Out For Delivery";
    order.deliveryStatus = "Out For Delivery";
    order.outForDeliveryAt = new Date();

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order Out For Delivery",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// DELIVERED
// ==========================================

exports.deliveredOrder = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await MedicineOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus === "CANCELLED" || order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled order cannot be marked delivered",
      });
    }

    order.orderStatus = "DELIVERED";
    order.status = "Delivered";
    order.deliveryStatus = "Delivered";
    order.deliveredAt = new Date();
    order.isCompleted = true;

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order Delivered Successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// CANCEL ORDER
// ==========================================

exports.cancelOrder = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const existing = await MedicineOrder.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      req.user &&
      req.user.role !== "admin" &&
      existing.user?.toString() !== req.user._id?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this order",
      });
    }

    if (
      existing.orderStatus === "DELIVERED" ||
      existing.status === "Delivered"
    ) {
      return res.status(400).json({
        success: false,
        message: "Delivered order cannot be cancelled",
      });
    }

    if (
      existing.orderStatus === "CANCELLED" ||
      existing.status === "Cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    const claimed = await MedicineOrder.findOneAndUpdate(
      {
        _id: existing._id,
        orderStatus: { $nin: ["DELIVERED", "CANCELLED"] },
        status: { $nin: ["Delivered", "Cancelled"] },
      },
      {
        $set: {
          orderStatus: "CANCELLED",
          status: "Cancelled",
          pharmacyStatus: "Rejected",
          cancelledAt: new Date(),
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
        source: "medicine_order_cancelled",
        orderId: claimed._id.toString(),
        pharmacyId: claimed.pharmacy ? claimed.pharmacy.toString() : null,
      });
    }

    const updatedOrder = await MedicineOrder.findById(claimed._id);

    res.status(200).json({
      success: true,
      message: "Order Cancelled Successfully",
      data: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// DELETE ORDER
// ==========================================

exports.deleteMedicineOrder = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await MedicineOrder.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.inventoryAdjusted &&
      order.orderStatus !== "CANCELLED" &&
      order.status !== "Cancelled"
    ) {
      await releaseInventory(order.pharmacy, order.items);
      emitStockUpdated(req, {
        source: "medicine_order_deleted",
        orderId: order._id.toString(),
        pharmacyId: order.pharmacy ? order.pharmacy.toString() : null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Order Deleted Successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
