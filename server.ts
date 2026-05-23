import express from 'express';
import path from 'path';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// Using multer with memory storage since we just need the buffer
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini client globally
  // We'll configure it lazily inside the routes because GEMINI_API_KEY could be injected later.
  let ai: GoogleGenAI | null = null;
  function getAI() {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
      }
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
    }
    return ai;
  }

  // --- API Routes ---

  // 1. Analyze the uploaded item and generate 3 outfit concepts
  app.post('/api/analyze-item', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded.' });
      }

      const client = getAI();
      const base64Data = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;

      const prompt = `
        You are an expert fashion stylist. The user has uploaded an image of a specific clothing item.
        Analyze this item (its style, color, pattern, material) and create 3 distinct outfit options featuring it:
        1. Casual
        2. Business
        3. Night Out

        For each outfit, provide a title, a short description, the items needed to complete it (excluding the uploaded item itself, just the pairings), and a color palette (3-4 hex codes).
      `;

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
           { inlineData: { data: base64Data, mimeType } },
           prompt
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: 'Unique identifier string' },
                type: { type: Type.STRING, description: 'One of: Casual, Business, Night Out' },
                title: { type: Type.STRING, description: 'A catchy name for the outfit' },
                description: { type: Type.STRING, description: 'Brief description of the complete look' },
                items: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of pieces paired with the item' },
                colorPalette: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of hex color codes' },
                visualPrompt: { type: Type.STRING, description: 'A concise visual prompt for an image generator to create a pristine flat-lay photograph of this exact outfit.' }
              },
              required: ['id', 'type', 'title', 'description', 'items', 'colorPalette', 'visualPrompt']
            }
          }
        }
      });

      const text = response.text || "[]";
      let outfits = [];
      try {
        outfits = JSON.parse(text);
      } catch (e) {
        throw new Error("Failed to parse JSON from AI response.");
      }

      res.json({ outfits });
    } catch (error: any) {
      console.error('Error analyzing item:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // 2. Generate a flat-lay visualize image for a specific outfit
  app.post('/api/generate-outfit-image', upload.single('image'), async (req, res) => {
    try {
      const { visualPrompt } = req.body;
      if (!visualPrompt) {
        return res.status(400).json({ error: 'Missing visualPrompt in body.' });
      }

      const client = getAI();
      const parts = [];

      // If the user uploaded the original image, we can try to include it for reference,
      // but text-to-image is often better for a pure flat-lay without weird artifacts on the reference.
      // Easiest is just text-to-image with the visual prompt.
      // We will just use text to generate a clean flat lay representing the style.
      parts.push({ text: `A pristine, high-fashion flat-lay studio photograph. ${visualPrompt}. Display the clothing items neatly arranged on a clean background.` });

      // If we *really* wanted to pass the original image, we could. The request has it as req.file
      if (req.file) {
        parts.push({
           inlineData: { data: req.file.buffer.toString('base64'), mimeType: req.file.mimetype }
        });
      }

      // We MUST use gemini-3.1-flash-image-preview for high quality images
      const response = await client.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "3:4", // Tall aspect ratio usually good for outfits
            imageSize: "1K"
          }
        }
      });

      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = \`data:\${part.inlineData.mimeType};base64,\${part.inlineData.data}\`;
          break;
        }
      }

      if (imageUrl) {
        res.json({ imageUrl });
      } else {
        res.status(500).json({ error: 'AI did not return an image part.' });
      }

    } catch (error: any) {
      console.error('Error generating image:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });


  // --- Vite / SPA Fallback ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on port \${PORT}\`);
  });
}

startServer();
