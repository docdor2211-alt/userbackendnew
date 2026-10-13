// // // routes/medicineOrderRoutes.js

// // const express = require("express");

// // const router = express.Router();

// // const {
// //   createMedicineOrder,
// //   verifyMedicinePayment,
// //   getAllMedicineOrders,
// //   getSingleMedicineOrder,
// // } = require("../controllers/medicineOrderController");

// // router.post(
// //   "/create",
// //    protect,
// //   userOnly,
// //   createMedicineOrder
// // );

// // router.post(
// //   "/verify-payment",
// //   verifyMedicinePayment
// // );

// // router.get(
// //   "/all",
// //   getAllMedicineOrders
// // );

// // router.get(
// //   "/:id",
// //   getSingleMedicineOrder
// // );

// // module.exports = router;


// // routes/medicineOrderRoutes.js

// const express = require("express");

// const router = express.Router();

// const {

//   createMedicineOrder,

//   verifyMedicinePayment,

//   getAllMedicineOrders,

//   getSingleMedicineOrder,
//   getMyMedicineOrders,

// } = require("../controllers/medicineOrderController");


// // =========================
// // AUTH MIDDLEWARE
// // =========================

// const {

//   protect,

//   adminOnly,

//   userOnly,

// } = require("../middleware/authMiddleware");



// // ======================================================
// // 👤 USER ROUTES
// // ======================================================


// // ✅ CREATE ORDER
// router.post(
//   "/create",
//   protect,
//   userOnly,
//   createMedicineOrder
// );


// // ✅ VERIFY PAYMENT
// router.post(
//   "/verify-payment",
//   protect,
//   userOnly,
//   verifyMedicinePayment
// );
// // ✅ GET ALL ORDERS
// router.get(
//   "/all",
//   protect,
//   adminOnly,
//   getAllMedicineOrders
// );
// // ✅ GET MY ORDERS
// router.get(
//   "/my-orders",
//   protect,
//   userOnly,
//   getMyMedicineOrders
// );

// // ✅ GET SINGLE ORDER
// router.get(
//   "/:id",
//   protect,
//   getSingleMedicineOrder
// );



// // ======================================================
// // 👑 ADMIN ROUTES
// // ======================================================


// // ✅ GET ALL ORDERS
// // router.get(
// //   "/all",
// //   protect,
// //   adminOnly,
// //   getAllMedicineOrders
// // );



// // ======================================================
// // EXPORT
// // ======================================================

// module.exports = router;



// routes/medicineOrderRoutes.js

const express =
  require("express");

const router =
  express.Router();

// ==========================================
// CONTROLLERS
// ==========================================

const {
  createMedicineOrder,
  verifyMedicinePayment,
  getAllMedicineOrders,
  getSingleMedicineOrder,
  getMyMedicineOrders,
  getOrdersByUserId,
  updateMedicineOrderStatus,
} = require(
  "../controllers/medicineOrderController"
);

// ==========================================
// AUTH MIDDLEWARE
// ==========================================

const {
  protect,
  adminOnly,
  userOnly,
} = require(
  "../middleware/authMiddleware"
);

// Middleware supporting token or body user
const userAuthOrBody = (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return protect(req, res, () => {
      userOnly(req, res, next);
    });
  }
  if (req.body.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: "Not authorized, token or user missing",
  });
};

const verifyAuth = (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return protect(req, res, next);
  }
  if (req.body.orderId || req.body.order_id || req.body.razorpay_order_id) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: "Not authorized, token missing",
  });
};

const optionalAuth = (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return protect(req, res, next);
  }
  next();
};

// ======================================================
// 👤 USER ROUTES
// ======================================================

// ==========================================
// CREATE ORDER
// ==========================================
router.post(
  "/create",
  userAuthOrBody,
  createMedicineOrder
);

// ==========================================
// VERIFY PAYMENT
// ==========================================
router.post(
  "/verify-payment",
  verifyAuth,
  verifyMedicinePayment
);

// ==========================================
// GET MY ORDERS
// ==========================================
router.get(
  "/my-orders",
  protect,
  userOnly,
  getMyMedicineOrders
);

// ==========================================
// GET ALL ORDERS (ADMIN)
// ==========================================
router.get(
  "/all",
  protect,
  adminOnly,
  getAllMedicineOrders
);

// ==========================================
// GET USER ORDERS (EXPLICIT)
// ==========================================
router.get(
  "/user/:userId",
  optionalAuth,
  getOrdersByUserId
);

// ==========================================
// GET SINGLE ORDER OR USER ORDERS BY ID
// ==========================================
router.get(
  "/:id",
  optionalAuth,
  getSingleMedicineOrder
);


// ======================================================
// 👑 ADMIN ROUTES
// ======================================================




// ==========================================
// UPDATE ORDER STATUS
// ==========================================

router.put(
  "/update-status/:id",

  protect,

  adminOnly,

  updateMedicineOrderStatus
);


// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports =
  router;