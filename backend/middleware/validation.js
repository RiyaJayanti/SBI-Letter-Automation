const Joi = require('joi');

// Customer data validation schema
const customerSchema = Joi.object({
  NAME: Joi.string().required().trim().min(2).max(100),
  ACCOUNT_NO: Joi.string().required().trim().min(8).max(20),
  BALANCE: Joi.number().allow('', null).min(0),
  EMAIL: Joi.string().email().allow('', null).trim(),
  MOBILE: Joi.string().allow('', null).trim().pattern(/^\+?[\d\s\-\(\)]{10,15}$/),
  LAST_TRANSACTION: Joi.string().allow('', null).trim(),
  ACCOUNT_TYPE: Joi.string().allow('', null).trim(),
  KYC_STATUS: Joi.string().allow('', null).trim().valid('Complete', 'Pending', 'Expired', ''),
  OUTSTANDING_AMOUNT: Joi.number().allow('', null).min(0),
  EMI_AMOUNT: Joi.number().allow('', null).min(0),
  DUE_DATE: Joi.string().allow('', null).trim(),
  BRANCH_CODE: Joi.string().allow('', null).trim().min(3).max(10),
  AGE: Joi.number().allow('', null).min(18).max(120),
  CUSTOMER_CATEGORY: Joi.string().allow('', null).trim(),
  DOC_TYPE: Joi.string().allow('', null).trim(),
  DOC_STATUS: Joi.string().allow('', null).trim(),
  DOC_EXPIRY: Joi.string().allow('', null).trim(),
  DAYS_TO_EXPIRY: Joi.number().allow('', null).min(0)
}).unknown(true); // Allow additional fields

function validateCustomerData(customers) {
  const errors = [];
  
  if (!Array.isArray(customers) || customers.length === 0) {
    return {
      isValid: false,
      errors: ['Customer data must be a non-empty array']
    };
  }

  // Check required columns in first row
  const firstCustomer = customers[0];
  const requiredFields = ['NAME', 'ACCOUNT_NO'];
  
  for (const field of requiredFields) {
    if (!(field in firstCustomer)) {
      errors.push(`Missing required column: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Validate each customer record (check first 10 for performance)
  const samplesToValidate = Math.min(customers.length, 10);
  
  for (let i = 0; i < samplesToValidate; i++) {
    const customer = customers[i];
    const { error } = customerSchema.validate(customer, { allowUnknown: true });
    
    if (error) {
      errors.push(`Row ${i + 1}: ${error.details[0].message}`);
    }

    // Custom validation rules
    if (customer.EMAIL && !isValidEmail(customer.EMAIL)) {
      errors.push(`Row ${i + 1}: Invalid email format`);
    }

    if (customer.MOBILE && !isValidMobile(customer.MOBILE)) {
      errors.push(`Row ${i + 1}: Invalid mobile number format`);
    }

    // Stop if too many errors
    if (errors.length >= 5) {
      errors.push('... and possibly more errors. Please fix the above issues first.');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedRows: samplesToValidate,
    totalRows: customers.length
  };
}

// API request validations
function validateAnalysisRequest(req, res, next) {
  const schema = Joi.object({
    customers: Joi.array().items(Joi.object()).min(1).max(10000).required(),
    issueType: Joi.string().valid(
      'account_closure', 
      'kyc_update', 
      'loan_default', 
      'fee_waiver', 
      'document_expiry'
    ).required(),
    options: Joi.object({
      useAI: Joi.boolean().default(false),
      aiProvider: Joi.string().valid('gemini', 'openai').default('gemini'),
      confidenceThreshold: Joi.number().min(0).max(1).default(0.7),
      maxResults: Joi.number().min(1).max(1000).default(100)
    }).default({})
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      message: error.details[0].message,
      field: error.details[0].path[0]
    });
  }

  req.body = value;
  next();
}

function validateLetterRequest(req, res, next) {
  const schema = Joi.object({
    customers: Joi.array().items(Joi.object().keys({
      NAME: Joi.string().required(),
      ACCOUNT_NO: Joi.string().required()
    }).unknown(true)).min(1).max(1000).required(),
    issueType: Joi.string().valid(
      'account_closure', 
      'kyc_update', 
      'loan_default', 
      'fee_waiver', 
      'document_expiry'
    ).required(),
    customMessage: Joi.string().allow('').max(500).default(''),
    options: Joi.object({
      generatePDF: Joi.boolean().default(false),
      includeHeader: Joi.boolean().default(true),
      includeFooter: Joi.boolean().default(true),
      batchSize: Joi.number().min(1).max(100).default(10)
    }).default({})
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      message: error.details[0].message,
      field: error.details[0].path[0]
    });
  }

  req.body = value;
  next();
}

function validateEmailRequest(req, res, next) {
  const schema = Joi.object({
    customers: Joi.array().items(Joi.object().keys({
      NAME: Joi.string().required(),
      ACCOUNT_NO: Joi.string().required(),
      EMAIL: Joi.string().email().allow('', null)
    }).unknown(true)).min(1).max(500).required(),
    subject: Joi.string().max(200).default(''),
    content: Joi.string().required().max(10000),
    issueType: Joi.string().valid(
      'account_closure', 
      'kyc_update', 
      'loan_default', 
      'fee_waiver', 
      'document_expiry'
    ).required(),
    options: Joi.object({
      includeAttachment: Joi.boolean().default(false),
      sendCopy: Joi.boolean().default(false),
      priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
      delayMs: Joi.number().min(500).max(10000).default(1000),
      batchSize: Joi.number().min(1).max(10).default(5),
      batchDelayMs: Joi.number().min(1000).max(30000).default(5000)
    }).default({})
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      message: error.details[0].message,
      field: error.details[0].path[0]
    });
  }

  req.body = value;
  next();
}

// Utility validation functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidMobile(mobile) {
  // Remove all spaces, dashes, parentheses
  const cleaned = mobile.replace(/[\s\-\(\)\+]/g, '');
  // Should be 10-15 digits
  const mobileRegex = /^\d{10,15}$/;
  return mobileRegex.test(cleaned);
}

// File upload validation
function validateFileUpload(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please select an Excel file to upload'
    });
  }

  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  const allowedExtensions = ['.xlsx', '.xls'];
  const fileExtension = require('path').extname(req.file.originalname).toLowerCase();

  if (!allowedMimeTypes.includes(req.file.mimetype) && !allowedExtensions.includes(fileExtension)) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only Excel files (.xlsx, .xls) are allowed'
    });
  }

  if (req.file.size > 10 * 1024 * 1024) { // 10MB limit
    return res.status(400).json({
      error: 'File too large',
      message: 'Maximum file size is 10MB'
    });
  }

  next();
}

module.exports = {
  validateCustomerData,
  validateAnalysisRequest,
  validateLetterRequest,
  validateEmailRequest,
  validateFileUpload,
  customerSchema
};
