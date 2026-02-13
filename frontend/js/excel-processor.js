// SBI Letter Automation - Excel Processing Module
'use strict';

class ExcelProcessor {
    constructor() {
        this.supportedFormats = ['.xlsx', '.xls'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.requiredColumns = ['NAME', 'ACCOUNT_NO', 'BALANCE'];
        this.optionalColumns = ['EMAIL', 'MOBILE', 'LAST_TRANSACTION', 'ACCOUNT_TYPE', 'KYC_STATUS', 'OUTSTANDING_AMOUNT'];
    }

    // Validate Excel file before processing
    validateFile(file) {
        const errors = [];

        // Check file existence
        if (!file) {
            errors.push('No file selected');
            return { isValid: false, errors };
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            errors.push(`File size exceeds ${this.maxFileSize / (1024 * 1024)}MB limit`);
        }

        // Check file extension
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.supportedFormats.includes(extension)) {
            errors.push(`Unsupported file format. Allowed: ${this.supportedFormats.join(', ')}`);
        }

        // Check file name for invalid characters
        if (!/^[a-zA-Z0-9._\-\s]+$/.test(file.name)) {
            errors.push('File name contains invalid characters');
        }

        return {
            isValid: errors.length === 0,
            errors,
            fileInfo: {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: new Date(file.lastModified)
            }
        };
    }

    // Process Excel file and extract data
    async processFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { 
                        type: 'array',
                        cellDates: true,
                        cellNF: false,
                        cellText: false
                    });

                    // Process all sheets and find the best one
                    const sheetAnalysis = this.analyzeSheets(workbook);
                    const bestSheet = this.selectBestSheet(sheetAnalysis);

                    if (!bestSheet) {
                        throw new Error('No valid data sheet found in the Excel file');
                    }

                    // Extract data from the selected sheet
                    const rawData = this.extractSheetData(workbook, bestSheet.name);
                    
                    // Validate and clean data
                    const processedData = this.validateAndCleanData(rawData);

                    resolve({
                        success: true,
                        data: processedData.data,
                        metadata: {
                            fileName: file.name,
                            fileSize: file.size,
                            totalRows: processedData.data.length,
                            selectedSheet: bestSheet.name,
                            availableSheets: workbook.SheetNames,
                            columns: processedData.columns,
                            warnings: processedData.warnings,
                            processedAt: new Date().toISOString()
                        }
                    });

                } catch (error) {
                    reject(new Error(`Excel processing failed: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read Excel file'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // Analyze all sheets in the workbook
    analyzeSheets(workbook) {
        const analysis = [];

        workbook.SheetNames.forEach(sheetName => {
            try {
                const worksheet = workbook.Sheets[sheetName];
                const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
                const rowCount = range.e.r - range.s.r + 1;
                const colCount = range.e.c - range.s.c + 1;

                // Get first few rows to analyze structure
                const sampleData = XLSX.utils.sheet_to_json(worksheet, { 
                    range: 0,
                    header: 1,
                    defval: '',
                    blankrows: false
                });

                const columns = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];
                const hasRequiredColumns = this.checkRequiredColumns(columns);
                const dataQuality = this.assessDataQuality(sampleData.slice(0, 10));

                analysis.push({
                    name: sheetName,
                    rowCount,
                    colCount,
                    columns,
                    hasRequiredColumns,
                    dataQuality,
                    sampleRowCount: sampleData.length,
                    score: this.calculateSheetScore(hasRequiredColumns, dataQuality, sampleData.length)
                });

            } catch (error) {
                console.warn(`Failed to analyze sheet "${sheetName}":`, error);
                analysis.push({
                    name: sheetName,
                    error: error.message,
                    score: 0
                });
            }
        });

        return analysis;
    }

    // Select the best sheet based on analysis
    selectBestSheet(analysis) {
        const validSheets = analysis.filter(sheet => !sheet.error && sheet.score > 0);
        
        if (validSheets.length === 0) {
            return null;
        }

        // Sort by score (highest first) and return the best
        validSheets.sort((a, b) => b.score - a.score);
        return validSheets[0];
    }

    // Check if sheet has required columns
    checkRequiredColumns(columns) {
        const normalizedColumns = columns.map(col => col.toUpperCase().trim());
        const normalizedRequired = this.requiredColumns.map(col => col.toUpperCase());
        
        return {
            hasAll: normalizedRequired.every(req => normalizedColumns.includes(req)),
            missing: normalizedRequired.filter(req => !normalizedColumns.includes(req)),
            found: normalizedRequired.filter(req => normalizedColumns.includes(req)),
            extra: normalizedColumns.filter(col => !normalizedRequired.includes(col))
        };
    }

    // Assess data quality of sample rows
    assessDataQuality(sampleData) {
        if (!sampleData || sampleData.length === 0) {
            return { score: 0, issues: ['No data found'] };
        }

        const issues = [];
        let score = 100;

        // Check for empty rows
        const emptyRows = sampleData.filter(row => 
            Object.values(row).every(val => val === '' || val === null || val === undefined)
        ).length;
        
        if (emptyRows > 0) {
            issues.push(`${emptyRows} empty rows found`);
            score -= (emptyRows / sampleData.length) * 30;
        }

        // Check required field completeness
        this.requiredColumns.forEach(col => {
            const emptyCount = sampleData.filter(row => !row[col] || row[col] === '').length;
            if (emptyCount > 0) {
                issues.push(`${col}: ${emptyCount} empty values`);
                score -= (emptyCount / sampleData.length) * 20;
            }
        });

        // Check data type consistency
        const accountNumbers = sampleData.map(row => row.ACCOUNT_NO).filter(Boolean);
        const invalidAccounts = accountNumbers.filter(acc => !/^\d{8,16}$/.test(String(acc))).length;
        if (invalidAccounts > 0) {
            issues.push(`${invalidAccounts} invalid account numbers`);
            score -= (invalidAccounts / accountNumbers.length) * 15;
        }

        // Check email format if present
        if (sampleData.some(row => row.EMAIL)) {
            const emails = sampleData.map(row => row.EMAIL).filter(Boolean);
            const invalidEmails = emails.filter(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).length;
            if (invalidEmails > 0) {
                issues.push(`${invalidEmails} invalid email formats`);
                score -= (invalidEmails / emails.length) * 10;
            }
        }

        return {
            score: Math.max(0, score),
            issues,
            completeness: Math.round(((sampleData.length - emptyRows) / sampleData.length) * 100)
        };
    }

    // Calculate overall sheet score
    calculateSheetScore(requiredColumns, dataQuality, rowCount) {
        let score = 0;

        // Required columns weight: 40%
        if (requiredColumns.hasAll) {
            score += 40;
        } else {
            score += (requiredColumns.found.length / requiredColumns.missing.length) * 40;
        }

        // Data quality weight: 40%
        score += (dataQuality.score / 100) * 40;

        // Row count weight: 20%
        if (rowCount > 0) {
            score += Math.min(20, rowCount / 10); // Max 20 points, 1 point per 10 rows
        }

        return Math.round(score);
    }

    // Extract data from selected sheet
    extractSheetData(workbook, sheetName) {
        const worksheet = workbook.Sheets[sheetName];
        
        return XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false,
            raw: false,
            dateNF: 'yyyy-mm-dd'
        });
    }

    // Validate and clean the extracted data
    validateAndCleanData(rawData) {
        if (!rawData || rawData.length === 0) {
            throw new Error('No data found in Excel sheet');
        }

        // First row should be headers
        const headers = rawData[0];
        const dataRows = rawData.slice(1);

        if (!headers || headers.length === 0) {
            throw new Error('No column headers found');
        }

        // Normalize headers
        const normalizedHeaders = headers.map(header => 
            String(header).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        );

        // Check for duplicate headers
        const duplicateHeaders = normalizedHeaders.filter((header, index) => 
            normalizedHeaders.indexOf(header) !== index
        );
        
        if (duplicateHeaders.length > 0) {
            throw new Error(`Duplicate column headers found: ${duplicateHeaders.join(', ')}`);
        }

        // Convert rows to objects
        const processedData = [];
        const warnings = [];

        dataRows.forEach((row, index) => {
            const rowNumber = index + 2; // +2 because we skip header row and use 1-based indexing
            
            // Skip completely empty rows
            if (row.every(cell => cell === '' || cell === null || cell === undefined)) {
                warnings.push(`Row ${rowNumber}: Empty row skipped`);
                return;
            }

            const rowData = {};
            let hasRequiredData = false;

            headers.forEach((header, colIndex) => {
                const normalizedHeader = normalizedHeaders[colIndex];
                let cellValue = row[colIndex] || '';

                // Clean and process cell value
                if (typeof cellValue === 'string') {
                    cellValue = cellValue.trim();
                }

                // Special processing for specific columns
                if (normalizedHeader === 'ACCOUNT_NO') {
                    cellValue = String(cellValue).replace(/[^\d]/g, '');
                    if (cellValue && (cellValue.length < 8 || cellValue.length > 16)) {
                        warnings.push(`Row ${rowNumber}: Invalid account number length`);
                    }
                }

                if (normalizedHeader === 'BALANCE' || normalizedHeader === 'OUTSTANDING_AMOUNT') {
                    cellValue = parseFloat(String(cellValue).replace(/[^\d.-]/g, '')) || 0;
                }

                if (normalizedHeader === 'EMAIL' && cellValue) {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cellValue)) {
                        warnings.push(`Row ${rowNumber}: Invalid email format`);
                        cellValue = '';
                    }
                }

                if (normalizedHeader === 'MOBILE' && cellValue) {
                    cellValue = String(cellValue).replace(/[^\d]/g, '');
                    if (cellValue.length < 10 || cellValue.length > 15) {
                        warnings.push(`Row ${rowNumber}: Invalid mobile number`);
                        cellValue = '';
                    }
                }

                rowData[normalizedHeader] = cellValue;

                // Check if this row has required data
                if (this.requiredColumns.includes(normalizedHeader) && cellValue) {
                    hasRequiredData = true;
                }
            });

            // Only include rows with at least some required data
            if (hasRequiredData) {
                rowData._rowNumber = rowNumber;
                processedData.push(rowData);
            } else {
                warnings.push(`Row ${rowNumber}: Missing all required data, skipped`);
            }
        });

        if (processedData.length === 0) {
            throw new Error('No valid data rows found');
        }

        return {
            data: processedData,
            columns: normalizedHeaders,
            warnings: warnings.slice(0, 20) // Limit warnings to first 20
        };
    }

    // Export processed data to Excel
    exportToExcel(data, filename = 'SBI_Processed_Data.xlsx') {
        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            // Set column widths
            const columnWidths = [
                { wch: 20 }, // NAME
                { wch: 15 }, // ACCOUNT_NO
                { wch: 12 }, // BALANCE
                { wch: 25 }, // EMAIL
                { wch: 15 }, // MOBILE
                { wch: 15 }, // LAST_TRANSACTION
                { wch: 12 }  // ACCOUNT_TYPE
            ];
            ws['!cols'] = columnWidths;

            XLSX.utils.book_append_sheet(wb, ws, 'Processed_Data');
            XLSX.writeFile(wb, filename);

            return { success: true, filename };

        } catch (error) {
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    // Generate data statistics
    generateStatistics(data) {
        if (!data || data.length === 0) {
            return null;
        }

        const stats = {
            totalRecords: data.length,
            columnStats: {},
            dataTypes: {},
            completeness: {}
        };

        // Analyze each column
        const columns = Object.keys(data[0]);
        columns.forEach(column => {
            const values = data.map(row => row[column]).filter(val => val !== '' && val !== null && val !== undefined);
            
            stats.columnStats[column] = {
                totalValues: values.length,
                emptyValues: data.length - values.length,
                completeness: Math.round((values.length / data.length) * 100),
                uniqueValues: new Set(values).size
            };

            // Determine data type
            if (column === 'BALANCE' || column === 'OUTSTANDING_AMOUNT') {
                stats.dataTypes[column] = 'number';
                stats.columnStats[column].min = Math.min(...values.map(v => parseFloat(v) || 0));
                stats.columnStats[column].max = Math.max(...values.map(v => parseFloat(v) || 0));
                stats.columnStats[column].average = values.reduce((sum, v) => sum + (parseFloat(v) || 0), 0) / values.length;
            } else if (column === 'EMAIL') {
                stats.dataTypes[column] = 'email';
                stats.columnStats[column].validEmails = values.filter(email => 
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                ).length;
            } else if (column === 'MOBILE') {
                stats.dataTypes[column] = 'phone';
                stats.columnStats[column].validMobiles = values.filter(mobile => 
                    /^\d{10,15}$/.test(String(mobile).replace(/[^\d]/g, ''))
                ).length;
            } else {
                stats.dataTypes[column] = 'text';
            }
        });

        return stats;
    }
}

// Export for global use
window.ExcelProcessor = ExcelProcessor;

// Create global instance
window.excelProcessor = new ExcelProcessor();
