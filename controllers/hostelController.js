import { initOwnerModel } from "../models/ownerModel.js";
import { initHostelModel } from "../models/hostelModel.js";

import { initStudentModel } from "../models/studentModel.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

export const addHostel = async (req, res) => {
  console.log("Adding new hostel");
  const {
    name,
    number,
    address,
    hostelType,
    beds,
    studentsPerRoom,
    food,
    foodType,
    mealOptions,
    rentStructure,
    wifi,
    ac,
    mess,
    solar,
    studyRoom,
    tuition,
    kitchenType,
  } = req.body;

  try {
    const commonDB = req.app.locals.commonDB;
    const hostelOwnerDB = req.app.locals.hostelOwnerDB;

    if (!commonDB || !hostelOwnerDB) {
      console.error("Database connections not found");
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);

    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    if (!Hostel || !Owner) {
      console.error("Failed to initialize models");
      return res.status(500).json({ message: "Failed to initialize models" });
    }

    let processedMealOptions = [];
    let processedFoodType = null;

    if (food === true || food === "true") {
      // Process meal options
      if (Array.isArray(mealOptions)) {
        processedMealOptions = mealOptions;
      } else if (typeof mealOptions === "string") {
        processedMealOptions = JSON.parse(mealOptions);
      }

      if (processedMealOptions.includes("all")) {
        processedMealOptions = ["all"];
      }

      // Process food type
      processedFoodType = foodType;
    }

    const newHostel = new Hostel({
      name,
      owner: req.user.profileId,
      number,
      address,
      hostelType,
      beds: parseInt(beds),
      studentsPerRoom: parseInt(studentsPerRoom),
      food: food === true || food === "true",
      foodType: processedFoodType,
      mealOptions: processedMealOptions,
      images: req.files
        ? req.files.map((file) => ({
            data: file.buffer,
            contentType: file.mimetype,
          }))
        : [],
      rentStructure: JSON.parse(rentStructure).map((item) => ({
        studentsPerRoom: parseInt(item.studentsPerRoom),
        rentPerStudent: parseFloat(item.rentPerStudent),
      })),
      wifi: wifi === true || wifi === "true",
      ac: ac === true || ac === "true",
      mess: mess === true || mess === "true",
      solar: solar === true || solar === "true",
      studyRoom: studyRoom === true || studyRoom === "true",
      tuition: tuition === true || tuition === "true",
      kitchenType,
      verified: false, // Always set to false initially
    });

    const savedHostel = await newHostel.save();

    await Owner.findByIdAndUpdate(req.user.profileId, {
      $push: { hostels: savedHostel._id },
    });

    res.status(201).json({
      message: "Hostel added successfully",
      hostel: savedHostel,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const updateOwnerProfile = async (req, res) => {
  const { name, number, email, address, password } = req.body;
  const { profileId } = req.params;

  try {
    const commonDB = req.app.locals.commonDB;
    const hostelOwnerDB = req.app.locals.hostelOwnerDB;

    if (!commonDB || !hostelOwnerDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const existingOwner = await Owner.findById(profileId);
    if (!existingOwner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const updateData = { name, number, email, address };

    if (req.files && req.files.idProof && req.files.idProof.length > 0) {
      updateData.idProof = {
        data: req.files.idProof[0].buffer,
        contentType: req.files.idProof[0].mimetype,
      };
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedOwner = await Owner.findByIdAndUpdate(profileId, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      message: "Profile updated successfully",
      owner: updatedOwner,
    });
  } catch (error) {
    console.error("Error updating owner profile:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const removeHostel = async (req, res) => {
  const { hostelId } = req.params;

  try {
    const commonDB = req.app.locals.commonDB;
    const hostelOwnerDB = req.app.locals.hostelOwnerDB;
    const studentDB = req.app.locals.studentDB;

    if (!commonDB || !hostelOwnerDB || !studentDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);
    const Student = initStudentModel(studentDB, commonDB);

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const studentsAdmitted = await Student.find({ admittedHostel: hostelId });
    if (studentsAdmitted.length > 0) {
      return res.status(403).json({
        message: "Hostel cannot be deleted because students are admitted.",
      });
    }

    await Hostel.deleteOne({ _id: hostelId });
    await Owner.findByIdAndUpdate(hostel.owner, {
      $pull: { hostels: hostelId },
    });

    res.status(200).json({ message: "Hostel removed successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getAllHostelsWithOwnerDetails = async (req, res) => {
  try {
    const commonDB = req.app.locals.commonDB;
    const hostelOwnerDB = req.app.locals.hostelOwnerDB;

    if (!commonDB || !hostelOwnerDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const hostels = await Hostel.find();
    const hostelsWithOwners = await Promise.all(
      hostels.map(async (hostel) => {
        const owner = await Owner.findById(hostel.owner).select("-password");
        return {
          ...hostel.toObject(),
          ownerDetails: owner,
        };
      })
    );

    if (hostelsWithOwners.length === 0) {
      return res.status(404).json({ message: "No hostels found" });
    }

    res.status(200).json(hostelsWithOwners);
  } catch (error) {
    console.error("Error in getAllHostelsWithOwnerDetails:", error);
    res.status(500).json({
      message: "Something went wrong",
      error: { message: error.message, stack: error.stack },
    });
  }
};

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10, // Maximum 10 files
  },
  fileFilter: fileFilter,
}).array("images", 10);

export const updateHostelDetails = async (req, res) => {
  const handleUpload = () => {
    return new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          reject({
            status: 400,
            message: "Multer error",
            error: err.message,
          });
        } else if (err) {
          reject({
            status: 400,
            message: "Unknown error",
            error: err.message,
          });
        }
        resolve();
      });
    });
  };

  try {
    await handleUpload();

    const commonDB = req.app.locals.commonDB;
    if (!commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);

    const {
      hostelId,
      rentStructure,
      foodType,
      mealOptions,
      food,
      wifi,
      solar,
      mess,
      studyRoom,
      tuition,
      kitchenType,
      existingImages,
      complaints,
      feedback,
      ...updateData
    } = req.body;

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    // Handle existing images
    let updatedImages = hostel.images;
    if (existingImages) {
      try {
        const existingImageIds = JSON.parse(existingImages);
        updatedImages = updatedImages.filter((img) =>
          existingImageIds.includes(img._id.toString())
        );
      } catch (error) {
        return res.status(400).json({
          message: "Invalid existing images data",
          error: error.message,
        });
      }
    }

    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        data: file.buffer,
        contentType: file.mimetype,
      }));
      updatedImages = [...updatedImages, ...newImages];
    }

    // Parse and validate rent structure
    let parsedRentStructure;
    try {
      parsedRentStructure =
        typeof rentStructure === "string"
          ? JSON.parse(rentStructure)
          : rentStructure;

      // Validate rent structure format
      if (!Array.isArray(parsedRentStructure)) {
        throw new Error("Rent structure must be an array");
      }

      parsedRentStructure.forEach((rent) => {
        if (!rent.studentsPerRoom || !rent.rentPerStudent) {
          throw new Error("Invalid rent structure format");
        }
      });
    } catch (error) {
      return res.status(400).json({
        message: "Invalid rent structure format",
        error: error.message,
      });
    }

    // Process meal options and food type
    let processedMealOptions = [];
    let processedFoodType = null;
    if (food === true || food === "true") {
      try {
        processedMealOptions = Array.isArray(mealOptions)
          ? mealOptions
          : typeof mealOptions === "string"
          ? JSON.parse(mealOptions)
          : [];

        if (processedMealOptions.includes("all")) {
          processedMealOptions = ["all"];
        }
        processedFoodType = foodType;
      } catch (error) {
        return res.status(400).json({
          message: "Invalid meal options format",
          error: error.message,
        });
      }
    }

    // Parse and validate complaints
    let parsedComplaints = [];
    if (complaints && complaints !== '[""]') {
      try {
        parsedComplaints =
          typeof complaints === "string" ? JSON.parse(complaints) : complaints;

        // Validate complaint objects
        if (!Array.isArray(parsedComplaints)) {
          throw new Error("Complaints must be an array");
        }

        parsedComplaints = parsedComplaints.filter((complaint) => {
          return (
            complaint &&
            typeof complaint === "object" &&
            complaint.description && // Required field
            (!complaint.complaintType || // Optional field
              ["Rooms", "Washroom", "Wi-Fi", "Cleanliness", "Food"].includes(
                complaint.complaintType
              ))
          );
        });
      } catch (error) {
        return res.status(400).json({
          message: "Invalid complaints data",
          error: error.message,
        });
      }
    }

    // Parse and validate feedback
    let parsedFeedback = [];
    if (feedback && feedback !== '[""]') {
      try {
        parsedFeedback =
          typeof feedback === "string" ? JSON.parse(feedback) : feedback;

        // Validate feedback objects
        if (!Array.isArray(parsedFeedback)) {
          throw new Error("Feedback must be an array");
        }

        parsedFeedback = parsedFeedback.filter((item) => {
          return (
            item &&
            typeof item === "object" &&
            typeof item.rating === "number" && // Required field
            item.rating >= 1 &&
            item.rating <= 5
          );
        });
      } catch (error) {
        return res.status(400).json({
          message: "Invalid feedback data",
          error: error.message,
        });
      }
    }

    // Update hostel with validated data
    const updateObject = {
      ...updateData,
      images: updatedImages,
      rentStructure: parsedRentStructure,
      food: food === true || food === "true",
      foodType: processedFoodType,
      mealOptions: processedMealOptions,
      wifi: wifi === true || wifi === "true",
      ac: updateData.ac === true || updateData.ac === "true",
      mess: mess === true || mess === "true",
      solar: solar === true || solar === "true",
      studyRoom: studyRoom === true || studyRoom === "true",
      tuition: tuition === true || tuition === "true",
      kitchenType,
    };

    // Only update arrays if they contain valid data
    if (parsedComplaints.length > 0) {
      updateObject.complaints = parsedComplaints;
    }
    if (parsedFeedback.length > 0) {
      updateObject.feedback = parsedFeedback;
    }

    const updatedHostel = await Hostel.findByIdAndUpdate(
      hostelId,
      { $set: updateObject },
      { new: true, runValidators: true }
    );

    res.json(updatedHostel);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
        error: error.error,
      });
    }
    console.error("Error updating hostel:", error);
    res.status(500).json({
      message: "Error updating hostel",
      error: error.message,
    });
  }
};

export const getHostelById = async (req, res) => {
  const { id } = req.params;
  try {
    const commonDB = req.app.locals.commonDB;
    const hostelOwnerDB = req.app.locals.hostelOwnerDB;

    if (!commonDB || !hostelOwnerDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);
    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const hostel = await Hostel.findById(id).populate({
      path: "owner",
      select: "-password",
    });

    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const ownerWithHostels = await Owner.findById(hostel.owner._id)
      .select("-password")
      .populate("hostels", "name address hostelType beds");

    const response = {
      hostel: {
        profileId: hostel._id,
        name: hostel.name,
        number: hostel.number,
        address: hostel.address,
        hostelType: hostel.hostelType,
        beds: hostel.beds,
        studentsPerRoom: hostel.studentsPerRoom,
        food: hostel.food,
        foodType: hostel.foodType,
        mealOptions: hostel.mealOptions,
        images: hostel.images,
        verified: hostel.verified,
        paymentStatus: hostel.paymentStatus,
        registerDate: hostel.registerDate,
        wifi: hostel.wifi,
        ac: hostel.ac,
        mess: hostel.mess,
        solar: hostel.solar,
        studyRoom: hostel.studyRoom,
        tuition: hostel.tuition,
        kitchenType: hostel.kitchenType,
        pendingVisits: hostel.pendingVisits,
        rentStructure: hostel.rentStructure,
        feedback: hostel.feedback,
        complaints: hostel.complaints,
      },
      owner: {
        profileId: ownerWithHostels._id,
        name: ownerWithHostels.name,
        email: ownerWithHostels.email,
        number: ownerWithHostels.number,
        address: ownerWithHostels.address,
        hostels: ownerWithHostels.hostels,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getOwnerById = async (req, res) => {
  const ownerId = req.params.id;
  try {
    const hostelOwnerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    if (!hostelOwnerDB || !commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const owner = await Owner.findById(ownerId).select("-password").populate({
      path: "hostels",
      select: "name address hostelType beds",
    });

    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const response = {
      owner: {
        profileId: owner._id,
        name: owner.name,
        email: owner.email,
        number: owner.number,
        address: owner.address,
        hostels: owner.hostels,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getHostelWishlistStudents = async (req, res) => {
  const { hostelId } = req.params;
  try {
    const studentDB = req.app.locals.studentDB;
    const commonDB = req.app.locals.commonDB;

    if (!studentDB || !commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Student = initStudentModel(studentDB, commonDB);

    const students = await Student.find({ wishlist: hostelId }).select(
      "-password -wishlist -admissionReceipt"
    );
    res.status(200).json(students);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getAdmittedStudents = async (req, res) => {
  const { hostelId } = req.params;
  const ownerId = req.user.profileId;

  try {
    const commonDB = req.app.locals.commonDB;
    const studentDB = req.app.locals.studentDB;

    if (!commonDB || !studentDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);
    const Student = initStudentModel(studentDB, commonDB);

    const hostel = await Hostel.findOne({ _id: hostelId, owner: ownerId });

    if (!hostel) {
      return res.status(404).json({
        message:
          "Hostel not found or you're not authorized to access this data",
      });
    }

    const students = await Student.find({
      admittedHostel: hostelId,
    }).select("-complaints -wishlist -passportPhoto");

    const studentsWithReceipts = await Promise.all(
      students.map(async (student) => {
        if (student.admitReceipt) {
          const receiptBuffer = await fs.readFile(student.admitReceipt);
          const binaryReceipt = receiptBuffer.toString("base64");
          return { ...student.toObject(), binaryAdmitReceipt: binaryReceipt };
        }
        return student.toObject();
      })
    );

    const hostelWithStudents = {
      _id: hostel._id,
      name: hostel.name,
      admittedStudents: studentsWithReceipts,
      totalAdmittedStudents: studentsWithReceipts.length,
    };

    if (studentsWithReceipts.length === 0) {
      hostelWithStudents.message =
        "No admitted students found for this hostel.";
    }

    res.status(200).json(hostelWithStudents);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const applyCashback = async (req, res) => {
  const { studentId, hostelId } = req.body;
  try {
    const commonDB = req.app.locals.commonDB;
    const studentDB = req.app.locals.studentDB;

    if (!commonDB || !studentDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);
    const Student = initStudentModel(studentDB, commonDB);

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }
    if (hostel.owner.toString() !== req.user.profileId.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to apply cashback for this hostel" });
    }
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    if (student.cashbackApplied) {
      return res.status(400).json({ message: "Cashback already applied" });
    }
    student.cashbackApplied = true;
    await student.save();
    res.status(200).json({ message: "Cashback applied successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getPhotos = async (req, res) => {
  try {
    const commonDB = req.app.locals.commonDB;

    if (!commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);

    const hostelId = req.params.id;
    const hostel = await Hostel.findById(hostelId);

    if (!hostel || !hostel.images || hostel.images.length === 0) {
      return res.status(404).send("No photos found");
    }

    const imagesBase64 = hostel.images.map((image) => ({
      contentType: image.contentType,
      data: image.data.toString("base64"),
    }));

    res.json(imagesBase64);
  } catch (error) {
    res.status(500).send("Error retrieving photos");
  }
};

export const getIdproofPhoto = async (req, res) => {
  try {
    const hostelOwnerDB = req.app.locals.hostelOwnerDB;
    const commonDB = req.app.locals.commonDB;

    if (!hostelOwnerDB || !commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Owner = initOwnerModel(hostelOwnerDB, commonDB);

    const owner = await Owner.findById(req.params.id);
    if (!owner || !owner.idProof) {
      return res.status(404).send("No photo found");
    }
    res.set("Content-Type", owner.idProof.contentType);
    res.send(owner.idProof.data);
  } catch (error) {
    res.status(500).send("Error retrieving photo");
  }
};

export const getHostelComplaints = async (req, res) => {
  try {
    const commonDB = req.app.locals.commonDB;

    if (!commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);

    const hostel = await Hostel.findById(req.params.hostelId).populate({
      path: "complaints.student",
      select: "name -_id",
    });

    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const complaints = hostel.complaints.map((complaint) => ({
      ...complaint.toObject(),
      studentName: complaint.isAnonymous ? "Anonymous" : complaint.student.name,
      images: complaint.images.map((image) => ({
        contentType: image.contentType,
        data: image.data.toString("base64"),
      })),
    }));

    const complaintStats = {
      total: complaints.length,
      resolved: complaints.filter((c) => c.status === "resolved").length,
      open: complaints.filter((c) => c.status === "open").length,
    };

    res.status(200).json({ complaints, stats: complaintStats });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const updateComplaintStatus = async (req, res) => {
  const { complaintId } = req.params;
  const { status } = req.body;

  if (!["open", "noticed", "resolved"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const commonDB = req.app.locals.commonDB;

    if (!commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);

    const hostel = await Hostel.findOneAndUpdate(
      { "complaints._id": complaintId },
      { $set: { "complaints.$.status": status } },
      { new: true }
    );

    if (!hostel) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    res.status(200).json({ message: `Complaint status updated to ${status}` });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const deleteComplaint = async (req, res) => {
  const { complaintId } = req.params;
  try {
    const commonDB = req.app.locals.commonDB;

    if (!commonDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);

    const hostel = await Hostel.findOne({
      owner: req.user.profileId,
      "complaints._id": complaintId,
    });

    if (!hostel) {
      return res
        .status(404)
        .json({ message: "Complaint not found or you're not authorized" });
    }

    const complaint = hostel.complaints.id(complaintId);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (complaint.status !== "resolved") {
      return res
        .status(400)
        .json({ message: "Complaint must be resolved before deletion" });
    }

    hostel.complaints.pull(complaintId);
    await hostel.save();

    res.status(200).json({ message: "Complaint deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getPendingVisits = async (req, res) => {
  try {
    const commonDB = req.app.locals.commonDB;
    const studentDB = req.app.locals.studentDB;

    if (!commonDB || !studentDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);
    const Student = initStudentModel(studentDB, commonDB);

    const hostel = await Hostel.findById(req.params.hostelId).lean();

    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const pendingVisits = hostel.pendingVisits.filter((visit) => {
      const status = visit.status || "pending";
      return ["pending", "accepted", "not_interested"].includes(status);
    });

    console.log(
      "Filtered pendingVisits:",
      JSON.stringify(pendingVisits, null, 2)
    );

    const formattedVisits = await Promise.all(
      pendingVisits.map(async (visit) => {
        const student = await Student.findById(visit.student)
          .select(
            "name email number class year school college city address passportPhoto"
          )
          .lean();

        return {
          ...visit,
          student,
          status: visit.status || "pending",
          hostelName: hostel.name,
          hostelAddress: hostel.address,
          hostelType: hostel.hostelType,
          hostelBeds: hostel.beds,
          hostelStudentsPerRoom: hostel.studentsPerRoom,
          hostelFood: hostel.food,
          hostelImages: hostel.images
            ? hostel.images.map((img) => ({
                contentType: img.contentType,
                data: img.data ? img.data.toString("base64") : null,
              }))
            : [],
        };
      })
    );

    res.status(200).json(formattedVisits);
  } catch (error) {
    console.error("Error in getPendingVisits:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};
export const respondToVisitRequest = async (req, res) => {
  const { hostelId, studentId, response } = req.body;

  try {
    const commonDB = req.app.locals.commonDB;
    const studentDB = req.app.locals.studentDB;

    if (!commonDB || !studentDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Hostel = initHostelModel(commonDB);
    const Student = initStudentModel(studentDB, commonDB);

    const hostel = await Hostel.findById(hostelId);
    const student = await Student.findById(studentId);

    if (!hostel || !student) {
      return res.status(404).json({ message: "Hostel or student not found" });
    }

    if (!Array.isArray(hostel.pendingVisits)) {
      return res.status(400).json({ message: "Invalid hostel visit data" });
    }

    const visitIndex = hostel.pendingVisits.findIndex(
      (visit) => visit.student?.toString() === studentId
    );

    if (visitIndex === -1) {
      return res.status(404).json({ message: "Visit request not found" });
    }

    const visit = hostel.pendingVisits[visitIndex];

    if (!Array.isArray(student.hostelVisits)) {
      return res.status(400).json({ message: "Invalid student visit data" });
    }

    const studentVisit = student.hostelVisits.find(
      (v) => v.hostel?.toString() === hostelId && v.status === "pending"
    );

    if (!studentVisit) {
      return res
        .status(404)
        .json({ message: "Corresponding student visit not found" });
    }

    if (response === "accept") {
      studentVisit.status = "accepted";
    } else if (response === "reject") {
      studentVisit.status = "rejected";
    }

    hostel.pendingVisits.splice(visitIndex, 1);

    await hostel.save();
    await student.save();

    // Email notification
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
      to: student.email,
      from: "noreply@stayhomehostels.com",
      subject: `Stay Home Hostels Visit Request ${
        response === "accept" ? "Accepted" : "Rejected"
      }`,
      text: `Your visit request to ${hostel.name} has been ${
        response === "accept" ? "accepted" : "rejected"
      }.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: `Visit request ${response}ed` });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};
export const markVisitCompleted = async (req, res) => {
  const { hostelId, studentId } = req.body;

  try {
    const commonDB = req.app.locals.commonDB;
    const studentDB = req.app.locals.studentDB;

    if (!commonDB || !studentDB) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const Student = initStudentModel(studentDB, commonDB);
    const Hostel = initHostelModel(commonDB);

    console.log(
      `Attempting to mark visit as completed for student ${studentId} and hostel ${hostelId}`
    );

    const student = await Student.findById(studentId);
    if (!student) {
      console.log(`Student with ID ${studentId} not found`);
      return res.status(404).json({ message: "Student not found" });
    }

    console.log(`Student found: ${student.name}`);
    console.log(`Hostel visits: ${JSON.stringify(student.hostelVisits)}`);

    const visitIndex = student.hostelVisits.findIndex(
      (v) =>
        v.hostel.equals(new mongoose.Types.ObjectId(hostelId)) &&
        v.status === "accepted"
    );

    if (visitIndex === -1) {
      console.log(`No accepted visit found for hostel ${hostelId}`);
      return res.status(404).json({ message: "Accepted visit not found" });
    }

    console.log(`Found accepted visit at index ${visitIndex}`);

    const result = await Student.updateOne(
      {
        _id: studentId,
        "hostelVisits._id": student.hostelVisits[visitIndex]._id,
      },
      { $set: { "hostelVisits.$.status": "completed" } }
    );

    console.log(`Update result: ${JSON.stringify(result)}`);

    if (result.modifiedCount === 0) {
      console.log("Failed to update visit status");
      return res.status(400).json({ message: "Failed to update visit status" });
    }

    const hostel = await Hostel.findById(hostelId);

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
      to: student.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels Visit Completed",
      text: `Dear ${student.name},

We hope you enjoyed your visit to ${hostel.name}!

Your visit has been marked as completed. We'd love to hear about your experience. Please take a moment to rate your stay and provide any feedback you may have.

If you have any questions or need further assistance, please don't hesitate to contact us.

Thank you for choosing Stay Home Hostels!

Best regards,
The Stay Home Hostels Team`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Completion email sent to ${student.email}`);

    res.status(200).json({ message: "Visit marked as completed" });
  } catch (error) {
    console.error("Error in markVisitCompleted:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};
