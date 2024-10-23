// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import { initStudentModel } from "../models/studentModel.js";
import { initOwnerModel } from "../models/ownerModel.js";
import { initRoleModel } from "../models/roleModel.js";

// Student authentication middleware
export const studentAuthMiddleware = async (req, res, next) => {
  console.log("Executing student auth middleware");
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      console.log("No token provided");
      return res.status(401).json({
        message: "No authentication token, authorization denied",
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    console.log("Decoded token:", {
      id: decoded.id,
      role: decoded.role,
    });

    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    if (!studentDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Server error" });
    }

    const Student = initStudentModel(studentDB, commonDB);
    const Role = initRoleModel(commonDB);

    const student = await Student.findById(decoded.id).populate({
      path: "role",
      model: Role,
    });

    if (!student) {
      console.log("Student not found");
      return res.status(401).json({
        message: "User not found",
      });
    }

    if (
      !student.role ||
      (student.role.name !== "student" && student.role.name !== "admin")
    ) {
      console.log("Invalid role:", student.role?.name);
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    req.user = student;
    req.user.profileId = student._id;
    next();
  } catch (error) {
    console.error("Student auth error:", error);
    res.status(401).json({ message: "Token is not valid" });
  }
};

// Owner authentication middleware
export const ownerAuthMiddleware = async (req, res, next) => {
  console.log("Executing owner auth middleware");
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      console.log("No token provided");
      return res.status(401).json({
        message: "No authentication token, authorization denied",
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    console.log("Decoded token:", {
      id: decoded.id,
      role: decoded.role,
    });

    const ownerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    if (!ownerDB || !commonDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Server error" });
    }

    const Owner = initOwnerModel(ownerDB, commonDB);
    const Role = initRoleModel(commonDB);

    const owner = await Owner.findById(decoded.id).populate({
      path: "role",
      model: Role,
    });

    if (!owner) {
      console.log("Owner not found");
      return res.status(401).json({
        message: "User not found",
      });
    }

    if (
      !owner.role ||
      (owner.role.name !== "hostelOwner" && owner.role.name !== "admin")
    ) {
      console.log("Invalid role:", owner.role?.name);
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    req.user = owner;
    req.user.profileId = owner._id;
    next();
  } catch (error) {
    console.error("Owner auth error:", error);
    res.status(401).json({ message: "Token is not valid" });
  }
};

// Admin-only authentication middleware
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
};

export const adminAuthMiddleware = async (req, res, next) => {
  try {
    // 1. Check token existence and format
    const authHeader = req.header("Authorization");
    console.log("Auth header:", authHeader);

    if (!authHeader) {
      return res.status(401).json({ message: "No authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ message: "No token found" });
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      });
    } catch (jwtError) {
      console.error("JWT Verification failed:", jwtError);
      return res.status(401).json({
        message: "Invalid token",
        error: jwtError.message,
      });
    }

    // 3. Get database connections
    const commonDB = req.app.locals.commonDB;
    const studentDB = req.app.locals.studentDB;

    if (!commonDB || !studentDB) {
      console.error("Database connections missing");
      return res.status(500).json({
        message: "Database configuration error",
      });
    }

    // 4. Initialize models
    const Role =
      commonDB.models.Role ||
      commonDB.model("Role", {
        name: String,
        description: String,
      });

    const Student =
      studentDB.models.Student || initStudentModel(studentDB, commonDB);

    // 5. Find user
    const user = await Student.findById(decoded.id);
    console.log(
      "Found user:",
      user
        ? {
            id: user._id,
            email: user.email,
            roleId: user.role,
          }
        : "No user found"
    );

    if (!user) {
      return res.status(403).json({
        message: "User not found",
        userId: decoded.id,
      });
    }

    // 6. Check role
    const userRole = await Role.findById(user.role);
    console.log("User role:", userRole);

    if (!userRole) {
      return res.status(403).json({
        message: "Role not found",
        roleId: user.role,
      });
    }

    if (userRole.name !== "admin") {
      return res.status(403).json({
        message: "Admin access required",
        currentRole: userRole.name,
      });
    }

    // 7. All checks passed
    req.user = {
      ...user.toObject(),
      role: userRole,
    };
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    return res.status(500).json({
      message: "Authentication failed",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
// Common token verification middleware
export const commonVerifyToken = async (req, res, next) => {
  console.log("Executing common token verification");
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      console.log("No token provided");
      return res.status(401).json({
        message: "No authentication token provided",
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    console.log("Token verified for user:", {
      id: decoded.id,
      role: decoded.role,
    });

    req.user = {
      _id: decoded.id,
      role: decoded.role,
      profileId: decoded.id,
    };
    next();
  } catch (error) {
    console.error("Common token verification error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};
