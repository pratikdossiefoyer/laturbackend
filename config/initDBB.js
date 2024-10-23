// config/initDBB.js
import mongoose from "mongoose";
import { initStudentModel } from "../models/studentModel.js";
import { initOwnerModel } from "../models/ownerModel.js";
import { initHostelModel } from "../models/hostelModel.js";
import { initRoleModel } from "../models/roleModel.js";
import { initGroupModel } from "../models/groupModel.js";
import { initPermissionModel } from "../models/permissionModel.js";

import { initRolePermissionModel } from "../models/rolePermissonModal.js";

const initDBB = async (studentDB, hostelOwnerDB, commonDB) => {
  try {
    console.log("Initializing database models");
    const Student = initStudentModel(studentDB, commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);
    const Hostel = initHostelModel(commonDB);

    // Initialize new models
    const Role = initRoleModel(commonDB);
    const Group = initGroupModel(commonDB);
    const Permission = initPermissionModel(commonDB);
    const RolePermission = initRolePermissionModel(commonDB);

    console.log("Student model initialized:", Student ? "yes" : "no");
    console.log("Owner model initialized:", Owner ? "yes" : "no");
    console.log("Hostel model initialized:", Hostel ? "yes" : "no");
    console.log("Role model initialized:", Role ? "yes" : "no");
    console.log("Group model initialized:", Group ? "yes" : "no");
    console.log("Permission model initialized:", Permission ? "yes" : "no");
    console.log(
      "RolePermission model initialized:",
      RolePermission ? "yes" : "no"
    );

    console.log("Database initialized successfully");

    // Return the initialized models
    return { Student, Owner, Hostel, Role, Group, Permission, RolePermission };
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
};

export default initDBB;
