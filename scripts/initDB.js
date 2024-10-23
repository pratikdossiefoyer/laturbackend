// config/initDB.js
import mongoose from "mongoose";
import { initRoleModel } from "../models/roleModel.js";
import { initStudentModel } from "../models/studentModel.js";
import { initOwnerModel } from "../models/ownerModel.js";
import bcrypt from "bcryptjs";

const initDB = async (studentDB, hostelOwnerDB, commonDB) => {
  try {
    // Initialize models
    const Role = initRoleModel(commonDB);
    const Student = initStudentModel(studentDB, commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    // Check if admin role exists
    let adminRole = await Role.findOne({ name: "admin" });

    if (!adminRole) {
      // Create admin role if it doesn't exist
      adminRole = new Role({
        _id: new mongoose.Types.ObjectId(),
        name: "admin",
        description: "Administrator with full access",
      });
      adminRole = await adminRole.save();
      console.log("Admin role created in common database");
    }

    // Check if hostel owner role exists
    let hostelOwnerRole = await Role.findOne({ name: "hostelOwner" });

    if (!hostelOwnerRole) {
      // Create hostel owner role if it doesn't exist
      hostelOwnerRole = new Role({
        _id: new mongoose.Types.ObjectId(),
        name: "hostelOwner",
        description: "Hostel owner with limited access",
      });
      hostelOwnerRole = await hostelOwnerRole.save();
      console.log("Hostel owner role created in common database");
    }
    // Check if hostel owner role exists
    let studentRole = await Role.findOne({ name: "student" });

    if (!studentRole) {
      // Create hostel owner role if it doesn't exist
      hostelOwnerRole = new Role({
        _id: new mongoose.Types.ObjectId(),
        name: "student",
        description: "student",
      });
      hostelOwnerRole = await hostelOwnerRole.save();
      console.log("student role created in common database");
    }

    // Function to create admin user in a specific database
    const createAdminUser = async (UserModel, dbName) => {
      const adminUser = await UserModel.findOne({ email: "admin@gmail.com" });

      if (!adminUser) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("123", salt);

        const newAdminUser = new UserModel({
          email: "admin@gmail.com",

          password: hashedPassword,
          role: adminRole._id, // Reference to the admin role in the common database
          isApproved: true,
        });
        await newAdminUser.save();
        console.log(`Admin user created in ${dbName} database`);
      }
    };

    // Create admin user in student database
    await createAdminUser(Student, "student");

    // Create admin user in hostel owner database
    await createAdminUser(Owner, "hostel owner");

    console.log("Database initialization complete");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
};

export default initDB;
