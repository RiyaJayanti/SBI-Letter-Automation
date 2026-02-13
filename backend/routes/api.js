const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'SBI Letter Automation API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// System information endpoint
router.get('/info', (req, res) => {
  res.json({
    name: 'SBI Letter Automation System',
    description: 'Automated letter generation system for State Bank of India',
    version: '1.0.0',
    features: [
      'Excel customer data processing',
      'AI-powered issue analysis using Google Gemini',
      'Automated letter generation',
      'Bulk email sending',
      'PDF generation',
      'Interactive chatbot assistance'
    ],
    endpoints: {
      customers: {
        upload: 'POST /api/customers/upload',
        analyze: 'POST /api/customers/analyze'
      },
      letters: {
        generate: 'POST /api/letters/generate',
        preview: 'POST /api/letters/preview',
        templates: 'GET /api/letters/templates'
      },
      email: {
        send: 'POST /api/email/send',
        test: 'POST /api/email/test'
      }
    }
  });
});

// Get available issue types
router.get('/issue-types', (req, res) => {
  res.json({
    issueTypes: {
      account_closure: {
        name: 'Account Closure Notice',
        description: 'For accounts with zero or low balance that may be closed',
        criteria: 'Balance ≤ ₹100 or no transactions in 90+ days'
      },
      kyc_update: {
        name: 'KYC Update Required',
        description: 'For customers with expired or missing KYC documents',
        criteria: 'Missing email, expired KYC status, or incomplete documents'
      },
      loan_default: {
        name: 'Loan Payment Reminder',
        description: 'For customers with overdue loan payments',
        criteria: 'Outstanding loan amount > ₹0 or overdue EMI'
      },
      fee_waiver: {
        name: 'Fee Waiver Information',
        description: 'For eligible customers (senior citizens, students)',
        criteria: 'Age > 60 years or student account type'
      },
      document_expiry: {
        name: 'Document Expiry Notice',
        description: 'For customers with expiring identity/address documents',
        criteria: 'Documents expiring within 60 days'
      }
    }
  });
});

module.exports = router;
