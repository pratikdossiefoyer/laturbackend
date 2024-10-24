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
    // Store the referrer URL for post-authentication redirect
    req.session.returnTo = req.headers.referer;
    next();
  },
  passport.authenticate("google-owner", {
    // Changed to google-owner to distinguish from student auth
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google-owner", async (err, user, info) => {
    try {
      // Error handling
      if (err) {
        console.error("Authentication error:", err);
        return res.redirect(
          `${
            process.env.FRONTEND_URL
          }/hostelownerlogin?error=${encodeURIComponent(err.message)}`
        );
      }

      // No user returned
      if (!user) {
        console.error(
          "Authentication failed:",
          info?.message || "No user returned"
        );
        return res.redirect(
          `${process.env.FRONTEND_URL}/hostelownerlogin?error=authentication_failed`
        );
      }

      // Debug log
      console.log("Authenticated owner:", {
        id: user._id,
        email: user.email,
        name: user.name,
      });

      // Login user
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          return res.redirect(
            `${process.env.FRONTEND_URL}/hostelownerlogin?error=login_failed`
          );
        }

        try {
          // Generate JWT token with owner-specific claims
          const token = jwt.sign(
            {
              id: user._id,
              role: "hostelOwner",
              email: user.email,
              name: user.name,
              verified: user.verified,
            },
            process.env.JWT_SECRET,
            {
              expiresIn: "24h",
              algorithm: "HS256",
            }
          );

          // Construct redirect URL
          const redirectUrl = new URL(
            `${process.env.FRONTEND_URL}/oauth-success`
          );

          // Add parameters with proper encoding
          const params = {
            token,
            role: "hostelOwner",
            profileId: user._id?.toString() || "",
            email: user.email || "",
            name: user.name || "",
            verified: user.verified ? "true" : "false",
          };

          // Safely append all parameters
          Object.entries(params).forEach(([key, value]) => {
            redirectUrl.searchParams.append(key, encodeURIComponent(value));
          });

          // Redirect to frontend
          return res.redirect(redirectUrl.toString());
        } catch (tokenError) {
          console.error("Token generation error:", tokenError);
          return res.redirect(
            `${process.env.FRONTEND_URL}/hostelownerlogin?error=token_generation_failed`
          );
        }
      });
    } catch (callbackError) {
      console.error("Callback processing error:", callbackError);
      return res.redirect(
        `${process.env.FRONTEND_URL}/hostelownerlogin?error=callback_processing_failed`
      );
    }
  })(req, res, next);
});

export default router;
