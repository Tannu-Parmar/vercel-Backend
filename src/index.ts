import "dotenv/config";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import { z } from "zod";
import { Agent, run, user } from "@openai/agents";
const app: Application = express();
const PORT = process.env.PORT || 3001;
const upload = multer();

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

       // @ts-ignore
const getAgentInstructions = (type: string, pageNumber: number) => {
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
};

const passPosrtFirstPageOutput = z.object({
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

const passPosrtSecondPageOutput = z.object({
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

    const agent = new Agent({
      name: "Passport Extraction Agent",
      instructions: getAgentInstructions("passport", pageNumber),
      outputType:
        pageNumber === 1 ? passPosrtFirstPageOutput : passPosrtSecondPageOutput,
      model: "gpt-5-mini-2025-08-07",
    });

    const { finalOutput } = await run(agent, [
      user([
        {
          type: "input_text",
          text: "Extract all available passport information from this image. Return only JSON with no additional text.",
        },
        {
          type: "input_image",
          image: dataUrl,
          // @ts-ignore - OpenAI agents library type issue
          // image_url: base64Image,
        },
      ]),
    ]);

    return res.json({
      message: "Image extracted successfully",
      data: finalOutput,
    });
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

    const agent = new Agent({
      name: "Aadhaar Extraction Agent",
      instructions: getAgentInstructions("passport", pageNumber),
      outputType:
        pageNumber === 1 ? aadhaarFirstPageOutput : aadhaarSecondPageOutput,
      model: "gpt-5-mini-2025-08-07",
    });

    const { finalOutput } = await run(agent, [
      user([
        {
          type: "input_text",
          text: "Extract all available passport information from this image. Return only JSON with no additional text.",
        },
        {
          type: "input_image",
          image: dataUrl,
          // @ts-ignore - OpenAI agents library type issue
          // image_url: base64Image,
        },
      ]),
    ]);

    return res.json({
      message: "Image extracted successfully",
      data: finalOutput,
    });
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

  const { finalOutput } = await run(agent, [
    user([
      {
        type: "input_text",
        text: "Extract all available passport information from this image. Return only JSON with no additional text.",
      },
      {
        type: "input_image",
        image: dataUrl,
        // @ts-ignore - OpenAI agents library type issue
        // image_url: base64Image,
      },
    ]),
  ]);

  return res.json({
    message: "Image extracted successfully",
    data: finalOutput,
  });
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
