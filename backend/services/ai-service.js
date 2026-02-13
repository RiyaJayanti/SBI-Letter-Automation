const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    } else {
      console.warn('GEMINI_API_KEY not found. AI features will be disabled.');
    }
  }

  async analyzeCustomers(customers, issueType) {
    if (!this.model) {
      throw new Error('Gemini API not configured. Please set GEMINI_API_KEY in environment variables.');
    }

    try {
      const prompt = this.createAnalysisPrompt(customers, issueType);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }

    } catch (error) {
      console.error('Gemini AI analysis error:', error);
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  createAnalysisPrompt(customers, issueType) {
    const customerSample = customers.slice(0, 10); // Limit for efficiency
    
    const issueDescriptions = {
      account_closure: 'accounts that should be closed due to inactivity or zero balance',
      kyc_update: 'customers who need to update their KYC documents',
      loan_default: 'customers with overdue loan payments',
      fee_waiver: 'customers eligible for fee waivers (senior citizens, students)',
      document_expiry: 'customers with expiring identity or address documents'
    };

    return `You are an expert banking analyst for State Bank of India. Analyze the following customer data to identify ${issueDescriptions[issueType] || 'banking issues'}.

Customer Data: ${JSON.stringify(customerSample, null, 2)}

Issue Type: ${issueType}
Current Date: ${new Date().toISOString().split('T')[0]}

For each customer, assess:
1. Confidence score (0.0 to 1.0) - how certain are you this customer is affected?
2. Priority level (high/medium/low) - how urgent is this issue?
3. Specific reason - why is this customer affected?
4. Recommended action - what should be done?

Banking Context:
- Account closure: Consider balance, transaction history, account age
- KYC update: Look for missing information, expired documents, compliance requirements
- Loan default: Focus on payment history, outstanding amounts, overdue status
- Fee waiver: Consider customer category, age, account type, eligibility criteria
- Document expiry: Check document validity periods, upcoming renewals

Return ONLY a valid JSON object with this exact structure:
{
  "analysis": [
    {
      "account_no": "customer account number",
      "confidence": 0.95,
      "priority": "high",
      "reason": "specific issue description",
      "recommendation": "suggested action"
    }
  ],
  "summary": {
    "total_analyzed": number,
    "high_priority": number,
    "medium_priority": number,
    "low_priority": number,
    "average_confidence": number,
    "key_insights": ["insight1", "insight2"],
    "recommendations": ["rec1", "rec2"]
  }
}`;
  }

  async generateChatResponse(message, context = {}) {
    if (!this.model) {
      return this.getStaticResponse(message);
    }

    try {
      const chatPrompt = `You are a helpful banking assistant for State Bank of India's Letter Automation System. 

Current context: ${JSON.stringify(context, null, 2)}

User message: "${message}"

Provide helpful guidance about:
- Excel file upload and data requirements
- Customer analysis and filtering
- Letter generation and templates
- Email sending procedures
- Banking processes and compliance
- System features and troubleshooting

Keep responses concise (2-3 sentences), professional, and actionable. Focus on practical help for bank staff.`;

      const result = await this.model.generateContent(chatPrompt);
      const response = await result.response;
      return response.text();

    } catch (error) {
      console.error('Chat AI error:', error);
      return this.getStaticResponse(message);
    }
  }

  getStaticResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    const responses = {
      'help': 'I can help you with: Excel upload, customer analysis, letter generation, email sending, and system troubleshooting. What specific task would you like assistance with?',
      
      'excel': 'For Excel upload: Use .xlsx format with columns NAME, ACCOUNT_NO, BALANCE (required), plus EMAIL, MOBILE, LAST_TRANSACTION (optional). Maximum 10MB file size.',
      
      'upload': 'Upload requirements: Excel files only (.xlsx/.xls), required columns: NAME, ACCOUNT_NO, BALANCE. Optional: EMAIL, MOBILE, KYC_STATUS, OUTSTANDING_AMOUNT.',
      
      'account closure': 'Account closure letters target customers with zero balance or no transactions >90 days. Review filtered customers and generate closure notices with reactivation instructions.',
      
      'kyc': 'KYC update notices are for customers with expired documents or missing information. Generate letters requesting document updates with submission deadlines.',
      
      'loan': 'Loan default letters target customers with outstanding amounts. Include payment options and consequences of non-payment in the notice.',
      
      'email': 'For email sending: Ensure customers have valid email addresses, configure SMTP settings, test email connection first. Use bulk sending for large batches.',
      
      'pdf': 'PDFs generate automatically when creating letters. Download individual files or use bulk generation. Include official SBI letterhead and formatting.',
      
      'error': 'For errors: Check file format (.xlsx), verify required columns exist, ensure email configuration is correct, try smaller file sizes if upload fails.',
      
      'templates': 'Letter templates available: Account Closure, KYC Update, Loan Default, Fee Waiver, Document Expiry. Each includes official SBI formatting and compliance language.',
      
      'analyze': 'Customer analysis uses rule-based filtering plus optional AI enhancement. Review confidence scores and priority levels before generating letters.'
    };

    // Find matching response
    for (const [key, response] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        return response;
      }
    }

    // Default response
    return 'I can help with Excel upload, customer analysis, letter generation, and email sending. Try asking about specific features like "excel format" or "account closure" for detailed guidance.';
  }

  async enhanceLetterContent(originalContent, customerData, issueType) {
    if (!this.model) {
      return originalContent; // Return original if AI not available
    }

    try {
      const prompt = `You are a professional letter writer for State Bank of India. Enhance this letter to make it more personalized and effective while maintaining formal banking tone.

Original Letter:
${originalContent}

Customer Information:
${JSON.stringify(customerData, null, 2)}

Issue Type: ${issueType}

Guidelines:
- Maintain professional, respectful tone
- Include relevant customer-specific details
- Add appropriate urgency based on issue type
- Keep SBI branding and format
- Ensure compliance with banking regulations
- Make it actionable with clear next steps

Return only the enhanced letter content:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();

    } catch (error) {
      console.warn('Letter enhancement failed, using original:', error.message);
      return originalContent;
    }
  }

  // Get AI service status
  getStatus() {
    return {
      available: !!this.model,
      provider: 'Google Gemini',
      model: 'gemini-1.5-flash',
      features: {
        customerAnalysis: !!this.model,
        chatbot: !!this.model,
        letterEnhancement: !!this.model
      },
      configured: !!process.env.GEMINI_API_KEY
    };
  }
}

module.exports = new AIService();
