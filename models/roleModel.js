// models/roleModel.js
import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  name: { type: String, required: true },
  description: String,
});

export const initRoleModel = (commonDB) => {
  // Check if model already exists to avoid recompiling
  if (commonDB.models.Role) {
    return commonDB.models.Role;
  }

  // Register the model
  const Role = commonDB.model("Role", roleSchema);
  return Role;
};

// Export schema for reference in other models
export const RoleSchema = roleSchema;
