
const MedicineCategory = require(
  "../models/medicineCategory.model"
);


// ==========================================
// ✅ CREATE CATEGORY
// ==========================================
exports.createMedicineCategory = async (req, res) => {
  try {
    const {
      category,
      title,
      image,
      isFree,
      parentId,
      slug,
      isActive,
    } = req.body;

    // ✅ VALIDATION - title is required
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const categorySlug =
      slug ||
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    let imageData = image || {};
    if (typeof imageData === "string") {
      imageData = { url: imageData, publicId: "" };
    }

    // ✅ CREATE
    const data = await MedicineCategory.create({
      category: category || null,
      title: title.trim(),
      image: imageData,
      isFree: Boolean(isFree),
      parentId: parentId || null,
      slug: categorySlug,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: "Medicine category created successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Helper to format category according to doc
function formatCategory(cat) {
  const doc = cat.toObject ? cat.toObject() : cat;
  const img =
    typeof doc.image === "string"
      ? { url: doc.image, publicId: "" }
      : doc.image || { url: "", publicId: "" };

  return {
    _id: doc._id?.toString() || "",
    id: doc._id?.toString() || "",
    title: doc.title || "",
    image: {
      url: img.url || "",
      publicId: img.publicId || "",
    },
    isFree: doc.isFree ?? false,
    isActive: doc.isActive ?? true,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    slug: doc.slug || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(doc.category ? { category: doc.category } : {}),
  };
}

// ==========================================
// ✅ GET ALL
// ==========================================
exports.getMedicineCategories = async (req, res) => {
  try {
    const data = await MedicineCategory.find({
      isActive: true,
    })
      .populate("category", "title")
      .sort({
        createdAt: -1,
      });

    const formatted = data.map(formatCategory);

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
// ✅ GET BY MAIN CATEGORY
// ==========================================
exports.getByCategory = async (req, res) => {
  try {
    const data = await MedicineCategory.find({
      category: req.params.id,
      isActive: true,
    }).sort({
      createdAt: -1,
    });

    const formatted = data.map(formatCategory);

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
exports.getMedicineCategoryById = async (req, res) => {
  try {
    const data = await MedicineCategory.findById(req.params.id).populate(
      "category",
      "title"
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Medicine category not found",
      });
    }

    res.json({
      success: true,
      data: formatCategory(data),
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
exports.updateMedicineCategory =
  async (req, res) => {
    try {

      const updated =
        await MedicineCategory.findByIdAndUpdate(
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
            "Medicine category not found"
        });
      }

      res.json({
        success: true,
        message:
          "Medicine category updated successfully",
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
exports.deleteMedicineCategory =
  async (req, res) => {
    try {

      const deleted =
        await MedicineCategory.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message:
            "Medicine category not found"
        });
      }

      res.json({
        success: true,
        message:
          "Medicine category deleted successfully"
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  };

