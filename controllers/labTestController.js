const LabTest = require("../models/LabTestModel");
const { uploadFile, deleteFile } = require("../utils/bunnyUpload");

// Helper to format lab test to match frontend documentation
const formatLabTest = (item) => {
  if (!item) return null;
  const doc = item.toObject ? item.toObject() : { ...item };

  // checkupType: populate object or string
  let checkupType = null;
  if (doc.checkupType && typeof doc.checkupType === "object" && doc.checkupType._id) {
    checkupType = {
      _id: doc.checkupType._id.toString(),
      title: doc.checkupType.title || "",
      slug: doc.checkupType.slug || "",
      image: doc.checkupType.image || "",
    };
  } else if (doc.checkupType) {
    checkupType = doc.checkupType.toString();
  }

  // labCategory / category: populate object { _id, name }
  const catObj = doc.labCategory || doc.category;
  let labCategory = null;
  if (catObj && typeof catObj === "object" && catObj._id) {
    labCategory = {
      _id: catObj._id.toString(),
      name: catObj.name || "",
      image: catObj.image || "",
    };
  } else if (catObj) {
    labCategory = {
      _id: catObj.toString(),
      name: "",
    };
  }

  // image: ensure object { url, publicId } or string
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

  const actualPrice =
    typeof doc.actualPrice === "number"
      ? doc.actualPrice
      : Number(doc.actualPrice) || 0;
  const salePrice =
    typeof doc.salePrice === "number"
      ? doc.salePrice
      : Number(doc.salePrice) || 0;
  const totalTests =
    typeof doc.totalTests === "number"
      ? doc.totalTests
      : Number(doc.totalTests) || 0;

  const guidelines = Array.isArray(doc.guidelines)
    ? doc.guidelines.map((g) => ({
        text: typeof g === "string" ? g : g.text || "",
      }))
    : [];

  const parameters = Array.isArray(doc.parameters)
    ? doc.parameters.map((p) => ({
        title: p.title || "",
        description: p.description || "",
      }))
    : [];

  return {
    _id: doc._id ? doc._id.toString() : "",
    title: doc.title || "",
    shortDescription: doc.shortDescription || "",
    description: doc.description || "",
    checkupType,
    actualPrice,
    salePrice,
    reportTime: doc.reportTime || "24 hours",
    totalTests,
    labCategory,
    category: labCategory, // Backwards compatibility
    image,
    recommended: Boolean(doc.recommended),
    bestSeller: Boolean(doc.bestSeller),
    homeSample: doc.homeSample !== undefined ? Boolean(doc.homeSample) : true,
    digitalReport:
      doc.digitalReport !== undefined ? Boolean(doc.digitalReport) : true,
    nablCertified:
      doc.nablCertified !== undefined ? Boolean(doc.nablCertified) : true,
    guidelines,
    parameters,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const parseGuidelines = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((g) =>
      typeof g === "string" ? { text: g } : { text: g.text || "" }
    );
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map((g) =>
          typeof g === "string" ? { text: g } : { text: g.text || "" }
        );
      }
    } catch {
      return input.trim() ? [{ text: input.trim() }] : [];
    }
  }
  return [];
};

const parseParameters = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((p) => ({
      title: p.title || "",
      description: p.description || "",
    }));
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => ({
          title: p.title || "",
          description: p.description || "",
        }));
      }
    } catch {
      return [];
    }
  }
  return [];
};

// ================= CREATE =================
exports.createLabTest = async (req, res) => {
  try {
    const {
      title,
      shortDescription,
      description,
      category,
      labCategory,
      checkupType,
      actualPrice,
      salePrice,
      reportTime,
      totalTests,
      recommended,
      bestSeller,
      homeSample,
      digitalReport,
      nablCertified,
      guidelines,
      parameters,
    } = req.body;

    const catId = labCategory || category;

    if (!title || !catId || !checkupType) {
      return res.status(400).json({
        success: false,
        message: "Title, category, and checkupType are required",
      });
    }

    // ================= IMAGE =================
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

    // ================= CREATE =================
    const newTest = await LabTest.create({
      title: title.trim(),
      shortDescription: shortDescription || "",
      description: description || "",
      category: catId,
      labCategory: catId,
      checkupType,
      actualPrice: Number(actualPrice) || 0,
      salePrice: Number(salePrice) || 0,
      reportTime: reportTime || "24 hours",
      totalTests: Number(totalTests) || 0,
      recommended: recommended === true || recommended === "true",
      bestSeller: bestSeller === true || bestSeller === "true",
      homeSample:
        homeSample === undefined ? true : homeSample === true || homeSample === "true",
      digitalReport:
        digitalReport === undefined
          ? true
          : digitalReport === true || digitalReport === "true",
      nablCertified:
        nablCertified === undefined
          ? true
          : nablCertified === true || nablCertified === "true",
      guidelines: parseGuidelines(guidelines),
      parameters: parseParameters(parameters),
      image: imageData,
    });

    const populated = await LabTest.findById(newTest._id)
      .populate("checkupType", "_id title slug image")
      .populate("labCategory", "_id name image")
      .populate("category", "_id name image");

    res.status(201).json({
      success: true,
      message: "Lab Test created successfully",
      data: formatLabTest(populated),
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
exports.getLabTests = async (req, res) => {
  try {
    let filter = {};

    if (req.query.recommended !== undefined) {
      filter.recommended = req.query.recommended === "true";
    }

    if (req.query.bestSeller !== undefined) {
      filter.bestSeller = req.query.bestSeller === "true";
    }

    const catQuery = req.query.category || req.query.labCategory;
    if (catQuery) {
      filter.$or = [{ labCategory: catQuery }, { category: catQuery }];
    }

    if (req.query.checkupType) {
      filter.checkupType = req.query.checkupType;
    }

    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: "i" };
      const searchCondition = [
        { title: searchRegex },
        { shortDescription: searchRegex },
        { description: searchRegex },
      ];
      if (filter.$or) {
        filter = { $and: [{ $or: filter.$or }, { $or: searchCondition }] };
      } else {
        filter.$or = searchCondition;
      }
    }

    const data = await LabTest.find(filter)
      .populate("checkupType", "_id title slug image")
      .populate("labCategory", "_id name image")
      .populate("category", "_id name image")
      .sort({ createdAt: -1 });

    const formattedData = data.map(formatLabTest);

    res.status(200).json({
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
exports.getLabTestById = async (req, res) => {
  try {
    const item = await LabTest.findById(req.params.id)
      .populate("checkupType", "_id title slug image")
      .populate("labCategory", "_id name image")
      .populate("category", "_id name image");

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Lab Test not found",
      });
    }

    res.status(200).json({
      success: true,
      data: formatLabTest(item),
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
exports.updateLabTest = async (req, res) => {
  try {
    const item = await LabTest.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Lab Test not found",
      });
    }

    const {
      title,
      shortDescription,
      description,
      category,
      labCategory,
      checkupType,
      actualPrice,
      salePrice,
      reportTime,
      totalTests,
      recommended,
      bestSeller,
      homeSample,
      digitalReport,
      nablCertified,
      guidelines,
      parameters,
    } = req.body;

    if (title !== undefined) item.title = title.trim();
    if (shortDescription !== undefined) item.shortDescription = shortDescription;
    if (description !== undefined) item.description = description;

    const catId = labCategory !== undefined ? labCategory : category;
    if (catId !== undefined) {
      item.category = catId;
      item.labCategory = catId;
    }

    if (checkupType !== undefined) item.checkupType = checkupType;
    if (actualPrice !== undefined) item.actualPrice = Number(actualPrice) || 0;
    if (salePrice !== undefined) item.salePrice = Number(salePrice) || 0;
    if (reportTime !== undefined) item.reportTime = reportTime;
    if (totalTests !== undefined) item.totalTests = Number(totalTests) || 0;

    if (recommended !== undefined) {
      item.recommended = recommended === true || recommended === "true";
    }
    if (bestSeller !== undefined) {
      item.bestSeller = bestSeller === true || bestSeller === "true";
    }
    if (homeSample !== undefined) {
      item.homeSample = homeSample === true || homeSample === "true";
    }
    if (digitalReport !== undefined) {
      item.digitalReport = digitalReport === true || digitalReport === "true";
    }
    if (nablCertified !== undefined) {
      item.nablCertified = nablCertified === true || nablCertified === "true";
    }

    if (guidelines !== undefined) {
      item.guidelines = parseGuidelines(guidelines);
    }

    if (parameters !== undefined) {
      item.parameters = parseParameters(parameters);
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

    const populated = await LabTest.findById(item._id)
      .populate("checkupType", "_id title slug image")
      .populate("labCategory", "_id name image")
      .populate("category", "_id name image");

    res.status(200).json({
      success: true,
      message: "Lab Test updated successfully",
      data: formatLabTest(populated),
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
exports.deleteLabTest = async (req, res) => {
  try {
    const item = await LabTest.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Lab Test not found",
      });
    }

    if (item.image?.publicId) {
      await deleteFile(item.image.publicId);
    }

    await item.deleteOne();

    res.status(200).json({
      success: true,
      message: "Lab Test deleted successfully",
    });
  } catch (err) {
    console.log("DELETE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};