import express from "express";
import { adminAuthMiddleware } from "../middlewares/authMiddleware.js";

import {
  getHostelById,
  getAllStudents,
  getAllHostels,
  updateHostel,
  updateStudent,
  verifyHostel,
  getAllOwners,
  updateOwner,
  removeFromWishlist,
  removeStudent,
  removeHostel,
  getGroups,
  addGroup,
  updateGroup,
  deleteGroup,
  assignGroupToRole,
  removePermissionFromRole,
  updateRolePermissions,
  getAllUsers,
  addUser,
  updateUserRole,
  deleteUser,
  addRole,
  deleteRole,
  getRoles,
} from "../controllers/adminController.js";

const router = express.Router();

// Hostel routes
router.get("/hostels", adminAuthMiddleware, getAllHostels);
router.get("/hostels/:hostelId", adminAuthMiddleware, getHostelById);
router.put("/hostels", adminAuthMiddleware, updateHostel);
router.post("/hostels/verify", adminAuthMiddleware, verifyHostel);
router.delete("/hostels/:hostelId", adminAuthMiddleware, removeHostel);

// Student routes
router.get("/students", adminAuthMiddleware, getAllStudents);
router.put("/students", adminAuthMiddleware, updateStudent);
router.post(
  "/students/wishlist/remove",
  adminAuthMiddleware,
  removeFromWishlist
);
router.delete("/students/:studentId", adminAuthMiddleware, removeStudent);

// Owner routes
router.get("/owners", adminAuthMiddleware, getAllOwners);
router.put("/owners", adminAuthMiddleware, updateOwner);

// Groups

router.get("/groups", adminAuthMiddleware, getGroups);
router.post("/groups", adminAuthMiddleware, addGroup);
router.put("/groups", adminAuthMiddleware, updateGroup);
router.delete("/groups/:id", adminAuthMiddleware, deleteGroup);

router.post("/assign-group-to-role", adminAuthMiddleware, assignGroupToRole);
router.delete(
  "/remove-permission-from-role",
  adminAuthMiddleware,
  removePermissionFromRole
);
router.patch(
  "/update-role-permissions",
  adminAuthMiddleware,
  updateRolePermissions
);
//UAC Role page get all users , add user, role update,delete role
router.get("/users", getAllUsers);
router.post("/users", addUser);
router.put("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

// roles
//add roles
router.post("/roles", addRole);
router.delete("/roles/:roleName", deleteRole);
router.get("/getroles", getRoles);

export default router;
