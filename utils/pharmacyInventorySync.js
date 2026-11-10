const mongoose = require("mongoose");
const PharmacyProduct = require("../models/pharmacyProductModel");
const PharmacyPurchase = require("../models/pharmacyPurchaseModel");
const MedicineItem = require("../models/medicineItem.model");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseStrictNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
};

const parseNonNegativeInt = (value) => {
  const num = parseStrictNumber(value);
  return Number.isInteger(num) && num >= 0 ? num : null;
};

const parsePositiveInt = (value) => {
  const num = parseStrictNumber(value);
  return Number.isInteger(num) && num >= 1 ? num : null;
};

const parseNonNegativeNumber = (value) => {
  const num = parseStrictNumber(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
};

const normalizeStoredStock = (value) => {
  const parsed = parseNonNegativeInt(value);
  if (parsed !== null) return parsed;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return 0;
};

const buildStockMeta = (stockValue, thresholdValue = 10) => {
  const stock = normalizeStoredStock(stockValue);
  const parsedThreshold = parseNonNegativeInt(thresholdValue);
  const lowStockThreshold = parsedThreshold !== null ? parsedThreshold : 10;
  const isOutOfStock = stock <= 0;
  const inStock = stock > 0;
  const isLowStock = inStock && stock <= lowStockThreshold;
  const stockStatus = isOutOfStock
    ? "OUT_OF_STOCK"
    : isLowStock
      ? "LOW_STOCK"
      : "IN_STOCK";
  const stockMessage = isOutOfStock
    ? "Out of Stock"
    : isLowStock
      ? `Only ${stock} left in stock`
      : `In Stock (${stock} available)`;

  return {
    stock,
    availableStock: stock,
    availableQuantity: stock,
    lowStockThreshold,
    inStock,
    isOutOfStock,
    outOfStock: isOutOfStock,
    isLowStock,
    stockStatus,
    stockMessage,
  };
};

const calculateSalePrice = (mrp, discount = 0) => {
  const safeMrp = parseNonNegativeNumber(mrp) ?? 0;
  const safeDiscount = Math.min(100, Math.max(0, parseNonNegativeNumber(discount) ?? 0));
  return Math.round(safeMrp * (1 - safeDiscount / 100) * 100) / 100;
};

const formatPharmacyProduct = (product) => {
  if (!product) return null;
  const doc = product.toObject ? product.toObject() : { ...product };
  const mrp = parseNonNegativeNumber(doc.mrp) ?? 0;
  const discount = Math.min(100, Math.max(0, parseNonNegativeNumber(doc.discount) ?? 0));
  const salePrice = calculateSalePrice(mrp, discount);
  const stockMeta = buildStockMeta(doc.stock, doc.lowStockThreshold);

  return {
    ...doc,
    _id: doc._id ? doc._id.toString() : "",
    id: doc._id ? doc._id.toString() : "",
    name: doc.productTitle || doc.name || "",
    productTitle: doc.productTitle || doc.name || "",
    mrp,
    oldPrice: mrp,
    discount,
    salePrice,
    sellingPrice: salePrice,
    newPrice: salePrice,
    price: salePrice,
    ...stockMeta,
  };
};

const syncLinkedMedicineItemsForProduct = async (product) => {
  if (!product?._id) return;

  const stock = normalizeStoredStock(product.stock);
  const threshold = parseNonNegativeInt(product.lowStockThreshold) ?? 10;
  const conditions = [{ pharmacyProduct: product._id }];

  if (product.pharmacy && product.productTitle) {
    const exactTitleRegex = new RegExp(
      `^${escapeRegex(product.productTitle.trim())}$`,
      "i"
    );
    conditions.push({
      pharmacy: product.pharmacy,
      $or: [{ productTitle: exactTitleRegex }, { name: exactTitleRegex }],
    });
  }

  await MedicineItem.updateMany(
    { $or: conditions },
    {
      $set: {
        stock,
        lowStockThreshold: threshold,
        pharmacyProduct: product._id,
      },
    }
  );
};

const enrichMedicineItemsWithLiveStock = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const docs = items.map((item) =>
    item.toObject ? item.toObject() : { ...item }
  );

  const directProductIds = [];
  const pharmacyIds = [];

  for (const doc of docs) {
    if (doc.pharmacyProduct && mongoose.Types.ObjectId.isValid(doc.pharmacyProduct)) {
      directProductIds.push(doc.pharmacyProduct);
    }
    const rawPharmacyId = doc.pharmacy?._id || doc.pharmacy;
    if (rawPharmacyId && mongoose.Types.ObjectId.isValid(rawPharmacyId)) {
      pharmacyIds.push(rawPharmacyId);
    }
  }

  const orConditions = [];
  if (directProductIds.length > 0) {
    orConditions.push({ _id: { $in: directProductIds } });
  }
  if (pharmacyIds.length > 0) {
    orConditions.push({ pharmacy: { $in: pharmacyIds } });
  }

  const byId = new Map();
  const byPharmacyTitle = new Map();

  if (orConditions.length > 0) {
    const linkedProducts = await PharmacyProduct.find({ $or: orConditions })
      .select("_id pharmacy productTitle stock lowStockThreshold")
      .lean();

    for (const prod of linkedProducts) {
      byId.set(prod._id.toString(), prod);
      if (prod.pharmacy && prod.productTitle) {
        const key = `${prod.pharmacy.toString()}::${prod.productTitle
          .trim()
          .toLowerCase()}`;
        byPharmacyTitle.set(key, prod);
      }
    }
  }

  return docs.map((doc) => {
    let linked = null;
    if (doc.pharmacyProduct) {
      linked = byId.get(doc.pharmacyProduct.toString()) || null;
    }
    if (!linked && doc.pharmacy) {
      const pharmacyId = (doc.pharmacy._id || doc.pharmacy).toString();
      const title = (doc.name || doc.productTitle || doc.description || "")
        .trim()
        .toLowerCase();
      if (title) {
        linked = byPharmacyTitle.get(`${pharmacyId}::${title}`) || null;
      }
    }

    if (linked) {
      const stockMeta = buildStockMeta(linked.stock, linked.lowStockThreshold);
      return {
        ...doc,
        pharmacy: doc.pharmacy || linked.pharmacy,
        pharmacyProduct: linked._id,
        ...stockMeta,
      };
    }

    const stockMeta = buildStockMeta(doc.stock, doc.lowStockThreshold);
    return {
      ...doc,
      ...stockMeta,
    };
  });
};

const inventoryError = (message, statusCode = 400, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const allocatePurchaseBatches = async (pharmacyId, productId, quantity) => {
  if (!pharmacyId || !productId || quantity < 1) return [];

  const purchases = await PharmacyPurchase.find({
    pharmacy: pharmacyId,
    items: { $elemMatch: { product: productId, remainingQuantity: { $gt: 0 } } },
  })
    .select("items")
    .lean();

  const candidates = purchases
    .flatMap((purchase) =>
      purchase.items
        .filter(
          (item) =>
            item.product &&
            item.product.toString() === productId.toString() &&
            item.remainingQuantity > 0
        )
        .map((item) => ({
          purchaseId: purchase._id,
          item,
        }))
    )
    .sort((left, right) => {
      const leftExpiry = left.item.expiryDate || "9999-12-31";
      const rightExpiry = right.item.expiryDate || "9999-12-31";
      return leftExpiry.localeCompare(rightExpiry);
    });

  let remaining = quantity;
  const allocations = [];
  try {
    for (const candidate of candidates) {
      if (remaining === 0) break;
      const allocated = Math.min(remaining, candidate.item.remainingQuantity);
      const result = await PharmacyPurchase.updateOne(
        {
          _id: candidate.purchaseId,
          pharmacy: pharmacyId,
          items: {
            $elemMatch: {
              _id: candidate.item._id,
              remainingQuantity: { $gte: allocated },
            },
          },
        },
        { $inc: { "items.$.remainingQuantity": -allocated } }
      );
      if (result.modifiedCount === 1) {
        allocations.push({
          purchaseId: candidate.purchaseId,
          purchaseItemId: candidate.item._id,
          quantity: allocated,
        });
        remaining -= allocated;
      }
    }
  } catch (error) {
    for (const allocation of allocations) {
      await PharmacyPurchase.updateOne(
        {
          _id: allocation.purchaseId,
          pharmacy: pharmacyId,
          "items._id": allocation.purchaseItemId,
        },
        { $inc: { "items.$.remainingQuantity": allocation.quantity } }
      );
    }
    throw error;
  }
  return allocations;
};

const restorePurchaseBatches = async (pharmacyId, allocations = []) => {
  for (const allocation of allocations || []) {
    const qty = parsePositiveInt(allocation?.quantity);
    if (!allocation?.purchaseId || !allocation?.purchaseItemId || !qty) {
      continue;
    }
    const filter = {
      _id: allocation.purchaseId,
      "items._id": allocation.purchaseItemId,
    };
    if (pharmacyId && mongoose.Types.ObjectId.isValid(pharmacyId)) {
      filter.pharmacy = pharmacyId;
    }
    await PharmacyPurchase.updateOne(filter, {
      $inc: { "items.$.remainingQuantity": qty },
    });
  }
};

const findLinkedPharmacyProductForMedicine = async (medItem, fallbackPharmacyId) => {
  if (!medItem) return null;

  if (
    medItem.pharmacyProduct &&
    mongoose.Types.ObjectId.isValid(medItem.pharmacyProduct)
  ) {
    const filter = { _id: medItem.pharmacyProduct };
    if (fallbackPharmacyId && mongoose.Types.ObjectId.isValid(fallbackPharmacyId)) {
      filter.pharmacy = fallbackPharmacyId;
    }
    const prod = await PharmacyProduct.findOne(filter);
    if (prod) return prod;
  }

  const pharmacyId = medItem.pharmacy || fallbackPharmacyId;
  const title = (
    medItem.productTitle ||
    medItem.name ||
    medItem.description ||
    ""
  ).trim();
  if (pharmacyId && mongoose.Types.ObjectId.isValid(pharmacyId) && title) {
    return PharmacyProduct.findOne({
      pharmacy: pharmacyId,
      productTitle: new RegExp(`^${escapeRegex(title)}$`, "i"),
    });
  }

  return null;
};

const resolveOrderItemTarget = async (item, fallbackPharmacyId = null) => {
  const rawId = item.productId || item.product || item._id;

  if (rawId !== undefined && rawId !== null && String(rawId).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      throw inventoryError(`Invalid product ID: ${rawId}`, 400);
    }

    const pharmacyFilter =
      fallbackPharmacyId && mongoose.Types.ObjectId.isValid(fallbackPharmacyId)
        ? { _id: rawId, pharmacy: fallbackPharmacyId }
        : { _id: rawId };

    const pharmacyProduct = await PharmacyProduct.findOne(pharmacyFilter);
    if (pharmacyProduct) {
      return {
        kind: "PharmacyProduct",
        product: pharmacyProduct,
        orderProductId: pharmacyProduct._id,
        pharmacyId: pharmacyProduct.pharmacy,
      };
    }

    const medItem = await MedicineItem.findById(rawId);
    if (medItem) {
      if (medItem.isActive === false) {
        throw inventoryError(
          `${medItem.name || medItem.productTitle || "Product"} is currently unavailable`,
          400
        );
      }

      if (
        fallbackPharmacyId &&
        medItem.pharmacy &&
        medItem.pharmacy.toString() !== fallbackPharmacyId.toString()
      ) {
        throw inventoryError(
          `Product ${medItem.name || medItem.productTitle || rawId} does not belong to the selected pharmacy`,
          404
        );
      }

      const linkedPharmacyProduct = await findLinkedPharmacyProductForMedicine(
        medItem,
        fallbackPharmacyId
      );
      if (linkedPharmacyProduct) {
        return {
          kind: "PharmacyProduct",
          product: linkedPharmacyProduct,
          orderProductId: medItem._id,
          pharmacyId: linkedPharmacyProduct.pharmacy,
        };
      }

      return {
        kind: "MedicineItem",
        product: medItem,
        orderProductId: medItem._id,
        pharmacyId: medItem.pharmacy || fallbackPharmacyId || null,
      };
    }

    throw inventoryError(
      `No product matches ID ${rawId}${item.name ? ` (${item.name})` : ""}`,
      404
    );
  }

  const itemName = String(item.name || item.productTitle || "").trim();
  if (!itemName) {
    throw inventoryError("Each order item must specify a product ID or name", 400);
  }

  const exactRegex = new RegExp(`^${escapeRegex(itemName)}$`, "i");
  const prodQuery = { productTitle: exactRegex };
  if (fallbackPharmacyId && mongoose.Types.ObjectId.isValid(fallbackPharmacyId)) {
    prodQuery.pharmacy = fallbackPharmacyId;
  }

  const matchingProducts = await PharmacyProduct.find(prodQuery).limit(2);
  if (matchingProducts.length === 1) {
    return {
      kind: "PharmacyProduct",
      product: matchingProducts[0],
      orderProductId: matchingProducts[0]._id,
      pharmacyId: matchingProducts[0].pharmacy,
    };
  }
  if (matchingProducts.length > 1) {
    throw inventoryError(
      `Multiple pharmacies offer "${itemName}". Please pass the specific product ID`,
      400
    );
  }

  const medQuery = {
    isActive: { $ne: false },
    $or: [{ name: exactRegex }, { productTitle: exactRegex }],
  };
  if (fallbackPharmacyId && mongoose.Types.ObjectId.isValid(fallbackPharmacyId)) {
    medQuery.pharmacy = fallbackPharmacyId;
  }

  const matchingMedicines = await MedicineItem.find(medQuery).limit(2);
  if (matchingMedicines.length === 1) {
    const med = matchingMedicines[0];
    const linked = await findLinkedPharmacyProductForMedicine(med, fallbackPharmacyId);
    if (linked) {
      return {
        kind: "PharmacyProduct",
        product: linked,
        orderProductId: med._id,
        pharmacyId: linked.pharmacy,
      };
    }
    return {
      kind: "MedicineItem",
      product: med,
      orderProductId: med._id,
      pharmacyId: med.pharmacy || fallbackPharmacyId || null,
    };
  }
  if (matchingMedicines.length > 1) {
    throw inventoryError(
      `Multiple medicines match "${itemName}". Please pass the specific product ID`,
      400
    );
  }

  throw inventoryError(`No inventory product matches "${itemName}"`, 404);
};

const reserveInventory = async (pharmacyId, items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw inventoryError("At least one order item is required", 400);
  }

  const reserved = [];
  const linkedItems = [];
  const priorReservedMap = new Map();

  try {
    for (const item of items) {
      const quantity = parsePositiveInt(item?.qty ?? item?.quantity);
      if (quantity === null) {
        throw inventoryError(
          "Order item quantity must be a positive whole number",
          400
        );
      }

      const target = await resolveOrderItemTarget(item, pharmacyId);
      const targetIdStr = target.product._id.toString();
      const priorReserved = priorReservedMap.get(targetIdStr) || 0;

      if (target.kind === "PharmacyProduct") {
        const prod = target.product;
        const updated = await PharmacyProduct.findOneAndUpdate(
          {
            _id: prod._id,
            pharmacy: prod.pharmacy,
            stock: { $gte: quantity },
          },
          { $inc: { stock: -quantity } },
          { new: true }
        );

        if (!updated) {
          const fresh = await PharmacyProduct.findById(prod._id)
            .select("stock productTitle")
            .lean();
          const remainingNow = normalizeStoredStock(fresh?.stock);
          const totalAvailable = remainingNow + priorReserved;
          const totalRequested = quantity + priorReserved;
          const title = fresh?.productTitle || prod.productTitle || "Product";

          if (totalAvailable <= 0) {
            throw inventoryError(`${title} is out of stock`, 409, {
              code: "OUT_OF_STOCK",
              productId: prod._id,
              productName: title,
              availableStock: 0,
              requestedQuantity: totalRequested,
            });
          }

          throw inventoryError(
            `Insufficient stock for ${title}. Available: ${totalAvailable}, requested: ${totalRequested}`,
            409,
            {
              code: "INSUFFICIENT_STOCK",
              productId: prod._id,
              productName: title,
              availableStock: totalAvailable,
              requestedQuantity: totalRequested,
            }
          );
        }

        priorReservedMap.set(targetIdStr, priorReserved + quantity);

        const reservation = {
          productId: updated._id,
          product: updated._id,
          productModel: "PharmacyProduct",
          pharmacy: updated.pharmacy,
          quantity,
          inventoryAllocations: [],
        };
        reserved.push(reservation);

        const inventoryAllocations = await allocatePurchaseBatches(
          updated.pharmacy,
          updated._id,
          quantity
        );
        reservation.inventoryAllocations = inventoryAllocations;

        await syncLinkedMedicineItemsForProduct(updated);

        const rawItem = typeof item.toObject === "function" ? item.toObject() : item;
        const unitPrice =
          parseNonNegativeNumber(rawItem.price) ??
          calculateSalePrice(updated.mrp, updated.discount);

        linkedItems.push({
          ...rawItem,
          product: target.orderProductId,
          productId: updated._id,
          productModel: "PharmacyProduct",
          pharmacy: updated.pharmacy,
          name: rawItem.name || updated.productTitle,
          image: rawItem.image || updated.image || "",
          quantity,
          qty: quantity,
          price: unitPrice,
          totalPrice:
            parseNonNegativeNumber(rawItem.totalPrice) ??
            Math.round(unitPrice * quantity * 100) / 100,
          inventoryAllocations,
        });
      } else {
        const med = target.product;
        const updatedMed = await MedicineItem.findOneAndUpdate(
          {
            _id: med._id,
            isActive: { $ne: false },
            stock: { $gte: quantity },
          },
          { $inc: { stock: -quantity } },
          { new: true }
        );

        if (!updatedMed) {
          const fresh = await MedicineItem.findById(med._id)
            .select("stock name productTitle description")
            .lean();
          const remainingNow = normalizeStoredStock(fresh?.stock);
          const totalAvailable = remainingNow + priorReserved;
          const totalRequested = quantity + priorReserved;
          const title =
            fresh?.name ||
            fresh?.productTitle ||
            fresh?.description ||
            med.name ||
            "Medicine";

          if (totalAvailable <= 0) {
            throw inventoryError(`${title} is out of stock`, 409, {
              code: "OUT_OF_STOCK",
              productId: med._id,
              productName: title,
              availableStock: 0,
              requestedQuantity: totalRequested,
            });
          }

          throw inventoryError(
            `Insufficient stock for ${title}. Available: ${totalAvailable}, requested: ${totalRequested}`,
            409,
            {
              code: "INSUFFICIENT_STOCK",
              productId: med._id,
              productName: title,
              availableStock: totalAvailable,
              requestedQuantity: totalRequested,
            }
          );
        }

        priorReservedMap.set(targetIdStr, priorReserved + quantity);

        const reservation = {
          productId: updatedMed._id,
          product: updatedMed._id,
          productModel: "MedicineItem",
          pharmacy: updatedMed.pharmacy || pharmacyId || null,
          quantity,
          inventoryAllocations: [],
        };
        reserved.push(reservation);

        const rawItem = typeof item.toObject === "function" ? item.toObject() : item;
        const unitPrice =
          parseNonNegativeNumber(rawItem.price) ??
          parseNonNegativeNumber(updatedMed.newPrice) ??
          parseNonNegativeNumber(updatedMed.price) ??
          0;
        const displayName =
          rawItem.name ||
          updatedMed.name ||
          updatedMed.productTitle ||
          updatedMed.description ||
          "Medicine";
        const resolvedImage =
          rawItem.image ||
          updatedMed.imageUrl ||
          (typeof updatedMed.image === "string"
            ? updatedMed.image
            : updatedMed.image?.url || "");

        linkedItems.push({
          ...rawItem,
          product: updatedMed._id,
          productId: updatedMed._id,
          productModel: "MedicineItem",
          pharmacy: updatedMed.pharmacy || pharmacyId || null,
          name: displayName,
          image: resolvedImage,
          quantity,
          qty: quantity,
          price: unitPrice,
          totalPrice:
            parseNonNegativeNumber(rawItem.totalPrice) ??
            Math.round(unitPrice * quantity * 100) / 100,
          inventoryAllocations: [],
        });
      }
    }

    return linkedItems;
  } catch (error) {
    if (reserved.length > 0) {
      await releaseInventory(pharmacyId, reserved);
    }
    throw error;
  }
};

const releaseInventory = async (pharmacyId, items = []) => {
  for (const item of items || []) {
    const quantity = parsePositiveInt(item?.quantity ?? item?.qty);
    if (!quantity) continue;

    const targetId = item.productId || item.product;
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      continue;
    }

    const itemPharmacyId = item.pharmacy || pharmacyId || null;

    if (item.productModel === "MedicineItem") {
      await MedicineItem.updateOne(
        { _id: targetId },
        { $inc: { stock: quantity } }
      );
      continue;
    }

    const prodFilter = { _id: targetId };
    if (itemPharmacyId && mongoose.Types.ObjectId.isValid(itemPharmacyId)) {
      prodFilter.pharmacy = itemPharmacyId;
    }

    const updatedProduct = await PharmacyProduct.findOneAndUpdate(
      prodFilter,
      { $inc: { stock: quantity } },
      { new: true }
    );

    if (updatedProduct) {
      await restorePurchaseBatches(
        updatedProduct.pharmacy,
        item.inventoryAllocations || []
      );
      await syncLinkedMedicineItemsForProduct(updatedProduct);
      continue;
    }

    await MedicineItem.updateOne(
      { _id: targetId },
      { $inc: { stock: quantity } }
    );
  }
};

const emitStockUpdated = (reqOrApp, payload = {}) => {
  try {
    const app = reqOrApp?.app || reqOrApp;
    const io = typeof app?.get === "function" ? app.get("io") : null;
    if (io) {
      io.emit("pharmacy_stock_updated", {
        ...payload,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (_) {
    // Non-fatal: real-time socket broadcast is best-effort
  }
};

module.exports = {
  parseStrictNumber,
  parseNonNegativeInt,
  parsePositiveInt,
  parseNonNegativeNumber,
  normalizeStoredStock,
  buildStockMeta,
  calculateSalePrice,
  formatPharmacyProduct,
  syncLinkedMedicineItemsForProduct,
  enrichMedicineItemsWithLiveStock,
  reserveInventory,
  releaseInventory,
  emitStockUpdated,
};

