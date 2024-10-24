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

const startServer = async () => {
  try {
    // Connect to databases
    console.log("Connecting to databases...");
    const { studentDB, hostelOwnerDB, commonDB } = await connectToDatabases();
    console.log("Database connections established successfully");

    // Set database instances in app.locals
    app.locals = {
      ...app.locals,
      studentDB,
      hostelOwnerDB,
      commonDB,
    };

    // Configure session before passport
    app.use(
      session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
        store: new MongoStore({
          mongoUrl: process.env.COMMON_DB_URI,
          collection: "sessions",
        }),
      })
    );

    // Configure passports
    console.log("Configuring passport strategies...");

    // Student passport configuration
    const passportInstance = configurePassport(studentDB, commonDB);
    if (!passportInstance) {
      throw new Error("Failed to configure student passport");
    }
    app.use(passportInstance.initialize());
    app.use(passportInstance.session());

    // Owner passport configuration
    const passportInstanceowner = configurePassportowner(
      hostelOwnerDB,
      commonDB
    );
    if (!passportInstanceowner) {
      throw new Error("Failed to configure owner passport");
    }
    app.use(passportInstanceowner.initialize());
    app.use(passportInstanceowner.session());

    console.log("Passport strategies configured successfully");

    // Initialize databases
    console.log("Initializing databases...");
    await Promise.all([
      initDBB(studentDB, hostelOwnerDB, commonDB),
      initDB(studentDB, hostelOwnerDB, commonDB),
    ]);
    console.log("Databases initialized successfully");

    // Middleware for route logging
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });

    // Routes
    const routes = [
      { path: "/api/auth/student", router: studentAuthRoutes },
      { path: "/api/auth/owner", router: ownerAuthRoutes },
      { path: "/api/hostels", router: hostelRoutes },
      { path: "/api/students", router: studentRoutes },
      { path: "/api/admin", router: adminRoutes },
    ];

    routes.forEach(({ path, router }) => {
      app.use(path, router);
      console.log(`Route registered: ${path}`);
    });

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

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error("Error:", err);
      res.status(err.status || 500).json({
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
      });
    });

    // Start server
    const serverInstance = server.listen(PORT, "0.0.0.0", () => {
      console.log(`
        🚀 Server is running!
        🔊 Listening on port ${PORT}
        📚 Swagger docs: http://localhost:${PORT}/api-docs
        🌍 Environment: ${process.env.NODE_ENV}
      `);
    });

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      console.log("\nStarting graceful shutdown...");
      try {
        await serverInstance.close();
        console.log("Server closed");

        // Close database connections
        await studentDB.close();
        await hostelOwnerDB.close();
        await commonDB.close();
        console.log("Database connections closed");

        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
};

// Unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Start the server
startServer().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
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
