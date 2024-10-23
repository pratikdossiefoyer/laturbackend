// ownerModel.js
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const ownerSchema = new mongoose.Schema({
  // User-specific fields
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function () {
      return !this.googleId && !this.facebookId && !this.instagramId;
    },
  },
  // Update the role field to reference the Role model
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role", // This will be resolved in the common database
    required: true,
  },
  isApproved: { type: Boolean, default: true },
  lastLogin: { type: Date },
  lastLogout: { type: Date },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  resetPasswordOTP: String,
  resetPasswordOTPExpires: Date,
  otp: String,
  otpExpires: Date,
  newEmail: {
    type: String,
    validate: {
      validator: function (v) {
        return v === null || v.length > 0;
      },
      message: "New email cannot be empty",
    },
  },
  emailOtp: String,
  emailOtpExpires: Date,
  googleId: String,
  facebookId: String,
  instagramId: String,

  // Owner-specific fields
  name: { type: String, required: false },
  number: { type: String, required: false },
  address: { type: String, required: false },
  gender: { type: String, enum: ["male", "female", "other"], required: false },
  idProof: {
    data: Buffer,
    contentType: String,
  },
  hostels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hostel" }],
});

ownerSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

export const initOwnerModel = (ownerDB, commonDB) => {
  if (!ownerDB || !commonDB) {
    console.error("Database connections not provided to initOwnerModel");
    return null;
  }

  // Check if the model already exists to avoid re-compilation
  if (ownerDB.models.Owner) {
    return ownerDB.models.Owner;
  }

  // Register the schema with the ownerDB connection
  const Owner = ownerDB.model("Owner", ownerSchema);

  // Add methods that need to access the commonDB
  Owner.prototype.getHostels = async function () {
    return await commonDB.model("Hostel").find({ _id: { $in: this.hostels } });
  };

  // Add a method to get the role from the common database
  Owner.prototype.getRole = async function () {
    return await commonDB.model("Role").findById(this.role);
  };

  // Override the toJSON method to populate the role
  Owner.prototype.toJSON = function () {
    var obj = this.toObject();
    if (obj.role && typeof obj.role !== "string") {
      obj.role = obj.role.name; // Assuming the role has a 'name' field
    }
    return obj;
  };

  return Owner;
};
