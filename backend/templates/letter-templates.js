function generateLetterContent(customer, issueType, customMessage = '') {
  const currentDate = new Date().toLocaleDateString('en-IN');
  const currentYear = new Date().getFullYear();
  
  const templates = {
    account_closure: generateAccountClosureLetter(customer, currentDate, currentYear, customMessage),
    kyc_update: generateKYCUpdateLetter(customer, currentDate, currentYear, customMessage),
    loan_default: generateLoanDefaultLetter(customer, currentDate, currentYear, customMessage),
    fee_waiver: generateFeeWaiverLetter(customer, currentDate, currentYear, customMessage),
    document_expiry: generateDocumentExpiryLetter(customer, currentDate, currentYear, customMessage)
  };

  const letterData = templates[issueType] || templates.account_closure;
  
  return {
    subject: letterData.subject,
    content: letterData.content,
    urgency: letterData.urgency,
    followUpDays: letterData.followUpDays || 30,
    category: issueType
  };
}

function generateAccountClosureLetter(customer, currentDate, currentYear, customMessage) {
  const subject = `Important Notice - Account Status Review - A/C ${customer.ACCOUNT_NO}`;
  
  const content = `STATE BANK OF INDIA
Branch Office

Date: ${currentDate}
Reference: SBI/AC/${customer.ACCOUNT_NO}/${currentYear}

Dear ${customer.NAME},

Subject: Account Inactivity Notice - Account No: ${customer.ACCOUNT_NO}

We hope this letter finds you in good health and prosperity. We are writing to bring to your attention the current status of your Savings Account with our branch.

Account Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account Number: ${customer.ACCOUNT_NO}
Account Holder: ${customer.NAME}
Current Balance: ₹${customer.BALANCE || 0}
Last Transaction Date: ${customer.LAST_TRANSACTION || 'Not Available'}
Account Type: ${customer.ACCOUNT_TYPE || 'Savings Account'}
Branch Code: ${customer.BRANCH_CODE || 'MAIN'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

As per Reserve Bank of India (RBI) guidelines and our bank's policy, accounts showing minimal or no activity for an extended period may be classified as dormant accounts. This classification may lead to certain restrictions on your account operations.

${customMessage ? `\nSpecial Instructions:\n${customMessage}\n` : ''}

To keep your account active and avoid any inconvenience, we request you to:

✓ Make any deposit or withdrawal transaction
✓ Update your contact information (mobile number and email address)
✓ Ensure your KYC documents are current and valid
✓ Visit the branch to confirm your intention to continue the account

Important Points:
• Accounts with zero balance for more than 365 days may be closed as per RBI guidelines
• Closure of account will result in forfeiture of any remaining balance to RBI
• Reactivation after closure involves additional documentation and processes
• No charges will be applied for reactivating your account within the specified period

Please visit our branch within 30 days from the date of this letter with your account passbook and a valid identity proof. Our customer service team will be happy to assist you with the reactivation process.

For any queries or assistance, please contact:
📞 Customer Care: 1800-SBI-1234 (Toll Free)
📧 Email: customercare@sbi.co.in
🌐 Website: www.sbi.co.in

We value your relationship with State Bank of India and look forward to serving you better.

Thank you for banking with us.

Yours sincerely,

[Branch Manager Name]
Branch Manager
State Bank of India
${customer.BRANCH_ADDRESS || 'Branch Address'}

Contact: ${customer.BRANCH_PHONE || '1800-SBI-1234'}
Email: ${customer.BRANCH_EMAIL || 'branch@sbi.co.in'}`;

  return {
    subject,
    content,
    urgency: 'medium',
    followUpDays: 30
  };
}

function generateKYCUpdateLetter(customer, currentDate, currentYear, customMessage) {
  const subject = `Action Required - KYC Document Update - A/C ${customer.ACCOUNT_NO}`;
  
  const content = `STATE BANK OF INDIA
Branch Office

Date: ${currentDate}
Reference: SBI/KYC/${customer.ACCOUNT_NO}/${currentYear}

Dear ${customer.NAME},

Subject: KYC (Know Your Customer) Update Required - Account No: ${customer.ACCOUNT_NO}

Greetings from State Bank of India! We hope you are in the best of health and happiness.

This communication is regarding the mandatory updation of your KYC (Know Your Customer) documents as per the directives issued by the Reserve Bank of India (RBI) and to ensure compliance with the Prevention of Money Laundering Act (PMLA).

Current Account Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account Number: ${customer.ACCOUNT_NO}
Account Holder: ${customer.NAME}
Mobile Number: ${customer.MOBILE || 'Not Available - Update Required'}
Email Address: ${customer.EMAIL || 'Not Available - Update Required'}
KYC Status: ${customer.KYC_STATUS || 'Pending Update'}
Last KYC Update: ${customer.LAST_KYC_UPDATE || 'Not Available'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

As per RBI mandates, all bank customers must maintain updated KYC records to continue enjoying uninterrupted banking services. Non-compliance may result in restrictions on your account operations.

${customMessage ? `\nAdditional Information:\n${customMessage}\n` : ''}

Required Documents (Please bring originals for verification):

📋 IDENTITY PROOF (Any one of the following):
   • Aadhaar Card
   • PAN Card
   • Passport
   • Driving License
   • Voter ID Card

📋 ADDRESS PROOF (Any one of the following):
   • Aadhaar Card
   • Utility Bills (Electricity/Gas/Water) - Not older than 3 months
   • Bank Statement from another bank - Not older than 3 months
   • Rental Agreement (if staying in rented accommodation)
   • Property Tax Receipt

📋 ADDITIONAL REQUIREMENTS:
   • Recent passport-size photographs (2 copies)
   • Income proof (Salary Certificate/ITR) - if required
   • Form 60 (if PAN not available and transaction value exceeds limit)

Convenient KYC Update Options:

🏪 BRANCH VISIT:
   Visit any SBI branch during business hours (10:00 AM to 4:00 PM, Monday to Friday)
   Saturday: 10:00 AM to 2:00 PM (except 2nd & 4th Saturday)

💻 DIGITAL KYC:
   • SBI YONO App - Digital KYC facility
   • Internet Banking - Upload documents online
   • Video KYC - Schedule appointment through app

📱 VIDEO KYC:
   Complete KYC process from home through video call with bank officials
   Available Monday to Friday: 9:00 AM to 6:00 PM

Important Notes:
• KYC update is mandatory and free of cost
• Failure to update KYC may result in account restrictions
• All documents will be verified and returned immediately
• Keep your mobile number and email updated for important communications

For assistance or to schedule Video KYC:
📞 Customer Care: 1800-SBI-1234 (Toll Free)
📞 KYC Helpline: 1800-SBI-5678
📧 Email: kyc@sbi.co.in
🌐 Website: www.sbi.co.in/kyc

We appreciate your cooperation in complying with regulatory requirements and thank you for choosing State Bank of India as your banking partner.

Warm regards,

[Branch Manager Name]
Branch Manager
State Bank of India
${customer.BRANCH_ADDRESS || 'Branch Address'}`;

  return {
    subject,
    content,
    urgency: 'high',
    followUpDays: 15
  };
}

function generateLoanDefaultLetter(customer, currentDate, currentYear, customMessage) {
  const subject = `Urgent Payment Reminder - Loan A/C ${customer.LOAN_ACCOUNT_NO || customer.ACCOUNT_NO}`;
  
  const content = `STATE BANK OF INDIA
Credit Department

Date: ${currentDate}
Reference: SBI/LOAN/${customer.LOAN_ACCOUNT_NO || customer.ACCOUNT_NO}/${currentYear}

Dear ${customer.NAME},

Subject: Payment Reminder - Loan Account No: ${customer.LOAN_ACCOUNT_NO || customer.ACCOUNT_NO}

We hope this letter finds you in good health. This communication is regarding your loan account with our branch, and we notice that your Equated Monthly Installment (EMI) payment is overdue.

Loan Account Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Loan Account Number: ${customer.LOAN_ACCOUNT_NO || customer.ACCOUNT_NO}
Borrower Name: ${customer.NAME}
Outstanding Principal: ₹${customer.OUTSTANDING_AMOUNT || 'Please Contact Branch'}
EMI Amount: ₹${customer.EMI_AMOUNT || 'Please Contact Branch'}
Due Date: ${customer.DUE_DATE || 'Overdue'}
Overdue Amount: ₹${customer.OVERDUE_AMOUNT || 'Please Contact Branch'}
Days Overdue: ${customer.OVERDUE_DAYS || 'Please Contact Branch'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We understand that sometimes unforeseen circumstances may cause temporary financial difficulties. However, it is important to clear the overdue amount at the earliest to avoid any adverse impact on your credit profile.

${customMessage ? `\nImportant Notice:\n${customMessage}\n` : ''}

Immediate Action Required:
Please clear the overdue amount immediately to avoid:

⚠️ CONSEQUENCES OF NON-PAYMENT:
• Additional penalty charges and late payment fees
• Negative reporting to Credit Information Companies (CIBIL, Equifax, etc.)
• Adverse impact on your credit score and future loan eligibility
• Legal action as per the terms and conditions of your loan agreement
• Recovery proceedings including attachment of collateral/security
• Additional interest on overdue amounts

💳 CONVENIENT PAYMENT OPTIONS:

🏪 Branch Payment:
   Visit any SBI branch with cash, cheque, or demand draft
   Branch Hours: 10:00 AM to 4:00 PM (Monday to Friday)

💻 Online Payment:
   • SBI Net Banking - Loan Repayment Section
   • SBI YONO App - Pay Loan EMI
   • NEFT/RTGS to your loan account
   • UPI Payment using loan account number

📱 Mobile Banking:
   • SMS Banking: Send SMS to 56161
   • Missed Call Banking: 1800-SBI-1111

🏧 ATM Payment:
   Use SBI ATM cash deposit or fund transfer facility

📞 Phone Banking:
   Call 1800-SBI-1234 for assisted payment

💰 Payment Assistance Available:
If you are facing genuine financial difficulties, we offer:
• EMI rescheduling options
• Loan restructuring facility
• Moratorium period (subject to bank's discretion)
• One-time settlement schemes (for eligible accounts)

Please contact our loan department immediately to discuss available options.

🆘 For Immediate Assistance:
📞 Loan Department: 1800-SBI-5555
📞 Customer Care: 1800-SBI-1234 (24x7)
📧 Email: loans@sbi.co.in
🏪 Visit Branch: ${customer.BRANCH_ADDRESS || 'Your Home Branch'}

We value your relationship with State Bank of India and are committed to helping you through any financial challenges. Please contact us immediately to resolve this matter amicably.

Yours faithfully,

[Credit Manager Name]
Credit Manager
State Bank of India
${customer.BRANCH_ADDRESS || 'Branch Address'}

⚠️ URGENT: Please act immediately to avoid further complications and maintain your creditworthiness.`;

  return {
    subject,
    content,
    urgency: 'high',
    followUpDays: 7
  };
}

function generateFeeWaiverLetter(customer, currentDate, currentYear, customMessage) {
  const subject = `Fee Waiver Approval - Account ${customer.ACCOUNT_NO}`;
  
  const content = `STATE BANK OF INDIA
Customer Service Department

Date: ${currentDate}
Reference: SBI/FW/${customer.ACCOUNT_NO}/${currentYear}

Dear ${customer.NAME},

Subject: Fee Waiver Notification - Account No: ${customer.ACCOUNT_NO}

We are pleased to inform you about the approval of fee waiver for your account based on your eligibility criteria and as per the bank's customer-friendly policies.

Account & Waiver Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account Number: ${customer.ACCOUNT_NO}
Account Holder: ${customer.NAME}
Customer Category: ${customer.CUSTOMER_CATEGORY || 'Valued Customer'}
Account Type: ${customer.ACCOUNT_TYPE || 'Savings Account'}
Waiver Type: ${customer.WAIVER_TYPE || 'Service Charges Waiver'}
Effective Date: ${currentDate}
Valid Until: ${customer.WAIVER_VALIDITY || 'One year from approval date'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${customMessage ? `\nSpecial Conditions:\n${customMessage}\n` : ''}

🎉 Fees Covered Under This Waiver:

✅ Monthly/Quarterly Account Maintenance Charges
✅ SMS Alert Charges for account transactions
✅ Cheque Book Issuance Charges (Regular)
✅ Online Fund Transfer Charges (NEFT/IMPS) - as per scheme
✅ ATM Transaction Charges beyond free limit
✅ Statement Generation Charges
✅ Balance Inquiry Charges (Non-SBI ATMs)

📋 Terms and Conditions:

• This waiver is applicable as per your customer category and account type
• Waiver is subject to maintaining minimum monthly average balance as required
• Some charges may still apply for premium services not covered under this scheme
• Waiver validity is for one year and may be renewed based on eligibility review
• Bank reserves the right to modify or withdraw the waiver with prior notice

🏆 Additional Benefits:
As a valued customer, you also enjoy:
• Priority customer service at branch
• Preferential rates on deposits and loans (subject to eligibility)
• Complimentary insurance coverage (as per scheme terms)
• Access to exclusive banking products and offers

📞 For any queries regarding this waiver or your account:
Customer Care: 1800-SBI-1234 (Toll Free, 24x7)
Email: customercare@sbi.co.in
Branch Contact: ${customer.BRANCH_PHONE || '1800-SBI-1234'}

We thank you for your continued trust in State Bank of India and look forward to serving you with excellence.

Warm regards,

[Customer Relationship Manager]
Customer Service Department
State Bank of India
${customer.BRANCH_ADDRESS || 'Branch Address'}`;

  return {
    subject,
    content,
    urgency: 'low',
    followUpDays: 365
  };
}

function generateDocumentExpiryLetter(customer, currentDate, currentYear, customMessage) {
  const subject = `Document Renewal Required - Account ${customer.ACCOUNT_NO}`;
  
  const content = `STATE BANK OF INDIA
Compliance Department

Date: ${currentDate}
Reference: SBI/DOC/${customer.ACCOUNT_NO}/${currentYear}

Dear ${customer.NAME},

Subject: Important - Document Expiry Notification - Account No: ${customer.ACCOUNT_NO}

We hope this communication finds you in the best of health and prosperity. This is to notify you that some of your important documents linked to your bank account are approaching their expiry date.

Account & Document Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account Number: ${customer.ACCOUNT_NO}
Account Holder: ${customer.NAME}
Document Type: ${customer.DOC_TYPE || 'Identity/Address Proof'}
Document Number: ${customer.DOC_NUMBER || 'Please refer to your records'}
Current Expiry Date: ${customer.DOC_EXPIRY || 'Soon'}
Days Remaining: ${customer.DAYS_TO_EXPIRY || 'Limited time remaining'}
Status: ${customer.DOC_STATUS || 'Renewal Required'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To ensure uninterrupted banking services and compliance with regulatory requirements, please update your documents before the expiry date. Failure to update may result in temporary restrictions on your account.

${customMessage ? `\nAdditional Requirements:\n${customMessage}\n` : ''}

📋 Acceptable Identity Proof Documents:
✅ Aadhaar Card (Preferred - No expiry)
✅ PAN Card (Permanent)
✅ Passport (Check validity)
✅ Driving License (Check validity)
✅ Voter ID Card
✅ Government Employee ID
✅ Pensioner Card

📋 Acceptable Address Proof Documents:
✅ Aadhaar Card (Preferred - Always current)
✅ Utility Bills (Electricity/Gas/Water) - Not older than 3 months
✅ Bank Account Statement - Not older than 3 months
✅ Rental Agreement with Revenue Stamp
✅ Property Registration Documents
✅ Municipal Tax Receipt (Current year)
✅ Employer Certificate with address

🏪 Document Update Options:

1️⃣ BRANCH VISIT (Recommended):
   • Visit your home branch or any SBI branch
   • Bring original documents for verification
   • Copies will be made and attested by bank staff
   • Immediate update in bank records
   • Branch Hours: 10:00 AM - 4:00 PM (Mon-Fri)

2️⃣ DIGITAL SUBMISSION:
   • SBI YONO Mobile App - Document Upload Section
   • Internet Banking - Profile Update
   • High-quality scanned copies required
   • Subject to verification and approval

3️⃣ VIDEO KYC SERVICE:
   • Schedule appointment through YONO App
   • Complete process from home via video call
   • Available: Monday to Friday, 9:00 AM - 6:00 PM
   • Required: Good internet connection and smartphone

📱 How to Schedule Video KYC:
1. Download SBI YONO App
2. Login to your account
3. Go to 'Services' > 'Update KYC'
4. Select 'Video KYC' option
5. Choose convenient time slot
6. Keep documents ready for verification

⚠️ Important Reminders:
• Document update service is completely FREE
• Never share your banking details with unauthorized persons
• Bank officials will never ask for sensitive information over phone/email
• Always verify the identity of anyone claiming to represent the bank

🆘 Need Assistance?
📞 Customer Care: 1800-SBI-1234 (Toll Free, 24x7)
📞 Document Helpline: 1800-SBI-5678
📧 Email: documents@sbi.co.in
💬 Chat Support: Available on SBI website
🏪 Branch Address: ${customer.BRANCH_ADDRESS || 'Your Home Branch'}

We appreciate your prompt attention to this important matter and thank you for your continued association with State Bank of India.

Sincerely,

[Compliance Officer Name]
Compliance Department
State Bank of India
${customer.BRANCH_ADDRESS || 'Branch Address'}

📅 Action Required: Please update your documents within 15 days to avoid any service disruption.`;

  return {
    subject,
    content,
    urgency: 'high',
    followUpDays: 15
  };
}

function getAvailableTemplates() {
  return {
    account_closure: {
      name: 'Account Closure Notice',
      description: 'For inactive accounts or accounts with zero balance',
      category: 'Account Management',
      urgency: 'medium',
      followUpDays: 30
    },
    kyc_update: {
      name: 'KYC Update Required',
      description: 'For customers with expired or missing KYC documents',
      category: 'Compliance',
      urgency: 'high',
      followUpDays: 15
    },
    loan_default: {
      name: 'Loan Payment Reminder',
      description: 'For customers with overdue loan payments',
      category: 'Credit Management',
      urgency: 'high',
      followUpDays: 7
    },
    fee_waiver: {
      name: 'Fee Waiver Information',
      description: 'For eligible customers (senior citizens, students, etc.)',
      category: 'Customer Service',
      urgency: 'low',
      followUpDays: 365
    },
    document_expiry: {
      name: 'Document Expiry Notice',
      description: 'For customers with expiring identity or address documents',
      category: 'Compliance',
      urgency: 'high',
      followUpDays: 15
    }
  };
}

module.exports = {
  generateLetterContent,
  getAvailableTemplates
};
