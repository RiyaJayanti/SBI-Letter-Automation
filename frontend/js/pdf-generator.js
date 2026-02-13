// SBI Letter Automation - PDF Generation Module
'use strict';

class PDFGenerator {
    constructor() {
        this.defaultFont = 'helvetica';
        this.defaultFontSize = 10;
        this.pageWidth = 210; // A4 width in mm
        this.pageHeight = 297; // A4 height in mm
        this.margins = { top: 20, right: 20, bottom: 20, left: 20 };
        this.lineHeight = 6;
        
        this.sbiColors = {
            primary: [0, 51, 102],    // SBI Blue
            secondary: [0, 102, 204], // Light Blue
            accent: [255, 193, 7],    // SBI Yellow
            text: [33, 37, 41],       // Dark Gray
            lightText: [108, 117, 125] // Light Gray
        };
    }

    // Generate a single letter PDF
    async generateLetterPDF(letterData, customer) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            // Set up document
            this.setupDocument(doc);
            
            // Add letterhead
            this.addLetterhead(doc);
            
            // Add letter content
            let currentY = this.addLetterContent(doc, letterData, customer);
            
            // Add footer
            this.addFooter(doc, currentY);
            
            return doc;

        } catch (error) {
            console.error('PDF generation error:', error);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    // Generate multiple PDFs as a ZIP file
    async generateBulkPDFs(lettersData, options = {}) {
        const results = [];
        const errors = [];

        for (let i = 0; i < lettersData.length; i++) {
            const { letterData, customer } = lettersData[i];
            
            try {
                const pdf = await this.generateLetterPDF(letterData, customer);
                const filename = this.generateFilename(customer, letterData.issueType);
                
                results.push({
                    pdf,
                    filename,
                    customer: customer.NAME,
                    accountNo: customer.ACCOUNT_NO
                });

                // Progress callback
                if (options.onProgress) {
                    options.onProgress({
                        completed: i + 1,
                        total: lettersData.length,
                        current: customer.NAME
                    });
                }

            } catch (error) {
                errors.push({
                    customer: customer.NAME,
                    accountNo: customer.ACCOUNT_NO,
                    error: error.message
                });
            }
        }

        return { results, errors };
    }

    // Setup basic document properties
    setupDocument(doc) {
        doc.setCreationDate(new Date());
        doc.setProperties({
            title: 'SBI Official Letter',
            subject: 'Banking Communication',
            author: 'State Bank of India',
            creator: 'SBI Letter Automation System',
            producer: 'SBI IT Department'
        });
    }

    // Add SBI letterhead
    addLetterhead(doc) {
        const startY = this.margins.top;
        
        // SBI Logo area (placeholder - in production, add actual logo)
        doc.setFillColor(...this.sbiColors.primary);
        doc.rect(this.margins.left, startY, 30, 15, 'F');
        
        // Bank name
        doc.setFont(this.defaultFont, 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...this.sbiColors.primary);
        doc.text('STATE BANK OF INDIA', this.margins.left + 35, startY + 8);
        
        // Subtitle
        doc.setFont(this.defaultFont, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...this.sbiColors.lightText);
        doc.text('The Banker to Every Indian', this.margins.left + 35, startY + 13);
        
        // Branch details (right aligned)
        doc.setFont(this.defaultFont, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...this.sbiColors.text);
        
        const branchInfo = [
            'Branch Office',
            'Contact: 1800-SBI-1234',
            'Email: customercare@sbi.co.in',
            'www.sbi.co.in'
        ];
        
        let rightX = this.pageWidth - this.margins.right;
        branchInfo.forEach((info, index) => {
            const textWidth = doc.getTextWidth(info);
            doc.text(info, rightX - textWidth, startY + 3 + (index * 4));
        });
        
        // Horizontal line
        doc.setDrawColor(...this.sbiColors.primary);
        doc.setLineWidth(0.5);
        doc.line(this.margins.left, startY + 20, this.pageWidth - this.margins.right, startY + 20);
        
        return startY + 25;
    }

    // Add letter content
    addLetterContent(doc, letterData, customer) {
        let currentY = this.margins.top + 30;
        
        // Date and reference
        doc.setFont(this.defaultFont, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...this.sbiColors.text);
        
        const date = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        doc.text(`Date: ${date}`, this.margins.left, currentY);
        currentY += this.lineHeight;
        
        doc.text(`Reference: SBI/${customer.ACCOUNT_NO}/${new Date().getFullYear()}`, this.margins.left, currentY);
        currentY += this.lineHeight * 2;
        
        // Customer address
        doc.text(`Dear ${customer.NAME},`, this.margins.left, currentY);
        currentY += this.lineHeight * 2;
        
        // Subject line
        doc.setFont(this.defaultFont, 'bold');
        doc.text(`Subject: ${letterData.subject}`, this.margins.left, currentY);
        currentY += this.lineHeight * 2;
        
        // Letter body
        doc.setFont(this.defaultFont, 'normal');
        const contentWidth = this.pageWidth - this.margins.left - this.margins.right;
        
        // Split content into paragraphs
        const paragraphs = letterData.content.split('\n\n');
        
        paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
                const lines = doc.splitTextToSize(paragraph.trim(), contentWidth);
                
                lines.forEach(line => {
                    // Check if we need a new page
                    if (currentY > this.pageHeight - this.margins.bottom - 40) {
                        doc.addPage();
                        currentY = this.margins.top;
                    }
                    
                    doc.text(line, this.margins.left, currentY);
                    currentY += this.lineHeight;
                });
                
                currentY += this.lineHeight; // Extra space between paragraphs
            }
        });
        
        // Signature area
        currentY += this.lineHeight * 2;
        
        if (currentY > this.pageHeight - this.margins.bottom - 40) {
            doc.addPage();
            currentY = this.margins.top;
        }
        
        doc.text('Yours sincerely,', this.margins.left, currentY);
        currentY += this.lineHeight * 4;
        
        doc.setFont(this.defaultFont, 'bold');
        doc.text('[Branch Manager Name]', this.margins.left, currentY);
        currentY += this.lineHeight;
        
        doc.setFont(this.defaultFont, 'normal');
        doc.text('Branch Manager', this.margins.left, currentY);
        currentY += this.lineHeight;
        doc.text('State Bank of India', this.margins.left, currentY);
        
        return currentY + this.lineHeight * 2;
    }

    // Add footer
    addFooter(doc, contentEndY) {
        const footerY = this.pageHeight - this.margins.bottom - 10;
        
        // Footer line
        doc.setDrawColor(...this.sbiColors.lightText);
        doc.setLineWidth(0.3);
        doc.line(this.margins.left, footerY - 5, this.pageWidth - this.margins.right, footerY - 5);
        
        // Footer text
        doc.setFont(this.defaultFont, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...this.sbiColors.lightText);
        
        const footerText = 'This is a computer-generated letter from State Bank of India';
        const textWidth = doc.getTextWidth(footerText);
        const centerX = (this.pageWidth - textWidth) / 2;
        
        doc.text(footerText, centerX, footerY);
        
        // Page number (if multiple pages)
        const pageCount = doc.internal.getNumberOfPages();
        if (pageCount > 1) {
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                const pageText = `Page ${i} of ${pageCount}`;
                const pageTextWidth = doc.getTextWidth(pageText);
                doc.text(pageText, this.pageWidth - this.margins.right - pageTextWidth, footerY);
            }
        }
    }

    // Generate appropriate filename
    generateFilename(customer, issueType) {
        const date = new Date().toISOString().split('T')[0];
        const customerName = customer.NAME.replace(/[^a-zA-Z0-9]/g, '_');
        const accountNo = customer.ACCOUNT_NO;
        
        const typeMap = {
            account_closure: 'AC_CLOSURE',
            kyc_update: 'KYC_UPDATE',
            loan_default: 'LOAN_REMINDER',
            fee_waiver: 'FEE_WAIVER',
            document_expiry: 'DOC_EXPIRY'
        };
        
        const typeCode = typeMap[issueType] || 'LETTER';
        
        return `SBI_${typeCode}_${customerName}_${accountNo}_${date}.pdf`;
    }

    // Download single PDF
    downloadPDF(doc, filename) {
        doc.save(filename);
    }

    // Create and download ZIP file with multiple PDFs
    async downloadBulkPDFs(pdfResults, zipFilename = 'SBI_Letters.zip') {
        try {
            // This would require JSZip library for creating ZIP files
            if (typeof JSZip === 'undefined') {
                // Fallback: download individual PDFs
                pdfResults.forEach(({ pdf, filename }) => {
                    this.downloadPDF(pdf, filename);
                });
                return;
            }

            const zip = new JSZip();
            
            pdfResults.forEach(({ pdf, filename }) => {
                const pdfBlob = pdf.output('blob');
                zip.file(filename, pdfBlob);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // Download ZIP file
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = zipFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Bulk PDF download error:', error);
            throw new Error('Failed to create PDF package');
        }
    }

    // Preview PDF in browser
    previewPDF(doc) {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        // Clean up URL after some time
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    // Get PDF as base64 string
    getPDFBase64(doc) {
        return doc.output('datauristring');
    }

    // Print PDF directly
    printPDF(doc) {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        
        document.body.appendChild(iframe);
        
        iframe.onload = () => {
            iframe.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(url);
            }, 1000);
        };
    }

    // Generate PDF with custom template
    generateCustomPDF(template, data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        this.setupDocument(doc);
        this.addLetterhead(doc);

        // Process template with data
        const processedContent = this.processTemplate(template, data);
        this.addCustomContent(doc, processedContent);
        
        return doc;
    }

    // Process template with customer data
    processTemplate(template, data) {
        let content = template;
        
        // Replace placeholders
        Object.keys(data).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            content = content.replace(placeholder, data[key] || '');
        });

        // Handle conditional sections
        content = content.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, condition, section) => {
            return data[condition] ? section : '';
        });

        return content;
    }

    // Add custom content to PDF
    addCustomContent(doc, content) {
        let currentY = this.margins.top + 30;
        
        doc.setFont(this.defaultFont, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...this.sbiColors.text);
        
        const contentWidth = this.pageWidth - this.margins.left - this.margins.right;
        const lines = doc.splitTextToSize(content, contentWidth);
        
        lines.forEach(line => {
            if (currentY > this.pageHeight - this.margins.bottom - 20) {
                doc.addPage();
                currentY = this.margins.top;
            }
            
            doc.text(line, this.margins.left, currentY);
            currentY += this.lineHeight;
        });
        
        return currentY;
    }
}

// Export for global use
window.PDFGenerator = PDFGenerator;

// Create global instance
window.pdfGenerator = new PDFGenerator();
