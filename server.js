import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import dotenv from "dotenv";
import http from "http";
//import { setupWebSocket } from "./websocket/index.js";
import configurePassport from "./middlewares/passportConfig.js";
import studentAuthRoutes from "./routes/studentAuthRoutes.js";
import ownerAuthRoutes from "./routes/ownerAuthRoutes.js";
import initDBB from "./config/initDBB.js";
import hostelRoutes from "./routes/hostelRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import initDB from "./scripts/initDB.js";
import adminRoutes from "./routes/adminRoutes.js";
import MongoStore from "connect-mongo";
dotenv.config();

const app = express();
const server = http.createServer(app);

// setupWebSocket(server);

// Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(morgan("dev"));
app.use(express.json());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.COMMON_DB_URI,
      ttl: 60 * 15, // 15 minutes
      autoRemove: "native",
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
    },
  })
);

// Additional security headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

const PORT = process.env.PORT || 8188;

// Database URIs
const STUDENT_DB_URI = process.env.STUDENT_DB_URI;
const HOSTEL_OWNER_DB_URI = process.env.HOSTEL_OWNER_DB_URI;
const COMMON_DB_URI = process.env.COMMON_DB_URI;

// Connect to databases
const connectToDatabases = async () => {
  try {
    const studentConnection = await mongoose.createConnection(STUDENT_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log("Connected to Student Database");

    const hostelOwnerConnection = await mongoose.createConnection(
      HOSTEL_OWNER_DB_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
      }
    );
    console.log("Connected to Hostel Owner Database");

    const commonConnection = await mongoose.createConnection(COMMON_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log("Connected to Common Database");

    return {
      studentDB: studentConnection,
      hostelOwnerDB: hostelOwnerConnection,
      commonDB: commonConnection,
    };
  } catch (error) {
    console.error("Error connecting to databases:", error);
    throw error;
  }
};

// Start the server only after database connections are established
const startServer = async () => {
  try {
    const { studentDB, hostelOwnerDB, commonDB } = await connectToDatabases();

    // Make database connections available
    app.locals.studentDB = studentDB;
    app.locals.hostelOwnerDB = hostelOwnerDB;
    app.locals.commonDB = commonDB;

    // Configure passport with database connections
    const passportInstance = configurePassport(studentDB, commonDB);
    app.use(passportInstance.initialize());
    app.use(passportInstance.session());

    // Initialize the database
    await initDBB(studentDB, hostelOwnerDB, commonDB);
    await initDB(studentDB, hostelOwnerDB, commonDB);
    // Routes
    app.use("/api/auth/student", studentAuthRoutes);
    app.use("/api/auth/owner", ownerAuthRoutes);
    app.use("/api/hostels", hostelRoutes);
    app.use("/api/students", studentRoutes);
    app.use("/api/admin", adminRoutes);

    app.get("/", (req, res) => {
      res.send("Welcome to the Hostel Backend API");
    });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
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
