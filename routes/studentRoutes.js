import express from "express";
import {
  getStudentById,
  getWishlistByStudentId,
  addToWishlist,
  removeFromWishlist,
  submitWishlist,
  takeAdmission,
  updateStudentProfile,
  uploadAdmissionReceipt,
  submitHostelFeedback,
  getPassportPhoto,
  submitComplaint,
  getStudentComplaints,
  markNotInterested,
  requestOrUpdateHostelVisit,
} from "../controllers/studentController.js";
import {
  commonVerifyToken,
  studentAuthMiddleware,
} from "../middlewares/authMiddleware.js";

import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/:studentId", getStudentById);
router.get("/getphoto/:id", getPassportPhoto);
router.post("/wishlist/submit", studentAuthMiddleware, submitWishlist);
router.post("/submit-feedback", studentAuthMiddleware, submitHostelFeedback);
router.put(
  "/update-profile/:profileId",
  upload.fields([{ name: "passportPhoto", maxCount: 1 }]),
  studentAuthMiddleware,

  updateStudentProfile
);
router.post(
  "/upload-receipt",
  upload.single("admissionReceipt"),
  studentAuthMiddleware,
  uploadAdmissionReceipt
);
router.post("/take-admission", studentAuthMiddleware, takeAdmission);
router.post(
  "/complaints",
  upload.array("images", 5),
  studentAuthMiddleware,
  submitComplaint
);
router.get("/complaints/:studentId", getStudentComplaints);
router.get(
  "/wishlist/:studentId",
  studentAuthMiddleware,

  getWishlistByStudentId
);
router.post("/wishlist/remove", studentAuthMiddleware, removeFromWishlist);
router.post(
  "/wishlist/add",
  studentAuthMiddleware,

  addToWishlist
);
router.post(
  "/request-visit",
  studentAuthMiddleware,
  requestOrUpdateHostelVisit
);
router.post("/not-interested", studentAuthMiddleware, markNotInterested);

export default router;
