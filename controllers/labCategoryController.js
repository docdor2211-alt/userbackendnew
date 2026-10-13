const LabCategory = require("../models/LabCategoryModel");
const { uploadFile, deleteFile } = require("../utils/bunnyUpload");

// Helper to format lab category to match frontend documentation
const formatLabCategory = (item) => {
  if (!item) return null;
  const doc = item.toObject ? item.toObject() : { ...item };

  let image = doc.image;
  if (!image) {
    image = { url: "", publicId: "" };
  } else if (typeof image === "string") {
    image = { url: image, publicId: "" };
  } else if (typeof image === "object") {
    image = {
      url: image.url || "",
      publicId: image.publicId || "",
    };
  }

  return {
    _id: doc._id ? doc._id.toString() : "",
    name: doc.name || "",
    image,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

// ================= CREATE =================
exports.createLabCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name required",
      });
    }

    let imageData = { url: "", publicId: "" };

    // ✅ IMAGE (file upload)
    if (req.files && req.files.image && req.files.image.length > 0) {
      const uploadRes = await uploadFile(req.files.image[0]);
      imageData = {
        url: uploadRes.url,
        publicId: uploadRes.publicId,
      };
    } else if (req.body.image) {
      if (typeof req.body.image === "string") {
        imageData = { url: req.body.image, publicId: "" };
      } else if (typeof req.body.image === "object") {
        imageData = {
          url: req.body.image.url || "",
          publicId: req.body.image.publicId || "",
        };
      }
    } else if (req.body.imageUrl) {
      imageData = { url: req.body.imageUrl, publicId: "" };
    }

    const category = await LabCategory.create({
      name,
      image: imageData,
    });

    res.status(201).json({
      success: true,
      message: "Lab category created successfully",
      data: formatLabCategory(category),
    });
  } catch (err) {
    console.log("CREATE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET ALL =================
exports.getLabCategories = async (req, res) => {
  try {
    const data = await LabCategory.find().sort({ createdAt: -1 });

    const formattedData = data.map(formatLabCategory);

    res.json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (err) {
    console.log("GET ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET SINGLE =================
exports.getLabCategoryById = async (req, res) => {
  try {
    const item = await LabCategory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: formatLabCategory(item),
    });
  } catch (err) {
    console.log("GET ONE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= UPDATE =================
exports.updateLabCategory = async (req, res) => {
  try {
    const item = await LabCategory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const { name } = req.body;

    if (name) item.name = name;

    // ✅ IMAGE UPDATE
    if (req.files && req.files.image && req.files.image.length > 0) {
      // old image delete
      if (item.image?.publicId) {
        await deleteFile(item.image.publicId);
      }

      const uploadRes = await uploadFile(req.files.image[0]);

      item.image = {
        url: uploadRes.url,
        publicId: uploadRes.publicId,
      };
    } else if (req.body.image) {
      if (typeof req.body.image === "string") {
        item.image = { url: req.body.image, publicId: "" };
      } else if (typeof req.body.image === "object") {
        item.image = {
          url: req.body.image.url || "",
          publicId: req.body.image.publicId || "",
        };
      }
    } else if (req.body.imageUrl) {
      item.image = { url: req.body.imageUrl, publicId: "" };
    }

    await item.save();

    res.json({
      success: true,
      message: "Category updated successfully",
      data: formatLabCategory(item),
    });
  } catch (err) {
    console.log("UPDATE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= DELETE =================
exports.deleteLabCategory = async (req, res) => {
  try {
    const item = await LabCategory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // image delete
    if (item.image?.publicId) {
      await deleteFile(item.image.publicId);
    }

    await item.deleteOne();

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (err) {
    console.log("DELETE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};