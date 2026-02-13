const express = require('express');
const { generateLetterContent, getAvailableTemplates } = require('../templates/letter-templates');
const pdfService = require('../services/pdf-service');
const { validateLetterRequest } = require('../middleware/validation');
const router = express.Router();

// Generate letters for selected customers
router.post('/generate', validateLetterRequest, async (req, res) => {
  try {
    const { customers, issueType, customMessage, options = {} } = req.body;
    const startTime = Date.now();

    console.log(`Generating ${customers.length} letters for ${issueType}`);

    const letters = [];
    const errors = [];

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      
      try {
        // Generate letter content
        const letterData = generateLetterContent(customer, issueType, customMessage);
        
        let letterResult = {
          customerId: customer.ACCOUNT_NO || i,
          customerName: customer.NAME,
          subject: letterData.subject,
          content: letterData.content,
          urgency: letterData.urgency || 'medium',
          generatedAt: new Date().toISOString()
        };

        // Generate PDF if requested
        if (options.generatePDF) {
          try {
            const pdfBuffer = await pdfService.generateLetterPDF(letterData.content, customer);
            letterResult.pdfBase64 = pdfBuffer.toString('base64');
            letterResult.pdfSize = pdfBuffer.length;
          } catch (pdfError) {
            console.warn(`PDF generation failed for customer ${customer.ACCOUNT_NO}:`, pdfError.message);
            letterResult.pdfError = pdfError.message;
          }
        }

        letters.push(letterResult);

      } catch (letterError) {
        console.error(`Letter generation failed for customer ${customer.ACCOUNT_NO}:`, letterError);
        errors.push({
          customer: customer.ACCOUNT_NO || customer.NAME,
          error: letterError.message
        });
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`Letter generation completed: ${letters.length} successful, ${errors.length} failed`);

    res.json({
      success: true,
      count: letters.length,
      letters,
      errors: errors.length > 0 ? errors : undefined,
      statistics: {
        totalRequested: customers.length,
        successful: letters.length,
        failed: errors.length,
        processingTimeMs: processingTime
      },
      metadata: {
        issueType,
        hasCustomMessage: !!customMessage,
        pdfGenerated: options.generatePDF,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Letter generation error:', error);
    res.status(500).json({
      error: 'Letter generation failed',
      message: 'Unable to generate letters. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Preview letter content for a single customer
router.post('/preview', async (req, res) => {
  try {
    const { customer, issueType, customMessage } = req.body;

    if (!customer || !issueType) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Customer data and issue type are required for preview'
      });
    }

    const letterData = generateLetterContent(customer, issueType, customMessage);

    res.json({
      success: true,
      preview: {
        customer: {
          name: customer.NAME,
          accountNo: customer.ACCOUNT_NO
        },
        letter: letterData,
        previewedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Letter preview error:', error);
    res.status(500).json({
      error: 'Preview generation failed',
      message: 'Unable to generate letter preview',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get available letter templates
router.get('/templates', (req, res) => {
  try {
    const templates = getAvailableTemplates();
    
    res.json({
      success: true,
      templates,
      count: Object.keys(templates).length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Template retrieval error:', error);
    res.status(500).json({
      error: 'Template retrieval failed',
      message: 'Unable to retrieve letter templates'
    });
  }
});

// Get template by ID
router.get('/templates/:templateId', (req, res) => {
  try {
    const { templateId } = req.params;
    const templates = getAvailableTemplates();
    
    if (!templates[templateId]) {
      return res.status(404).json({
        error: 'Template not found',
        message: `Template '${templateId}' does not exist`,
        availableTemplates: Object.keys(templates)
      });
    }

    res.json({
      success: true,
      template: {
        id: templateId,
        ...templates[templateId]
      }
    });

  } catch (error) {
    console.error('Template retrieval error:', error);
    res.status(500).json({
      error: 'Template retrieval failed',
      message: 'Unable to retrieve the requested template'
    });
  }
});

// Bulk letter generation with progress tracking
router.post('/bulk-generate', validateLetterRequest, async (req, res) => {
  try {
    const { customers, issueType, customMessage, options = {} } = req.body;
    
    // Set response headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const batchSize = options.batchSize || 10;
    const batches = [];
    
    // Split customers into batches
    for (let i = 0; i < customers.length; i += batchSize) {
      batches.push(customers.slice(i, i + batchSize));
    }

    let processedCount = 0;
    const allLetters = [];
    const allErrors = [];

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      try {
        // Generate letters for this batch
        const batchLetters = [];
        
        for (const customer of batch) {
          try {
            const letterData = generateLetterContent(customer, issueType, customMessage);
            batchLetters.push({
              customerId: customer.ACCOUNT_NO,
              customerName: customer.NAME,
              ...letterData
            });
          } catch (error) {
            allErrors.push({
              customer: customer.ACCOUNT_NO || customer.NAME,
              error: error.message
            });
          }
        }

        allLetters.push(...batchLetters);
        processedCount += batch.length;

        // Send progress update
        const progress = {
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          processedCount,
          totalCount: customers.length,
          currentBatchSize: batchLetters.length,
          progressPercentage: Math.round((processedCount / customers.length) * 100)
        };

        console.log(`Batch ${batchIndex + 1}/${batches.length} completed: ${batchLetters.length} letters`);

      } catch (batchError) {
        console.error(`Batch ${batchIndex + 1} failed:`, batchError);
        allErrors.push({
          batch: batchIndex + 1,
          error: batchError.message
        });
      }
    }

    // Send final result
    res.json({
      success: true,
      bulkGeneration: true,
      summary: {
        totalRequested: customers.length,
        totalGenerated: allLetters.length,
        totalErrors: allErrors.length,
        batchesProcessed: batches.length,
        batchSize
      },
      letters: allLetters,
      errors: allErrors.length > 0 ? allErrors : undefined,
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk generation error:', error);
    res.status(500).json({
      error: 'Bulk generation failed',
      message: 'Unable to complete bulk letter generation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
