const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email credentials not configured. Email features will be disabled.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        pool: true, // Use connection pooling
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10 // Max 10 emails per second
      });

      // Verify connection on startup
      this.verifyConnection();
      
    } catch (error) {
      console.error('Email service initialization failed:', error);
    }
  }

  async verifyConnection() {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      console.log('✅ Email service connected successfully');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error.message);
      return false;
    }
  }

  async sendLetter(customer, subject, content, issueType, options = {}) {
    if (!this.transporter) {
      throw new Error('Email service not configured. Please set EMAIL_USER and EMAIL_PASS in environment variables.');
    }

    const mailOptions = {
      from: {
        name: 'State Bank of India',
        address: process.env.EMAIL_USER
      },
      to: {
        name: customer.NAME,
        address: customer.EMAIL
      },
      subject: subject || this.getDefaultSubject(issueType, customer),
      text: content,
      html: this.formatAsHTML(content, customer),
      priority: this.getPriority(issueType),
      headers: {
        'X-SBI-Customer-ID': customer.ACCOUNT_NO,
        'X-SBI-Issue-Type': issueType,
        'X-SBI-Branch': customer.BRANCH_CODE || 'MAIN'
      }
    };

    // Add PDF attachment if provided
    if (options.pdfBuffer) {
      mailOptions.attachments = [{
        filename: `SBI_Letter_${customer.ACCOUNT_NO}.pdf`,
        content: options.pdfBuffer,
        contentType: 'application/pdf'
      }];
    }

    try {
      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`Email sent successfully to ${customer.EMAIL} (Message ID: ${result.messageId})`);
      
      return {
        success: true,
        messageId: result.messageId,
        recipient: customer.EMAIL,
        subject: mailOptions.subject
      };

    } catch (error) {
      console.error(`Email sending failed for ${customer.EMAIL}:`, error);
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }

  async sendTestEmail(email, customMessage) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const testContent = customMessage || 
      `This is a test email from the SBI Letter Automation System.

If you receive this message, your email configuration is working correctly.

Test Details:
- Sent: ${new Date().toLocaleString('en-IN')}
- Service: SBI Letter Automation
- From: ${process.env.EMAIL_USER}

Thank you for testing the system!

Best regards,
SBI IT Team`;

    const mailOptions = {
      from: {
        name: 'SBI Letter System - Test',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: `✅ Test Email - SBI Letter Automation System - ${new Date().toLocaleDateString('en-IN')}`,
      text: testContent,
      html: this.formatTestEmailAsHTML(testContent),
      priority: 'normal'
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: result.messageId,
        recipient: email,
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Test email failed: ${error.message}`);
    }
  }

  getDefaultSubject(issueType, customer) {
    const subjectMap = {
      account_closure: `Important Notice - Account Status Update - ${customer.ACCOUNT_NO}`,
      kyc_update: `Action Required - KYC Documents Update - Account ${customer.ACCOUNT_NO}`,
      loan_default: `Payment Reminder - Loan Account ${customer.LOAN_ACCOUNT_NO || customer.ACCOUNT_NO}`,
      fee_waiver: `Fee Waiver Notification - Account ${customer.ACCOUNT_NO}`,
      document_expiry: `Document Renewal Required - Account ${customer.ACCOUNT_NO}`
    };

    return subjectMap[issueType] || `Important Banking Notice - Account ${customer.ACCOUNT_NO}`;
  }

  getPriority(issueType) {
    const priorityMap = {
      loan_default: 'high',
      document_expiry: 'high',
      account_closure: 'normal',
      kyc_update: 'normal',
      fee_waiver: 'low'
    };

    return priorityMap[issueType] || 'normal';
  }

  formatAsHTML(content, customer) {
    const htmlContent = content
      .replace(/\n/g, '<br>')
      .replace(/STATE BANK OF INDIA/g, '<strong style="color: #003366;">STATE BANK OF INDIA</strong>')
      .replace(/URGENT/gi, '<strong style="color: #d32f2f;">URGENT</strong>')
      .replace(/Important/gi, '<strong style="color: #1976d2;">Important</strong>');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>SBI Official Communication</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background-color: #003366; color: white; padding: 15px; text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">STATE BANK OF INDIA</h1>
        <p style="margin: 5px 0 0 0; font-size: 14px;">Official Banking Communication</p>
      </div>

      <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #003366; margin-bottom: 20px;">
        ${htmlContent}
      </div>

      <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin-top: 20px;">
        <p style="margin: 0; font-size: 12px; color: #666;">
          <strong>Important:</strong> This is an official communication from State Bank of India. 
          Please do not reply to this email. For any queries, contact your branch directly.
        </p>
      </div>

      <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
        <p>© ${new Date().getFullYear()} State Bank of India. All rights reserved.</p>
        <p>This email was sent by SBI Letter Automation System</p>
      </div>

    </body>
    </html>`;
  }

  formatTestEmailAsHTML(content) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SBI Test Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background-color: #4caf50; color: white; padding: 15px; text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0;">✅ Test Email Successful</h1>
        <p style="margin: 5px 0 0 0;">SBI Letter Automation System</p>
      </div>

      <div style="background-color: #f1f8e9; padding: 20px; border-left: 4px solid #4caf50;">
        ${content.replace(/\n/g, '<br>')}
      </div>

      <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
        <p>SBI IT Department - Letter Automation System</p>
      </div>

    </body>
    </html>`;
  }

  // Get email service status
  getStatus() {
    return {
      configured: !!this.transporter,
      provider: 'Gmail SMTP',
      fromAddress: process.env.EMAIL_USER || 'Not configured',
      connectionPool: true,
      features: {
        htmlEmail: true,
        attachments: true,
        rateLimiting: true,
        priorities: true
      }
    };
  }

  // Send multiple emails with rate limiting
  async sendBulkEmails(emailData, options = {}) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const results = [];
    const delayMs = options.delayMs || 1000;
    const maxConcurrent = options.maxConcurrent || 3;

    // Process emails in batches to avoid overwhelming the server
    for (let i = 0; i < emailData.length; i += maxConcurrent) {
      const batch = emailData.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (data, index) => {
        try {
          // Add staggered delay within batch
          await new Promise(resolve => setTimeout(resolve, index * (delayMs / maxConcurrent)));
          
          const result = await this.sendLetter(data.customer, data.subject, data.content, data.issueType, data.options);
          return {
            ...result,
            customer: data.customer.ACCOUNT_NO,
            email: data.customer.EMAIL
          };
        } catch (error) {
          return {
            success: false,
            customer: data.customer.ACCOUNT_NO,
            email: data.customer.EMAIL,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches
      if (i + maxConcurrent < emailData.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

module.exports = new EmailService();
