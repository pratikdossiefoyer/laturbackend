// models/rolePermissionModel.js
import mongoose from "mongoose";

// models/rolePermissionModel.js
export const initRolePermissionModel = (commonDB) => {
  if (!commonDB) {
    console.error(
      "Common database connection not provided to initRolePermissionModel"
    );
    return null;
  }

  if (commonDB.models.RolePermission) {
    return commonDB.models.RolePermission;
  }

  const rolePermissionSchema = new mongoose.Schema({
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      unique: true,
    },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
  });

  return commonDB.model("RolePermission", rolePermissionSchema);
};
