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
      // Log initial authentication state
      console.log("Authentication state:", {
        hasError: !!err,
        hasUser: !!user,
        info: info,
      });

      if (err) {
        console.error("Authentication error:", err);
        return res.redirect(
          `${process.env.FRONTEND_URL}/hostelownerlogin?error=authentication_failed`
        );
      }

      if (!user) {
        console.error("No user returned from authentication");
        return res.redirect(
          `${process.env.FRONTEND_URL}/hostelownerlogin?error=no_user`
        );
      }

      // Log user object
      console.log("User object before token generation:", {
        id: user._id,
        email: user.email,
        role: user.role,
      });

      // Manual login
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          return res.redirect(
            `${process.env.FRONTEND_URL}/hostelownerlogin?error=login_failed`
          );
        }

        try {
          // Verify JWT_SECRET is available
          if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not defined");
          }

          // Create token payload
          const tokenPayload = {
            id: user._id.toString(),
            role: "hostelOwner",
            email: user.email,
          };

          console.log("Token payload:", tokenPayload);

          // Generate token with error handling
          const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: "24h",
            algorithm: "HS256",
          });

          // Construct success URL
          const successUrl = new URL(
            `${process.env.FRONTEND_URL}/hostelowner/dashboard`
          );

          // Add parameters safely
          successUrl.searchParams.append("token", token);
          successUrl.searchParams.append("role", "hostelOwner");
          successUrl.searchParams.append("profileId", user._id.toString());
          successUrl.searchParams.append("email", user.email || "");
          successUrl.searchParams.append("name", user.name || "");

          console.log("Redirecting to:", successUrl.toString());

          return res.redirect(successUrl.toString());
        } catch (tokenError) {
          console.error("Token generation error details:", {
            error: tokenError.message,
            stack: tokenError.stack,
            user: {
              id: user._id,
              hasEmail: !!user.email,
              hasRole: !!user.role,
            },
          });

          return res.redirect(
            `${
              process.env.FRONTEND_URL
            }/hostelownerlogin?error=token_generation_failed&reason=${encodeURIComponent(
              tokenError.message
            )}`
          );
        }
      });
    } catch (error) {
      console.error("Callback error:", error);
      return res.redirect(
        `${process.env.FRONTEND_URL}/hostelownerlogin?error=callback_failed`
      );
    }
  })(req, res, next);
});

export default router;
