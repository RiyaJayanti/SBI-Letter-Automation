const express = require('express');
const emailService = require('../services/email-service');
const { validateEmailRequest } = require('../middleware/validation');
const router = express.Router();

// Send emails to selected customers
router.post('/send', validateEmailRequest, async (req, res) => {
  try {
    const { 
      customers, 
      subject, 
      content, 
      issueType, 
      options = {} 
    } = req.body;

    console.log(`Sending emails to ${customers.length} customers for ${issueType}`);

    const results = [];
    const startTime = Date.now();

    // Process emails with rate limiting to avoid spam detection
    const delayBetweenEmails = options.delayMs || 1000; // 1 second delay by default

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];

      if (!customer.EMAIL) {
        results.push({
          customer: customer.ACCOUNT_NO || customer.NAME,
          email: 'N/A',
          status: 'skipped',
          reason: 'No email address provided'
        });
        continue;
      }

      try {
        // Add delay between emails (except for first email)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
        }

        await emailService.sendLetter(customer, subject, content, issueType, options);
        
        results.push({
          customer: customer.ACCOUNT_NO || customer.NAME,
          email: customer.EMAIL,
          status: 'sent',
          sentAt: new Date().toISOString()
        });

        console.log(`Email sent successfully to ${customer.EMAIL}`);

      } catch (emailError) {
        console.error(`Email failed for ${customer.EMAIL}:`, emailError.message);
        
        results.push({
          customer: customer.ACCOUNT_NO || customer.NAME,
          email: customer.EMAIL,
          status: 'failed',
          error: emailError.message,
          errorCode: emailError.code || 'UNKNOWN'
        });
      }
    }

    // Calculate statistics
    const stats = {
      total: customers.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      processingTimeMs: Date.now() - startTime
    };

    console.log(`Email sending completed: ${stats.sent} sent, ${stats.failed} failed, ${stats.skipped} skipped`);

    res.json({
      success: true,
      emailSending: true,
      statistics: stats,
      results,
      summary: {
        successRate: stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0,
        averageTimePerEmail: stats.total > 0 ? Math.round(stats.processingTimeMs / stats.total) : 0,
        totalProcessingTime: `${Math.round(stats.processingTimeMs / 1000)}s`
      },
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      error: 'Email sending failed',
      message: 'Unable to send emails. Please check your email configuration.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test email configuration
router.post('/test', async (req, res) => {
  try {
    const { email, customMessage } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email address required',
        message: 'Please provide an email address for testing'
      });
    }

    console.log(`Sending test email to ${email}`);

    const testResult = await emailService.sendTestEmail(email, customMessage);

    res.json({
      success: true,
      testEmail: true,
      email,
      result: testResult,
      message: 'Test email sent successfully',
      testedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      error: 'Test email failed',
      message: 'Unable to send test email. Please check your email configuration.',
      details: {
        error: error.message,
        code: error.code,
        suggestion: 'Verify your email credentials in the .env file'
      }
    });
  }
});

// Get email configuration status
router.get('/config-status', (req, res) => {
  const config = {
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    emailProvider: process.env.EMAIL_PROVIDER || 'gmail',
    fromAddress: process.env.EMAIL_USER || 'Not configured',
    lastChecked: new Date().toISOString()
  };

  res.json({
    success: true,
    configuration: config,
    recommendations: config.emailConfigured ? [] : [
      'Set EMAIL_USER in your .env file',
      'Set EMAIL_PASS (app password) in your .env file',
      'Ensure 2-factor authentication is enabled for Gmail'
    ]
  });
});

// Send bulk emails with progress tracking
router.post('/bulk-send', validateEmailRequest, async (req, res) => {
  try {
    const { customers, subject, content, issueType, options = {} } = req.body;
    
    const batchSize = options.batchSize || 5; // Smaller batches for email
    const delayBetweenBatches = options.batchDelayMs || 5000; // 5 seconds between batches
    
    // Set up for streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const batches = [];
    for (let i = 0; i < customers.length; i += batchSize) {
      batches.push(customers.slice(i, i + batchSize));
    }

    let processedCount = 0;
    const allResults = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      try {
        const batchResults = [];
        
        // Process emails in this batch
        for (const customer of batch) {
          if (!customer.EMAIL) {
            batchResults.push({
              customer: customer.ACCOUNT_NO,
              status: 'skipped',
              reason: 'No email address'
            });
            continue;
          }

          try {
            await emailService.sendLetter(customer, subject, content, issueType);
            batchResults.push({
              customer: customer.ACCOUNT_NO,
              email: customer.EMAIL,
              status: 'sent'
            });
          } catch (error) {
            batchResults.push({
              customer: customer.ACCOUNT_NO,
              email: customer.EMAIL,
              status: 'failed',
              error: error.message
            });
          }

          // Small delay between emails in the same batch
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        allResults.push(...batchResults);
        processedCount += batch.length;

        console.log(`Email batch ${batchIndex + 1}/${batches.length} completed`);

        // Delay between batches to avoid rate limiting
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }

      } catch (batchError) {
        console.error(`Email batch ${batchIndex + 1} failed:`, batchError);
      }
    }

    // Send final results
    const stats = {
      total: customers.length,
      sent: allResults.filter(r => r.status === 'sent').length,
      failed: allResults.filter(r => r.status === 'failed').length,
      skipped: allResults.filter(r => r.status === 'skipped').length
    };

    res.json({
      success: true,
      bulkEmail: true,
      statistics: stats,
      results: allResults,
      batchesProcessed: batches.length,
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk email error:', error);
    res.status(500).json({
      error: 'Bulk email sending failed',
      message: 'Unable to complete bulk email sending'
    });
  }
});

module.exports = router;
