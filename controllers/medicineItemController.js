const mongoose = require("mongoose");
const MedicineItem = require("../models/medicineItem.model");
require("../models/medicineSubCategory.model");
const PharmacyProduct = require("../models/pharmacyProductModel");
const { uploadFile, deleteFile } = require("../utils/bunnyUpload");
const {
  parseNonNegativeInt,
  parsePositiveInt,
  parseNonNegativeNumber,
  buildStockMeta,
  enrichMedicineItemsWithLiveStock,
  emitStockUpdated,
} = require("../utils/pharmacyInventorySync");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ============================================
// 🛠️ HELPER: FORMAT MEDICINE ITEM
// ============================================
function formatMedicineItem(item) {
  if (!item) return null;
  const doc = item.toObject ? item.toObject() : item;

  const newPrice = doc.newPrice ?? doc.price ?? doc.mrp ?? 0;
  const oldPrice =
    doc.oldPrice ??
    doc.originalPrice ??
    (doc.price && doc.price > newPrice ? doc.price : newPrice);

  let discount = doc.discount || "";
  if (!discount && oldPrice > newPrice && oldPrice > 0 && newPrice > 0) {
    const pct = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
    if (pct > 0) {
      discount = `${pct}% OFF`;
    }
  }

  const imageUrl =
    doc.imageUrl ||
    (typeof doc.image === "string" ? doc.image : doc.image?.url || "");
  const image =
    doc.image ||
    (imageUrl
      ? { url: imageUrl, publicId: "" }
      : { url: "", publicId: "" });

  const subCatId = (
    doc.subCategoryId?._id ||
    doc.subCategoryId ||
    doc.medicineSubCategory?._id ||
    doc.medicineSubCategory ||
    ""
  ).toString();

  const resolvedTitle = (
    doc.name ||
    doc.productTitle ||
    doc.description ||
    ""
  ).trim();
  const description = (doc.description || resolvedTitle).trim();
  const name = resolvedTitle;
  const stockMeta = buildStockMeta(doc.stock, doc.lowStockThreshold);

  return {
    _id: doc._id?.toString() || "",
    id: doc._id?.toString() || "",
    pharmacy: doc.pharmacy || null,
    pharmacyProduct: doc.pharmacyProduct || null,
    name,
    productTitle: (doc.productTitle || resolvedTitle).trim(),
    description,
    type: doc.type || "Strip of tablets",
    delivery: doc.delivery || "Delivery by Tomorrow 9 PM",
    newPrice,
    oldPrice,
    price: newPrice,
    mrp: oldPrice,
    originalPrice: oldPrice,
    discount,
    prescription: Boolean(doc.prescription),
    imageUrl,
    image,
    subCategoryId: subCatId,
    medicineSubCategory: doc.medicineSubCategory || subCatId,
    medicineItems: Array.isArray(doc.medicineItems) ? doc.medicineItems : [],
    quantity: typeof doc.quantity === "number" ? doc.quantity : 1,
    ...stockMeta,
    isActive: doc.isActive !== undefined ? doc.isActive : true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ============================================
// ✅ CREATE MEDICINE
// ============================================
exports.createMedicine = async (req, res) => {
  try {
    const {
      pharmacy,
      pharmacyProduct,
      medicineCategory,
      medicineSubCategory,
      subCategoryId,
      name,
      productTitle,
      description,
      type,
      delivery,
      price,
      newPrice,
      oldPrice,
      mrp,
      originalPrice,
      discount,
      prescription,
      imageUrl,
      medicineItems,
      quantity,
      stock,
      lowStockThreshold,
      isActive,
    } = req.body;

    if (pharmacy && !mongoose.Types.ObjectId.isValid(pharmacy)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pharmacy ID",
      });
    }

    let linkedPharmacyProduct = null;
    if (pharmacyProduct) {
      if (!mongoose.Types.ObjectId.isValid(pharmacyProduct)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pharmacyProduct ID",
        });
      }
      linkedPharmacyProduct = await PharmacyProduct.findById(pharmacyProduct);
      if (!linkedPharmacyProduct) {
        return res.status(404).json({
          success: false,
          message: "Linked pharmacy product not found",
        });
      }
    }

    const targetSubCategory = medicineSubCategory || subCategoryId;
    const displayName = (name || productTitle || description || "").trim();
    const rawSellingPrice = newPrice ?? price ?? mrp ?? 0;
    const sellingPrice = parseNonNegativeNumber(rawSellingPrice);
    const rawRegularPrice = oldPrice ?? originalPrice ?? sellingPrice ?? 0;
    const regularPrice = parseNonNegativeNumber(rawRegularPrice);

    if (!displayName) {
      return res.status(400).json({
        success: false,
        message: "Medicine name or description is required",
      });
    }

    if (sellingPrice === null || regularPrice === null) {
      return res.status(400).json({
        success: false,
        message: "Valid non-negative price and MRP are required",
      });
    }

    let validatedQuantity = 1;
    if (quantity !== undefined) {
      validatedQuantity = parsePositiveInt(quantity);
      if (validatedQuantity === null) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be a positive whole number",
        });
      }
    }

    let validatedStock = linkedPharmacyProduct ? linkedPharmacyProduct.stock : 0;
    if (stock !== undefined) {
      validatedStock = parseNonNegativeInt(stock);
      if (validatedStock === null) {
        return res.status(400).json({
          success: false,
          message: "Stock must be a non-negative whole number",
        });
      }
    }

    let validatedThreshold = linkedPharmacyProduct
      ? linkedPharmacyProduct.lowStockThreshold ?? 10
      : 10;
    if (lowStockThreshold !== undefined) {
      validatedThreshold = parseNonNegativeInt(lowStockThreshold);
      if (validatedThreshold === null) {
        return res.status(400).json({
          success: false,
          message: "Low stock threshold must be a non-negative whole number",
        });
      }
    }

    let imageData = null;

    // Image from file upload
    if (req.files && req.files.image && req.files.image.length > 0) {
      const uploadRes = await uploadFile(req.files.image[0]);
      imageData = {
        url: uploadRes.url,
        publicId: uploadRes.publicId,
      };
    } else if (req.body.image) {
      let img = req.body.image;
      if (typeof img === "string") {
        try {
          img = JSON.parse(img);
        } catch (e) {
          // plain string URL
          img = { url: img, publicId: "" };
        }
      }
      if (img?.url) {
        imageData = img;
      }
    } else if (imageUrl) {
      imageData = { url: imageUrl, publicId: "" };
    }

    if (!imageData) {
      imageData = { url: "", publicId: "" };
    }

    let itemsArray = [];
    if (medicineItems) {
      itemsArray = Array.isArray(medicineItems)
        ? medicineItems
        : [medicineItems];
    }

    let calculatedDiscount = discount || "";
    if (
      !calculatedDiscount &&
      regularPrice > sellingPrice &&
      regularPrice > 0 &&
      sellingPrice > 0
    ) {
      const pct = Math.round(
        ((regularPrice - sellingPrice) / regularPrice) * 100
      );
      if (pct > 0) {
        calculatedDiscount = `${pct}% OFF`;
      }
    }

    const data = await MedicineItem.create({
      pharmacy: pharmacy || linkedPharmacyProduct?.pharmacy || null,
      pharmacyProduct: linkedPharmacyProduct?._id || null,
      medicineCategory: medicineCategory || null,
      medicineSubCategory: targetSubCategory || null,
      subCategoryId: targetSubCategory ? targetSubCategory.toString() : "",
      name: displayName,
      productTitle: (productTitle || displayName).trim(),
      description: description || displayName,
      type: type || "Strip of tablets",
      delivery: delivery || "Delivery by Tomorrow 9 PM",
      newPrice: sellingPrice,
      oldPrice: regularPrice,
      price: sellingPrice,
      mrp: regularPrice,
      discount: calculatedDiscount,
      prescription: Boolean(prescription),
      imageUrl: imageData.url || imageUrl || "",
      image: imageData,
      medicineItems: itemsArray,
      quantity: validatedQuantity,
      stock: validatedStock,
      lowStockThreshold: validatedThreshold,
      isActive: isActive !== undefined ? isActive : true,
    });

    const [enriched] = await enrichMedicineItemsWithLiveStock([data]);
    const formatted = formatMedicineItem(enriched);

    emitStockUpdated(req, {
      source: "medicine_item_created",
      products: [
        {
          productId: formatted._id,
          name: formatted.name,
          stock: formatted.stock,
          inStock: formatted.inStock,
          stockStatus: formatted.stockStatus,
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Medicine created successfully",
      data: formatted,
    });
  } catch (err) {
    console.error("CREATE MEDICINE ERROR:", err);
    res.status(err.name === "ValidationError" ? 400 : 500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================
// ✅ GET ALL MEDICINES
// ============================================
exports.getMedicines = async (req, res) => {
  try {
    const search = req.query.search || "";
    const medicineCategory = req.query.medicineCategory || "";
    const subCategoryId =
      req.query.subCategoryId || req.query.medicineSubCategory || "";
    const pharmacy = req.query.pharmacy || req.query.pharmacyId || "";

    const andConditions = [{ isActive: true }];

    if (search) {
      const escapedSearch = escapeRegex(search.trim());
      andConditions.push({
        $or: [
          { name: { $regex: escapedSearch, $options: "i" } },
          { productTitle: { $regex: escapedSearch, $options: "i" } },
          { description: { $regex: escapedSearch, $options: "i" } },
        ],
      });
    }

    if (medicineCategory) {
      if (!mongoose.Types.ObjectId.isValid(medicineCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }
      andConditions.push({ medicineCategory });
    }

    if (pharmacy) {
      if (!mongoose.Types.ObjectId.isValid(pharmacy)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pharmacy ID",
        });
      }
      andConditions.push({ pharmacy });
    }

    if (subCategoryId) {
      andConditions.push({
        $or: [
          { medicineSubCategory: subCategoryId },
          { subCategoryId: subCategoryId },
        ],
      });
    }

    const inStockParam = String(req.query.inStock || "").toLowerCase();
    const hideOutOfStock =
      String(
        req.query.hideOutOfStock || req.query.excludeOutOfStock || ""
      ).toLowerCase() === "true";

    const query =
      andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const allMatches = await MedicineItem.find(query)
      .populate("medicineSubCategory", "title name")
      .sort({ createdAt: -1 });

    let enriched = (await enrichMedicineItemsWithLiveStock(allMatches)).map(
      formatMedicineItem
    );

    if (inStockParam === "true" || hideOutOfStock) {
      enriched = enriched.filter((item) => item.stock > 0);
    } else if (inStockParam === "false") {
      enriched = enriched.filter((item) => item.stock <= 0);
    }

    const total = enriched.length;
    const hasLimit = Boolean(req.query.limit);
    const hasPage = Boolean(req.query.page);

    let page = 1;
    let limit = total;
    let formatted = enriched;

    if (hasLimit || hasPage) {
      page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const skip = (page - 1) * limit;
      formatted = enriched.slice(skip, skip + limit);
    }

    res.json({
      success: true,
      page,
      limit,
      total,
      data: formatted,
    });
  } catch (err) {
    console.error("GET MEDICINES ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================
// ✅ GET MEDICINES BY SUB CATEGORY
// ============================================
exports.getBySubCategory = async (req, res) => {
  try {
    const subCatId = req.params.id;
    const orConditions = [{ subCategoryId: subCatId }];
    if (mongoose.Types.ObjectId.isValid(subCatId)) {
      orConditions.unshift({ medicineSubCategory: subCatId });
    }

    const medicines = await MedicineItem.find({
      $or: orConditions,
      isActive: true,
    })
      .populate("medicineSubCategory", "title name")
      .sort({
        createdAt: -1,
      });

    let formatted = (await enrichMedicineItemsWithLiveStock(medicines)).map(
      formatMedicineItem
    );

    const inStockParam = String(req.query.inStock || "").toLowerCase();
    const hideOutOfStock =
      String(
        req.query.hideOutOfStock || req.query.excludeOutOfStock || ""
      ).toLowerCase() === "true";

    if (inStockParam === "true" || hideOutOfStock) {
      formatted = formatted.filter((item) => item.stock > 0);
    } else if (inStockParam === "false") {
      formatted = formatted.filter((item) => item.stock <= 0);
    }

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    console.error("GET BY SUBCATEGORY ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================
// ✅ GET SINGLE MEDICINE (GET /medicine-item/:id)
// ============================================
exports.getMedicineById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine ID",
      });
    }

    const medicine = await MedicineItem.findById(req.params.id).populate(
      "medicineSubCategory",
      "title name"
    );

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    const [enriched] = await enrichMedicineItemsWithLiveStock([medicine]);
    const formatted = formatMedicineItem(enriched);

    res.json({
      success: true,
      data: formatted,
      page: 1,
      limit: 10,
      total: 1,
    });
  } catch (err) {
    console.error("GET MEDICINE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================
// ✅ UPDATE MEDICINE
// ============================================
exports.updateMedicine = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine ID",
      });
    }

    const medicine = await MedicineItem.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    const {
      pharmacy,
      pharmacyProduct,
      medicineCategory,
      medicineSubCategory,
      subCategoryId,
      name,
      productTitle,
      description,
      type,
      delivery,
      price,
      newPrice,
      oldPrice,
      mrp,
      originalPrice,
      discount,
      prescription,
      imageUrl,
      medicineItems,
      quantity,
      stock,
      lowStockThreshold,
      isActive,
    } = req.body;

    if (pharmacy !== undefined) {
      if (pharmacy && !mongoose.Types.ObjectId.isValid(pharmacy)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pharmacy ID",
        });
      }
      medicine.pharmacy = pharmacy || null;
    }

    if (pharmacyProduct !== undefined) {
      if (pharmacyProduct) {
        if (!mongoose.Types.ObjectId.isValid(pharmacyProduct)) {
          return res.status(400).json({
            success: false,
            message: "Invalid pharmacyProduct ID",
          });
        }
        const linked = await PharmacyProduct.findById(pharmacyProduct);
        if (!linked) {
          return res.status(404).json({
            success: false,
            message: "Linked pharmacy product not found",
          });
        }
        medicine.pharmacyProduct = linked._id;
        medicine.pharmacy = medicine.pharmacy || linked.pharmacy;
        if (stock === undefined) {
          medicine.stock = linked.stock;
        }
      } else {
        medicine.pharmacyProduct = null;
      }
    }

    if (medicineCategory !== undefined) medicine.medicineCategory = medicineCategory;
    if (medicineSubCategory !== undefined || subCategoryId !== undefined) {
      const targetSub = medicineSubCategory || subCategoryId;
      medicine.medicineSubCategory = targetSub;
      medicine.subCategoryId = targetSub ? targetSub.toString() : "";
    }

    if (name !== undefined) medicine.name = name;
    if (productTitle !== undefined) medicine.productTitle = productTitle;
    if (description !== undefined) medicine.description = description;
    if (type !== undefined) medicine.type = type;
    if (delivery !== undefined) medicine.delivery = delivery;

    if (newPrice !== undefined || price !== undefined) {
      const p = parseNonNegativeNumber(newPrice ?? price);
      if (p === null) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid non-negative number",
        });
      }
      medicine.newPrice = p;
      medicine.price = p;
    }

    if (oldPrice !== undefined || mrp !== undefined || originalPrice !== undefined) {
      const op = parseNonNegativeNumber(oldPrice ?? mrp ?? originalPrice);
      if (op === null) {
        return res.status(400).json({
          success: false,
          message: "MRP / oldPrice must be a valid non-negative number",
        });
      }
      medicine.oldPrice = op;
      medicine.mrp = op;
    }

    if (discount !== undefined) {
      medicine.discount = discount;
    } else if (medicine.oldPrice > medicine.newPrice && medicine.newPrice > 0) {
      const pct = Math.round(
        ((medicine.oldPrice - medicine.newPrice) / medicine.oldPrice) * 100
      );
      if (pct > 0) medicine.discount = `${pct}% OFF`;
    }

    if (prescription !== undefined) medicine.prescription = Boolean(prescription);

    if (quantity !== undefined) {
      const parsedQuantity = parsePositiveInt(quantity);
      if (parsedQuantity === null) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be a positive whole number",
        });
      }
      medicine.quantity = parsedQuantity;
    }

    if (stock !== undefined) {
      const parsedStock = parseNonNegativeInt(stock);
      if (parsedStock === null) {
        return res.status(400).json({
          success: false,
          message: "Stock must be a non-negative whole number",
        });
      }
      medicine.stock = parsedStock;
    }

    if (lowStockThreshold !== undefined) {
      const parsedThreshold = parseNonNegativeInt(lowStockThreshold);
      if (parsedThreshold === null) {
        return res.status(400).json({
          success: false,
          message: "Low stock threshold must be a non-negative whole number",
        });
      }
      medicine.lowStockThreshold = parsedThreshold;
    }

    if (medicineItems !== undefined) {
      medicine.medicineItems = Array.isArray(medicineItems)
        ? medicineItems
        : [medicineItems];
    }
    if (isActive !== undefined) medicine.isActive = Boolean(isActive);

    // Image update from file
    if (req.files?.image?.length > 0) {
      if (medicine.image?.publicId) {
        await deleteFile(medicine.image.publicId);
      }
      const uploadRes = await uploadFile(req.files.image[0]);
      medicine.image = {
        url: uploadRes.url,
        publicId: uploadRes.publicId,
      };
      medicine.imageUrl = uploadRes.url;
    } else if (req.body.image) {
      let img = req.body.image;
      if (typeof img === "string") {
        try {
          img = JSON.parse(img);
        } catch (e) {
          img = { url: img, publicId: "" };
        }
      }
      if (img?.url) {
        medicine.image = img;
        medicine.imageUrl = img.url;
      }
    } else if (imageUrl) {
      medicine.imageUrl = imageUrl;
      medicine.image = { url: imageUrl, publicId: "" };
    }

    await medicine.save();

    if (
      (stock !== undefined || lowStockThreshold !== undefined) &&
      medicine.pharmacyProduct
    ) {
      const syncFields = {};
      if (stock !== undefined) syncFields.stock = medicine.stock;
      if (lowStockThreshold !== undefined) {
        syncFields.lowStockThreshold = medicine.lowStockThreshold;
      }

      const updatedProd = await PharmacyProduct.findByIdAndUpdate(
        medicine.pharmacyProduct,
        { $set: syncFields },
        { new: true }
      );
      if (updatedProd) {
        await MedicineItem.updateMany(
          { pharmacyProduct: updatedProd._id, _id: { $ne: medicine._id } },
          {
            $set: {
              stock: updatedProd.stock,
              lowStockThreshold: updatedProd.lowStockThreshold ?? 10,
            },
          }
        );
      }
    }

    const [enriched] = await enrichMedicineItemsWithLiveStock([medicine]);
    const formatted = formatMedicineItem(enriched);

    emitStockUpdated(req, {
      source: "medicine_item_updated",
      products: [
        {
          productId: formatted._id,
          pharmacyProductId: formatted.pharmacyProduct || null,
          name: formatted.name,
          stock: formatted.stock,
          inStock: formatted.inStock,
          stockStatus: formatted.stockStatus,
        },
      ],
    });

    res.json({
      success: true,
      message: "Medicine updated successfully",
      data: formatted,
    });
  } catch (err) {
    console.error("UPDATE MEDICINE ERROR:", err);
    res.status(err.name === "ValidationError" ? 400 : 500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================
// ✅ DELETE MEDICINE
// ============================================
exports.deleteMedicine = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine ID",
      });
    }

    const medicine = await MedicineItem.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    if (medicine.image?.publicId) {
      await deleteFile(medicine.image.publicId);
    }

    await medicine.deleteOne();

    emitStockUpdated(req, {
      source: "medicine_item_deleted",
      products: [{ productId: req.params.id }],
    });

    res.json({
      success: true,
      message: "Medicine deleted successfully",
    });
  } catch (err) {
    console.error("DELETE MEDICINE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
