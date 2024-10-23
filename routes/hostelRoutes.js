import express from "express";
import {
  addHostel,
  getAllHostelsWithOwnerDetails,
  getHostelById,
  getPhotos,
  getIdproofPhoto,
  updateHostelDetails,
  getOwnerById,
  updateOwnerProfile,
  removeHostel,
  getHostelWishlistStudents,
  getAdmittedStudents,
  applyCashback,
  getHostelComplaints,
  updateComplaintStatus,
  deleteComplaint,
  getPendingVisits,
  respondToVisitRequest,
  markVisitCompleted,
} from "../controllers/hostelController.js";

import upload from "../middlewares/uploadMiddleware.js";
import { ownerAuthMiddleware } from "../middlewares/authMiddleware.js";

import { initHostelModel } from "../models/hostelModel.js";

const router = express.Router();

// Get all hostels with owner details
router.get("/all", getAllHostelsWithOwnerDetails);

// Get a specific hostel by ID
router.get("/:id", getHostelById);

// Get hostel photos
router.get("/gethostalphotos/:id", getPhotos);

// Get owner's ID proof photo
router.get("/getidproof/:id", getIdproofPhoto);

// Add a new hostel
router.post(
  "/add-hostel",
  ownerAuthMiddleware,
  upload.array("images", 10),
  addHostel
);

// Update hostel details
router.put(
  "/update-hostel",
  ownerAuthMiddleware,

  updateHostelDetails
);

// Get owner details by ID
router.get("/owners/:id", getOwnerById);

// Update owner profile
router.put("/owner/:profileId", ownerAuthMiddleware, updateOwnerProfile);

// Delete a hostel
router.delete(
  "/delete/:hostelId",
  ownerAuthMiddleware,

  removeHostel
);

// Get hostels owned by a specific owner
router.get(
  "/:ownerId/hostels",
  ownerAuthMiddleware,

  async (req, res) => {
    try {
      const commonDB = req.app.locals.commonDB;
      if (!commonDB) {
        return res.status(500).json({ message: "Database connection error" });
      }
      const Hostel = initHostelModel(commonDB);

      const ownerHostels = await Hostel.find({
        owner: req.params.ownerId,
      });

      res.status(200).json({ hostels: ownerHostels });
    } catch (error) {
      console.error("Backend error:", error);
      res
        .status(500)
        .json({ message: "Something went wrong", error: error.message });
    }
  }
);

// Get wishlist students for a hostel
router.get(
  "/:hostelId/wishlist-students",
  ownerAuthMiddleware,
  getHostelWishlistStudents
);

// Get admitted students for a hostel
router.get(
  "/:hostelId/admitted-students",
  ownerAuthMiddleware,
  getAdmittedStudents
);

// Apply cashback
router.post("/apply-cashback", ownerAuthMiddleware, applyCashback);

// Get hostel complaints
router.get("/:hostelId/complaints", ownerAuthMiddleware, getHostelComplaints);

// Update complaint status
router.patch(
  "/complaints/:complaintId/status",
  ownerAuthMiddleware,
  updateComplaintStatus
);

// Delete a complaint
router.delete("/complaints/:complaintId", ownerAuthMiddleware, deleteComplaint);

// Get pending visits for a hostel
router.get("/:hostelId/pending-visits", ownerAuthMiddleware, getPendingVisits);

// Respond to a visit request
router.post("/respond-visit", ownerAuthMiddleware, respondToVisitRequest);

// Mark a visit as completed
router.post("/complete-visit", ownerAuthMiddleware, markVisitCompleted);

export default router;
