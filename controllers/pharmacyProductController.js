const mongoose = require("mongoose");
const PharmacyProduct = require("../models/pharmacyProductModel");
require("../models/PharmacyUser");
const { formatPharmacyProduct } = require("../utils/pharmacyInventorySync");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildProductQuery = (req, forcedPharmacyId = null) => {
  const query = {};
  const rawPharmacyId =
    forcedPharmacyId || req.query.pharmacy || req.query.pharmacyId || "";

  if (rawPharmacyId) {
    if (!mongoose.Types.ObjectId.isValid(rawPharmacyId)) {
      const error = new Error("Invalid pharmacy ID");
      error.statusCode = 400;
      throw error;
    }
    query.pharmacy = rawPharmacyId;
  }

  if (req.query.category) {
    query.category = new RegExp(
      `^${escapeRegex(String(req.query.category).trim())}$`,
      "i"
    );
  }

  if (req.query.brand) {
    query.brand = new RegExp(
      escapeRegex(String(req.query.brand).trim()),
      "i"
    );
  }

  if (req.query.search) {
    const searchRegex = new RegExp(
      escapeRegex(String(req.query.search).trim()),
      "i"
    );
    query.$or = [
      { productTitle: searchRegex },
      { brand: searchRegex },
      { category: searchRegex },
      { description: searchRegex },
    ];
  }

  const inStockParam = String(req.query.inStock || "").toLowerCase();
  const hideOutOfStock =
    String(
      req.query.hideOutOfStock || req.query.excludeOutOfStock || ""
    ).toLowerCase() === "true";

  if (inStockParam === "true" || hideOutOfStock) {
    query.stock = { $gt: 0 };
  } else if (inStockParam === "false") {
    query.stock = { $lte: 0 };
  }

  return query;
};

exports.getPharmacyProducts = async (req, res) => {
  try {
    const query = buildProductQuery(req);
    const total = await PharmacyProduct.countDocuments(query);

    const hasLimit = Boolean(req.query.limit);
    const hasPage = Boolean(req.query.page);

    let findQuery = PharmacyProduct.find(query)
      .populate("pharmacy", "name phone licenseNumber rating")
      .sort({ createdAt: -1 });

    let page = 1;
    let limit = total;

    if (hasLimit || hasPage) {
      page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
      findQuery = findQuery.skip((page - 1) * limit).limit(limit);
    }

    const products = await findQuery.lean();
    const formatted = products.map(formatPharmacyProduct);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalProducts: total,
      data: formatted,
    });
  } catch (error) {
    console.error("GET USER PHARMACY PRODUCTS ERROR:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProductsByPharmacy = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const query = buildProductQuery(req, pharmacyId);
    const total = await PharmacyProduct.countDocuments(query);

    const hasLimit = Boolean(req.query.limit);
    const hasPage = Boolean(req.query.page);

    let findQuery = PharmacyProduct.find(query)
      .populate("pharmacy", "name phone licenseNumber rating")
      .sort({ createdAt: -1 });

    let page = 1;
    let limit = total;

    if (hasLimit || hasPage) {
      page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
      findQuery = findQuery.skip((page - 1) * limit).limit(limit);
    }

    const products = await findQuery.lean();
    const formatted = products.map(formatPharmacyProduct);

    return res.status(200).json({
      success: true,
      pharmacyId,
      page,
      limit,
      total,
      totalProducts: total,
      data: formatted,
    });
  } catch (error) {
    console.error("GET PHARMACY PRODUCTS BY PHARMACY ERROR:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSinglePharmacyProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await PharmacyProduct.findById(id)
      .populate("pharmacy", "name phone licenseNumber rating")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: formatPharmacyProduct(product),
    });
  } catch (error) {
    console.error("GET SINGLE USER PHARMACY PRODUCT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
