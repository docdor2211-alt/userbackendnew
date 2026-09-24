// controllers/legalPolicyController.js

const LegalPolicy = require("../models/legalPolicyModel");

// ================= GET ALL POLICIES =================

exports.getPolicies = async (req, res) => {
  try {
    let filter = { isActive: true };

    if (typeof req.query.isActive !== "undefined") {
      filter.isActive = req.query.isActive === "true";
    }

    const policies = await LegalPolicy.find(filter).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: policies.length,
      data: policies,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET POLICY BY SLUG =================

exports.getPolicyBySlug = async (req, res) => {
  try {
    const policy = await LegalPolicy.findOne({
      slug: req.params.slug.toLowerCase(),
      isActive: true,
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: "Policy not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= CREATE POLICY (ADMIN) =================

exports.createPolicy = async (req, res) => {
  try {
    const { title, slug, summary, sections, isActive } = req.body;

    if (!title || !slug) {
      return res.status(400).json({
        success: false,
        message: "Title and slug are required",
      });
    }

    const existing = await LegalPolicy.findOne({ slug: slug.toLowerCase() });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Policy with this slug already exists",
      });
    }

    const policy = await LegalPolicy.create({
      title,
      slug: slug.toLowerCase(),
      summary: summary || "",
      sections: sections || [],
      isActive,
    });

    return res.status(201).json({
      success: true,
      message: "Policy created successfully",
      data: policy,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE POLICY (ADMIN) =================

exports.updatePolicy = async (req, res) => {
  try {
    const policy = await LegalPolicy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: "Policy not found",
      });
    }

    const { title, slug, summary, sections, isActive } = req.body;

    if (title !== undefined) policy.title = title;
    if (slug !== undefined) policy.slug = slug.toLowerCase();
    if (summary !== undefined) policy.summary = summary;
    if (sections !== undefined) policy.sections = sections;
    if (typeof isActive !== "undefined") policy.isActive = isActive;

    await policy.save();

    return res.status(200).json({
      success: true,
      message: "Policy updated successfully",
      data: policy,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DELETE POLICY (ADMIN) =================

exports.deletePolicy = async (req, res) => {
  try {
    const policy = await LegalPolicy.findByIdAndDelete(req.params.id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: "Policy not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Policy deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};