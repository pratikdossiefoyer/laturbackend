// config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import mongoose from "mongoose";
import { initStudentModel } from "../models/studentModel.js";
import { initRoleModel } from "../models/roleModel.js";
import jwt from "jsonwebtoken";
const configurePassport = (studentDB, commonDB) => {
  const Student = initStudentModel(studentDB, commonDB);
  const Role = initRoleModel(commonDB);

  passport.serializeUser((user, done) => {
    done(null, { id: user._id, db: "student" });
  });

  passport.deserializeUser(async ({ id, db }, done) => {
    try {
      const student = await Student.findById(id);
      done(null, student);
    } catch (error) {
      done(error, null);
    }
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/api/auth/student/google/callback`,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          console.log("Google profile:", profile); // Debug log

          // Get student role
          const studentRole = await Role.findOne({ name: "student" });
          if (!studentRole) {
            console.error("Student role not found");
            return done(new Error("Student role not found"));
          }

          // Check for existing student
          let student = await Student.findOne({ googleId: profile.id });

          if (student) {
            console.log("Found existing student by googleId:", student); // Debug log
            if (!student.role) {
              student.role = studentRole;
              await student.save();
            }
            return done(null, student);
          }

          // Check by email
          student = await Student.findOne({ email: profile.emails[0].value });

          if (student) {
            console.log("Found existing student by email:", student); // Debug log
            student.googleId = profile.id;
            student.verified = true;
            student.authProvider = "google";
            if (!student.role) {
              student.role = studentRole;
            }
            await student.save();
            return done(null, student);
          }

          // Create new student
          const newStudent = await Student.create({
            _id: new mongoose.Types.ObjectId(), // Explicitly set _id
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            verified: true,
            authProvider: "google",
            role: studentRole,
          });

          console.log("Created new student:", newStudent); // Debug log
          return done(null, newStudent);
        } catch (error) {
          console.error("Google authentication error:", error);
          return done(error, null);
        }
      }
    )
  );

  return passport;
};

export default configurePassport;
