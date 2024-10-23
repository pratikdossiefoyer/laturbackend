// ownerAuthRoutes.js
import express from "express";
import multer from "multer";
import passport from "passport";
import {
  registerOwner,
  loginOwner,
  logoutOwner,
  generateAndSendOTPOwner,
  verifyRegistrationOtpOwner,
  verifyOTPAndChangePasswordOwner,
  sendEmailOtp,
  verifyEmailOtp,
  resetPassword,
  verifyResetToken,
  updatePassword,
} from "../controllers/ownerAuthController.js";

import User from "../models/userModal.js";
import { ownerAuthMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/register",
  upload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
  ]),
  registerOwner
);

router.post("/verify-registration-otp", verifyRegistrationOtpOwner);
router.post("/login", loginOwner);
router.post("/logout", logoutOwner);
router.post("/forgot-password", generateAndSendOTPOwner);
router.post("/reset-own-password", verifyOTPAndChangePasswordOwner);
router.post("/send-email-otp", ownerAuthMiddleware, sendEmailOtp);
router.post("/verify-email-otp", ownerAuthMiddleware, verifyEmailOtp);
router.post("/reset-password", resetPassword);
router.get("/reset/:token", verifyResetToken);
router.post("/reset-password/:token", updatePassword);

// Google OAuth routes
router.get(
  "/google",
  (req, res, next) => {
    // Generate a random state
    const state = randomBytes(16).toString("hex");

    // Store the state in the session
    req.session.oauthState = state;

    // If roleId is provided (for registration), store it in the session
    if (req.query.roleId) {
      req.session.roleId = req.query.roleId;
    }

    // Pass the state to the next middleware
    req.oauthState = state;

    next();
  },
  (req, res, next) => {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state: req.oauthState,
    })(req, res, next);
  }
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    if (!req.user) {
      console.error("No user object in Google OAuth callback");
      return res.redirect("/login");
    }

    try {
      let roleId = null;
      if (req.query.state) {
        try {
          const decodedState = decodeURIComponent(req.query.state);
          const stateParams = new URLSearchParams(decodedState);
          roleId = stateParams.get("roleId");
        } catch (error) {
          console.error("Error parsing state parameter:", error);
        }
      }

      const ownerDB = req.app.locals.hostelOwnerDB;
      const commonDB = req.app.locals.commonDB;

      if (!ownerDB || !commonDB) {
        console.error("Database connections not found");
        return res.redirect("/login");
      }

      const Owner = initOwnerModel(ownerDB, commonDB);
      const Role = initRoleModel(commonDB);

      const user = await User.findById(req.user._id).populate("role");

      if (!user) {
        console.log(
          "User not found in main database, checking owner database..."
        );

        // Check owner database
        const owner = await Owner.findOne({
          email: req.user.email,
        }).populate("role");

        if (!owner) {
          console.error("User not found in either database after Google OAuth");
          return res.redirect("/login");
        }

        // Create JWT token for owner
        const token = jwt.sign(
          {
            id: owner._id,
            role: owner.role.name,
            isOwner: true,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        const redirectUrl = new URL(
          `${process.env.FRONTEND_URL}/oauth-success`
        );
        redirectUrl.searchParams.append("token", token);
        redirectUrl.searchParams.append("role", owner.role.name);
        redirectUrl.searchParams.append("email", owner.email);
        redirectUrl.searchParams.append("isOwner", "true");

        return res.redirect(redirectUrl.toString());
      }

      // Update the user's role if it's provided and different from the current role
      if (roleId && user.role._id.toString() !== roleId) {
        user.role = roleId;
        await user.save();
      }

      const token = jwt.sign(
        {
          id: user._id,
          role: user.role.name,
          profileId: user.profileId,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/oauth-success`);
      redirectUrl.searchParams.append("token", token);
      redirectUrl.searchParams.append("role", user.role.name);
      redirectUrl.searchParams.append("profileId", user.profileId);
      redirectUrl.searchParams.append("email", user.email);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error("Error in Google OAuth callback:", error);
      res.redirect("/login");
    }
  }
);

export default router;
