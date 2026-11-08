
import express from "express";
import multer from "multer";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { InferenceClient } from "@huggingface/inference";

dotenv.config({ path: "kimey.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const hf = new InferenceClient(
  process.env.HF_TOKEN || ""
);

// =================================
// SECURITY
// =================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

app.use(express.json({ limit: "2mb" }));

app.use(
  express.static(path.join(__dirname, "public"))
);

// =================================
// IMAGE UPLOAD
// =================================

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 8 * 1024 * 1024
  },

  fileFilter: (req, file, callback) => {
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp"
    ];

    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error("Format gambar harus PNG, JPG, atau WEBP.")
      );
    }

    callback(null, true);
  }
});

// =================================
// STATUS API
// =================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    name: "MESKY AI",
    title: "ANIME MINECRAFT AI",
    status: "online",
    aiConfigured: Boolean(process.env.HF_TOKEN)
  });
});

// =================================
// CONVERT IMAGE API
// =================================

app.post("/api/convert", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Gambar belum diupload."
      });
    }

    if (!process.env.HF_TOKEN) {
      return res.status(500).json({
        success: false,
        error: "HF_TOKEN belum diatur di kimey.env."
      });
    }

    const model =
      process.env.HF_MODEL ||
      "timbrooks/instruct-pix2pix";

    const instruction = `
      Transform this character into a Minecraft-style
      blocky character concept.

      Preserve the original character's recognizable
      hair color, hairstyle, outfit colors and accessories.

      Use a clean Minecraft pixel art appearance.
      Show the complete character.
      Keep the background simple.
    `;

    const result = await hf.imageToImage({
      model,
      inputs: req.file.buffer,
      parameters: {
        prompt: instruction
      }
    });

    if (!result) {
      throw new Error("AI tidak menghasilkan gambar.");
    }

    const imageBuffer = Buffer.from(
      await result.arrayBuffer()
    );

    const mimeType = result.type || "image/png";

    const imageBase64 =
      `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

    return res.json({
      success: true,
      image: imageBase64,
      model,
      message: "Gambar berhasil diproses."
    });

  } catch (error) {
    console.error("MESKY AI ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Gagal memproses gambar."
    });
  }
});

// =================================
// 404
// =================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Halaman atau API tidak ditemukan."
  });
});

// =================================
// ERROR HANDLER
// =================================

app.use((error, req, res, next) => {
  console.error("SERVER ERROR:", error);

  res.status(error.status || 500).json({
    success: false,
    error: error.message || "Terjadi kesalahan server."
  });
});

// =================================
// START SERVER
// =================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════╗
║           MESKY AI               ║
║      ANIME MINECRAFT AI          ║
╠══════════════════════════════════╣
║  STATUS : ONLINE                 ║
║  PORT   : ${String(PORT).padEnd(24)}║
║  URL    : http://localhost:${PORT}
╚══════════════════════════════════╝
  `);
});
