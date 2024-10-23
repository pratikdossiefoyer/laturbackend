// controllers/studentAuthController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { initStudentModel } from "../models/studentModel.js";
import { initRoleModel } from "../models/roleModel.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { initOwnerModel } from "../models/ownerModel.js";
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
// studentAuthController.js

export const registerStudent = async (req, res) => {
  console.log("Initiating student registration with body:", {
    hasEmail: !!req.body.email,
    hasPassword: !!req.body.password,
    fields: Object.keys(req.body),
  });

  try {
    const { email, password, ...profileData } = req.body;

    if (!email || !password) {
      console.error("Missing required fields:", {
        email: !!email,
        password: !!password,
      });
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    if (!studentDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Student = initStudentModel(studentDB, commonDB);
    const Role = initRoleModel(commonDB);

    // Check for existing student
    const existingStudent = await Student.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingStudent) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store registration data in session
    const registrationData = {
      email: email.toLowerCase().trim(),
      password,
      otp,
      otpExpires,
      ...profileData,
    };

    // Save to session explicitly
    req.session.pendingRegistration = registrationData;

    // Force session save and wait for completion
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          reject(err);
        }
        resolve(true);
      });
    });

    // Verify session was saved
    console.log("Session saved. Verification:", {
      sessionId: req.session.id,
      hasPendingReg: !!req.session.pendingRegistration,
      savedEmail: req.session.pendingRegistration?.email,
    });

    // Send email
    const mailOptions = {
      from: "Stay Home Hostels",
      to: email,
      subject: "Stay Home Hostels - Email Verification",
      text: `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to Stay Home Hostels!</h2>
          <p>Your verification code is:</p>
          <h1 style="color: #4a90e2;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Verification code sent to your email",
      email: email,
      sessionId: req.session.id, // Send session ID for debugging
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

export const verifyRegistrationOtpStudent = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log("Verifying OTP with session data:", {
      sessionId: req.session.id,
      hasPendingReg: !!req.session.pendingRegistration,
      pendingEmail: req.session.pendingRegistration?.email,
      receivedEmail: email,
      receivedOtp: otp,
    });

    if (!req.session.pendingRegistration) {
      return res.status(400).json({
        message: "No pending registration found. Please register again.",
        sessionId: req.session.id,
      });
    }

    const pendingRegistration = req.session.pendingRegistration;

    // Validate email match
    if (pendingRegistration.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        message:
          "Email mismatch. Please use the same email used for registration.",
      });
    }

    // Validate OTP
    if (pendingRegistration.otp !== otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // Check OTP expiration
    if (new Date() > new Date(pendingRegistration.otpExpires)) {
      return res.status(401).json({ message: "OTP has expired" });
    }

    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    const Student = initStudentModel(studentDB, commonDB);
    const Role = initRoleModel(commonDB);

    // Get student role
    const studentRole = await Role.findOne({ name: "student" });
    if (!studentRole) {
      return res.status(500).json({ message: "Student role not configured" });
    }

    console.log("Found student role:", studentRole); // Debug log

    // Remove fields that shouldn't be in the student document
    const {
      otp: _otp,
      otpExpires: _otpExpires,
      confirmPassword: _confirmPassword,
      role: _role, // Remove role from pendingRegistration to prevent override
      ...cleanRegistrationData
    } = pendingRegistration;

    // Create new student with explicit role assignment
    const newStudent = new Student({
      ...cleanRegistrationData,
      email: email.toLowerCase(),
      role: studentRole._id, // Explicitly set role ID
      isApproved: true,
    });

    // Debug log before saving
    console.log("About to save student with data:", {
      email: newStudent.email,
      roleId: newStudent.role,
      hasPassword: !!newStudent.password,
    });

    await newStudent.save();

    // Clear session data
    delete req.session.pendingRegistration;
    await new Promise((resolve) => req.session.save(resolve));

    res.status(201).json({
      message: "Registration completed successfully",
      student: {
        _id: newStudent._id,
        email: newStudent.email,
        role: "student",
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    // Enhanced error response
    res.status(500).json({
      message: "Registration completion failed",
      error: error.message,
      details: {
        name: error.name,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    });
  }
};
export const loginStudent = async (req, res) => {
  console.log("Attempting login");
  try {
    const { email, password } = req.body;
    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    console.log("studentDB:", studentDB ? "connected" : "not connected");
    console.log("commonDB:", commonDB ? "connected" : "not connected");

    if (!studentDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Student = initStudentModel(studentDB, commonDB);
    const Role = initRoleModel(commonDB);

    console.log("Student model:", Student ? "initialized" : "not initialized");
    console.log("Role model:", Role ? "initialized" : "not initialized");

    if (!Student || !Role) {
      console.error("Failed to initialize models");
      return res.status(500).json({ message: "Failed to initialize models" });
    }

    // Find student and populate role
    console.log("Searching for user with email:", email);
    const student = await Student.findOne({ email }).populate({
      path: "role",
      model: commonDB.model("Role"),
    });

    if (!student) {
      console.log("User not found");
      return res.status(401).json({ message: "Email not found" });
    }

    // Debug password comparison
    console.log("Debug password info:", {
      hasStoredPassword: !!student.password,
      providedPassword: !!password,
      storedPasswordLength: student.password?.length,
    });

    // Using the isValidPassword method from the schema
    const isMatch = await student.isValidPassword(password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Incorrect password");
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Check if user is either student or admin
    if (
      !student.role ||
      (student.role.name !== "student" && student.role.name !== "admin")
    ) {
      console.log("Invalid user role:", student.role?.name);
      return res.status(401).json({ message: "Invalid user role" });
    }

    // Generate token with role information
    console.log("Generating JWT token");
    const token = jwt.sign(
      {
        id: student._id,
        email: student.email,
        role: student.role.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Update last login
    student.lastLogin = new Date();
    await student.save();
    console.log("Last login updated");
    const userData = {
      profileId: student._id,
      email: student.email,
      name: student.name,
      role: student.role.name,
    };

    // Add additional data for admin users
    if (student.role.name === "admin") {
      userData.isAdmin = true;
    }

    res.json({
      token,
      userData,
      message: `Login successful as ${student.role.name}`,
    });

    console.log(
      `Login successful for ${student.email} as ${student.role.name}`
    );
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

export const logoutStudent = async (req, res) => {
  try {
    const studentId = req.Student.id;
    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    console.log("studentDB:", studentDB ? "connected" : "not connected");
    console.log("commonDB:", commonDB ? "connected" : "not connected");

    if (!studentDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Student = initStudentModel(studentDB, commonDB);

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    student.lastLogout = new Date();
    await student.save();

    res.status(200).json({
      message: "Logged out successfully",
      lastLogout: student.lastLogout,
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const generateAndSendOTPStudent = async (req, res) => {
  const { email } = req.body;
  const studentDB = req.app.locals.studentDB;
  const commonDB = req.app.locals.commonDB;

  console.log("studentDB:", studentDB ? "connected" : "not connected");
  console.log("commonDB:", commonDB ? "connected" : "not connected");

  if (!studentDB || !commonDB) {
    console.error("Database connections not found");
    return res.status(500).json({ message: "Database connection error" });
  }

  const Student = initStudentModel(studentDB, commonDB);
  try {
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiration = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    student.resetPasswordOTP = otp;
    student.resetPasswordOTPExpires = otpExpiration;

    await student.save();

    const mailOptions = {
      to: student.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels Student Password Reset OTP",
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

export const verifyOTPAndChangePasswordStudent = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const studentDB = req.app.locals.studentDB;
  const commonDB = req.app.locals.commonDB;

  console.log("studentDB:", studentDB ? "connected" : "not connected");
  console.log("commonDB:", commonDB ? "connected" : "not connected");

  if (!studentDB || !commonDB) {
    console.error("Database connections not found");
    return res.status(500).json({ message: "Database connection error" });
  }

  const Student = initStudentModel(studentDB, commonDB);

  try {
    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (student.resetPasswordOTP !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (student.resetPasswordOTPExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    student.password = newPassword;
    student.resetPasswordOTP = undefined;
    student.resetPasswordOTPExpires = undefined;
    await student.save();

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
    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    console.log("studentDB:", studentDB ? "connected" : "not connected");
    console.log("commonDB:", commonDB ? "connected" : "not connected");

    if (!studentDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Student = initStudentModel(studentDB, commonDB);
    const student = await Student.findById(profileId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    const existingStudent = await Student.findOne({ email: newEmail });
    if (existingStudent) {
      return res
        .status(400)
        .json({ success: false, error: "Email already in use" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    student.emailOtp = otp;
    student.emailOtpExpires = Date.now() + 300000; // 5 minutes
    student.newEmail = newEmail;
    await student.save();

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
    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    console.log("studentDB:", studentDB ? "connected" : "not connected");
    console.log("commonDB:", commonDB ? "connected" : "not connected");

    if (!studentDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Student = initStudentModel(studentDB, commonDB);

    const student = await Student.findById(profileId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    if (student.emailOtp !== otp) {
      return res.status(401).json({ success: false, error: "Invalid OTP" });
    }

    if (student.emailOtpExpires < Date.now()) {
      return res.status(401).json({ success: false, error: "OTP has expired" });
    }

    if (!student.newEmail) {
      return res
        .status(400)
        .json({ success: false, error: "No new email address found" });
    }

    student.email = student.newEmail;
    student.emailOtp = undefined;
    student.emailOtpExpires = undefined;
    student.newEmail = undefined;

    await student.save();
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
  const studentDB = req.app.locals.studentDB;
  const commonDB = req.app.locals.commonDB;

  console.log("studentDB:", studentDB ? "connected" : "not connected");
  console.log("commonDB:", commonDB ? "connected" : "not connected");

  if (!studentDB || !commonDB) {
    console.error("Database connections not found");
    return res.status(500).json({ message: "Database connection error" });
  }

  const Student = initStudentModel(studentDB, commonDB);
  try {
    const student = await Student.findOne({ email: email.toLowerCase() });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    student.resetPasswordToken = resetToken;
    student.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await student.save();

    const mailOptions = {
      to: student.email,
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
    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    console.log("studentDB:", studentDB ? "connected" : "not connected");
    console.log("commonDB:", commonDB ? "connected" : "not connected");

    if (!studentDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Student = initStudentModel(studentDB, commonDB);
    const student = await Student.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!student) {
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
  const studentDB = req.app.locals.studentDB;
  const commonDB = req.app.locals.commonDB;

  console.log("studentDB:", studentDB ? "connected" : "not connected");
  console.log("commonDB:", commonDB ? "connected" : "not connected");

  if (!studentDB || !commonDB) {
    console.error("Database connections not found");
    return res.status(500).json({ message: "Database connection error" });
  }

  const Student = initStudentModel(studentDB, commonDB);

  try {
    const student = await Student.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!student) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired" });
    }

    student.password = password;
    student.resetPasswordToken = undefined;
    student.resetPasswordExpires = undefined;
    await student.save();

    res.json({ message: "Password has been updated" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
