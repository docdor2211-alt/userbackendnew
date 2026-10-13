const mongoose = require("mongoose");
const MedicineItem = require("../models/medicineItem.model");
const { uploadFile, deleteFile } = require("../utils/bunnyUpload");

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

  const description = doc.description || doc.name || "";
  const name = doc.name || doc.description || "";

  return {
    _id: doc._id?.toString() || "",
    id: doc._id?.toString() || "",
    name,
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
    stock: doc.stock !== undefined ? doc.stock : null,
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
      medicineCategory,
      medicineSubCategory,
      subCategoryId,
      name,
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
      isActive,
    } = req.body;

    const targetSubCategory = medicineSubCategory || subCategoryId;
    const displayName = (name || description || "").trim();
    const sellingPrice = Number(newPrice ?? price ?? mrp ?? 0);
    const regularPrice = Number(oldPrice ?? originalPrice ?? sellingPrice);

    if (!displayName) {
      return res.status(400).json({
        success: false,
        message: "Medicine name or description is required",
      });
    }

    if (sellingPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid price is required",
      });
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
      medicineCategory: medicineCategory || null,
      medicineSubCategory: targetSubCategory || null,
      subCategoryId: targetSubCategory ? targetSubCategory.toString() : "",
      name: displayName,
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
      quantity: Number(quantity) || 1,
      stock: stock !== undefined && stock !== null ? Number(stock) : null,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: "Medicine created successfully",
      data: formatMedicineItem(data),
    });
  } catch (err) {
    console.error("CREATE MEDICINE ERROR:", err);
    res.status(500).json({
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

    const query = {
      isActive: true,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (medicineCategory) {
      query.medicineCategory = medicineCategory;
    }

    if (subCategoryId) {
      query.$or = query.$or || [];
      query.$and = [
        {
          $or: [
            { medicineSubCategory: subCategoryId },
            { subCategoryId: subCategoryId },
          ],
        },
      ];
    }

    const hasLimit = Boolean(req.query.limit);
    const hasPage = Boolean(req.query.page);

    const total = await MedicineItem.countDocuments(query);

    let findQuery = MedicineItem.find(query)
      .populate("medicineSubCategory", "title name")
      .sort({ createdAt: -1 });

    let page = 1;
    let limit = total;

    if (hasLimit || hasPage) {
      page = Math.max(parseInt(req.query.page) || 1, 1);
      limit = Math.max(parseInt(req.query.limit) || 10, 1);
      const skip = (page - 1) * limit;
      findQuery = findQuery.skip(skip).limit(limit);
    }

    const medicines = await findQuery;
    const formatted = medicines.map(formatMedicineItem);

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

    const medicines = await MedicineItem.find({
      $or: [
        { medicineSubCategory: subCatId },
        { subCategoryId: subCatId },
      ],
      isActive: true,
    })
      .populate("medicineSubCategory", "title name")
      .sort({
        createdAt: -1,
      });

    const formatted = medicines.map(formatMedicineItem);

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

    const formatted = formatMedicineItem(medicine);

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
    const medicine = await MedicineItem.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    const {
      medicineCategory,
      medicineSubCategory,
      subCategoryId,
      name,
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
      isActive,
    } = req.body;

    if (medicineCategory !== undefined) medicine.medicineCategory = medicineCategory;
    if (medicineSubCategory !== undefined || subCategoryId !== undefined) {
      const targetSub = medicineSubCategory || subCategoryId;
      medicine.medicineSubCategory = targetSub;
      medicine.subCategoryId = targetSub ? targetSub.toString() : "";
    }

    if (name !== undefined) medicine.name = name;
    if (description !== undefined) medicine.description = description;
    if (type !== undefined) medicine.type = type;
    if (delivery !== undefined) medicine.delivery = delivery;

    if (newPrice !== undefined || price !== undefined) {
      const p = Number(newPrice ?? price);
      medicine.newPrice = p;
      medicine.price = p;
    }

    if (oldPrice !== undefined || mrp !== undefined || originalPrice !== undefined) {
      const op = Number(oldPrice ?? mrp ?? originalPrice);
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
    if (quantity !== undefined) medicine.quantity = Number(quantity);
    if (stock !== undefined) {
      medicine.stock = stock !== null ? Number(stock) : null;
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

    res.json({
      success: true,
      message: "Medicine updated successfully",
      data: formatMedicineItem(medicine),
    });
  } catch (err) {
    console.error("UPDATE MEDICINE ERROR:", err);
    res.status(500).json({
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
