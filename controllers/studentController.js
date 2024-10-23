import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { initStudentModel } from "../models/studentModel.js";
import { initHostelModel } from "../models/hostelModel.js";
import { initOwnerModel } from "../models/ownerModel.js";
import jwt from "jsonwebtoken";
dotenv.config();

const initModels = (req) => {
  const studentDB = req.app.locals.studentDB;
  const hostelOwnerDB = req.app.locals.hostelOwnerDB;
  const commonDB = req.app.locals.commonDB;

  const Student = initStudentModel(studentDB, commonDB);
  const Hostel = initHostelModel(commonDB);
  const Owner = initOwnerModel(hostelOwnerDB, commonDB);

  return { Student, Hostel, Owner };
};
export const getPassportPhoto = async (req, res) => {
  const { Student } = initModels(req);
  try {
    const student = await Student.findById(req.params.id);
    if (!student || !student.passportPhoto) {
      return res.status(404).send("No photo found");
    }
    res.set("Content-Type", student.passportPhoto.contentType);
    res.send(student.passportPhoto.data);
  } catch (error) {
    res.status(500).send("Error retrieving photo");
  }
};

export const getStudentById = async (req, res) => {
  const studentDB = req.app.locals.studentDB;
  const commonDB = req.app.locals.commonDB;
  const hostelOwnerDB = req.app.locals.hostelOwnerDB;

  if (!studentDB || !commonDB || !hostelOwnerDB) {
    return res.status(500).json({ message: "Database connection error" });
  }

  const Student = initStudentModel(studentDB, commonDB);
  const Hostel = initHostelModel(commonDB);
  const Owner = initOwnerModel(hostelOwnerDB, commonDB);

  if (!Student || !Hostel || !Owner) {
    return res.status(500).json({ message: "Failed to initialize models" });
  }

  const { studentId } = req.params;

  try {
    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const studentObj = student.toObject();

    studentObj.wishlist = await Promise.all(
      student.wishlist.map(async (hostelId) => {
        const hostel = await Hostel.findById(hostelId).select(
          "name address hostelType beds food verified images owner"
        );

        let ownerInfo = null;
        if (hostel && hostel.owner) {
          try {
            const ownerId = new mongoose.Types.ObjectId(
              hostel.owner.toString()
            );

            // Change this line to fetch all fields
            const owner = await Owner.findById(ownerId).lean();

            ownerInfo = owner
              ? {
                  _id: owner._id,
                  email: owner.email,
                  name: owner.name || "N/A",
                  number: owner.number || "N/A",
                }
              : null;
          } catch (error) {
            ownerInfo = {
              _id: hostel.owner,
              error: "Failed to fetch owner details",
            };
          }
        } else {
          console.log("No owner associated with this hostel");
        }

        return hostel
          ? {
              _id: hostel._id,
              name: hostel.name,
              address: hostel.address,
              hostelType: hostel.hostelType,
              beds: hostel.beds,
              food: hostel.food,
              verified: hostel.verified,
              images: hostel.images,
              owner: ownerInfo,
            }
          : null;
      })
    );

    // Populate hostelVisits
    studentObj.hostelVisits = await Promise.all(
      student.hostelVisits.map(async (visit) => {
        const hostel = await Hostel.findById(visit.hostel).select(
          "name address hostelType beds food verified images owner wifi ac mess solar studyRoom tuition"
        );
        let hostelObj = null;
        if (hostel) {
          hostelObj = hostel.toObject();
          if (hostel.owner) {
            const owner = await Owner.findById(hostel.owner).select(
              "name number"
            );
            hostelObj.owner = owner ? owner.toObject() : null;
          }
        }
        return {
          hostel: hostelObj,
          visitDate: visit.visitDate,
          visitTime: visit.visitTime,
          status: visit.status,
        };
      })
    );

    // Populate admittedHostel
    if (student.admittedHostel) {
      const admittedHostel = await Hostel.findById(
        student.admittedHostel
      ).select(
        "name address hostelType beds food verified images owner rentStructure"
      );
      if (admittedHostel && admittedHostel.owner) {
        const owner = await Owner.findById(admittedHostel.owner).select(
          "name number"
        );
        studentObj.admittedHostel = {
          ...admittedHostel.toObject(),
          owner: owner ? owner.toObject() : null,
        };
      } else {
        studentObj.admittedHostel = admittedHostel;
      }
    }

    // Fetch complaints and feedback
    const complaintsAggregation = await Hostel.aggregate([
      { $unwind: "$complaints" },
      {
        $match: {
          "complaints.student": new mongoose.Types.ObjectId(studentId),
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

    const feedbackAggregation = await Hostel.aggregate([
      { $unwind: "$feedback" },
      {
        $match: {
          "feedback.student": new mongoose.Types.ObjectId(studentId),
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

    studentObj.complaints = complaintsAggregation.map((item) => ({
      ...item.complaint,
      hostelId: item.hostelId,
      hostelName: item.hostelName,
    }));

    studentObj.feedback = feedbackAggregation.map((item) => ({
      ...item.feedback,
      hostelId: item.hostelId,
      hostelName: item.hostelName,
    }));

    res.status(200).json(studentObj);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getWishlistByStudentId = async (req, res) => {
  const studentDB = req.app.locals.studentDB;
  const commonDB = req.app.locals.commonDB;
  const hostelOwnerDB = req.app.locals.hostelOwnerDB;

  if (!studentDB || !commonDB || !hostelOwnerDB) {
    return res.status(500).json({ message: "Database connection error" });
  }

  const Student = initStudentModel(studentDB, commonDB);
  const Hostel = initHostelModel(commonDB);
  const Owner = initOwnerModel(hostelOwnerDB, commonDB);

  if (!Student || !Hostel || !Owner) {
    return res.status(500).json({ message: "Failed to initialize models" });
  }

  const { studentId } = req.params;

  try {
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Manually populate the wishlist
    const populatedWishlist = await Promise.all(
      student.wishlist.map(async (hostelId) => {
        const hostel = await Hostel.findById(hostelId);
        if (!hostel) return null;

        let ownerInfo = null;
        if (hostel.owner) {
          const owner = await Owner.findById(hostel.owner);
          if (owner) {
            ownerInfo = {
              _id: owner._id,
              name: owner.name,
              number: owner.number,
            };
          }
        }

        return {
          _id: hostel._id,
          name: hostel.name,
          address: hostel.address,
          hostelType: hostel.hostelType,
          beds: hostel.beds,
          food: hostel.food,
          verified: hostel.verified,
          images: hostel.images,
          owner: ownerInfo,
        };
      })
    );

    // Filter out any null values (in case a hostel was not found)
    const filteredWishlist = populatedWishlist.filter(
      (hostel) => hostel !== null
    );

    res.status(200).json(filteredWishlist);
  } catch (error) {
    console.error("Error in getWishlistByStudentId:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const addToWishlist = async (req, res) => {
  const { Student } = initModels(req);
  const { hostelId } = req.body;
  try {
    if (!req.user || !req.user.profileId) {
      return res.status(401).json({ message: "Authentication failed" });
    }
    const student = await Student.findById(req.user.profileId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (student.wishlist.length >= 5) {
      return res
        .status(400)
        .json({ message: "Wishlist can't exceed 5 hostels" });
    }
    if (student.wishlist.includes(hostelId)) {
      return res.status(400).json({ message: "Hostel already in wishlist" });
    }
    student.wishlist.push(hostelId);
    await student.save();
    res.status(200).json({
      message: "Hostel added to wishlist",
      wishlist: student.wishlist,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const removeFromWishlist = async (req, res) => {
  const { Student } = initModels(req);
  const { hostelId } = req.body;
  try {
    if (!req.user || !req.user.profileId) {
      return res.status(401).json({ message: "Authentication failed" });
    }
    const student = await Student.findById(req.user.profileId);

    student.wishlist = student.wishlist.filter(
      (id) => id.toString() !== hostelId
    );
    await student.save();
    res.status(200).json({
      message: "Hostel removed from wishlist",
      wishlist: student.wishlist,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const submitWishlist = async (req, res) => {
  const { Student } = initModels(req);
  try {
    const student = await Student.findById(req.user.profileId);
    if (student.wishlist.length === 0) {
      return res.status(400).json({ message: "Wishlist is empty" });
    }
    if (student.wishlistSubmitted) {
      return res.status(400).json({ message: "Wishlist is already submitted" });
    }
    student.wishlistSubmitted = true;
    await student.save();
    res.status(200).json({ message: "Wishlist submitted for review" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const takeAdmission = async (req, res) => {
  const { Student } = initModels(req);
  const { hostelId } = req.body;

  try {
    const student = await Student.findById(req.user.profileId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!student.isProfileComplete()) {
      return res
        .status(400)
        .json({ message: "Complete your profile before taking admission" });
    }

    if (!student.wishlistApproved) {
      return res
        .status(400)
        .json({ message: "Wishlist must be approved before taking admission" });
    }

    if (student.admittedHostel) {
      return res
        .status(400)
        .json({ message: "You have already been admitted to a hostel" });
    }

    student.admittedHostel = hostelId;
    await student.save();

    res.status(200).json({ message: "Admission taken successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const updateStudentProfile = async (req, res) => {
  const { Student } = initModels(req);
  const {
    name,
    number,
    email,
    class: studentClass,
    year,
    school,
    college,
    city,
    address,
    password,
    parentnumber,
    parentname,
    gender,
  } = req.body;

  const { profileId } = req.params;

  try {
    const existingStudent = await Student.findById(profileId);
    if (!existingStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    const updateData = {
      name,
      number,
      email,
      class: studentClass,
      year,
      school,
      college,
      city,
      address,
      parentnumber,
      parentname,
      gender,
    };

    if (
      req.files &&
      req.files.passportPhoto &&
      req.files.passportPhoto.length > 0
    ) {
      updateData.passportPhoto = {
        data: req.files.passportPhoto[0].buffer,
        contentType: req.files.passportPhoto[0].mimetype,
      };
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      profileId,
      updateData,
      { new: true, runValidators: true }
    );

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updatedStudent.password = hashedPassword;
      await updatedStudent.save();
    }

    res.status(200).json({
      message: "Profile updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const uploadAdmissionReceipt = async (req, res) => {
  const { Student } = initModels(req);
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const student = await Student.findById(req.user.profileId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    student.admissionReceipt = {
      data: req.file.buffer,
      contentType: req.file.mimetype,
    };
    await student.save();

    res
      .status(200)
      .json({ message: "Admission receipt uploaded successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const submitHostelFeedback = async (req, res) => {
  const { Hostel } = initModels(req);
  const { hostelId, rating, comment } = req.body;
  try {
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }
    hostel.feedback.push({
      student: req.user.profileId,
      rating,
      comment,
      date: new Date(),
    });

    await hostel.save();
    res.status(200).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const submitComplaint = async (req, res) => {
  const { Student, Hostel } = initModels(req);
  const { hostelId, description, isAnonymous, complaintType } = req.body;

  try {
    const student = await Student.findById(req.user.profileId);

    if (!student.admittedHostel) {
      return res.status(400).json({
        message: "You must be admitted to a hostel to submit a complaint",
      });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const validComplaintTypes = [
      "Rooms",
      "Washroom",
      "Wi-Fi",
      "Cleanliness",
      "Food",
    ];
    if (!validComplaintTypes.includes(complaintType)) {
      return res.status(400).json({ message: "Invalid complaint type" });
    }

    const complaint = {
      student: student._id,
      description,
      isAnonymous,
      complaintType,
      images: req.files
        ? req.files.map((file) => ({
            data: file.buffer,
            contentType: file.mimetype,
          }))
        : [],
      status: "open",
    };

    student.complaints.push(complaint._id);
    await student.save();

    hostel.complaints.push(complaint);
    await hostel.save();

    res.status(200).json({ message: "Complaint submitted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const getStudentComplaints = async (req, res) => {
  const { Student, Hostel } = initModels(req);
  const { studentId } = req.params;

  try {
    const student = await Student.findById(studentId).populate(
      "admittedHostel"
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!student.admittedHostel) {
      return res
        .status(404)
        .json({ message: "Student is not admitted to any hostel" });
    }

    const hostel = await Hostel.findById(student.admittedHostel._id);

    const studentComplaints = hostel.complaints.filter(
      (complaint) => complaint.student.toString() === studentId.toString()
    );

    res.status(200).json(studentComplaints);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const markNotInterested = async (req, res) => {
  const { Student, Hostel, Owner } = initModels(req);
  const { hostelId } = req.body;
  const studentId = req.user.profileId;

  if (!hostelId) {
    return res.status(400).json({ message: "Hostel ID is required" });
  }

  try {
    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    student.hostelVisits = student.hostelVisits.filter(
      (visit) => visit.hostel && visit.hostel.toString() !== hostelId
    );

    student.wishlist = student.wishlist.filter(
      (id) => id && id.toString() !== hostelId
    );

    if (student.hostelVisits.length === 0) {
      student.wishlistSubmitted = false;
      student.wishlistApproved = false;
    }

    await student.save();

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const owner = await Owner.findOne({ hostels: hostelId });
    if (!owner) {
      return res.status(404).json({ message: "Hostel owner not found" });
    }

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
      to: owner.email,
      from: "noreply@stayhomehostels.com",
      subject: "Stay Home Hostels - Student Not Interested",
      text: `Dear ${owner.name},
  
  We regret to inform you that a student has marked your hostel "${hostel.name}" as not interested.
  
  This means the hostel has been removed from their wishlist and they will not be considering it for their stay.
  
  While this may be disappointing, it's an opportunity to review your hostel's offerings and consider ways to make it more appealing to future students.
  
  If you have any questions or need assistance, please don't hesitate to contact our support team.
  
  Best regards,
  The Stay Home Hostels Team`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message:
        "Marked as not interested, removed from wishlist, and owner notified",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

export const requestOrUpdateHostelVisit = async (req, res) => {
  const { Student, Hostel, Owner } = initModels(req);
  const { hostelId, visitDate, visitTime, studentEmail } = req.body;
  const studentId = req.user.profileId;

  try {
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    const existingVisitIndex = student.hostelVisits.findIndex(
      (visit) => visit.hostel && visit.hostel.toString() === hostelId
    );

    if (existingVisitIndex !== -1) {
      student.hostelVisits[existingVisitIndex] = {
        ...student.hostelVisits[existingVisitIndex],
        visitDate,
        visitTime,
        status: "pending",
      };
    } else {
      student.hostelVisits.push({
        hostel: hostelId,
        visitDate,
        visitTime,
        status: "pending",
      });
    }

    const existingPendingVisitIndex = hostel.pendingVisits.findIndex(
      (visit) => visit.student && visit.student.toString() === studentId
    );

    if (existingPendingVisitIndex !== -1) {
      hostel.pendingVisits[existingPendingVisitIndex] = {
        ...hostel.pendingVisits[existingPendingVisitIndex],
        visitDate,
        visitTime,
        studentEmail,
      };
    } else {
      hostel.pendingVisits.push({
        student: studentId,
        visitDate,
        visitTime,
        studentEmail,
      });
    }

    await student.save();
    await hostel.save();

    const owner = await Owner.findOne({ hostels: hostelId });
    if (!owner) {
      return res.status(404).json({ message: "Hostel owner not found" });
    }

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
      to: owner.email,
      from: "noreply@stayhomehostels.com",
      subject: "New Hostel Visit Request",
      text: `Dear ${owner.name},
  
  A new visit request has been received for your hostel "${hostel.name}".
  
  Visit Details:
  - Hostel ID: ${hostelId}
  - Visit Date: ${visitDate}
  - Visit Time: ${visitTime}
  - Student Email: ${studentEmail}
  
  Please review this request and respond accordingly through your hostel management dashboard.
  
  If you have any questions or need assistance, please don't hesitate to contact our support team.
  
  Best regards,
  The Stay Home Hostels Team`,
    };

    await transporter.sendMail(mailOptions);

    res
      .status(200)
      .json({ message: "Visit request sent successfully and owner notified" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};
