import { initStudentModel } from "../models/studentModel.js";
import { initHostelModel } from "../models/hostelModel.js";
import { initOwnerModel } from "../models/ownerModel.js";
import { initRoleModel } from "../models/roleModel.js";
import { initPermissionModel } from "../models/permissionModel.js";
import { initRolePermissionModel } from "../models/rolePermissonModal.js";
// import { initRoleModel } from "../models/roleModel.js";
// import { handleRoleSpecificData } from "../utils/roleUtils.js";
// import bcrypt from "bcryptjs";
// import nodemailer from "nodemailer";

// Helper function to validate database connections
const validateDBConnections = (req, res) => {
  const { commonDB, hostelOwnerDB, studentDB } = req.app.locals;

  if (!commonDB || !hostelOwnerDB || !studentDB) {
    return {
      error: true,
      response: res.status(500).json({ message: "Database connection error" }),
    };
  }

  return {
    error: false,
    connections: { commonDB, hostelOwnerDB, studentDB },
  };
};

export const getHostelById = async (req, res) => {
  const { hostelId } = req.params;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const Hostel = initHostelModel(commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const owner = await Owner.findById(hostel.owner).select("-password");
    if (!owner) {
      return res.status(404).json({
        message: "Hostel owner not found",
        hostel: hostel,
      });
    }

    const hostelData = hostel.toObject();
    hostelData.owner = owner.toObject();

    res.status(200).json(hostelData);
  } catch (error) {
    console.error("Error in getHostelById:", error);
    res.status(500).json({
      message: "Error fetching hostel details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getAllStudents = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, studentDB } = dbCheck.connections;

  try {
    const Student = initStudentModel(studentDB, commonDB);
    const Hostel = initHostelModel(commonDB);

    const students = await Student.find();
    const enhancedStudents = await Promise.all(
      students.map(async (student) => {
        // Get admitted hostel details if exists
        let admittedHostel = null;
        if (student.admittedHostel) {
          admittedHostel = await Hostel.findById(
            student.admittedHostel
          ).populate({
            path: "owner",
            select: "name number",
          });
        }

        // Get complaints from all hostels
        const complaints = await Hostel.aggregate([
          { $unwind: "$complaints" },
          {
            $match: {
              "complaints.student": student._id,
            },
          },
          {
            $project: {
              _id: 0,
              hostelId: "$_id",
              hostelName: "$name",
              complaint: "$complaints",
            },
          },
        ]);

        // Get feedback from all hostels
        const feedback = await Hostel.aggregate([
          { $unwind: "$feedback" },
          {
            $match: {
              "feedback.student": student._id,
            },
          },
          {
            $project: {
              _id: 0,
              hostelId: "$_id",
              hostelName: "$name",
              feedback: "$feedback",
            },
          },
        ]);

        return {
          ...student.toObject(),
          admittedHostel: admittedHostel ? admittedHostel.toObject() : null,
          complaints: complaints.map((item) => ({
            ...item.complaint,
            hostelId: item.hostelId,
            hostelName: item.hostelName,
          })),
          feedback: feedback.map((item) => ({
            ...item.feedback,
            hostelId: item.hostelId,
            hostelName: item.hostelName,
          })),
        };
      })
    );

    res.status(200).json(enhancedStudents);
  } catch (error) {
    console.error("Error in getAllStudents:", error);
    res.status(500).json({
      message: "Error fetching students",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getAllHostels = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const Hostel = initHostelModel(commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const hostels = await Hostel.find();
    const enhancedHostels = await Promise.all(
      hostels.map(async (hostel) => {
        const owner = await Owner.findById(hostel.owner).select("-password");
        const hostelData = hostel.toObject();
        hostelData.owner = owner ? owner.toObject() : null;
        return hostelData;
      })
    );

    res.status(200).json(enhancedHostels);
  } catch (error) {
    console.error("Error in getAllHostels:", error);
    res.status(500).json({
      message: "Error fetching hostels",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateHostel = async (req, res) => {
  const { hostelId, ...updateData } = req.body;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Hostel = initHostelModel(commonDB);

    const updatedHostel = await Hostel.findByIdAndUpdate(hostelId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedHostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    res.status(200).json(updatedHostel);
  } catch (error) {
    console.error("Error in updateHostel:", error);
    res.status(500).json({
      message: "Error updating hostel",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateStudent = async (req, res) => {
  const { studentId, ...updateData } = req.body;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { studentDB, commonDB } = dbCheck.connections;

  try {
    const Student = initStudentModel(studentDB, commonDB);

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json(updatedStudent);
  } catch (error) {
    console.error("Error in updateStudent:", error);
    res.status(500).json({
      message: "Error updating student",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const verifyHostel = async (req, res) => {
  const { hostelId } = req.body;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const Hostel = initHostelModel(commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const hostel = await Hostel.findByIdAndUpdate(
      hostelId,
      { verified: true },
      { new: true }
    );

    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const owner = await Owner.findById(hostel.owner).select("-password");
    const hostelData = hostel.toObject();
    hostelData.owner = owner ? owner.toObject() : null;

    res.status(200).json(hostelData);
  } catch (error) {
    console.error("Error in verifyHostel:", error);
    res.status(500).json({
      message: "Error verifying hostel",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getAllOwners = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);
    const Hostel = initHostelModel(commonDB);

    const owners = await Owner.find().select("-password");
    const enhancedOwners = await Promise.all(
      owners.map(async (owner) => {
        const hostels = await Hostel.find({ owner: owner._id });
        const ownerData = owner.toObject();
        ownerData.hostels = hostels.map((hostel) => hostel.toObject());
        return ownerData;
      })
    );

    res.status(200).json(enhancedOwners);
  } catch (error) {
    console.error("Error in getAllOwners:", error);
    res.status(500).json({
      message: "Error fetching owners",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateOwner = async (req, res) => {
  const { ownerId, ...updateData } = req.body;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);
    const Hostel = initHostelModel(commonDB);

    const updatedOwner = await Owner.findByIdAndUpdate(ownerId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedOwner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const hostels = await Hostel.find({ owner: ownerId });
    const ownerData = updatedOwner.toObject();
    ownerData.hostels = hostels.map((hostel) => hostel.toObject());

    res.status(200).json(ownerData);
  } catch (error) {
    console.error("Error in updateOwner:", error);
    res.status(500).json({
      message: "Error updating owner",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const removeFromWishlist = async (req, res) => {
  const { studentId, hostelId } = req.body;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { studentDB, commonDB } = dbCheck.connections;

  try {
    const Student = initStudentModel(studentDB, commonDB);

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { $pull: { wishlist: hostelId } },
      { new: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json(updatedStudent);
  } catch (error) {
    console.error("Error in removeFromWishlist:", error);
    res.status(500).json({
      message: "Error removing hostel from wishlist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const removeStudent = async (req, res) => {
  const { studentId } = req.params;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { studentDB, commonDB } = dbCheck.connections;

  try {
    const Student = initStudentModel(studentDB, commonDB);
    const Hostel = initHostelModel(commonDB);

    // First check if student has any active complaints or feedback
    const hostelsWithStudentData = await Hostel.find({
      $or: [
        { "complaints.student": studentId },
        { "feedback.student": studentId },
      ],
    });

    if (hostelsWithStudentData.length > 0) {
      // Remove student's complaints and feedback first
      await Promise.all(
        hostelsWithStudentData.map((hostel) =>
          Hostel.updateMany(
            { _id: hostel._id },
            {
              $pull: {
                complaints: { student: studentId },
                feedback: { student: studentId },
              },
            }
          )
        )
      );
    }

    const deletedStudent = await Student.findByIdAndDelete(studentId);
    if (!deletedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error in removeStudent:", error);
    res.status(500).json({
      message: "Error removing student",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const removeHostel = async (req, res) => {
  const { hostelId } = req.params;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, hostelOwnerDB, studentDB } = dbCheck.connections;

  try {
    const Hostel = initHostelModel(commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);
    const Student = initStudentModel(studentDB, commonDB);

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    // Check for admitted students
    const studentsAdmitted = await Student.find({ admittedHostel: hostelId });
    if (studentsAdmitted.length > 0) {
      return res.status(403).json({
        message: "Hostel cannot be deleted because students are admitted.",
        admittedStudentsCount: studentsAdmitted.length,
      });
    }

    // Remove hostel from students' wishlists
    await Student.updateMany(
      { wishlist: hostelId },
      { $pull: { wishlist: hostelId } }
    );

    // Remove hostel from owner's hostels array
    if (hostel.owner) {
      await Owner.findByIdAndUpdate(hostel.owner, {
        $pull: { hostels: hostelId },
      });
    }

    // Delete the hostel
    await Hostel.deleteOne({ _id: hostelId });

    res.status(200).json({
      message: "Hostel removed successfully",
      removedFrom: {
        wishlists: true,
        ownerProfile: Boolean(hostel.owner),
      },
    });
  } catch (error) {
    console.error("Error in removeHostel:", error);
    res.status(500).json({
      message: "Error removing hostel",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const approveStudentWishlist = async (req, res) => {
  const { studentId } = req.body;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { studentDB, commonDB } = dbCheck.connections;

  try {
    const Student = initStudentModel(studentDB, commonDB);

    const student = await Student.findByIdAndUpdate(
      studentId,
      {
        wishlistApproved: true,
        approvedAt: new Date(),
        approvedBy: req.userId,
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!student.wishlistSubmitted) {
      return res.status(400).json({ message: "Wishlist not submitted" });
    }

    res.status(200).json({
      message: "Wishlist approved successfully",
      student,
    });
  } catch (error) {
    console.error("Error in approveStudentWishlist:", error);
    res.status(500).json({
      message: "Error approving wishlist",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getPendingOwners = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { hostelOwnerDB, commonDB } = dbCheck.connections;

  try {
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const pendingOwners = await Owner.find({ isApproved: false })
      .select("-password")
      .populate("role");

    res.status(200).json(pendingOwners);
  } catch (error) {
    console.error("Error in getPendingOwners:", error);
    res.status(500).json({
      message: "Error fetching pending owners",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const approveOwner = async (req, res) => {
  const { ownerId } = req.body;
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { hostelOwnerDB, commonDB } = dbCheck.connections;

  try {
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const owner = await Owner.findById(ownerId);
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    if (owner.isApproved) {
      return res.status(400).json({ message: "Owner is already approved" });
    }

    owner.isApproved = true;
    owner.approvedAt = new Date();
    owner.approvedBy = req.userId;
    await owner.save();

    res.status(200).json({
      message: "Owner approved successfully",
      owner: owner.toObject(),
    });
  } catch (error) {
    console.error("Error in approveOwner:", error);
    res.status(500).json({
      message: "Error approving owner",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// UAC

export const getGroups = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Group = initGroupModel(commonDB);
    const Role = initRoleModel(commonDB);

    const groups = await Group.find().populate({
      path: "roles",
      model: Role,
      select: "name",
    });

    const formattedGroups = groups.map((group) => ({
      _id: group._id,
      moduleId: group.moduleId,
      moduleName: group.moduleName,
      name: group.name,
      dateModified: group.dateModified,
      roles: group.roles.map((role) => role.name),
    }));

    res.status(200).json(formattedGroups);
  } catch (error) {
    console.error("Error in getGroups:", error);
    res.status(500).json({
      message: "Error fetching groups",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const addGroup = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Group = initGroupModel(commonDB);
    const Role = initRoleModel(commonDB);

    const { moduleId, moduleName, roleIds } = req.body;

    // Validate request body
    if (!moduleId || !moduleName || !roleIds || !Array.isArray(roleIds)) {
      return res.status(400).json({
        message:
          "Invalid request body. Required: moduleId, moduleName, roleIds (array)",
      });
    }

    // Validate roles
    const roles = await Role.find({ _id: { $in: roleIds } });
    if (roles.length !== roleIds.length) {
      console.log(
        "Invalid roles found. Expected:",
        roleIds.length,
        "Found:",
        roles.length
      );
      return res.status(400).json({
        message: "One or more invalid roles",
        expected: roleIds.length,
        found: roles.length,
      });
    }

    const groupCount = await Group.countDocuments();
    const name = `G${groupCount + 1}`;

    const newGroup = await Group.create({
      moduleId,
      moduleName,
      name,
      roles: roles.map((role) => role._id),
      createdBy: req.userId,
      dateCreated: new Date(),
    });

    const populatedGroup = await newGroup.populate({
      path: "roles",
      select: "name",
    });

    res.status(201).json({
      message: "Group added successfully",
      group: populatedGroup,
    });
  } catch (error) {
    console.error("Error in addGroup:", error);
    res.status(500).json({
      message: "Error creating group",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateGroup = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Group = initGroupModel(commonDB);
    const Role = initRoleModel(commonDB);

    const { id, moduleId, moduleName, roleIds } = req.body;

    // Validate request body
    if (
      !id ||
      !moduleId ||
      !moduleName ||
      !roleIds ||
      !Array.isArray(roleIds)
    ) {
      return res.status(400).json({
        message:
          "Invalid request body. Required: id, moduleId, moduleName, roleIds (array)",
      });
    }

    // Validate roles
    const roles = await Role.find({ _id: { $in: roleIds } });
    if (roles.length !== roleIds.length) {
      return res.status(400).json({
        message: "One or more invalid roles",
        expected: roleIds.length,
        found: roles.length,
      });
    }

    const updatedGroup = await Group.findByIdAndUpdate(
      id,
      {
        moduleId,
        moduleName,
        roles: roles.map((role) => role._id),
        dateModified: new Date(),
        modifiedBy: req.userId,
      },
      { new: true }
    ).populate({
      path: "roles",
      select: "name",
    });

    if (!updatedGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json({
      message: "Group updated successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.error("Error in updateGroup:", error);
    res.status(500).json({
      message: "Error updating group",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteGroup = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Group = initGroupModel(commonDB);
    const { id } = req.params;

    // Check if group exists
    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Optional: Check for dependencies before deletion
    // Add your dependency checks here

    const deletedGroup = await Group.findByIdAndDelete(id);

    res.status(200).json({
      message: "Group deleted successfully",
      deleted: {
        id: deletedGroup._id,
        name: deletedGroup.name,
        moduleName: deletedGroup.moduleName,
      },
    });
  } catch (error) {
    console.error("Error in deleteGroup:", error);
    res.status(500).json({
      message: "Error deleting group",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const assignGroupToRole = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Role = initRoleModel(commonDB);
    const Group = initGroupModel(commonDB);
    const Permission = initPermissionModel(commonDB);
    const RolePermission = initRolePermissionModel(commonDB);

    const { role, groupIds } = req.body;

    // Validate request
    if (!role || !groupIds || !Array.isArray(groupIds)) {
      return res.status(400).json({
        message: "Invalid request. Required: role (string), groupIds (array)",
      });
    }

    if (role === "admin") {
      return res.status(400).json({
        message: "Cannot assign groups to admin role",
      });
    }

    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(404).json({ message: "Role not found" });
    }

    const groups = await Group.find({ _id: { $in: groupIds } });
    if (groups.length !== groupIds.length) {
      return res.status(400).json({
        message: "One or more group IDs are invalid",
        expected: groupIds.length,
        found: groups.length,
      });
    }

    const newPermissions = await Promise.all(
      groups.map(async (group) => {
        return Permission.findOneAndUpdate(
          { moduleId: group.moduleId, role: roleDoc._id },
          {
            moduleId: group.moduleId,
            moduleName: group.moduleName,
            name: group.name,
            read: true,
            write: true,
            edit: true,
            delete: true,
            role: roleDoc._id,
            lastModified: new Date(),
            modifiedBy: req.userId,
          },
          { upsert: true, new: true }
        );
      })
    );

    await RolePermission.findOneAndUpdate(
      { role: roleDoc._id },
      {
        $addToSet: { permissions: { $each: newPermissions.map((p) => p._id) } },
        lastModified: new Date(),
        modifiedBy: req.userId,
      },
      { upsert: true }
    );

    res.status(200).json({
      message: "Groups assigned to role successfully",
      role: role,
      assignedGroups: groups.map((g) => ({ id: g._id, name: g.name })),
      permissions: newPermissions,
    });
  } catch (error) {
    console.error("Error in assignGroupToRole:", error);
    res.status(500).json({
      message: "Error assigning groups to role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const removePermissionFromRole = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Role = initRoleModel(commonDB);
    const Permission = initPermissionModel(commonDB);
    const RolePermission = initRolePermissionModel(commonDB);

    const { role, permissionId } = req.body;

    // Validate request
    if (!role || !permissionId) {
      return res.status(400).json({
        message:
          "Invalid request. Required: role (string), permissionId (string)",
      });
    }

    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(404).json({ message: "Role not found" });
    }

    const rolePermission = await RolePermission.findOne({ role: roleDoc._id });
    if (!rolePermission) {
      return res.status(404).json({ message: "Role permissions not found" });
    }

    const permission = await Permission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    // Remove permission
    await Permission.findByIdAndDelete(permissionId);

    // Update role permissions
    rolePermission.permissions = rolePermission.permissions.filter(
      (p) => p.toString() !== permissionId
    );
    rolePermission.lastModified = new Date();
    rolePermission.modifiedBy = req.userId;
    await rolePermission.save();

    const updatedRolePermission = await RolePermission.findOne({
      role: roleDoc._id,
    }).populate("permissions");

    res.status(200).json({
      message: "Permission removed successfully",
      role: role,
      removedPermission: permission,
      updatedRolePermissions: updatedRolePermission,
    });
  } catch (error) {
    console.error("Error in removePermissionFromRole:", error);
    res.status(500).json({
      message: "Error removing permission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateRolePermissions = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Role = initRoleModel(commonDB);
    const Permission = initPermissionModel(commonDB);

    const { role, permissionId, update } = req.body;

    // Validate request
    if (!role || !permissionId || !update) {
      return res.status(400).json({
        message:
          "Invalid request. Required: role, permissionId, and update object",
      });
    }

    if (role === "admin") {
      return res.status(400).json({
        message: "Cannot update permissions for admin role",
      });
    }

    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Validate update object
    const allowedUpdates = ["read", "write", "edit", "delete"];
    const updates = Object.keys(update);
    const isValidUpdate = updates.every((key) => allowedUpdates.includes(key));
    if (!isValidUpdate) {
      return res.status(400).json({
        message: "Invalid update fields",
        allowedFields: allowedUpdates,
      });
    }

    const updatedPermission = await Permission.findOneAndUpdate(
      { _id: permissionId, role: roleDoc._id },
      {
        $set: {
          ...update,
          lastModified: new Date(),
          modifiedBy: req.userId,
        },
      },
      { new: true }
    );

    if (!updatedPermission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    res.status(200).json({
      message: "Permission updated successfully",
      role: role,
      updatedPermission,
    });
  } catch (error) {
    console.error("Error in updateRolePermissions:", error);
    res.status(500).json({
      message: "Error updating permissions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getPermissionsForRole = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Role = initRoleModel(commonDB);
    const RolePermission = initRolePermissionModel(commonDB);
    const Permission = initPermissionModel(commonDB);

    const { role } = req.params;

    // Validate role parameter
    if (!role) {
      return res.status(400).json({
        message: "Role parameter is required",
      });
    }

    // Find role document
    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(404).json({
        message: "Role not found",
        requestedRole: role,
      });
    }

    // Find role permissions with populated permissions
    const rolePermission = await RolePermission.findOne({
      role: roleDoc._id,
    }).populate({
      path: "permissions",
      model: Permission,
      select: "moduleId moduleName name read write edit delete lastModified",
    });

    if (!rolePermission) {
      // If no permissions found, return empty grouped structure
      return res.status(200).json({
        role,
        permissions: {},
        message: "No permissions found for this role",
      });
    }

    // Group permissions by module
    const groupedPermissions = rolePermission.permissions.reduce(
      (acc, permission) => {
        // Create formatted permission object
        const formattedPermission = {
          id: permission._id,
          name: permission.name,
          moduleId: permission.moduleId,
          actions: {
            read: permission.read || false,
            write: permission.write || false,
            edit: permission.edit || false,
            delete: permission.delete || false,
          },
          lastModified: permission.lastModified,
        };

        // Initialize module group if it doesn't exist
        if (!acc[permission.moduleName]) {
          acc[permission.moduleName] = {
            permissions: [],
            count: 0,
          };
        }

        // Add permission to appropriate module group
        acc[permission.moduleName].permissions.push(formattedPermission);
        acc[permission.moduleName].count++;

        return acc;
      },
      {}
    );

    // Calculate summary statistics
    const summary = {
      totalModules: Object.keys(groupedPermissions).length,
      totalPermissions: rolePermission.permissions.length,
      moduleBreakdown: Object.entries(groupedPermissions).map(
        ([module, data]) => ({
          module,
          permissionCount: data.count,
        })
      ),
    };

    res.status(200).json({
      role,
      roleId: roleDoc._id,
      permissions: groupedPermissions,
      summary,
      lastModified: rolePermission.lastModified || null,
    });
  } catch (error) {
    console.error("Error in getPermissionsForRole:", error);
    res.status(500).json({
      message: "Error fetching role permissions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper function to validate permissions
export const validateRolePermissions = async (commonDB, roleId) => {
  try {
    const RolePermission = initRolePermissionModel(commonDB);
    const Permission = initPermissionModel(commonDB);

    const rolePermission = await RolePermission.findOne({
      role: roleId,
    }).populate("permissions");

    if (!rolePermission) {
      return { valid: false, message: "No permissions found for role" };
    }

    // Verify all permissions exist and are valid
    const validationPromises = rolePermission.permissions.map(
      async (permissionId) => {
        const permission = await Permission.findById(permissionId);
        return !!permission;
      }
    );

    const validationResults = await Promise.all(validationPromises);
    const allValid = validationResults.every((result) => result);

    return {
      valid: allValid,
      message: allValid
        ? "All permissions are valid"
        : "Some permissions are invalid",
      totalPermissions: rolePermission.permissions.length,
      invalidCount: validationResults.filter((result) => !result).length,
    };
  } catch (error) {
    console.error("Error validating role permissions:", error);
    return {
      valid: false,
      message: "Error validating permissions",
      error: error.message,
    };
  }
};

export const changeUserPassword = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, studentDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const { userId, roleId, newPassword } = req.body;

    // Validate request body
    if (!userId || !roleId || !newPassword) {
      return res.status(400).json({
        message: "Missing required fields: userId, roleId, newPassword",
      });
    }

    // Get role information
    const Role = initRoleModel(commonDB);
    const role = await Role.findById(roleId);

    if (!role) {
      return res.status(404).json({
        message: "Role not found",
      });
    }

    let user = null;
    let userModel = null;
    let userDB = null;

    // Determine which database to use based on role
    switch (role.name.toLowerCase()) {
      case "student":
        userModel = initStudentModel(studentDB, commonDB);
        userDB = studentDB;
        break;
      case "owner":
        userModel = initOwnerModel(hostelOwnerDB, commonDB);
        userDB = hostelOwnerDB;
        break;
      default:
        return res.status(400).json({
          message: "Invalid role for password change",
        });
    }

    // Find user in appropriate database
    user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: `${role.name} not found with provided ID`,
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in appropriate database
    user.password = hashedPassword;
    user.passwordLastChanged = new Date();
    user.passwordChangedBy = req.userId; // ID of admin who changed it
    await user.save();

    // Email configuration
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Enhanced email template based on user type
    const emailContent = `
      Dear ${user.name || "User"},
  
      Your password for Stay Home Hostels has been changed by an administrator.
      
      Account Type: ${role.name}
      New Temporary Password: ${newPassword}
      
      Please log in and change your password immediately for security purposes.
      
      If you did not expect this change, please contact support immediately.
      
      Best regards,
      Stay Home Hostels Team
      `;

    const mailOptions = {
      to: user.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels - Password Change Notification",
      text: emailContent,
      html: emailContent.replace(/\n/g, "<br>"),
    };

    await transporter.sendMail(mailOptions);

    // Log the password change
    console.log(
      `Password changed for ${role.name} ID: ${userId} by Admin ID: ${req.userId}`
    );

    res.status(200).json({
      message: "Password changed successfully",
      userType: role.name,
      email: user.email,
      emailSent: true,
    });
  } catch (error) {
    console.error("Error in changeUserPassword:", error);
    res.status(500).json({
      message: "Failed to change password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const addUser = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, studentDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const { email, roleName, password, ...additionalData } = req.body;

    // Get role from common database
    const Role = initRoleModel(commonDB);
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(400).json({ message: "Invalid role" });
    }

    let userModel;
    let userDB;
    let profileData = { ...additionalData, email };

    // Determine database based on role
    switch (roleName.toLowerCase()) {
      case "student":
        userModel = initStudentModel(studentDB, commonDB);
        userDB = studentDB;
        break;
      case "owner":
        userModel = initOwnerModel(hostelOwnerDB, commonDB);
        userDB = hostelOwnerDB;
        break;
      default:
        return res.status(400).json({
          message: "Invalid role for user creation",
        });
    }

    // Check if user exists in appropriate database
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: `Email already exists in ${roleName} database`,
      });
    }

    // Create user in appropriate database
    const newUser = new userModel({
      ...profileData,
      role: role._id,
      password, // Will be hashed by pre-save hook
      isApproved: roleName.toLowerCase() === "owner" ? false : true, // Owners need approval
      createdBy: req.userId,
      createdAt: new Date(),
    });

    await newUser.save();

    // Send email notification
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const emailContent = `
      Welcome to Stay Home Hostels!
  
      Your account has been created by an administrator.
  
      Account Details:
      ---------------
      Email: ${email}
      Password: ${password}
      Role: ${role.name}
      ${
        roleName.toLowerCase() === "owner"
          ? "\nNote: Your account requires approval before you can access the system."
          : ""
      }
  
      Please log in and change your password immediately for security purposes.
  
      Best regards,
      Stay Home Hostels Team
      `;

    const mailOptions = {
      to: email,
      from: "noreply@stayhomehostels.com",
      subject: "Welcome to Stay Home Hostels",
      text: emailContent,
      html: emailContent.replace(/\n/g, "<br>"),
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: "User created successfully",
      user: {
        ...newUser.toObject(),
        roleName: role.name,
        needsApproval: roleName.toLowerCase() === "owner",
      },
    });
  } catch (error) {
    console.error("Error in addUser:", error);
    res.status(500).json({
      message: "Failed to create user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateUserRole = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, studentDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const { userId } = req.params;
    const { roleName, email, password, ...additionalData } = req.body;

    // Get role from common database
    const Role = initRoleModel(commonDB);
    const newRole = await Role.findOne({ name: roleName });
    if (!newRole) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Find current user role and data
    let currentUser;
    let currentModel;
    let currentDB;

    // Try finding user in each database
    const Student = initStudentModel(studentDB, commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    currentUser = await Student.findById(userId);
    if (currentUser) {
      currentModel = Student;
      currentDB = studentDB;
    } else {
      currentUser = await Owner.findById(userId);
      if (currentUser) {
        currentModel = Owner;
        currentDB = hostelOwnerDB;
      }
    }

    if (!currentUser) {
      return res
        .status(404)
        .json({ message: "User not found in any database" });
    }

    // If role is changing, create new user in appropriate database and delete old one
    if (roleName.toLowerCase() !== currentUser.role.name.toLowerCase()) {
      // Create new user in new database
      let newModel;
      let newDB;

      switch (roleName.toLowerCase()) {
        case "student":
          newModel = Student;
          newDB = studentDB;
          break;
        case "owner":
          newModel = Owner;
          newDB = hostelOwnerDB;
          break;
        default:
          return res.status(400).json({ message: "Invalid new role" });
      }

      // Create new user
      const newUser = new newModel({
        ...additionalData,
        email: email || currentUser.email,
        password: password || currentUser.password,
        role: newRole._id,
        isApproved: roleName.toLowerCase() === "owner" ? false : true,
        modifiedBy: req.userId,
        modifiedAt: new Date(),
      });

      await newUser.save();

      // Delete old user
      await currentModel.findByIdAndDelete(userId);

      // Send email notification
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
        to: newUser.email,
        from: "noreply@stayhomehostels.com",
        subject: "Stay Home Hostels - Role Update",
        text: `Your role has been updated to ${roleName}. ${
          roleName.toLowerCase() === "owner"
            ? "Your account requires approval before you can access the system."
            : ""
        }`,
        html: `Your role has been updated to <strong>${roleName}</strong>. ${
          roleName.toLowerCase() === "owner"
            ? "<br><br>Your account requires approval before you can access the system."
            : ""
        }`,
      };

      await transporter.sendMail(mailOptions);

      res.status(200).json({
        message: "User role updated successfully",
        user: {
          ...newUser.toObject(),
          roleName: newRole.name,
        },
      });
    } else {
      // If just updating other fields
      if (email) currentUser.email = email;
      if (password) currentUser.password = password;
      Object.assign(currentUser, additionalData);
      currentUser.modifiedBy = req.userId;
      currentUser.modifiedAt = new Date();

      await currentUser.save();

      res.status(200).json({
        message: "User updated successfully",
        user: {
          ...currentUser.toObject(),
          roleName: newRole.name,
        },
      });
    }
  } catch (error) {
    console.error("Error in updateUserRole:", error);
    res.status(500).json({
      message: "Failed to update user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteUser = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, studentDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const { userId } = req.params;

    // Try finding user in each database
    const Student = initStudentModel(studentDB, commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    let user;
    let userModel;

    user = await Student.findById(userId);
    if (user) {
      userModel = Student;
    } else {
      user = await Owner.findById(userId);
      if (user) {
        userModel = Owner;
      }
    }

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found in any database" });
    }

    // Delete user
    await userModel.findByIdAndDelete(userId);

    // Send email notification
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
      subject: "Stay Home Hostels - Account Deletion",
      text: "Your Stay Home Hostels account has been deleted by an administrator.",
      html: "Your Stay Home Hostels account has been deleted by an administrator.",
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "User deleted successfully",
      userType: userModel === Student ? "student" : "owner",
    });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({
      message: "Failed to delete user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getAllUsers = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, studentDB, hostelOwnerDB } = dbCheck.connections;

  try {
    // Initialize models
    const Student = initStudentModel(studentDB, commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);
    const Role = initRoleModel(commonDB);

    // Get all roles first
    const roles = await Role.find({}).lean();
    console.log(
      "Available roles:",
      roles.map((r) => r.name)
    );

    // Function to safely populate role
    const populateRole = async (user) => {
      try {
        let roleData;
        if (typeof user.role === "string") {
          // If role is a string, find by name
          roleData = roles.find(
            (r) => r.name.toLowerCase() === user.role.toLowerCase()
          );
        } else if (user.role instanceof mongoose.Types.ObjectId) {
          // If role is ObjectId, find by _id
          roleData = roles.find(
            (r) => r._id.toString() === user.role.toString()
          );
        } else if (user.role?._id) {
          // If role is already populated
          return user;
        }

        return {
          ...user,
          role: roleData || { name: "No Role Assigned" },
        };
      } catch (error) {
        console.error("Error populating role for user:", user._id, error);
        return {
          ...user,
          role: { name: "Error Loading Role" },
        };
      }
    };

    // Fetch students
    const students = await Student.find()
      .select("-password -resetPasswordToken -resetPasswordOTP -otp -emailOtp")
      .lean();

    // Fetch owners
    const owners = await Owner.find()
      .select("-password -resetPasswordToken -resetPasswordOTP -otp -emailOtp")
      .lean();

    // Populate roles for all users
    const populatedStudents = await Promise.all(
      students.map((student) => populateRole(student))
    );

    const populatedOwners = await Promise.all(
      owners.map((owner) => populateRole(owner))
    );

    // Format user data
    const formatUser = (user, type) => ({
      id: user._id?.toString(),
      email: user.email,
      name: user.name || "",
      userType: type,
      roleId: user.role?._id?.toString() || null,
      roleName: user.role?.name || "No Role Assigned",
      isApproved: user.isApproved || false,
      lastLogin: user.lastLogin || null,
      createdAt: user._id
        ? new Date(parseInt(user._id.toString().substring(0, 8), 16) * 1000)
        : null,

      // Type-specific fields
      ...(type === "student"
        ? {
            college: user.college || "",
            year: user.year || "",
            wishlistSubmitted: user.wishlistSubmitted || false,
            wishlistApproved: user.wishlistApproved || false,
            wishlistCount: user.wishlist?.length || 0,
            class: user.class || "",
            gender: user.gender || "",
            number: user.number || "",
          }
        : {
            hostelCount: user.hostels?.length || 0,
            verificationStatus: user.verificationStatus || "pending",
            city: user.city || "",
            address: user.address || "",
          }),
    });

    // Combine and format users
    const allUsers = [
      ...populatedStudents.map((student) => formatUser(student, "student")),
      ...populatedOwners.map((owner) => formatUser(owner, "owner")),
    ];

    // Sort by creation date
    allUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    res.status(200).json({
      success: true,
      total: allUsers.length,
      students: populatedStudents.length,
      owners: populatedOwners.length,
      roles: roles.map((role) => ({
        id: role._id,
        name: role.name,
        description: role.description,
      })),
      users: allUsers,
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

export const addRole = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB } = dbCheck.connections;

  try {
    const Role = initRoleModel(commonDB);
    const { name, description } = req.body;

    // Validate request body
    if (!name) {
      return res.status(400).json({
        message: "Role name is required",
      });
    }

    // Check if role already exists (case insensitive)
    const existingRole = await Role.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingRole) {
      return res.status(400).json({
        message: "Role already exists",
        existingRole: existingRole.name,
      });
    }

    // Create new role
    const newRole = await Role.create({
      _id: new mongoose.Types.ObjectId(),
      name: name.toLowerCase(),
      description,
      createdBy: req.userId,
      createdAt: new Date(),
    });

    // Initialize empty role permissions
    const RolePermission = initRolePermissionModel(commonDB);
    await RolePermission.create({
      role: newRole._id,
      permissions: [],
      createdBy: req.userId,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: "Role added successfully",
      role: newRole,
      permissions: {
        message: "Initial empty permissions created",
      },
    });
  } catch (error) {
    console.error("Error in addRole:", error);
    res.status(500).json({
      message: "Error creating role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteRole = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, studentDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const Role = initRoleModel(commonDB);
    const Permission = initPermissionModel(commonDB);
    const RolePermission = initRolePermissionModel(commonDB);
    const Student = initStudentModel(studentDB, commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const { roleName } = req.params;

    // Find role
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Prevent deletion of essential roles
    if (["admin", "student", "owner"].includes(roleName.toLowerCase())) {
      return res.status(403).json({
        message: "Cannot delete essential system role",
        role: roleName,
      });
    }

    // Check if any users are using this role
    const studentsWithRole = await Student.countDocuments({ role: role._id });
    const ownersWithRole = await Owner.countDocuments({ role: role._id });

    if (studentsWithRole > 0 || ownersWithRole > 0) {
      return res.status(400).json({
        message: "Cannot delete role that is assigned to users",
        usersCount: {
          students: studentsWithRole,
          owners: ownersWithRole,
          total: studentsWithRole + ownersWithRole,
        },
      });
    }

    // Delete role and related data
    const deleteOperations = [
      Permission.deleteMany({ role: role._id }),
      RolePermission.deleteOne({ role: role._id }),
      Role.findByIdAndDelete(role._id),
    ];

    await Promise.all(deleteOperations);

    res.status(200).json({
      message: "Role and associated data deleted successfully",
      deletedRole: {
        name: role.name,
        id: role._id,
      },
    });
  } catch (error) {
    console.error("Error in deleteRole:", error);
    res.status(500).json({
      message: "Error deleting role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getRoles = async (req, res) => {
  const dbCheck = validateDBConnections(req, res);
  if (dbCheck.error) return;

  const { commonDB, studentDB, hostelOwnerDB } = dbCheck.connections;

  try {
    const Role = initRoleModel(commonDB);
    const RolePermission = initRolePermissionModel(commonDB);
    const Student = initStudentModel(studentDB, commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    // Get all roles with their permissions
    const roles = await Role.find().sort({ name: 1 });

    // Get user counts and permissions for each role
    const enhancedRoles = await Promise.all(
      roles.map(async (role) => {
        const [studentsCount, ownersCount, rolePermissions] = await Promise.all(
          [
            Student.countDocuments({ role: role._id }),
            Owner.countDocuments({ role: role._id }),
            RolePermission.findOne({ role: role._id }).populate("permissions"),
          ]
        );

        const permissions = rolePermissions?.permissions || [];

        return {
          ...role.toObject(),
          users: {
            students: studentsCount,
            owners: ownersCount,
            total: studentsCount + ownersCount,
          },
          permissions: permissions.length,
          isSystemRole: ["admin", "student", "owner"].includes(
            role.name.toLowerCase()
          ),
          canDelete:
            !["admin", "student", "owner"].includes(role.name.toLowerCase()) &&
            studentsCount + ownersCount === 0,
        };
      })
    );

    res.status(200).json({
      roles: enhancedRoles,
      summary: {
        totalRoles: enhancedRoles.length,
        systemRoles: enhancedRoles.filter((r) => r.isSystemRole).length,
        customRoles: enhancedRoles.filter((r) => !r.isSystemRole).length,
      },
    });
  } catch (error) {
    console.error("Error in getRoles:", error);
    res.status(500).json({
      message: "Error fetching roles",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
