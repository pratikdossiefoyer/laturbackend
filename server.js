import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import dotenv from "dotenv";
import http from "http";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import MongoStore from "connect-mongo";
import configurePassport from "./middlewares/passportConfig.js";
import configurePassportowner from "./middlewares/passportConfigowner.js";
import studentAuthRoutes from "./routes/studentAuthRoutes.js";
import ownerAuthRoutes from "./routes/ownerAuthRoutes.js";
import initDBB from "./config/initDBB.js";
import hostelRoutes from "./routes/hostelRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import initDB from "./scripts/initDB.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hostel Management System API",
      version: "1.0.0",
      description: "API documentation for Hostel Management System",
      contact: {
        name: "Support Team",
        email: "support@example.com",
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? "https://your-production-url.com"
            : `http://localhost:${process.env.PORT || 8188}`,
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        sessionAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
            },
            status: {
              type: "number",
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { sessionAuth: [] }],
  },
  apis: [
    "./routes/*.js",
    "./models/*.js",
    "./swagger/*.js", // For additional swagger documentation files
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(morgan("dev"));
app.use(express.json());

// Swagger UI
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Hostel Management API Documentation",
  })
);

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
      ttl: 60 * 15,
      autoRemove: "native",
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    },
  })
);

// Security headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

const PORT = process.env.PORT || 8188;

// Database connection function
const connectToDatabases = async () => {
  try {
    const studentConnection = await mongoose.createConnection(
      process.env.STUDENT_DB_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
      }
    );
    console.log("Connected to Student Database");

    const hostelOwnerConnection = await mongoose.createConnection(
      process.env.HOSTEL_OWNER_DB_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
      }
    );
    console.log("Connected to Hostel Owner Database");

    const commonConnection = await mongoose.createConnection(
      process.env.COMMON_DB_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
      }
    );
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

// Server startup function
const startServer = async () => {
  try {
    const { studentDB, hostelOwnerDB, commonDB } = await connectToDatabases();

    app.locals.studentDB = studentDB;
    app.locals.hostelOwnerDB = hostelOwnerDB;
    app.locals.commonDB = commonDB;

    const passportInstance = configurePassport(studentDB, commonDB);
    app.use(passportInstance.initialize());
    app.use(passportInstance.session());

    const passportInstanceowner = configurePassportowner(
      hostelOwnerDB,
      commonDB
    );
    app.use(passportInstanceowner.initialize());
    app.use(passportInstanceowner.session());

    await initDBB(studentDB, hostelOwnerDB, commonDB);
    await initDB(studentDB, hostelOwnerDB, commonDB);

    // Routes
    app.use("/api/auth/student", studentAuthRoutes);
    app.use("/api/auth/owner", ownerAuthRoutes);
    app.use("/api/hostels", hostelRoutes);
    app.use("/api/students", studentRoutes);
    app.use("/api/admin", adminRoutes);

    // Basic route
    /**
     * @swagger
     * /:
     *   get:
     *     summary: Welcome endpoint
     *     description: Returns a welcome message
     *     responses:
     *       200:
     *         description: Welcome message
     *         content:
     *           text/plain:
     *             schema:
     *               type: string
     */
    app.get("/", (req, res) => {
      res.send("Welcome to the Hostel Backend API");
    });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(
        `Swagger documentation available at http://localhost:${PORT}/api-docs`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: {
      message: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
  });
});

export default app;
