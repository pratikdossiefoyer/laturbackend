// studentModel.js
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  // Required fields
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function () {
      return !this.googleId && !this.facebookId && !this.instagramId;
    },
  },

  // Optional fields (but accepted during registration)
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true,
  },
  isApproved: { type: Boolean, default: false },
  name: { type: String },
  number: { type: String },
  parentnumber: { type: String },
  parentname: { type: String },
  class: { type: String },
  year: { type: String },
  school: { type: String },
  gender: { type: String, enum: ["male", "female", "other"] },
  college: { type: String },
  city: { type: String },
  address: { type: String },
  lastLogin: { type: Date },
  lastLogout: { type: Date },
  otp: String,
  otpExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  resetPasswordOTP: String,
  resetPasswordOTPExpires: Date,
  newEmail: { type: String },
  emailOtp: String,
  emailOtpExpires: Date,
  googleId: String,
  facebookId: String,
  instagramId: String,
  passportPhoto: {
    data: Buffer,
    contentType: String,
  },
  authProvider: { type: String, enum: ["local", "google"], default: "local" },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hostel" }],
  admittedHostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },

  wishlistSubmitted: { type: Boolean, default: false },
  wishlistApproved: { type: Boolean, default: false },
  cashbackApplied: { type: Boolean, default: false },

  admissionReceipt: {
    data: Buffer,
    contentType: String,
  },
  hostelVisits: [
    {
      hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
      visitDate: Date,
      visitTime: String,
      status: {
        type: String,
        enum: [
          "pending",
          "accepted",
          "rejected",
          "completed",
          "not_interested",
        ],
        default: "pending",
      },
    },
  ],
  complaints: [
    {
      hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
      description: String,
      isAnonymous: Boolean,
      images: [
        {
          data: Buffer,
          contentType: String,
        },
      ],
      date: { type: Date, default: Date.now },
      noticed: { type: Boolean, default: false },
    },
  ],
});

studentSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    try {
      console.log("Hashing password for student:", this.email);
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      console.log("Password hashed successfully");
    } catch (error) {
      console.error("Error hashing password:", error);
      return next(error);
    }
  }
  next();
});

// Single password validation method
studentSchema.methods.isValidPassword = async function (candidatePassword) {
  try {
    console.log("Attempting password comparison");
    console.log("Candidate password exists:", !!candidatePassword);
    console.log("Stored hash exists:", !!this.password);

    // Development mode check
    if (process.env.NODE_ENV === "development" && candidatePassword === "123") {
      console.log("Development mode: allowing test password");
      return true;
    }

    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    console.log("Password comparison result:", isMatch);
    return isMatch;
  } catch (error) {
    console.error("Password validation error:", error);
    throw error;
  }
};
export const initStudentModel = (studentDB, commonDB) => {
  if (!studentDB || !commonDB) {
    console.error("Database connections not provided to initStudentModel");
    return null;
  }
  if (studentDB.models.Student) {
    return studentDB.models.Student;
  }

  const Student = studentDB.model("Student", studentSchema);

  // Set up references to the common database
  Student.prototype.getWishlist = async function () {
    return await commonDB.model("Hostel").find({ _id: { $in: this.wishlist } });
  };

  Student.prototype.getAdmittedHostel = async function () {
    return await commonDB.model("Hostel").findById(this.admittedHostel);
  };

  // Add a method to get the role from the common database
  Student.prototype.getRole = async function () {
    return await commonDB.model("Role").findById(this.role);
  };

  // Override the toJSON method to populate the role
  Student.prototype.toJSON = function () {
    var obj = this.toObject();
    if (obj.role && typeof obj.role !== "string") {
      obj.role = obj.role.name;
    }
    return obj;
  };

  return Student;
};
