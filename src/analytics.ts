import ReactGA from 'react-ga4';

const MEASUREMENT_ID = 'G-DXECQ06P6E'; // Replace with your actual ID

export const initGA = () => {
  ReactGA.initialize(MEASUREMENT_ID, {
    gtagOptions: {
      send_page_view: false // We'll send manually
    }
  });
};

// Track page views
export const trackPageView = (path: string) => {
  ReactGA.send({ hitType: 'pageview', page: path });
};

// Track events
export const trackEvent = (category: string, action: string, label?: string, value?: number) => {
  ReactGA.event({
    category,
    action,
    label,
    value
  });
};

// Specific tracking functions for your app
export const tracking = {
  // Step progression
  reachedStep: (stepNumber: number) => {
    trackEvent('User Journey', 'Reached Step', `Step ${stepNumber}`);
  },

  // OCR events
  ocrStarted: () => {
    trackEvent('OCR', 'Started', 'Upload Receipt');
  },
  
  ocrSuccess: (itemCount: number) => {
    trackEvent('OCR', 'Success', `Items Found: ${itemCount}`, itemCount);
  },
  
  ocrFailed: (error: string) => {
    trackEvent('OCR', 'Failed', error);
  },

  // Receipt management
  receiptAdded: (receiptNumber: number) => {
    trackEvent('Receipts', 'Added Receipt', `Receipt ${receiptNumber}`);
  },

  // Party members
  personAdded: (totalPeople: number) => {
    trackEvent('Party', 'Added Person', `Total: ${totalPeople}`, totalPeople);
  },

  // Item management
  itemAddedManually: () => {
    trackEvent('Items', 'Added Manually', 'Manual Entry');
  },

  itemDeleted: () => {
    trackEvent('Items', 'Deleted', 'Item Removed');
  },

  // Charges
  serviceChargeToggled: (enabled: boolean) => {
    trackEvent('Charges', 'Service Charge', enabled ? 'Enabled' : 'Disabled');
  },

  gstToggled: (enabled: boolean) => {
    trackEvent('Charges', 'GST', enabled ? 'Enabled' : 'Disabled');
  },

  // Assignment
  itemAssigned: (personCount: number) => {
    trackEvent('Assignment', 'Item Assigned', `People: ${personCount}`, personCount);
  },

  // Completion
  summaryGenerated: (receiptCount: number, totalAmount: number) => {
    trackEvent('Completion', 'Summary Generated', `Receipts: ${receiptCount}`, Math.round(totalAmount));
  },

  summaryCopied: () => {
    trackEvent('Completion', 'Copied Summary', 'Copy to Clipboard');
  },

  // User actions
  startedOver: () => {
    trackEvent('Navigation', 'Started Over', 'Reset App');
  },

  skippedOCR: () => {
    trackEvent('OCR', 'Skipped', 'Manual Entry Selected');
  },

  // First receipt tracking
  firstReceiptOCR: () => {
    trackEvent('First Receipt', 'OCR', 'Method');
  },

  firstReceiptManual: () => {
    trackEvent('First Receipt', 'Manual Entry', 'Method');
  },

  // Additional receipt tracking
  additionalReceiptOCR: (receiptNumber: number) => {
    trackEvent('Additional Receipt', 'OCR', `Receipt ${receiptNumber}`);
  },

  completedFirstReceipt: () => {
    trackEvent('Receipt Progress', 'Completed Receipt 1', 'First Receipt');
  }

};

