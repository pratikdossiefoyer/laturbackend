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
    req.session.returnTo = req.headers.referer;
    next();
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", async (err, user, info) => {
    try {
      if (err) {
        console.error("Passport authentication error:", err);
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=auth_failed`
        );
      }

      if (!user) {
        console.error("No user returned from authentication");
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
      }

      // Log the user object to debug
      console.log("Authenticated user:", user);

      // Manually log in the user
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=login_failed`
          );
        }

        try {
          // Generate JWT token
          const token = jwt.sign(
            {
              id: user._id,
              role: "hostelOwner",
              email: user.email,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
          );

          // Construct redirect URL with proper error handling
          const redirectUrl = new URL(
            `${process.env.FRONTEND_URL}/oauth-success`
          );

          // Safely add parameters
          redirectUrl.searchParams.append("token", token);
          redirectUrl.searchParams.append("role", "hostelOwner");
          redirectUrl.searchParams.append(
            "profileId",
            user._id ? user._id.toString() : ""
          );
          redirectUrl.searchParams.append("email", user.email || "");
          redirectUrl.searchParams.append("name", user.name || "");

          // Redirect to frontend
          res.redirect(redirectUrl.toString());
        } catch (error) {
          console.error("Token generation error:", error);
          res.redirect(`${process.env.FRONTEND_URL}/login?error=token_failed`);
        }
      });
    } catch (error) {
      console.error("Callback error:", error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=callback_failed`);
    }
  })(req, res, next);
});

export default router;
