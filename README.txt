Pay How Much Ah? 💰
A smart receipt splitting web app that uses AI-powered OCR to automatically extract items from receipt photos and helps split costs fairly among groups.
🔗 Live App: https://pay-how-much-ah.vercel.app
Why This Exists
Splitting a receipt evenly is easy. But when you want to split by exact items? The math gets messy fast—especially with GST and service charge.
This app solves the pain of building spreadsheets every time friends go out. Upload a receipt, assign items to people, and get a clear payment summary. Simple.

✨ Features
🎯 Core Functionality

Google Cloud Vision OCR: Upload a receipt photo and automatically extract items and prices
Spatial Text Recognition: Custom logic matches items to prices using position-based detection
Manual Entry Option: Skip OCR and enter items manually if preferred
Multi-Receipt Support: Handle up to 3 receipts per session
Flexible Item Assignment: Assign items to one or multiple people with automatic split calculation
Service Charge & GST: Configure and apply percentage-based charges with accurate calculations
Copy-Paste Summary: WhatsApp-ready format with payment breakdown

💡 Smart Features

Pattern-based item detection (adapts to various receipt formats)
Real-time total calculation with tax breakdown
Warnings for unassigned items or people
Progress tracking through 5-step flow
Receipt navigation for multi-receipt sessions
Google Analytics integration for usage insights

💳 Support Features

Stripe donation integration
About modal with app explanation
Responsive mobile-first design


🛠 Tech Stack
Frontend

React 18 + TypeScript
Tailwind CSS for styling
Vite for build tooling
Lucide React for icons
browser-image-compression for image optimization

Backend

Vercel Serverless Functions
Google Cloud Vision API for OCR
Stripe for payment processing

Analytics

Google Analytics 4 (GA4) with custom event tracking
react-ga4 for event management

Deployment

Vercel (automatic deployments from main branch)


🚀 Getting Started
Prerequisites

Node.js 18+ and npm
Vercel CLI (for local development)
Google Cloud account with Vision API enabled
Stripe account (optional, for donation feature)

Installation

Clone the repository

bashgit clone https://github.com/isthismyniche/pay-how-much-ah.git
cd pay-how-much-ah

Install dependencies

bashnpm install

Set up environment variables

Create a .env.local file:
env# Google Cloud Vision (required)
GOOGLE_VISION_CREDENTIALS={"type":"service_account",...}

# Stripe (optional, for donations)
STRIPE_SECRET_KEY=sk_test_...

# Google Analytics (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...
Getting Google Cloud Vision credentials:

Create a project in Google Cloud Console
Enable Cloud Vision API
Create a service account with Vision API permissions
Download the JSON key file
Copy the entire JSON content into GOOGLE_VISION_CREDENTIALS
Run the development server

bashvercel dev
```

The app will be available at `http://localhost:3000`

**Note:** Use `vercel dev` (not `npm run dev`) to enable serverless functions locally.

---

## 📁 Project Structure
```
pay-how-much-ah/
├── api/
│   ├── ocr.ts                      # OCR endpoint (Google Vision + fallback)
│   └── create-donation-session.ts  # Stripe donation handler
├── src/
│   ├── App.tsx                     # Main application component
│   ├── analytics.ts                # GA4 tracking configuration
│   ├── main.tsx                    # React entry point
│   └── index.css                   # Global styles with Tailwind
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json

🎯 Usage Flow
1. Upload Receipt (Step 1)

Click "Upload & Scan Receipt" and select a photo (JPG/PNG, max 10MB)
Or click "Skip - Enter Manually" to add items by hand
Tip: Hold receipt straight and flat for best OCR results

2. Review & Edit Items (Step 2)

OCR-extracted items appear automatically
Edit names and prices as needed
Add or remove items manually
Add party member names
Configure service charge and GST percentages if applicable
See receipt total update in real-time

3. Select Payer (Step 3)

Choose who paid for this receipt

4. Assign Items (Step 4)

Click people's names to assign them to items
Use "Select All" for items everyone shares
Multiple people can share a single item (cost splits evenly)
Warnings appear for unassigned items or people with no items
Option to add another receipt (up to 3 total)

5. Generate Summary (Step 5)

View payment summary showing who owes whom
See detailed breakdown of each person's items (optional)
Copy to clipboard for easy sharing via WhatsApp
Support the project via donation button


🔧 Key Technical Decisions
Why Google Cloud Vision?

Superior accuracy compared to free OCR services
1,000 free requests/month (sufficient for personal use)
Better handling of various receipt formats and lighting conditions

Why Not Use LLMs?

LLMs (like GPT-4 Vision) would be more accurate at understanding context
But they're expensive (~$0.01+ per image)
Current solution keeps the app free for all users

Spatial Matching Algorithm

Uses bounding box coordinates (X, Y positions) to match items with prices
Groups words into lines based on Y-coordinate tolerance
Sorts words left-to-right within each line
Handles slightly tilted receipts (up to ~10 degrees)


📊 Analytics Events Tracked

User journey progression (Step 1-5)
OCR usage, success, and failure rates
Receipt count distribution (1, 2, or 3 receipts)
First receipt method (OCR vs manual)
Item management actions
Summary generation and copying
Donation interactions


🤝 Contributing
Contributions are welcome! Areas for improvement:

OCR Accuracy: Improve price-item matching algorithm
UI/UX: Better mobile experience, item reordering
Features: Currency support, receipt templates, export options
Performance: Optimize for slow networks

Feel free to:

Report bugs via Issues
Suggest features via Discussions
Submit pull requests


📄 License
MIT License - free to use for personal or commercial purposes.

🙏 Acknowledgments

OCR powered by Google Cloud Vision API
Icons by Lucide
Payment processing by Stripe
Deployed on Vercel


👤 Author
Manish Nair (@isthismyniche)
Built as a practical solution for splitting bills among friends and family. If it helps you, consider supporting the project!

Last Updated: November 2025