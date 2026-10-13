
const MedicineSubCategory =
  require(
    "../models/medicineSubCategory.model"
  );


// Helper to format subcategory for frontend
function formatSubCategory(sub) {
  const doc = sub.toObject ? sub.toObject() : sub;
  const img =
    typeof doc.image === "string"
      ? { url: doc.image, publicId: "" }
      : doc.image || { url: "", publicId: "" };
  const displayName = doc.name || doc.title || "";

  let medCat = doc.medicineCategory;
  if (medCat && typeof medCat === "object") {
    medCat = {
      _id: medCat._id?.toString() || "",
      title: medCat.title || "",
      ...(medCat.slug ? { slug: medCat.slug } : {}),
    };
  } else if (medCat) {
    medCat = { _id: medCat.toString() };
  } else {
    medCat = null;
  }

  return {
    _id: doc._id?.toString() || "",
    id: doc._id?.toString() || "",
    name: displayName,
    title: displayName,
    medicineCategory: medCat,
    image: {
      url: img.url || "",
      publicId: img.publicId || "",
    },
    isActive: doc.isActive ?? true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ==========================================
// ✅ CREATE
// ==========================================
exports.createMedicineSubCategory = async (req, res) => {
  try {
    const { medicineCategory, title, name, image, isActive } = req.body;
    const displayName = (name || title || "").trim();

    if (!medicineCategory || !displayName) {
      return res.status(400).json({
        success: false,
        message: "medicineCategory and name/title required",
      });
    }

    let imageData = image || {};
    if (typeof imageData === "string") {
      imageData = { url: imageData, publicId: "" };
    }

    const data = await MedicineSubCategory.create({
      medicineCategory,
      name: displayName,
      title: displayName,
      image: imageData,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: "Medicine sub category created successfully",
      data: formatSubCategory(data),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ==========================================
// ✅ GET ALL
// ==========================================
exports.getMedicineSubCategories = async (req, res) => {
  try {
    const data = await MedicineSubCategory.find({
      isActive: true,
    })
      .populate("medicineCategory", "_id title slug")
      .sort({
        createdAt: -1,
      });

    const formatted = data.map(formatSubCategory);

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ==========================================
// ✅ GET BY CATEGORY
// ==========================================
exports.getByMedicineCategory = async (req, res) => {
  try {
    const data = await MedicineSubCategory.find({
      medicineCategory: req.params.id,
      isActive: true,
    })
      .populate("medicineCategory", "_id title slug")
      .sort({
        createdAt: -1,
      });

    const formatted = data.map(formatSubCategory);

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ==========================================
// ✅ GET SINGLE
// ==========================================
exports.getMedicineSubCategoryById = async (req, res) => {
  try {
    const data = await MedicineSubCategory.findById(req.params.id).populate(
      "medicineCategory",
      "_id title slug"
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Medicine sub category not found",
      });
    }

    res.json({
      success: true,
      data: formatSubCategory(data),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



// ==========================================
// ✅ UPDATE
// ==========================================
exports.updateMedicineSubCategory =
  async (req, res) => {
    try {

      const updated =
        await MedicineSubCategory.findByIdAndUpdate(
          req.params.id,

          req.body,

          {
            new: true,
            runValidators: true
          }
        );

      if (!updated) {
        return res.status(404).json({
          success: false,
          message:
            "Medicine sub category not found"
        });
      }

      res.json({
        success: true,
        message:
          "Medicine sub category updated successfully",
        data: updated
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  };



// ==========================================
// ✅ DELETE
// ==========================================
exports.deleteMedicineSubCategory =
  async (req, res) => {
    try {

      const deleted =
        await MedicineSubCategory.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message:
            "Medicine sub category not found"
        });
      }

      res.json({
        success: true,
        message:
          "Medicine sub category deleted successfully"
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  };

