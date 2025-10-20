import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Initialize Google Vision client
let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient() {
  if (!visionClient && process.env.GOOGLE_VISION_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS);
      visionClient = new ImageAnnotatorClient({
        credentials
      });
    } catch (error) {
      console.error('Failed to initialize Google Vision client:', error);
    }
  }
  return visionClient;
}

// Google Vision OCR
async function tryGoogleVision(imageData: string) {
  const client = getVisionClient();
  if (!client) {
    throw new Error('Google Vision client not initialized');
  }

  // Remove data URL prefix if present
  const base64Data = imageData.split(',')[1] || imageData;

  // Use document text detection instead of regular text detection
  const [result] = await client.documentTextDetection({
    image: { content: base64Data }
  });

  const fullTextAnnotation = result.fullTextAnnotation;
  if (!fullTextAnnotation || !fullTextAnnotation.text) {
    throw new Error('No text detected');
  }

  // Get line-by-line text from pages -> blocks -> paragraphs
  let structuredText = '';
  
  if (fullTextAnnotation.pages) {
    fullTextAnnotation.pages.forEach(page => {
      page.blocks?.forEach(block => {
        block.paragraphs?.forEach(paragraph => {
          const paragraphText = paragraph.words
            ?.map(word => word.symbols?.map(s => s.text).join(''))
            .join(' ');
          if (paragraphText) {
            structuredText += paragraphText + '\n';
          }
        });
      });
    });
  }

  // Fallback to full text if structured extraction fails
  const finalText = structuredText.trim() || fullTextAnnotation.text;

  // Format to match OCR.space response structure
  return {
    ParsedResults: [{
      ParsedText: finalText,
      TextOverlay: null,
      FileParseExitCode: 1,
      ErrorMessage: '',
      ErrorDetails: ''
    }],
    OCRExitCode: 1,
    IsErroredOnProcessing: false,
    ProcessingTimeInMilliseconds: '0',
    SearchablePDFURL: '',
    ocrMethod: 'google_vision_document'
  };
}

// OCR.space fallback
async function tryOCRSpace(imageData: string) {
  const OCR_API_KEY = process.env.OCR_API_KEY || 'K84997741488957';

  const formData = new FormData();
  formData.append('base64Image', imageData);
  formData.append('apikey', OCR_API_KEY);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  formData.append('isTable', 'true');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR.space API error: ${response.status}`);
  }

  return await response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    let result;
    let ocrMethod = 'unknown';

    // Try Google Vision first
    try {
      console.log('Attempting Google Vision OCR...');
      result = await tryGoogleVision(imageData);
      ocrMethod = 'google_vision';
      console.log('Google Vision succeeded');
    } catch (visionError) {
      // Fall back to OCR.space
      console.log('Google Vision failed, falling back to OCR.space:', visionError);
      try {
        result = await tryOCRSpace(imageData);
        ocrMethod = 'ocr_space';
        console.log('OCR.space succeeded');
      } catch (ocrSpaceError) {
        console.error('Both OCR methods failed:', ocrSpaceError);
        throw ocrSpaceError;
      }
    }

    // Add metadata about which method was used
    return res.status(200).json({
      ...result,
      ocrMethod // Include this for your analytics
    });

  } catch (error) {
    console.error('OCR Error:', error);
    return res.status(500).json({ 
      error: 'OCR processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}