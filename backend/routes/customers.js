// backend/routes/customers.js
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { validateCustomerData, validateAnalysisRequest } = require('../middleware/validation');
const aiService = require('../services/ai-service');
const router = express.Router();

/**
 * Simple in-memory fallback sample customers.
 * If you have database/customers.json it will be used by the GET / route.
 */
const sampleCustomers = [
  { NAME: 'Amit Sharma', ACCOUNT_NO: 'SBIN0001001', BALANCE: 12500.50, EMAIL: 'amit@example.com', MOBILE: '9876543210', AGE: 35, KYC_STATUS: 'Verified' },
  { NAME: 'Sita Rao', ACCOUNT_NO: 'SBIN0001002', BALANCE: 2500.75, EMAIL: 'sita@example.com', MOBILE: '9876501234', AGE: 62, KYC_STATUS: 'Expired' },
  { NAME: 'Ramesh Gupta', ACCOUNT_NO: 'SBIN0001003', BALANCE: -500.00, EMAIL: 'ramesh@example.com', MOBILE: '9876512345', AGE: 45, KYC_STATUS: 'Pending' }
];

// ---------------- Multer upload setup ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `excel_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname) || '.xlsx'}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept either the spreadsheet mimetypes or extension
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream' // sometimes browsers send this
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = ['.xlsx', '.xls'];

    if (allowedMimes.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// ---------------- Helper utilities ----------------
function safeUnlink(filepath) {
  try {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch (err) {
    console.warn('safeUnlink error:', err && err.message ? err.message : err);
  }
}

function normalizeAccountKey(obj) {
  // Accept different casing: ACCOUNT_NO, accountNo, account_no, AccountNumber etc.
  if (!obj) return obj;
  const ret = { ...obj };
  const keys = Object.keys(obj);
  const accountKey = keys.find(k => /account[_\s-]*no$|^accountno$|^account$/i.test(k));
  if (accountKey && accountKey !== 'ACCOUNT_NO') {
    ret.ACCOUNT_NO = obj[accountKey];
  } else if (!ret.ACCOUNT_NO) {
    // also check common alternative names
    const alt = keys.find(k => /acc(?:ount)?[_\s-]*no|accno|accountnumber/i.test(k));
    if (alt) ret.ACCOUNT_NO = obj[alt];
  }
  return ret;
}

function getAccountValue(obj) {
  const normalized = normalizeAccountKey(obj);
  return normalized.ACCOUNT_NO || normalized.account_no || normalized.accountNo || normalized.Account || '';
}

// ---------------- GET / -> return customers list ----------------
router.get('/', (req, res) => {
  try {
    const dataFile = path.join(__dirname, '../database/customers.json');
    if (fs.existsSync(dataFile)) {
      const content = fs.readFileSync(dataFile, 'utf8');
      try {
        const parsed = JSON.parse(content);
        // if stored as { customers: [...] } support that shape
        if (Array.isArray(parsed)) {
          return res.json(parsed);
        } else if (parsed && Array.isArray(parsed.customers)) {
          return res.json(parsed.customers);
        } else {
          // unknown shape — fall back to sample
          console.warn('customers.json has unexpected shape, falling back to sample data');
          return res.json(sampleCustomers);
        }
      } catch (err) {
        console.warn('Error parsing database/customers.json, fallback to sampleCustomers:', err.message);
        return res.json(sampleCustomers);
      }
    } else {
      // No file — return sample
      return res.json(sampleCustomers);
    }
  } catch (err) {
    console.error('GET /api/customers error:', err);
    return res.status(500).json({ error: 'Unable to load customers', message: err.message });
  }
});

// ---------------- GET /:accountNo -> single customer ----------------
router.get('/:accountNo', (req, res) => {
  try {
    const accountNo = req.params.accountNo;
    // Prefer database file if exists
    const dataFile = path.join(__dirname, '../database/customers.json');
    let customers = sampleCustomers;
    if (fs.existsSync(dataFile)) {
      try {
        const content = fs.readFileSync(dataFile, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) customers = parsed;
        else if (parsed && Array.isArray(parsed.customers)) customers = parsed.customers;
      } catch (err) {
        // ignore parse error, use sample
      }
    }
    const lower = String(accountNo).toLowerCase();
    const found = customers.find(c => {
      const acct = String(getAccountValue(c) || '').toLowerCase();
      return acct === lower;
    });
    if (!found) return res.status(404).json({ error: 'Customer not found' });
    return res.json(found);
  } catch (err) {
    console.error('GET /api/customers/:accountNo error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// ---------------- POST /upload -> accept Excel upload, parse and return JSON ----------------
router.post('/upload', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select an Excel file to upload'
      });
    }

    console.log('Processing Excel file:', req.file.originalname);

    // Read workbook safely
    const workbook = XLSX.readFile(req.file.path, { cellDates: true });
    const sheetNames = workbook.SheetNames || [];

    // Try to find a sheet with "customer" in the name (case-insensitive), otherwise pick first sheet
    let targetSheet = sheetNames.find(n => /customer/i.test(n)) || sheetNames[0];
    if (!targetSheet) targetSheet = sheetNames[0] || null;

    if (!targetSheet) {
      safeUnlink(req.file.path);
      return res.status(400).json({
        error: 'No sheets found',
        message: 'The uploaded Excel file contains no sheets'
      });
    }

    const worksheet = workbook.Sheets[targetSheet];
    const customers = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    // Clean up uploaded file
    safeUnlink(req.file.path);

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        error: 'Empty file or no rows',
        message: 'The uploaded Excel file contains no data'
      });
    }

    // Normalize keys for each row (optional)
    const normalizedCustomers = customers.map(row => {
      // prefer original keys but ensure ACCOUNT_NO exists
      const norm = normalizeAccountKey(row);
      return norm;
    });

    // Validate data structure if validator exists
    if (typeof validateCustomerData === 'function') {
      const validation = validateCustomerData(normalizedCustomers);
      if (!validation || !validation.isValid) {
        return res.status(400).json({
          error: 'Invalid data format',
          message: 'Please check your Excel file format',
          details: validation ? validation.errors : 'Validation function returned invalid result'
        });
      }
    }

    console.log(`Successfully parsed ${normalizedCustomers.length} customer records from sheet "${targetSheet}"`);

    return res.json({
      success: true,
      count: normalizedCustomers.length,
      customers: normalizedCustomers,
      sheetName: targetSheet,
      availableSheets: sheetNames,
      message: `Successfully loaded ${normalizedCustomers.length} customer records`,
      columns: normalizedCustomers.length > 0 ? Object.keys(normalizedCustomers[0]) : [],
      sampleData: normalizedCustomers.slice(0, 3)
    });
  } catch (error) {
    console.error('Excel parsing error:', error && error.message ? error.message : error);

    // Clean up file if it exists
    if (req.file && req.file.path) safeUnlink(req.file.path);

    return res.status(500).json({
      error: 'File processing failed',
      message: 'Unable to process the Excel file. Please check the file format and try again.',
      details: process.env.NODE_ENV === 'development' ? (error && error.message ? error.message : String(error)) : undefined
    });
  }
});

// ---------------- POST /analyze -> analyze customers for selected issue ----------------
router.post('/analyze', validateAnalysisRequest, async (req, res) => {
  try {
    const { customers, issueType, options = {} } = req.body;
    const startTime = Date.now();

    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: 'Invalid request', message: 'customers must be an array' });
    }

    console.log(`Analyzing ${customers.length} customers for ${issueType} issues`);

    // Normalize and ensure ACCOUNT_NO for each customer
    const normalized = customers.map(c => normalizeAccountKey(c));

    // Rule-based filtering first
    const ruleFiltered = filterCustomersByRule(normalized, issueType);

    let analysisResult = {
      totalCustomers: normalized.length,
      ruleBasedMatches: ruleFiltered.length,
      finalMatches: ruleFiltered.length,
      customers: ruleFiltered,
      confidence: 'rule-based',
      processingTime: Date.now() - startTime
    };

    // Optional AI enhancement (limit number of records to avoid cost)
    const useAI = options.useAI && process.env.GEMINI_API_KEY;
    if (useAI && ruleFiltered.length > 0) {
      try {
        console.log('Enhancing analysis with AI service...');
        // pass a small sample or all depending on your policy
        const toAnalyze = ruleFiltered.slice(0, 100); // cap to 100 for safety
        const aiAnalysis = await aiService.analyzeCustomers(toAnalyze, issueType);

        if (aiAnalysis && Array.isArray(aiAnalysis.analysis)) {
          analysisResult.aiEnhanced = true;
          analysisResult.aiInsights = aiAnalysis.summary || {};

          // Build a map from various account key names (lowercase) to ai entries
          const aiMap = new Map();
          aiAnalysis.analysis.forEach(a => {
            const acct = (a.account_no || a.ACCOUNT_NO || a.accountNo || '').toString().toLowerCase();
            if (acct) aiMap.set(acct, a);
          });

          analysisResult.customers = ruleFiltered.map(customer => {
            const acctVal = (getAccountValue(customer) || '').toString().toLowerCase();
            const aiMatch = aiMap.get(acctVal);
            return {
              ...customer,
              aiConfidence: aiMatch ? aiMatch.confidence : (customer.aiConfidence || 0.8),
              aiPriority: aiMatch ? aiMatch.priority : (customer.aiPriority || 'medium'),
              aiReason: aiMatch ? aiMatch.reason : (customer.aiReason || 'Rule-based match')
            };
          });

          // Update finalMatches to reflect AI filtering if AI changed selection
          analysisResult.finalMatches = analysisResult.customers.filter(c => c.aiConfidence >= (options.minConfidence || 0.7)).length;
          analysisResult.confidence = 'ai-enhanced';
        }
      } catch (aiError) {
        console.warn('AI analysis failed, using rule-based results:', aiError && aiError.message ? aiError.message : aiError);
        analysisResult.aiError = aiError && aiError.message ? aiError.message : String(aiError);
      }
    }

    // Add issue-specific insights
    analysisResult.insights = generateInsights(issueType, analysisResult.customers);
    analysisResult.processingTime = Date.now() - startTime;

    console.log(`Analysis completed: ${analysisResult.finalMatches} customers affected`);

    return res.json({
      success: true,
      issueType,
      analysis: analysisResult,
      recommendations: getRecommendations(issueType, analysisResult.finalMatches),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Customer analysis error:', error && error.message ? error.message : error);
    return res.status(500).json({
      error: 'Analysis failed',
      message: 'Unable to analyze customer data. Please try again.',
      details: process.env.NODE_ENV === 'development' ? (error && error.message ? error.message : String(error)) : undefined
    });
  }
});

// ---------------- Rule-based filtering ----------------
function filterCustomersByRule(customers, issueType) {
  const currentDate = new Date();

  return customers.filter(customer => {
    try {
      switch (issueType) {
        case 'account_closure': {
          const bal = parseFloat(customer.BALANCE || customer.balance || 0) || 0;
          const lastTxRaw = customer.LAST_TRANSACTION || customer.last_transaction || customer.lastTransaction || null;
          const lastTransaction = lastTxRaw ? new Date(lastTxRaw) : null;
          const daysSinceLastTransaction = lastTransaction && !isNaN(lastTransaction.getTime())
            ? Math.floor((currentDate - lastTransaction) / (1000 * 60 * 60 * 24))
            : 9999;
          return bal <= 100 || daysSinceLastTransaction > 90;
        }

        case 'kyc_update': {
          const email = customer.EMAIL || customer.email || '';
          const mobile = customer.MOBILE || customer.mobile || '';
          const kyc = customer.KYC_STATUS || customer.kyc_status || customer.kycStatus || '';
          return !email || !mobile || /expired|pending/i.test(String(kyc || ''));
        }

        case 'loan_default': {
          const outstanding = parseFloat(customer.OUTSTANDING_AMOUNT || customer.outstanding_amount || customer.outstanding || 0) || 0;
          return outstanding > 0;
        }

        case 'fee_waiver': {
          const age = parseInt(customer.AGE || customer.age || 0, 10) || 0;
          const accType = String(customer.ACCOUNT_TYPE || customer.account_type || '').toLowerCase();
          const custCat = String(customer.CUSTOMER_CATEGORY || customer.customer_category || '').toLowerCase();
          return age > 60 || accType === 'student' || custCat.includes('senior');
        }

        case 'document_expiry': {
          const status = String(customer.DOC_STATUS || customer.doc_status || customer.docStatus || '').toLowerCase();
          const days = parseInt(customer.DOC_EXPIRY_DAYS || customer.doc_expiry_days || customer.docExpiryDays || 9999, 10) || 9999;
          return status === 'expiring' || status === 'expired' || days <= 60;
        }

        default:
          return false;
      }
    } catch (err) {
      console.warn('filterCustomersByRule per-customer error:', err);
      return false;
    }
  });
}

// ---------------- Insights & Recommendations ----------------
function generateInsights(issueType, customers) {
  const insights = {};

  try {
    switch (issueType) {
      case 'account_closure':
        insights.zeroBalance = customers.filter(c => parseFloat(c.BALANCE || c.balance || 0) === 0).length;
        insights.lowBalance = customers.filter(c => {
          const bal = parseFloat(c.BALANCE || c.balance || 0) || 0;
          return bal > 0 && bal <= 100;
        }).length;
        break;

      case 'kyc_update':
        insights.missingEmail = customers.filter(c => !(c.EMAIL || c.email)).length;
        insights.missingMobile = customers.filter(c => !(c.MOBILE || c.mobile)).length;
        insights.expiredKyc = customers.filter(c => /expired/i.test(String(c.KYC_STATUS || c.kyc_status || ''))).length;
        break;

      case 'loan_default':
        const totalOutstanding = customers.reduce((sum, c) => sum + (parseFloat(c.OUTSTANDING_AMOUNT || c.outstanding_amount || c.outstanding || 0) || 0), 0);
        insights.totalOutstanding = totalOutstanding;
        insights.averageOutstanding = customers.length > 0 ? (totalOutstanding / customers.length) : 0;
        break;

      default:
        break;
    }
  } catch (err) {
    console.warn('generateInsights error:', err);
  }

  return insights;
}

function getRecommendations(issueType, affectedCount) {
  const recommendations = [];

  if (!affectedCount || affectedCount === 0) {
    recommendations.push('No immediate action required for this issue type.');
    return recommendations;
  }

  switch (issueType) {
    case 'account_closure':
      recommendations.push(`Send account closure warnings to ${affectedCount} customers`);
      recommendations.push('Follow up with phone calls for high-value accounts');
      recommendations.push('Offer account reactivation incentives');
      break;

    case 'kyc_update':
      recommendations.push(`Initiate KYC update process for ${affectedCount} customers`);
      recommendations.push('Set up digital KYC collection drive');
      recommendations.push('Send reminders with document requirements');
      break;

    case 'loan_default':
      recommendations.push(`Contact ${affectedCount} customers for payment collection`);
      recommendations.push('Offer payment restructuring options');
      recommendations.push('Schedule follow-up calls within 7 days');
      break;

    default:
      recommendations.push('Perform manual review for affected customers');
      break;
  }

  return recommendations;
}

// ---------------- Stats endpoint ----------------
router.get('/stats', (req, res) => {
  // This should normally be backed by DB queries; using sample numbers for now
  res.json({
    totalCustomers: 15420,
    activeAccounts: 14890,
    pendingKyc: 530,
    lowBalanceAccounts: 1240,
    loanDefaults: 85,
    lastUpdated: new Date().toISOString()
  });
});

module.exports = router;
