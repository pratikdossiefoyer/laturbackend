import Student from "../models/studentModel.js";
import Hostel from "../models/hostelModel.js";
import Owner from "../models/ownerModel.js";

import User from "../models/userModal.js";
import Permission from "../models/permissionModel.js";
import Group from "../models/groupModel.js";
import bcrypt from "bcryptjs";

import { handleRoleSpecificData } from "../utils/roleUtils.js";
import RolePermission from "../models/rolePermissonModal.js";
import nodemailer from "nodemailer";
import Role from "../models/roleModel.js";
import mongoose from "mongoose";

export const getAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.userId).select("-password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.status(200).json(admin);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const updateAdminProfile = async (req, res) => {
  const { email } = req.body;
  try {
    const updatedAdmin = await User.findByIdAndUpdate(
      req.userId,
      { email },
      { new: true, runValidators: true }
    ).select("-password");
    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.status(200).json(updatedAdmin);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getAdminById = async (req, res) => {
  const { adminId } = req.params;
  try {
    const admin = await User.findById(adminId).select("-password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.status(200).json(admin);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

// UAC

export const assignAdminEmployee = async (req, res) => {
  try {
    const { userId, permissions } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.role = "adminEmployee";
    user.permissions = permissions;
    await user.save();
    res
      .status(200)
      .json({ message: "Admin employee assigned successfully", user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getPermissionsForRole = async (req, res) => {
  try {
    const { role } = req.params;

    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(404).json({ message: "Role not found" });
    }

    const rolePermission = await RolePermission.findOne({
      role: roleDoc._id,
    }).populate("permissions");

    if (!rolePermission) {
      return res.status(404).json({ message: "Role permissions not found" });
    }

    const groupedPermissions = rolePermission.permissions.reduce(
      (acc, permission) => {
        if (!acc[permission.moduleName]) {
          acc[permission.moduleName] = [];
        }
        acc[permission.moduleName].push(permission);
        return acc;
      },
      {}
    );

    res.status(200).json({
      role,
      permissions: groupedPermissions,
    });
  } catch (error) {
    console.error("Error in getPermissionsForRole:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

/// UAC User page roles assign role a, add roles , delete roles

export const changeUserPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    //Send email to user about password change
    // await sendEmail(
    //   user.email,
    //   "Password Changed",
    //   `Your password has been changed by an administrator. New temporary password: ${newPassword} `
    // );
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    const mailOptions = {
      to: user.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels Password change",
      text: `Your password has been changed by an administrator. New temporary password: ${newPassword}
        If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to change password",
      error: error.message,
    });
  }
};

export const addUser = async (req, res) => {
  try {
    const { email, roleName, password, ...additionalData } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const profileId = await handleRoleSpecificData(
      roleName,
      additionalData,
      "create"
    );

    const newUser = new User({
      email,
      password,
      role: role._id,
      profileId,
    });
    await newUser.save();
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    const mailOptions = {
      to: email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels admin addedyou",
      text: `your email id is ${email} , password is :${password}, role is ${role.name}`,
    };

    await transporter.sendMail(mailOptions);
    res.status(201).json({
      message: "User created successfully",
      user: {
        ...newUser.toObject(),
        roleName: role.name,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create user",
      error: error.message,
    });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, email, password } = req.body;

    console.log("Received request body:", req.body);

    if (!roleName) {
      return res.status(400).json({ message: "Role name is required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Found user:", user);

    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(400).json({ message: "Invalid role" });
    }

    console.log("Found role:", role);

    if (email && email !== user.email) {
      user.email = email;
    }

    if (password) {
      user.password = password; // The pre-save hook will hash this
    }

    // Check if user.role exists and if it's different from the new role
    if (!user.role || user.role.toString() !== role._id.toString()) {
      if (user.profileId) {
        await handleRoleSpecificData(
          user.role ? (await Role.findById(user.role)).name : "unknown",
          null,
          "delete",
          user.profileId
        );
      }

      const newProfileId = await handleRoleSpecificData(roleName, {}, "create");

      user.role = role._id;
      user.profileId = newProfileId;
    }

    await user.save();
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log("updated role", user.role.name);
    const mailOptions = {
      to: user.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels role is updated",
      text: `your role is updated to ${roleName}`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({
      message: "User updated successfully",
      user: {
        ...user.toObject({ getters: true, virtuals: false }),
        roleName: role.name,
      },
    });
  } catch (error) {
    console.error("Error in updateUserRole:", error);
    res.status(500).json({
      message: "Failed to update user",
      error: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).populate("role");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.role) {
      return res.status(400).json({ message: "User has no associated role" });
    }

    if (user.profileId) {
      try {
        await handleRoleSpecificData(
          user.role.name,
          null,
          "delete",
          user.profileId
        );
      } catch (roleError) {
        console.error("Error in handleRoleSpecificData:", roleError);
        return res.status(400).json({
          message: "Failed to delete user's role-specific data",
          error: roleError.message,
        });
      }
    }

    await User.findByIdAndDelete(id);
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    const mailOptions = {
      to: user.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels deleted your account by admin",
      text: `Hi ${email}admin is deleted your account`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res
      .status(500)
      .json({ message: "Failed to delete user", error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().populate("role", "name");
    const usersWithHashedPasswords = users.map((user) => {
      const userObject = user.toObject();
      return {
        ...userObject,

        roleName:
          userObject.role && userObject.role.name
            ? userObject.role.name
            : "No Role Assigned",
      };
    });

    res.status(200).json(usersWithHashedPasswords);
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

// Add role
export const addRole = async (req, res) => {
  try {
    const { name, description } = req.body;
    const newRole = new Role({
      _id: new mongoose.Types.ObjectId(),
      name,
      description,
    });
    await newRole.save();
    res.status(201).json({ message: "Role added successfully", role: newRole });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Role already exists" });
    }
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

// Delete role
export const deleteRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    const deletedRole = await Role.findOneAndDelete({ name: roleName });
    if (!deletedRole) {
      return res.status(404).json({ message: "Role not found" });
    }

    await Permission.deleteMany({ role: deletedRole._id });
    await RolePermission.deleteOne({ role: deletedRole._id });
    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

// Get all roles
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.status(200).json(roles);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};
