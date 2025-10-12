# Pay How Much Ah? 💰

A smart receipt splitting web app that uses OCR to automatically extract items from receipt photos and helps split costs fairly among groups.

🔗 **Live App:** (https://pay-how-much-ah.vercel.app)

## Features

### 🎯 Core Functionality
- **Smart OCR Receipt Scanning**: Upload a photo of your receipt and automatically extract items and prices
- **Manual Entry Option**: Skip OCR and enter items manually if preferred
- **Flexible Item Assignment**: Assign items to one or multiple people
- **Automatic Cost Splitting**: Evenly split shared items among assigned people
- **Service Charge & GST**: Configure and apply percentage-based charges
- **WhatsApp-Ready Summary**: Copy-paste friendly format for easy sharing

### 💡 Smart Features
- Pattern-based item detection (no hardcoded food keywords)
- Handles various receipt formats (restaurants, retail, services)
- Real-time total calculation
- Warning for unassigned people or items

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **OCR**: OCR.space API
- **Icons**: Lucide React
- **Deployment**: Vercel (with serverless functions)
- **Build Tool**: Vite

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Vercel CLI (for local development with OCR)
- OCR.space API key (free tier available)

### Installation

1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/pay-how-much-ah.git
cd pay-how-much-ah

2. Install dependencies

bashnpm install

3. Set up environment variables

Create a .env.local file in the root directory:
envOCR_API_KEY=your_ocr_space_api_key_here
Get your free API key from OCR.space

4. Run the development server

bashvercel dev
The app will be available at http://localhost:3000

Note: Use vercel dev instead of npm run dev to enable the OCR API endpoint locally.

Project Structure
pay-how-much-ah/
├── api/
│   └── ocr.ts              # Serverless OCR endpoint
├── src/
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # React entry point
│   └── index.css           # Global styles
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json

Usage
1. Upload Receipt

Click "Upload & Scan Receipt" and select a photo
Or click "Skip - Enter Manually" to add items by hand

2. Review & Edit Items

OCR-extracted items appear automatically
Edit names and prices as needed
Add party member names
Configure service charge and GST if applicable

3. Select Payer

Choose who paid for the receipt

4. Assign Items

Click on people's names to assign them to items
Multiple people can share a single item (cost splits evenly)
Warning appears for unassigned people

5. Generate Summary

View payment summary showing who owes whom
See detailed breakdown of each person's items
Copy to clipboard for easy sharing via WhatsApp

Contributing
Contributions are welcome! Feel free to:

Report bugs
Suggest new features
Submit pull requests

License
MIT License - feel free to use this project for personal or commercial purposes.
Acknowledgments

OCR powered by OCR.space
Icons by Lucide
Deployed on Vercel

Author
isthismyniche
Built as a practical solution for splitting bills among friends and family.