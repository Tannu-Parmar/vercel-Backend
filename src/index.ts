import "dotenv/config";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import { z } from "zod";
import { Agent, run, user } from "@openai/agents";
import connectDB from "./config/db";
import User from "./model/User";
import ExtractedData from "./model/ExtractedData"; // Fixed: removed .js extension

const app: Application = express();
const PORT = process.env.PORT || 3001;
const upload = multer();


// Connect to database
try {
  connectDB();
} catch (error) {
  console.error('Failed to connect to database:', error);
}

const allowedOrigins = [
  'https://vercel-frontend-feni.vercel.app',
  'http://localhost:5173'
];
app.use(cors({
  origin: function (origin, callback) {
    console.log('Request Origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Middlewares
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
); // Enable CORS
app.use(morgan("combined")); // Logging
app.use(express.json({ limit: "10mb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(upload.single("image"));

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Default route
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Welcome to Test Server 1.0.0",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      api: "/api",
    },
  });
});

const passportFrontPageInstructions = `You are an expert at extracting information from passport images. Analyze the provided passport's front page image and extract all available information
       Extrect following information from the passport's front page image: 
       - Passport Number
       - First Name
       - Last Name
       - Date of Birth
       - Passport Issued Date
       - Passport Expiry Date
       - Passport Issued Country
       - Passport Issued State
       - Gender
       - Nationality
       - Phone Number
       - Place of Birth
       `;

const passportBackPageInstructions = `You are an expert at extracting information from passport's back page images. Analyze the provided passport's back page image and extract all available information
       Extrect following information from the passport's back page image: 
       - Father's Name
       - Mother's Name
       - Address
       `;

const aadhaarFirstPageInstructions = `You are an expert at extracting information from aadhaar images. Analyze the provided aadhaar's first page image and extract all available information
       Extrect following information from the aadhaar's first page image: 
       - Aadhaar Number
       - Name as per Aadhaar Card
       `;

const aadhaarSecondPageInstructions = `You are an expert at extracting information from aadhaar's second page images. Analyze the provided aadhaar's second page image and extract all available information
       Extrect following information from the aadhaar's second page image: 
       - Address
       `;

const panCardInstructions = `You are an expert at extracting information from pan card image. Analyze the provided pan card image and extract all available information
       Extrect following information from the pan card image: 
       - PAN Number
       - Name as per PAN Card
       `;

// Fixed function signature - removed @ts-ignore
const getAgentInstructions = (type: string, pageNumber: number): string | undefined => {
  if (type === "passport") {
    if (pageNumber === 1) {
      return passportFrontPageInstructions;
    } else if (pageNumber === 2) {
      return passportBackPageInstructions;
    }
  } else if (type === "aadhaar") {
    if (pageNumber === 1) {
      return aadhaarFirstPageInstructions;
    } else if (pageNumber === 2) {
      return aadhaarSecondPageInstructions;
    }
  }
  return undefined;
};

const passportFirstPageOutput = z.object({
  passportNumber: z.string().describe("passport number"),
  firstName: z.string().describe("first name"),
  lastName: z.string().describe("last name"),
  dateOfBirth: z.string().describe("date of birth"),
  passportIssuedDate: z.string().describe("passport issued date"),
  passportExpiryDate: z.string().describe("passport expiry date"),
  passportIssuedCountry: z.string().describe("passport issued country"),
  passportIssuedState: z.string().describe("passport issued state"),
  gender: z.string().describe("gender"),
  nationality: z.string().describe("nationality"),
  phoneNumber: z.string().describe("phone number"),
  placeOfBirth: z.string().describe("place of birth"),
});

const passportSecondPageOutput = z.object({
  fatherName: z.string().describe("father's name"),
  motherName: z.string().describe("mother's name"),
  address: z.string().describe("address"),
});

const aadhaarFirstPageOutput = z.object({
  aadhaarNumber: z.string().describe("aadhaar number"),
  name: z.string().describe("name as per Aadhaar Card"),
});

const aadhaarSecondPageOutput = z.object({
  address: z.string().describe("address"),
});

const panCardOutput = z.object({
  panNumber: z.string().describe("PAN number"),
  name: z.string().describe("name as per PAN Card"),
});

app.post(
  "/api/extract/passport/:pageNumber",
  async (req: Request, res: Response) => {
    const image = req.file;
    const pageNumber = Number(req.params.pageNumber) || null;

    if (!image) {
      return res.status(400).json({ error: "No image file provided." });
    }

    if (!pageNumber) {
      return res.status(400).json({ error: "Page number is required." });
    }

    const base64Image = image.buffer.toString("base64");
    const dataUrl = `data:${image.mimetype};base64,${base64Image}`;

    const instructions = getAgentInstructions("passport", pageNumber);
    if (!instructions) {
      return res.status(400).json({ error: "Invalid page number for passport." });
    }

    const agent = new Agent({
      name: "Passport Extraction Agent",
      instructions: instructions,
      outputType:
        pageNumber === 1 ? passportFirstPageOutput : passportSecondPageOutput,
      model: "gpt-5-mini-2025-08-07",
    });

    try {
      const { finalOutput } = await run(agent, [
        user([
          {
            type: "input_text",
            text: "Extract all available passport information from this image. Return only JSON with no additional text.",
          },
          {
            type: "input_image",
            image: dataUrl,
          },
        ]),
      ]);

      // Store extracted data in MongoDB
      const extractedData = new ExtractedData({
        documentType: 'passport',
        pageNumber: pageNumber,
        extractedData: finalOutput,
        imageUrl: dataUrl // Store the base64 image
      });

      await extractedData.save();

      return res.json({
        message: "Image extracted and stored successfully",
        data: finalOutput,
        mongoId: extractedData._id
      });
    } catch (error) {
      console.error('Error processing image:', error);
      return res.status(500).json({ 
        error: "Failed to process image",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

app.post(
  "/api/extract/aadhaar/:pageNumber",
  async (req: Request, res: Response) => {
    const image = req.file;
    const pageNumber = Number(req.params.pageNumber) || null;

    if (!image) {
      return res.status(400).json({ error: "No image file provided." });
    }

    if (!pageNumber) {
      return res.status(400).json({ error: "Page number is required." });
    }

    const base64Image = image.buffer.toString("base64");
    const dataUrl = `data:${image.mimetype};base64,${base64Image}`;

    // Fixed: changed "passport" to "aadhaar" for correct instructions
    const instructions = getAgentInstructions("aadhaar", pageNumber);
    if (!instructions) {
      return res.status(400).json({ error: "Invalid page number for aadhaar." });
    }

    const agent = new Agent({
      name: "Aadhaar Extraction Agent",
      instructions: instructions,
      outputType:
        pageNumber === 1 ? aadhaarFirstPageOutput : aadhaarSecondPageOutput,
      model: "gpt-5-mini-2025-08-07",
    });

    try {
      const { finalOutput } = await run(agent, [
        user([
          {
            type: "input_text",
            text: "Extract all available aadhaar information from this image. Return only JSON with no additional text.",
          },
          {
            type: "input_image",
            image: dataUrl,
          },
        ]),
      ]);

      // Store extracted data in MongoDB
      const extractedData = new ExtractedData({
        documentType: 'aadhaar',
        pageNumber: pageNumber,
        extractedData: finalOutput,
        imageUrl: dataUrl
      });

      await extractedData.save();

      return res.json({
        message: "Image extracted and stored successfully",
        data: finalOutput,
        mongoId: extractedData._id
      });
    } catch (error) {
      console.error('Error processing image:', error);
      return res.status(500).json({ 
        error: "Failed to process image",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

app.post("/api/extract/pan-card", async (req: Request, res: Response) => {
  const image = req.file;

  if (!image) {
    return res.status(400).json({ error: "No image file provided." });
  }

  const base64Image = image.buffer.toString("base64");
  const dataUrl = `data:${image.mimetype};base64,${base64Image}`;

  const agent = new Agent({
    name: "PAN Card Extraction Agent",
    instructions: panCardInstructions,
    outputType: panCardOutput,
    model: "gpt-5-mini-2025-08-07",
  });

  try {
    const { finalOutput } = await run(agent, [
      user([
        {
          type: "input_text",
          text: "Extract all available PAN card information from this image. Return only JSON with no additional text.",
        },
        {
          type: "input_image",
          image: dataUrl,
        },
      ]),
    ]);

    // Store extracted data in MongoDB
    const extractedData = new ExtractedData({
      documentType: 'pan-card',
      pageNumber: 1,
      extractedData: finalOutput,
      imageUrl: dataUrl
    });

    await extractedData.save();

    return res.json({
      message: "Image extracted and stored successfully",
      data: finalOutput,
      mongoId: extractedData._id
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return res.status(500).json({ 
      error: "Failed to process image",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get all extracted data
app.get("/api/extracted-data", async (req: Request, res: Response) => {
  try {
    const { documentType, pageNumber } = req.query;
    
    let query: any = {};
    if (documentType) query.documentType = documentType;
    if (pageNumber) query.pageNumber = Number(pageNumber);
    
    const data = await ExtractedData.find(query).sort({ createdAt: -1 });
    
    return res.json({
      message: "Data retrieved successfully",
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('Error retrieving data:', error);
    return res.status(500).json({ 
      error: "Failed to retrieve data",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get specific extracted data by ID
app.get("/api/extracted-data/:id", async (req: Request, res: Response) => {
  try {
    const data = await ExtractedData.findById(req.params.id);
    
    if (!data) {
      return res.status(404).json({ error: "Data not found" });
    }
    
    return res.json({
      message: "Data retrieved successfully",
      data: data
    });
  } catch (error) {
    console.error('Error retrieving data:', error);
    return res.status(500).json({ 
      error: "Failed to retrieve data",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err.stack);

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong!",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;