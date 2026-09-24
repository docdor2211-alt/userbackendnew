// controllers/addressController.js

const Address = require("../models/addressModel");

// ================= CREATE ADDRESS =================

exports.createAddress = async (req, res) => {
  try {
    const {
      type,
      fullAddress,
      landmark,
      city,
      state,
      pincode,
      recipientName,
      recipientPhone,
      isDefault,
    } = req.body;

    // ================= VALIDATION =================

    if (!fullAddress || fullAddress.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Full address is required",
      });
    }

    // ================= DEFAULT HANDLING =================

    if (isDefault) {
      await Address.updateMany(
        { user: req.user._id },
        { $set: { isDefault: false } }
      );
    }

    const address = await Address.create({
      user: req.user._id,
      type: type || "Home",
      fullAddress: fullAddress.trim(),
      landmark: landmark || "",
      city: city || "",
      state: state || "",
      pincode: pincode || "",
      recipientName: recipientName || "",
      recipientPhone: recipientPhone || "",
      isDefault: isDefault || false,
    });

    return res.status(201).json({
      success: true,
      message: "Address saved successfully",
      data: address,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ALL ADDRESSES =================

exports.getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET SINGLE ADDRESS =================

exports.getAddressById = async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE ADDRESS =================

exports.updateAddress = async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const {
      type,
      fullAddress,
      landmark,
      city,
      state,
      pincode,
      recipientName,
      recipientPhone,
      isDefault,
    } = req.body;

    // ================= DEFAULT HANDLING =================

    if (typeof isDefault !== "undefined" && isDefault) {
      await Address.updateMany(
        { user: req.user._id, _id: { $ne: address._id } },
        { $set: { isDefault: false } }
      );
    }

    address.type = type || address.type;
    address.fullAddress =
      fullAddress && fullAddress.trim() !== ""
        ? fullAddress.trim()
        : address.fullAddress;
    address.landmark = landmark !== undefined ? landmark : address.landmark;
    address.city = city !== undefined ? city : address.city;
    address.state = state !== undefined ? state : address.state;
    address.pincode = pincode !== undefined ? pincode : address.pincode;
    address.recipientName =
      recipientName !== undefined ? recipientName : address.recipientName;
    address.recipientPhone =
      recipientPhone !== undefined ? recipientPhone : address.recipientPhone;
    address.isDefault =
      typeof isDefault !== "undefined" ? isDefault : address.isDefault;

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= SET DEFAULT ADDRESS =================

exports.setDefaultAddress = async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await Address.updateMany(
      { user: req.user._id },
      { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Default address set",
      data: address,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DELETE ADDRESS =================

exports.deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};