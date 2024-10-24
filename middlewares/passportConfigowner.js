import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import mongoose from "mongoose";
import { initRoleModel } from "../models/roleModel.js";
import { initOwnerModel } from "../models/ownerModel.js";
import dotenv from "dotenv";
dotenv.config();

const configurePassportowner = (hostelOwnerDB, commonDB) => {
  const Owner = initOwnerModel(hostelOwnerDB, commonDB);
  const Role = initRoleModel(commonDB);

  passport.serializeUser((user, done) => {
    done(null, { id: user._id, db: "hostelOwner" });
  });

  passport.deserializeUser(async ({ id, db }, done) => {
    try {
      const hostelOwner = await Owner.findById(id);
      done(null, hostelOwner);
    } catch (error) {
      done(error, null);
    }
  });

  passport.use(
    "google-owner",
    new GoogleStrategy(
      {
        clientID: process.env.Owner_GOOGLE_CLIENT_ID,
        clientSecret: process.env.Owner_GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/api/auth/owner/google/callback`,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          console.log("Google profile:", profile);

          // Get owner role
          const ownerRole = await Role.findOne({ name: "hostelOwner" });
          if (!ownerRole) {
            return done(new Error("Owner role not found in database"));
          }

          // Find or create user with proper error handling
          let owner = await Owner.findOne({ googleId: profile.id });

          if (!owner) {
            owner = await Owner.findOne({ email: profile.emails[0].value });
          }

          if (owner) {
            // Update existing owner
            owner.googleId = profile.id;
            owner.verified = true;
            owner.authProvider = "google";
            if (!owner.role) {
              owner.role = ownerRole;
            }
            await owner.save();
          } else {
            // Create new owner
            owner = await Owner.create({
              _id: new mongoose.Types.ObjectId(),
              googleId: profile.id,
              email: profile.emails[0].value,
              name: profile.displayName,
              verified: true,
              authProvider: "google",
              role: ownerRole,
            });
          }

          return done(null, owner);
        } catch (error) {
          console.error("Google authentication error:", error);
          return done(error);
        }
      }
    )
  );

  return passport;
};

export default configurePassportowner;
