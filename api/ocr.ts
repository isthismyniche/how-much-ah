import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Your OCR.space API key (stored securely on server)
    const OCR_API_KEY = process.env.OCR_API_KEY || 'K84997741488957';

    // Convert base64 to form data
    const formData = new FormData();
    
    // Convert base64 to blob
    const base64Data = imageData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer]);
    
    formData.append('base64Image', imageData);
    formData.append('apikey', OCR_API_KEY);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');
    formData.append('isTable', 'true');

    // Call OCR.space API
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    return res.status(200).json(result);
  } catch (error) {
    console.error('OCR Error:', error);
    return res.status(500).json({ error: 'OCR processing failed' });
  }
}