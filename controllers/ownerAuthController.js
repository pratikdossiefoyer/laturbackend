// controllers/ownerAuthController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { initOwnerModel } from "../models/ownerModel.js";
import nodemailer from "nodemailer";
import { initStudentModel } from "../models/studentModel.js";
import dotenv from "dotenv";
import crypto from "crypto";
import { initRoleModel } from "../models/roleModel.js";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const registerOwner = async (req, res) => {
  console.log("Initiating owner registration with body:", {
    hasEmail: !!req.body.email,
    hasPassword: !!req.body.password,
    fields: Object.keys(req.body),
  });

  try {
    const { email, password, ...profileData } = req.body;

    // Validate required fields
    if (!email || !password) {
      console.error("Missing required fields:", {
        email: !!email,
        password: !!password,
      });
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const ownerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;
    const studentDB = req.app.locals.studentDB;

    if (!ownerDB || !commonDB || !studentDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(ownerDB, commonDB);
    const Student = initStudentModel(studentDB, commonDB);
    const Role = initRoleModel(commonDB);

    // Find owner role
    const ownerRole = await Role.findOne({ name: "hostelOwner" });
    if (!ownerRole) {
      console.error("Owner role not found");
      return res.status(500).json({ message: "Owner role not configured" });
    }

    // Check for existing owner in owner database
    const existingOwner = await Owner.findOne({
      email: email.toLowerCase().trim(),
    });

    // Check for existing student in student database
    const existingStudent = await Student.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingOwner || existingStudent) {
      return res.status(400).json({
        message: "Email already exists",
        type: existingOwner ? "owner" : "student",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Store registration data in session
    const registrationData = {
      email: email.toLowerCase().trim(),
      password,
      role: ownerRole._id,
      otp,
      otpExpires,
      ...profileData,
    };

    // Debug log before storing in session
    console.log("Storing registration data in session:", {
      email: registrationData.email,
      hasPassword: !!registrationData.password,
      otpExists: !!registrationData.otp,
      roleId: registrationData.role,
    });

    req.session.pendingRegistration = registrationData;

    // Force session save and verify
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        resolve();
      });
    });

    // Send email
    const mailOptions = {
      to: email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels Owner Registration OTP",
      text: `Your OTP for registration is: ${otp}\n\nThis OTP will expire in 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Verification code sent to your email",
      email: email,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

export const verifyRegistrationOtpOwner = async (req, res) => {
  console.log("Starting OTP verification with body:", {
    hasEmail: !!req.body.email,
    hasOtp: !!req.body.otp,
  });

  try {
    const { email, otp } = req.body;

    // Debug session data
    console.log("Current session data:", {
      hasPendingReg: !!req.session.pendingRegistration,
      regEmail: req.session.pendingRegistration?.email,
      hasPassword: !!req.session.pendingRegistration?.password,
    });

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const ownerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    if (!ownerDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(ownerDB, commonDB);
    const pendingRegistration = req.session.pendingRegistration;

    if (!pendingRegistration || !pendingRegistration.password) {
      console.error("Missing registration data:", {
        exists: !!pendingRegistration,
        hasPassword: !!pendingRegistration?.password,
      });
      return res.status(400).json({
        message:
          "Registration data not found or incomplete. Please register again.",
      });
    }

    // Verify OTP
    if (pendingRegistration.otp !== otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // Check OTP expiration
    if (new Date() > new Date(pendingRegistration.otpExpires)) {
      return res.status(401).json({ message: "OTP has expired" });
    }

    // Create new owner
    const newOwner = new Owner({
      email: email.toLowerCase().trim(),
      password: pendingRegistration.password,
      role: pendingRegistration.role,
      isApproved: true,
      ...pendingRegistration,
    });

    // Debug before saving
    console.log("About to save new owner:", {
      email: newOwner.email,
      hasPassword: !!newOwner.password,
      roleId: newOwner.role,
    });

    await newOwner.save();
    console.log("Owner saved successfully");

    // Clear registration data
    delete req.session.pendingRegistration;
    await new Promise((resolve) => req.session.save(resolve));

    res.status(201).json({
      message: "Registration completed successfully",
      owner: {
        _id: newOwner._id,
        email: newOwner.email,
        role: "hostelOwner",
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({
      message: "Registration completion failed",
      error: error.message,
    });
  }
};

export const loginOwner = async (req, res) => {
  console.log("Attempting owner/admin login");
  try {
    const { email, password } = req.body;
    const ownerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    console.log("ownerDB:", ownerDB ? "connected" : "not connected");
    console.log("commonDB:", commonDB ? "connected" : "not connected");

    if (!ownerDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(ownerDB, commonDB);
    const Role = initRoleModel(commonDB);

    console.log("Owner model:", Owner ? "initialized" : "not initialized");
    console.log("Role model:", Role ? "initialized" : "not initialized");

    if (!Owner || !Role) {
      console.error("Failed to initialize models");
      return res.status(500).json({ message: "Failed to initialize models" });
    }

    // Find owner and populate role
    console.log("Searching for user with email:", email);
    const owner = await Owner.findOne({ email }).populate({
      path: "role",
      model: commonDB.model("Role"),
    });

    if (!owner) {
      console.log("User not found");
      return res.status(401).json({ message: "Email not found" });
    }

    // Debug password comparison
    console.log("Debug password info:", {
      hasStoredPassword: !!owner.password,
      providedPassword: !!password,
      storedPasswordLength: owner.password?.length,
    });

    // Using the isValidPassword method from the schema
    const isMatch = await owner.isValidPassword(password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Incorrect password");
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Check if user is either hostelOwner or admin
    if (
      !owner.role ||
      (owner.role.name !== "hostelOwner" && owner.role.name !== "admin")
    ) {
      console.log("Invalid user role:", owner.role?.name);
      return res.status(401).json({ message: "Invalid user role" });
    }

    // Generate token with role information
    console.log("Generating JWT token");
    const token = jwt.sign(
      {
        id: owner._id,
        email: owner.email,
        role: owner.role.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Update last login
    owner.lastLogin = new Date();
    await owner.save();
    console.log("Last login updated");

    // Prepare response data
    const userData = {
      profileId: owner._id,
      email: owner.email,
      name: owner.name,
      role: owner.role.name,
    };

    // Add role-specific data
    if (owner.role.name === "hostelOwner") {
      userData.hostels = owner.hostels;
    }

    // Add additional data for admin users
    if (owner.role.name === "admin") {
      userData.isAdmin = true;
    }

    res.json({
      token,
      userData,
      message: `Login successful as ${owner.role.name}`,
    });

    console.log(`Login successful for ${owner.email} as ${owner.role.name}`);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

export const logoutOwner = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const ownerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    if (!ownerDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(ownerDB, commonDB);
    const owner = await Owner.findById(ownerId);

    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    owner.lastLogout = new Date();
    await owner.save();

    res.status(200).json({
      message: "Logged out successfully",
      lastLogout: owner.lastLogout,
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const generateAndSendOTPOwner = async (req, res) => {
  const { email } = req.body;
  const ownerDB = req.app.locals.hostelOwnerDB;
  const commonDB = req.app.locals.commonDB;
  if (!ownerDB || !commonDB) {
    console.error("Database connections not found");
    return res.status(500).json({ message: "Database connection error" });
  }

  const Owner = initOwnerModel(ownerDB, commonDB);
  if (!Owner) {
    console.error("Failed to initialize Owner model");
    return res
      .status(500)
      .json({ message: "Failed to initialize Owner model" });
  }

  try {
    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiration = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    owner.resetPasswordOTP = otp;
    owner.resetPasswordOTPExpires = otpExpiration;

    await owner.save();

    const mailOptions = {
      to: owner.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels Owner Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}\n\nThis OTP will expire in 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error generating and sending OTP:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const verifyOTPAndChangePasswordOwner = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const ownerDB = req.app.locals.hostelOwnerDB;
  const commonDB = req.app.locals.commonDB;

  if (!ownerDB || !commonDB) {
    return res.status(500).json({ message: "Database connection error" });
  }

  const Owner = initOwnerModel(ownerDB, commonDB);

  try {
    const owner = await Owner.findOne({ email });

    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    if (owner.resetPasswordOTP !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (owner.resetPasswordOTPExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    owner.password = newPassword;
    owner.resetPasswordOTP = undefined;
    owner.resetPasswordOTPExpires = undefined;
    await owner.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error verifying OTP and changing password:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const sendEmailOtp = async (req, res) => {
  try {
    const { profileId, newEmail } = req.body;
    const ownerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    if (!ownerDB || !commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(ownerDB, commonDB);

    const owner = await Owner.findById(profileId);
    if (!owner) {
      return res.status(404).json({ success: false, error: "Owner not found" });
    }

    const existingOwner = await Owner.findOne({ email: newEmail });
    if (existingOwner) {
      return res
        .status(400)
        .json({ success: false, error: "Email already in use" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    owner.emailOtp = otp;
    owner.emailOtpExpires = Date.now() + 300000; // 5 minutes
    owner.newEmail = newEmail;
    await owner.save();

    const mailOptions = {
      to: newEmail,
      from: "noreply@stayhomehostels.com",
      subject: "Email Change OTP",
      text: `Your OTP for email change is ${otp}. It will expire in 5 minutes.`,
    };
    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent to new email successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const { profileId, otp } = req.body;
    const ownerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    if (!ownerDB || !commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(ownerDB, commonDB);

    const owner = await Owner.findById(profileId);
    if (!owner) {
      return res.status(404).json({ success: false, error: "Owner not found" });
    }

    if (owner.emailOtp !== otp) {
      return res.status(401).json({ success: false, error: "Invalid OTP" });
    }

    if (owner.emailOtpExpires < Date.now()) {
      return res.status(401).json({ success: false, error: "OTP has expired" });
    }

    if (!owner.newEmail) {
      return res
        .status(400)
        .json({ success: false, error: "No new email address found" });
    }

    owner.email = owner.newEmail;
    owner.emailOtp = undefined;
    owner.emailOtpExpires = undefined;
    owner.newEmail = undefined;

    await owner.save();
    res.json({ success: true, message: "Email changed successfully" });
  } catch (error) {
    console.error("Error in verify-email-otp:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
};

export const resetPassword = async (req, res) => {
  const { email } = req.body;
  const ownerDB = req.app.locals.hostelOwnerDB;
  const commonDB = req.app.locals.commonDB;

  if (!ownerDB || !commonDB) {
    return res.status(500).json({ message: "Database connection error" });
  }

  const Owner = initOwnerModel(ownerDB, commonDB);

  try {
    const owner = await Owner.findOne({ email: email.toLowerCase() });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    owner.resetPasswordToken = resetToken;
    owner.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await owner.save();

    const mailOptions = {
      to: owner.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels Password Reset",
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        ${process.env.BACKEND_URL}/reset?token=${resetToken}
        If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    await transporter.sendMail(mailOptions);
    res
      .status(200)
      .json({ message: "Password reset email sent", token: resetToken });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    const ownerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    if (!ownerDB || !commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(ownerDB, commonDB);

    const owner = await Owner.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!owner) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired" });
    }

    res.json({ message: "Token is valid" });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updatePassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  const ownerDB = req.app.locals.hostelOwnerDB;
  const commonDB = req.app.locals.commonDB;

  if (!ownerDB || !commonDB) {
    return res.status(500).json({ message: "Database connection error" });
  }

  const Owner = initOwnerModel(ownerDB, commonDB);

  try {
    const owner = await Owner.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!owner) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired" });
    }

    owner.password = password;
    owner.resetPasswordToken = undefined;
    owner.resetPasswordExpires = undefined;
    await owner.save();

    res.json({ message: "Password has been updated" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
