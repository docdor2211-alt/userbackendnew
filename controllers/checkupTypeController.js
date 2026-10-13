const CheckupType = require("../models/CheckupTypeModel");
const { uploadFile, deleteFile } = require("../utils/bunnyUpload");

// Helper to format checkup type to match frontend documentation
const formatCheckupType = (item) => {
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
    title: doc.title || "",
    slug: doc.slug || "",
    image,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const generateSlug = (text) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

// ================= CREATE =================
exports.createCheckupType = async (req, res) => {
  try {
    const { title, slug } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const finalSlug = slug ? generateSlug(slug) : generateSlug(title);

    let imageData = { url: "", publicId: "" };

    if (req.files?.image?.[0]) {
      const uploaded = await uploadFile(req.files.image[0]);
      imageData = {
        url: uploaded.url,
        publicId: uploaded.publicId,
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

    const data = await CheckupType.create({
      title: title.trim(),
      slug: finalSlug,
      image: imageData,
    });

    res.status(201).json({
      success: true,
      message: "Checkup Type created successfully",
      data: formatCheckupType(data),
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
exports.getCheckupTypes = async (req, res) => {
  try {
    const data = await CheckupType.find().sort({ createdAt: -1 });

    const formattedData = data.map(formatCheckupType);

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
exports.getCheckupTypeById = async (req, res) => {
  try {
    const item = await CheckupType.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Checkup Type not found",
      });
    }

    res.json({
      success: true,
      data: formatCheckupType(item),
    });
  } catch (err) {
    console.log("GET SINGLE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= UPDATE =================
exports.updateCheckupType = async (req, res) => {
  try {
    const item = await CheckupType.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Checkup Type not found",
      });
    }

    const { title, slug } = req.body;

    if (title) {
      item.title = title.trim();
      if (!slug) {
        item.slug = generateSlug(title);
      }
    }

    if (slug) {
      item.slug = generateSlug(slug);
    }

    // IMAGE UPDATE
    if (req.files?.image?.[0]) {
      if (item.image?.publicId) {
        await deleteFile(item.image.publicId);
      }

      const uploaded = await uploadFile(req.files.image[0]);
      item.image = {
        url: uploaded.url,
        publicId: uploaded.publicId,
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
      message: "Checkup Type updated successfully",
      data: formatCheckupType(item),
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
exports.deleteCheckupType = async (req, res) => {
  try {
    const item = await CheckupType.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Checkup Type not found",
      });
    }

    // DELETE IMAGE
    if (item.image?.publicId) {
      await deleteFile(item.image.publicId);
    }

    await item.deleteOne();

    res.json({
      success: true,
      message: "Checkup Type deleted successfully",
    });
  } catch (err) {
    console.log("DELETE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};