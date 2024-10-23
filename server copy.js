import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import dotenv from "dotenv";
import http from "http";
// import { ApolloServer } from "apollo-server-express";
//import { setupWebSocket } from "./websocket/index.js";

import studentAuthRoutes from "./routes/studentAuthRoutes.js";
import ownerAuthRoutes from "./routes/ownerAuthRoutes.js";
import hostelRoutes from "./routes/hostelRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import { typeDefs, resolvers } from "./graphql/index.js";
import { initStudentModel } from "./models/studentModel.js";
import { initOwnerModel } from "./models/ownerModel.js";
import { initHostelModel } from "./models/hostelModel.js";
import { initRoleModel } from "./models/roleModel.js";
import { initGroupModel } from "./models/groupModel.js";
import { initPermissionModel } from "./models/permissionModel.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// setupWebSocket(server);

// Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000,
    },
  })
);

const PORT = process.env.PORT || 8188;

// Database URIs
const STUDENT_DB_URI = process.env.STUDENT_DB_URI;
const HOSTEL_OWNER_DB_URI = process.env.HOSTEL_OWNER_DB_URI;
const COMMON_DB_URI = process.env.COMMON_DB_URI;

const initializeDatabasesAndModels = async () => {
  try {
    const studentDB = await mongoose.createConnection(STUDENT_DB_URI);
    console.log("Connected to Student Database");
    const Student = initStudentModel(studentDB, studentDB);

    const hostelOwnerDB = await mongoose.createConnection(HOSTEL_OWNER_DB_URI);
    console.log("Connected to Hostel Owner Database");
    const Owner = initOwnerModel(hostelOwnerDB, hostelOwnerDB);

    const commonDB = await mongoose.createConnection(COMMON_DB_URI);
    console.log("Connected to Common Database");

    // Initialize models in common DB
    const Hostel = initHostelModel(commonDB);
    const Role = initRoleModel(commonDB);
    const Group = initGroupModel(commonDB);
    const Permission = initPermissionModel(commonDB);

    // Ensure Owner model is registered on commonDB for cross-database operations
    if (!commonDB.models.Owner) {
      commonDB.model("Owner", Owner.schema);
    }

    return {
      Student,
      Owner,
      Hostel,
      Role,
      Group,
      Permission,
      studentDB,
      hostelOwnerDB,
      commonDB,
    };
  } catch (error) {
    console.error("Error connecting to databases:", error);
    throw error;
  }
};
// Start the server
const startServer = async () => {
  try {
    const {
      Student,
      Owner,
      Hostel,
      Role,
      Group,
      Permission,
      studentDB,
      hostelOwnerDB,
      commonDB,
    } = await initializeDatabasesAndModels();

    // // Set up Apollo Server
    // const apolloServer = new ApolloServer({
    //   typeDefs,
    //   resolvers,
    //   context: ({ req }) => ({
    //     models: {
    //       Student,
    //       Owner,
    //       Hostel,
    //       Role,
    //       Group,
    //       Permission,
    //     },
    //     connections: {
    //       studentDB,
    //       hostelOwnerDB,
    //       commonDB,
    //     },
    //   }),
    // });

    // await apolloServer.start();
    // apolloServer.applyMiddleware({ app, path: "/graphql" });

    // Routes
    app.use("/api/auth/student", studentAuthRoutes);
    app.use("/api/auth/owner", ownerAuthRoutes);
    app.use("/api/hostels", hostelRoutes);
    app.use("/api/student", studentRoutes);

    app.get("/", (req, res) => {
      res.send("Welcome to the Hostel Backend API");
    });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      // console.log(
      //   `GraphQL endpoint available at http://localhost:${PORT}${apolloServer.graphqlPath}`
      // );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

export default app;
