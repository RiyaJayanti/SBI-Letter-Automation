// SBI Letter Automation System - Main Application Logic
'use strict';

// -----------------------------
// Runtime inline-onclick migrator + robust initializer
// Paste this block *exactly* after 'use strict'; at the top of js/app.js
// -----------------------------

/**
 * migrateInlineOnclicks()
 * - Scans the DOM for elements that still have inline `onclick` attributes
 * - Converts a number of common safe inline patterns into proper addEventListener handlers
 * - Removes the inline attribute so the browser won't attempt to execute it (avoids CSP violation)
 *
 * NOTE: This intentionally *does not* eval arbitrary JS. It only recognizes these patterns:
 *   - fnName()
 *   - fnName('stringArg')
 *   - document.getElementById('someId').click()
 *   - clearFile() (or other single token functions)
 *
 * If an inline attribute contains multiple statements or unknown/unsafe code it will be removed and a warning logged.
 */
function migrateInlineOnclicks() {
    try {
        const els = Array.from(document.querySelectorAll('[onclick]'));
        if (!els.length) return;

        els.forEach(el => {
            try {
                const codeRaw = el.getAttribute('onclick') || '';
                const code = codeRaw.trim();

                if (!code) {
                    el.removeAttribute('onclick');
                    return;
                }

                // 1) pattern: fnName()
                let m = code.match(/^([a-zA-Z0-9_]+)\(\)\s*;?\s*$/);
                if (m) {
                    const fn = m[1];
                    el.addEventListener('click', (ev) => {
                        try {
                            if (typeof window[fn] === 'function') {
                                window[fn]();
                            } else {
                                console.warn(`migrateInlineOnclicks: function ${fn} not found`);
                            }
                        } catch (innerErr) {
                            console.error(`migrateInlineOnclicks: error calling ${fn}():`, innerErr);
                        }
                    }, { passive: false });
                    el.removeAttribute('onclick');
                    return;
                }

                // 2) pattern: fnName('singleStringArg')
                m = code.match(/^([a-zA-Z0-9_]+)\('([^']*)'\)\s*;?\s*$/);
                if (m) {
                    const fn = m[1];
                    const arg = m[2];
                    el.addEventListener('click', (ev) => {
                        try {
                            if (typeof window[fn] === 'function') {
                                window[fn](arg);
                            } else {
                                console.warn(`migrateInlineOnclicks: function ${fn} not found`);
                            }
                        } catch (innerErr) {
                            console.error(`migrateInlineOnclicks: error calling ${fn}('${arg}'):`, innerErr);
                        }
                    }, { passive: false });
                    el.removeAttribute('onclick');
                    return;
                }

                // 3) pattern: document.getElementById('someId').click()
                m = code.match(/^document\.getElementById\('([^']+)'\)\.click\(\)\s*;?\s*$/);
                if (m) {
                    const targetId = m[1];
                    el.addEventListener('click', (ev) => {
                        try {
                            const target = document.getElementById(targetId);
                            if (target) target.click();
                            else console.warn(`migrateInlineOnclicks: target #${targetId} not found`);
                        } catch (innerErr) {
                            console.error(`migrateInlineOnclicks: error triggering click on #${targetId}:`, innerErr);
                        }
                    }, { passive: false });
                    el.removeAttribute('onclick');
                    return;
                }

                // 4) fallback single-token function with optional whitespace, e.g. clearFile
                m = code.match(/^([a-zA-Z0-9_]+)\s*;?\s*$/);
                if (m) {
                    const fn = m[1];
                    el.addEventListener('click', (ev) => {
                        try {
                            if (typeof window[fn] === 'function') {
                                window[fn]();
                            } else {
                                console.warn(`migrateInlineOnclicks: function ${fn} not found`);
                            }
                        } catch (innerErr) {
                            console.error(`migrateInlineOnclicks: error calling ${fn}():`, innerErr);
                        }
                    }, { passive: false });
                    el.removeAttribute('onclick');
                    return;
                }

                // If we get here: unsupported inline content — remove it to avoid CSP errors, but log it.
                console.warn('migrateInlineOnclicks: removed unsupported inline handler:', codeRaw, el);
                el.removeAttribute('onclick');

            } catch (perElErr) {
                console.error('migrateInlineOnclicks: per-element error:', perElErr);
                try { el.removeAttribute('onclick'); } catch (e) { /* ignore */ }
            }
        });
    } catch (err) {
        console.error('migrateInlineOnclicks: fatal error', err);
    }
}

/**
 * robustInitialize()
 * - A safer DOMContentLoaded initializer which ensures:
 *   * app init functions run once
 *   * loading screen is hidden even on errors
 *   * inline onclick migration runs before user interaction
 *
 * Place this call in your file instead of ad-hoc DOMContentLoaded blocks OR keep it together as the main initializer.
 */
function robustInitialize() {
    // Ensure idempotent initialization
    if (window.__SBI_APP_INITIALIZED) return;
    window.__SBI_APP_INITIALIZED = true;

    // First, migrate inline handlers to avoid CSP refusal when elements are clicked
    try {
        migrateInlineOnclicks();
    } catch (e) {
        console.warn('robustInitialize: migrateInlineOnclicks failed', e);
    }

    // Give the browser a short tick to ensure all DOM nodes are present (helps in single-page dev environments)
    setTimeout(() => {
        try {
            if (typeof initializeApp === 'function') {
                initializeApp();
            } else {
                console.warn('robustInitialize: initializeApp() not found');
            }

            if (typeof setupDragAndDrop === 'function') {
                try { setupDragAndDrop(); } catch (e) { console.warn('setupDragAndDrop() error', e); }
            }

            if (typeof loadInitialData === 'function') {
                try { loadInitialData(); } catch (e) { console.warn('loadInitialData() error', e); }
            } else if (typeof loadApplicationData === 'function') {
                try { loadApplicationData(); } catch (e) { console.warn('loadApplicationData() error', e); }
            }

        } catch (initErr) {
            console.error('robustInitialize: initialization error', initErr);
        } finally {
            // Always hide the loading screen after init attempt (prevents stuck loading)
            try {
                const loadingScreen = document.getElementById('loadingScreen');
                if (loadingScreen) {
                    loadingScreen.style.display = 'none';
                }
            } catch (hideErr) {
                console.warn('robustInitialize: failed to hide loadingScreen', hideErr);
            }
        }
    }, 50);
}

// Attach robustInitialize to DOMContentLoaded and also run immediately if DOM is already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', robustInitialize);
} else {
    // DOM already loaded (hot reload / dev tools case)
    setTimeout(robustInitialize, 0);
}


// Global Application State
const AppState = {
    customers: [],
    filteredCustomers: [],
    selectedCustomers: [],
    currentIssueType: '',
    isProcessing: false,
    currentPage: 1,
    itemsPerPage: 20,
    analytics: {
        totalCustomers: 0,
        lettersGenerated: 0,
        emailsSent: 0,
        pendingActions: 0
    }
};

// Application Configuration
const AppConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['.xlsx', '.xls'],
    apiBaseUrl: '/api',
    enableAI: true,
    enableAnalytics: true,
    autoSave: true
};

// Initialize Application
function initializeApp() {
    console.log('🚀 Initializing SBI Letter Automation System...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    loadApplicationData();
    
    // Initialize components
    initializeComponents();
    
    console.log('✅ Application initialized successfully');
}

function setupEventListeners() {
    // File upload events
    const excelFile = document.getElementById('excelFile');
    if (excelFile) {
        excelFile.addEventListener('change', handleFileUpload);
    }
    
    // Issue type selection
    const issueType = document.getElementById('issueType');
    if (issueType) {
        issueType.addEventListener('change', handleIssueTypeChange);
    }
    
    // Confidence threshold
    const confidenceThreshold = document.getElementById('confidenceThreshold');
    if (confidenceThreshold) {
        confidenceThreshold.addEventListener('input', updateConfidenceDisplay);
    }
    
    // Search functionality
    const customerSearch = document.getElementById('customerSearch');
    if (customerSearch) {
        customerSearch.addEventListener('input', debounce(filterCustomers, 300));
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Window events
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('resize', handleWindowResize);
}

// Add this missing function
function loadInitialData() {
    console.log('📊 Loading initial data...');
    
    // Load sample statistics or any initial data
    try {
        // Update initial statistics
        updateStatistics();
        
        // Load any cached data from localStorage
        const cachedStats = localStorage.getItem('sbi-app-stats');
        if (cachedStats) {
            try {
                const stats = JSON.parse(cachedStats);
                AppState.analytics = { ...AppState.analytics, ...stats };
                updateStatistics();
            } catch (error) {
                console.warn('Failed to load cached stats:', error);
            }
        }
        
        console.log('✅ Initial data loaded successfully');
    } catch (error) {
        console.warn('⚠️ Initial data loading failed:', error);
    }
}


function loadApplicationData() {
    // Load stats
    updateStatistics();
    
    // Load user preferences
    loadUserPreferences();
    
    // Check system status
    checkSystemStatus();
}

function initializeComponents() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    
    // Initialize analytics charts if on analytics page
    if (document.getElementById('lettersChart')) {
        initializeAnalyticsCharts();
    }
    
    // Setup drag and drop
    setupDragAndDrop();
}

// File Upload Handling
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Validate file
        if (!validateFile(file)) return;
        
        // Show upload progress
        showUploadProgress(true);
        updateUploadStatus('uploading', `Uploading ${file.name}...`);
        
        // Display file info
        displayFileInfo(file);
        
        // Process file
        await processExcelFile(file);
        
        // Show success
        updateUploadStatus('success', `Successfully loaded ${AppState.customers.length} customers`);
        
        // Enable next step
        document.getElementById('issueSection').style.display = 'block';
        document.getElementById('issueSection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('File upload error:', error);
        updateUploadStatus('error', `Error: ${error.message}`);
        showToast('File Upload Failed', error.message, 'error');
    } finally {
        showUploadProgress(false);
    }
}

function validateFile(file) {
    // Check file size
    if (file.size > AppConfig.maxFileSize) {
        showToast('File Too Large', `Maximum file size is ${AppConfig.maxFileSize / (1024 * 1024)}MB`, 'error');
        return false;
    }
    
    // Check file type
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!AppConfig.allowedFileTypes.includes(extension)) {
        showToast('Invalid File Type', 'Only Excel files (.xlsx, .xls) are allowed', 'error');
        return false;
    }
    
    return true;
}

async function processExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Try to find the correct sheet
                let targetSheet = 'sample-customers';
                if (!workbook.SheetNames.includes(targetSheet)) {
                    targetSheet = workbook.SheetNames[0];
                }
                
                const worksheet = workbook.Sheets[targetSheet];
                const customers = XLSX.utils.sheet_to_json(worksheet);
                
                if (customers.length === 0) {
                    throw new Error('Excel file is empty or contains no valid data');
                }
                
                // Validate required columns
                const requiredColumns = ['NAME', 'ACCOUNT_NO', 'BALANCE'];
                const firstRow = customers[0];
                const missingColumns = requiredColumns.filter(col => !(col in firstRow));
                
                if (missingColumns.length > 0) {
                    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
                }
                
                // Store customers data
                AppState.customers = customers.map((customer, index) => ({
                    ...customer,
                    id: index + 1,
                    selected: false,
                    processed: false
                }));
                
                // Update statistics
                AppState.analytics.totalCustomers = customers.length;
                updateStatistics();
                
                resolve(customers);
                
            } catch (error) {
                reject(new Error(`Failed to process Excel file: ${error.message}`));
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

function displayFileInfo(file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = fileInfo.querySelector('.file-name');
    const fileDetails = fileInfo.querySelector('.file-details');
    
    fileName.textContent = file.name;
    fileDetails.textContent = `Size: ${formatFileSize(file.size)} • Type: ${file.type || 'Excel'} • Modified: ${new Date(file.lastModified).toLocaleDateString()}`;
    
    fileInfo.style.display = 'block';
    
    // Hide upload area, show file info
    document.getElementById('uploadArea').style.display = 'none';
}

function clearFile() {
    document.getElementById('excelFile').value = '';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'flex';
    document.getElementById('issueSection').style.display = 'none';
    document.getElementById('customerSection').style.display = 'none';
    document.getElementById('actionsSection').style.display = 'none';
    
    // Reset state
    AppState.customers = [];
    AppState.filteredCustomers = [];
    AppState.selectedCustomers = [];
    
    updateUploadStatus('default', 'No file selected');
}

// Issue Type Handling
function handleIssueTypeChange(event) {
    const issueType = event.target.value;
    AppState.currentIssueType = issueType;
    
    if (issueType) {
        updateIssueDescription(issueType);
        enableAnalyzeButton();
    } else {
        disableAnalyzeButton();
    }
}

function updateIssueDescription(issueType) {
    const descriptions = {
        account_closure: 'Identify accounts with zero or low balance that may need closure notices.',
        kyc_update: 'Find customers with expired or missing KYC documents requiring updates.',
        loan_default: 'Locate customers with overdue loan payments for payment reminders.',
        fee_waiver: 'Identify eligible customers for fee waivers (senior citizens, students).',
        document_expiry: 'Find customers with expiring identity or address documents.'
    };
    
    const descElement = document.getElementById('issueDescription');
    if (descElement) {
        descElement.textContent = descriptions[issueType] || '';
    }
}

function enableAnalyzeButton() {
    const btn = document.getElementById('analyzeBtn');
    if (btn && AppState.customers.length > 0) {
        btn.disabled = false;
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
    }
}

function disableAnalyzeButton() {
    const btn = document.getElementById('analyzeBtn');
    if (btn) {
        btn.disabled = true;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    }
}

// Add this missing function
function initializeAnalyticsCharts() {
    // Initialize charts only if Chart.js is available and elements exist
    if (typeof Chart !== 'undefined') {
        try {
            // Letters Chart
            const lettersCtx = document.getElementById('lettersChart');
            if (lettersCtx) {
                // Destroy existing chart if it exists
                const existingChart = Chart.getChart(lettersCtx);
                if (existingChart) {
                    existingChart.destroy();
                }
                
                new Chart(lettersCtx, {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                        datasets: [{
                            label: 'Letters Generated',
                            data: [12, 19, 3, 5, 2, 3],
                            borderColor: 'rgb(75, 192, 192)',
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Letters Generated Over Time'
                            }
                        }
                    }
                });
            }

            // Issues Chart
            const issuesCtx = document.getElementById('issuesChart');
            if (issuesCtx) {
                // Destroy existing chart if it exists
                const existingIssueChart = Chart.getChart(issuesCtx);
                if (existingIssueChart) {
                    existingIssueChart.destroy();
                }
                
                new Chart(issuesCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Account Closure', 'KYC Update', 'Loan Default', 'Fee Waiver', 'Doc Expiry'],
                        datasets: [{
                            data: [30, 25, 20, 15, 10],
                            backgroundColor: [
                                '#FF6384',
                                '#36A2EB',
                                '#FFCE56',
                                '#4BC0C0',
                                '#9966FF'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Issue Distribution'
                            }
                        }
                    }
                });
            }
            
            console.log('📊 Analytics charts initialized successfully');
        } catch (error) {
            console.warn('Chart initialization failed:', error);
        }
    } else {
        console.warn('Chart.js not loaded, skipping analytics charts');
    }
}



// Customer Analysis
async function analyzeCustomers() {
    if (!AppState.currentIssueType || AppState.customers.length === 0) {
        showToast('Analysis Error', 'Please select an issue type and upload customer data first.', 'warning');
        return;
    }
    
    try {
        setAnalyzeButtonLoading(true);
        
        // Get analysis options
        const useAI = document.getElementById('useAI')?.checked || false;
        const detailedAnalysis = document.getElementById('detailedAnalysis')?.checked || false;
        const confidenceThreshold = parseInt(document.getElementById('confidenceThreshold')?.value || 70) / 100;
        
        console.log(`🔍 Analyzing ${AppState.customers.length} customers for ${AppState.currentIssueType}`);
        
        // Perform rule-based analysis first
        const ruleBasedResults = performRuleBasedAnalysis(AppState.customers, AppState.currentIssueType);
        
        let finalResults = ruleBasedResults;
        
        // Enhanced AI analysis if enabled
        if (useAI && AppConfig.enableAI) {
            try {
                const aiResults = await performAIAnalysis(ruleBasedResults, AppState.currentIssueType, {
                    detailedAnalysis,
                    confidenceThreshold
                });
                finalResults = aiResults || ruleBasedResults;
            } catch (aiError) {
                console.warn('AI analysis failed, using rule-based results:', aiError);
                showToast('AI Analysis Warning', 'AI analysis unavailable, using rule-based filtering.', 'warning');
            }
        }
        
        // Store filtered results
        AppState.filteredCustomers = finalResults;
        AppState.analytics.pendingActions = finalResults.length;
        
        // Display results
        displayCustomerResults(finalResults);
        
        // Show customer section
        document.getElementById('customerSection').style.display = 'block';
        document.getElementById('actionsSection').style.display = 'block';
        
        // Scroll to results
        document.getElementById('customerSection').scrollIntoView({ behavior: 'smooth' });
        
        // Update statistics
        updateStatistics();
        
        showToast('Analysis Complete', `Found ${finalResults.length} affected customers`, 'success');
        
    } catch (error) {
        console.error('Analysis error:', error);
        showToast('Analysis Failed', error.message, 'error');
    } finally {
        setAnalyzeButtonLoading(false);
    }
}

function performRuleBasedAnalysis(customers, issueType) {
    const currentDate = new Date();
    
    return customers.filter(customer => {
        switch(issueType) {
            case 'account_closure':
                const balance = parseFloat(customer.BALANCE || 0);
                const lastTransaction = customer.LAST_TRANSACTION ? new Date(customer.LAST_TRANSACTION) : null;
                const daysSinceLastTransaction = lastTransaction ? 
                    Math.floor((currentDate - lastTransaction) / (1000 * 60 * 60 * 24)) : 9999;
                
                return balance <= 100 || daysSinceLastTransaction > 90;
            
            case 'kyc_update':
                return !customer.EMAIL || 
                       !customer.MOBILE ||
                       customer.KYC_STATUS === 'Expired' || 
                       customer.KYC_STATUS === 'Pending' ||
                       !customer.KYC_STATUS;
            
            case 'loan_default':
                const outstanding = parseFloat(customer.OUTSTANDING_AMOUNT || 0);
                return outstanding > 0;
            
            case 'fee_waiver':
                const age = parseInt(customer.AGE || 0);
                return age > 60 || 
                       customer.ACCOUNT_TYPE === 'Student' ||
                       customer.CUSTOMER_CATEGORY === 'Senior Citizen';
            
            case 'document_expiry':
                return customer.DOC_STATUS === 'Expiring' || 
                       customer.DOC_STATUS === 'Expired' ||
                       (customer.DOC_EXPIRY_DAYS && customer.DOC_EXPIRY_DAYS <= 60);
            
            default:
                return false;
        }
    }).map(customer => ({
        ...customer,
        confidence: 0.85,
        priority: determinePriority(customer, issueType),
        reason: getAnalysisReason(customer, issueType)
    }));
}

async function performAIAnalysis(customers, issueType, options) {
    try {
        const response = await fetch(`${AppConfig.apiBaseUrl}/customers/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customers: customers.slice(0, 50), // Limit for API efficiency
                issueType,
                options: {
                    useAI: true,
                    ...options
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.analysis) {
            return result.analysis.customers || customers;
        }
        
        throw new Error('Invalid API response');
        
    } catch (error) {
        console.error('AI analysis error:', error);
        throw error;
    }
}

function determinePriority(customer, issueType) {
    switch(issueType) {
        case 'loan_default':
            const outstanding = parseFloat(customer.OUTSTANDING_AMOUNT || 0);
            if (outstanding > 100000) return 'high';
            if (outstanding > 10000) return 'medium';
            return 'low';
            
        case 'account_closure':
            const balance = parseFloat(customer.BALANCE || 0);
            if (balance === 0) return 'high';
            if (balance < 50) return 'medium';
            return 'low';
            
        case 'kyc_update':
            if (!customer.EMAIL && !customer.MOBILE) return 'high';
            if (customer.KYC_STATUS === 'Expired') return 'medium';
            return 'low';
            
        default:
            return 'medium';
    }
}

function getAnalysisReason(customer, issueType) {
    switch(issueType) {
        case 'account_closure':
            if (parseFloat(customer.BALANCE || 0) === 0) return 'Zero balance account';
            return 'Low balance account';
            
        case 'kyc_update':
            const issues = [];
            if (!customer.EMAIL) issues.push('missing email');
            if (!customer.MOBILE) issues.push('missing mobile');
            if (customer.KYC_STATUS === 'Expired') issues.push('expired KYC');
            return issues.length > 0 ? issues.join(', ') : 'KYC update required';
            
        case 'loan_default':
            return `Outstanding amount: ₹${customer.OUTSTANDING_AMOUNT || 0}`;
            
        case 'fee_waiver':
            if (parseInt(customer.AGE || 0) > 60) return 'Senior citizen';
            if (customer.ACCOUNT_TYPE === 'Student') return 'Student account';
            return 'Eligible for fee waiver';
            
        case 'document_expiry':
            return `Document expires in ${customer.DOC_EXPIRY_DAYS || 'few'} days`;
            
        default:
            return 'Matches criteria';
    }
}

// Customer Display and Management
function displayCustomerResults(customers) {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const startIndex = (AppState.currentPage - 1) * AppState.itemsPerPage;
    const endIndex = startIndex + AppState.itemsPerPage;
    const paginatedCustomers = customers.slice(startIndex, endIndex);
    
    paginatedCustomers.forEach((customer, index) => {
        const row = createCustomerRow(customer, startIndex + index);
        tbody.appendChild(row);
    });
    
    // Update counts
    updateCustomerCounts(customers.length);
    
    // Setup pagination if needed
    if (customers.length > AppState.itemsPerPage) {
        setupPagination(customers.length);
    }
}

function createCustomerRow(customer, index) {
    const row = document.createElement('tr');
    row.className = 'customer-row';
    row.dataset.customerId = customer.id;
    
    const priorityClass = `priority-${customer.priority || 'medium'}`;
    const confidencePercent = Math.round((customer.confidence || 0.8) * 100);
    
    row.innerHTML = `
        <td>
            <input type="checkbox" class="form-check-input customer-checkbox" 
                   value="${index}" onchange="updateSelectedCount()" 
                   ${customer.selected ? 'checked' : ''}>
        </td>
        <td>
            <div class="customer-card">
                <div class="customer-name">${customer.NAME}</div>
                <div class="customer-account">A/C: ${customer.ACCOUNT_NO}</div>
                ${customer.MOBILE ? `<div class="text-muted small">📱 ${customer.MOBILE}</div>` : ''}
            </div>
        </td>
        <td>
            <div class="customer-balance">₹${formatCurrency(customer.BALANCE || 0)}</div>
            <div class="text-muted small">${customer.ACCOUNT_TYPE || 'Savings'}</div>
            ${customer.BRANCH_CODE ? `<div class="text-muted small">Branch: ${customer.BRANCH_CODE}</div>` : ''}
        </td>
        <td>
            ${customer.EMAIL ? `<div class="small">📧 ${customer.EMAIL}</div>` : '<div class="text-muted small">No email</div>'}
            <div class="text-muted small">Last Txn: ${customer.LAST_TRANSACTION || 'N/A'}</div>
        </td>
        <td>
            <div class="d-flex flex-column gap-1">
                <span class="badge ${priorityClass}">${(customer.priority || 'medium').toUpperCase()}</span>
                <div class="small text-muted">Confidence: ${confidencePercent}%</div>
                <div class="small text-muted">${customer.reason || 'Matches criteria'}</div>
            </div>
        </td>
        <td>
            <div class="btn-group-vertical btn-group-sm">
                <button class="btn btn-outline-primary btn-sm" onclick="previewCustomerLetter(${index})" 
                        title="Preview Letter">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-outline-info btn-sm" onclick="editCustomerInfo(${index})" 
                        title="Edit Info">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

function updateCustomerCounts(totalCount) {
    const selectedCount = getSelectedCustomers().length;
    
    document.getElementById('selectedCount').textContent = `${selectedCount} selected`;
    document.getElementById('totalAffected').textContent = `${totalCount} total`;
}

function updateSelectedCount() {
    const selectedCount = getSelectedCustomers().length;
    document.getElementById('selectedCount').textContent = `${selectedCount} selected`;
    
    // Update global state
    AppState.selectedCustomers = getSelectedCustomers();
    
    // Enable/disable action buttons
    const actionButtons = document.querySelectorAll('#actionsSection .btn:not(.btn-outline-secondary)');
    actionButtons.forEach(btn => {
        btn.disabled = selectedCount === 0;
    });
}

function getSelectedCustomers() {
    const checkboxes = document.querySelectorAll('.customer-checkbox:checked');
    return Array.from(checkboxes).map(cb => {
        const index = parseInt(cb.value);
        const startIndex = (AppState.currentPage - 1) * AppState.itemsPerPage;
        return AppState.filteredCustomers[startIndex + index];
    }).filter(Boolean);
}

// Customer Selection Functions
function selectAllCustomers() {
    const checkboxes = document.querySelectorAll('.customer-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = true;
    }
    
    updateSelectedCount();
}

function clearAllCustomers() {
    const checkboxes = document.querySelectorAll('.customer-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }
    
    updateSelectedCount();
}

function selectHighPriority() {
    clearAllCustomers();
    
    const rows = document.querySelectorAll('.customer-row');
    rows.forEach(row => {
        const priorityBadge = row.querySelector('.priority-high');
        if (priorityBadge) {
            const checkbox = row.querySelector('.customer-checkbox');
            if (checkbox) checkbox.checked = true;
        }
    });
    
    updateSelectedCount();
}

function toggleAllCustomers() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.customer-checkbox');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });
    
    updateSelectedCount();
}

function filterCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    const rows = document.querySelectorAll('.customer-row');
    
    let visibleCount = 0;
    
    rows.forEach(row => {
        const customerName = row.querySelector('.customer-name').textContent.toLowerCase();
        const customerAccount = row.querySelector('.customer-account').textContent.toLowerCase();
        const customerEmail = row.querySelector('.small').textContent.toLowerCase();
        
        const matches = customerName.includes(searchTerm) || 
                       customerAccount.includes(searchTerm) || 
                       customerEmail.includes(searchTerm);
        
        if (matches) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Update visible count
    if (searchTerm) {
        showToast('Search Results', `Found ${visibleCount} matching customers`, 'info');
    }
}

// Letter Generation and Actions
async function previewLetters() {
    const selectedCustomers = getSelectedCustomers();
    
    if (selectedCustomers.length === 0) {
        showToast('No Selection', 'Please select at least one customer to preview letters.', 'warning');
        return;
    }
    
    try {
        // Generate preview for first selected customer
        const customer = selectedCustomers[0];
        const customMessage = document.getElementById('customMessage').value;
        
        const response = await fetch(`${AppConfig.apiBaseUrl}/letters/preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer,
                issueType: AppState.currentIssueType,
                customMessage
            })
        });
        
        if (!response.ok) {
            throw new Error('Preview generation failed');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showLetterPreview(result.preview.letter, customer);
        } else {
            throw new Error('Invalid preview response');
        }
        
    } catch (error) {
        console.error('Preview error:', error);
        showToast('Preview Failed', error.message, 'error');
    }
}

function showLetterPreview(letter, customer) {
    const modal = new bootstrap.Modal(document.getElementById('letterPreviewModal'));
    const content = document.getElementById('letterPreviewContent');
    const info = document.getElementById('previewInfo');
    
    // Format letter content
    content.innerHTML = `<pre style="white-space: pre-wrap; font-family: 'Times New Roman', serif;">${letter.content}</pre>`;
    
    // Show customer info
    info.innerHTML = `
        <div class="mb-2"><strong>Customer:</strong> ${customer.NAME}</div>
        <div class="mb-2"><strong>Account:</strong> ${customer.ACCOUNT_NO}</div>
        <div class="mb-2"><strong>Issue:</strong> ${AppState.currentIssueType}</div>
        <div class="mb-2"><strong>Subject:</strong> ${letter.subject}</div>
        <div class="mb-2"><strong>Priority:</strong> ${letter.urgency || 'Medium'}</div>
    `;
    
    modal.show();
}

async function generatePDFs() {
    const selectedCustomers = getSelectedCustomers();
    
    if (selectedCustomers.length === 0) {
        showToast('No Selection', 'Please select customers to generate letters.', 'warning');
        return;
    }
    
    try {
        setPDFButtonLoading(true);
        showProgressModal('Generating PDFs', `Processing ${selectedCustomers.length} letters...`);
        
        const customMessage = document.getElementById('customMessage').value;
        let completedCount = 0;
        
        // Process in batches to avoid overwhelming the browser
        const batchSize = 5;
        for (let i = 0; i < selectedCustomers.length; i += batchSize) {
            const batch = selectedCustomers.slice(i, i + batchSize);
            
            // Generate PDFs for this batch
            for (const customer of batch) {
                try {
                    await generateSinglePDF(customer, AppState.currentIssueType, customMessage);
                    completedCount++;
                    
                    // Update progress
                    const progress = Math.round((completedCount / selectedCustomers.length) * 100);
                    updateProgressModal(progress, `Generated ${completedCount}/${selectedCustomers.length} letters`);
                    
                } catch (error) {
                    console.error(`PDF generation failed for ${customer.NAME}:`, error);
                }
            }
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Update statistics
        AppState.analytics.lettersGenerated += completedCount;
        updateStatistics();
        
        hideProgressModal();
        showToast('PDFs Generated', `Successfully generated ${completedCount} letters`, 'success');
        
    } catch (error) {
        console.error('PDF generation error:', error);
        hideProgressModal();
        showToast('Generation Failed', error.message, 'error');
    } finally {
        setPDFButtonLoading(false);
    }
}

async function generateSinglePDF(customer, issueType, customMessage) {
    return new Promise((resolve, reject) => {
        try {
            // Generate letter content using the template
            const letterContent = generateLetterTemplate(customer, issueType, customMessage);
            
            // Create PDF using jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Set font
            doc.setFont('helvetica');
            
            // Add header
            doc.setFontSize(16);
            doc.setTextColor(0, 51, 102);
            doc.text('STATE BANK OF INDIA', 20, 20);
            
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text('Official Banking Communication', 20, 30);
            
            // Add date and reference
            doc.setFontSize(10);
            doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 20, 45);
            doc.text(`Reference: SBI/${customer.ACCOUNT_NO}/${new Date().getFullYear()}`, 20, 52);
            
            // Add letter content
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(letterContent, 170);
            doc.text(lines, 20, 70);
            
            // Add footer
            doc.setFontSize(8);
            doc.setTextColor(128);
            doc.text('This is a computer-generated letter from State Bank of India', 20, 280);
            doc.text('For queries: 1800-SBI-1234 | www.sbi.co.in', 20, 287);
            
            // Save PDF
            doc.save(`SBI_Letter_${customer.NAME.replace(/\s+/g, '_')}_${customer.ACCOUNT_NO}.pdf`);
            
            resolve();
            
        } catch (error) {
            reject(error);
        }
    });
}

function generateLetterTemplate(customer, issueType, customMessage) {
    const templates = {
        account_closure: `Dear ${customer.NAME},

Subject: Account Inactivity Notice - Account No: ${customer.ACCOUNT_NO}

We hope this letter finds you in good health. We are writing to inform you about the inactive status of your Savings Account.

Account Details:
- Account Number: ${customer.ACCOUNT_NO}
- Current Balance: ₹${customer.BALANCE || 0}
- Last Transaction: ${customer.LAST_TRANSACTION || 'Not Available'}

As per RBI guidelines, accounts with minimal activity may be converted to dormant status. To keep your account active:

• Make any deposit or withdrawal transaction
• Update your contact information
• Visit the branch to confirm account continuation

${customMessage ? `\nSpecial Instructions:\n${customMessage}\n` : ''}

Please visit our branch within 30 days. For assistance, contact 1800-SBI-1234.

Thank you for banking with State Bank of India.

Yours sincerely,
Branch Manager
State Bank of India`,

        kyc_update: `Dear ${customer.NAME},

Subject: KYC Update Required - Account No: ${customer.ACCOUNT_NO}

This is to inform you about the KYC (Know Your Customer) update requirement for your account.

Account Information:
- Account Number: ${customer.ACCOUNT_NO}
- Mobile: ${customer.MOBILE || 'Not Available'}
- Email: ${customer.EMAIL || 'Not Available'}

Required Documents:
• Recent passport-size photograph
• Valid identity proof (Aadhaar/PAN/Passport)
• Current address proof (not older than 3 months)

${customMessage ? `\nAdditional Information:\n${customMessage}\n` : ''}

You can update KYC by:
• Visiting our branch during business hours
• Using SBI YONO mobile app
• Video KYC facility

Contact: 1800-SBI-1234 | kyc@sbi.co.in

Best regards,
Branch Manager
State Bank of India`,

        loan_default: `Dear ${customer.NAME},

Subject: Payment Reminder - Loan Account: ${customer.LOAN_ACCOUNT_NO || customer.ACCOUNT_NO}

This is regarding your loan account with overdue payment.

Loan Details:
- Outstanding Amount: ₹${customer.OUTSTANDING_AMOUNT || 'Contact branch'}
- Due Date: ${customer.DUE_DATE || 'Overdue'}

To avoid additional charges and maintain your credit score, please clear the outstanding amount immediately.

Payment Options:
• Visit branch with cash or cheque
• Online payment through SBI net banking
• NEFT/RTGS transfer
• UPI payment

${customMessage ? `\nImportant Notice:\n${customMessage}\n` : ''}

Contact: 1800-SBI-1234 for payment assistance.

Yours faithfully,
Branch Manager
State Bank of India`,

        fee_waiver: `Dear ${customer.NAME},

Subject: Fee Waiver Information - Account No: ${customer.ACCOUNT_NO}

We are pleased to inform you about the fee waiver approval for your account.

Waiver Details:
- Account Number: ${customer.ACCOUNT_NO}
- Customer Category: ${customer.CUSTOMER_CATEGORY || 'Valued Customer'}
- Effective Date: ${new Date().toLocaleDateString('en-IN')}

Fees Covered:
• Monthly maintenance charges
• SMS alert charges
• Cheque book issuance
• Online transaction fees

${customMessage ? `\nSpecial Conditions:\n${customMessage}\n` : ''}

For queries, contact: 1800-SBI-1234

Warm regards,
Branch Manager
State Bank of India`,

        document_expiry: `Dear ${customer.NAME},

Subject: Document Renewal Required - Account No: ${customer.ACCOUNT_NO}

Your important documents linked to the account are approaching expiry.

Document Information:
- Document Type: ${customer.DOC_TYPE || 'Identity/Address proof'}
- Days to Expiry: ${customer.DOC_EXPIRY_DAYS || 'Limited time'}

Required Actions:
Please update documents before expiry to ensure uninterrupted banking services.

Acceptable Documents:
• Aadhaar Card (preferred)
• PAN Card
• Passport
• Utility bills (for address proof)

${customMessage ? `\nAdditional Requirements:\n${customMessage}\n` : ''}

Update Options:
• Visit branch during business hours
• SBI YONO app document upload
• Video KYC service

Contact: 1800-SBI-1234

Sincerely,
Branch Manager
State Bank of India`
    };
    
    return templates[issueType] || templates.account_closure;
}

// Continue with more JavaScript functions in next response...
// Email Functionality
async function sendEmails() {
    const selectedCustomers = getSelectedCustomers();
    
    if (selectedCustomers.length === 0) {
        showToast('No Selection', 'Please select customers to send emails.', 'warning');
        return;
    }
    
    // Check if customers have email addresses
    const customersWithEmail = selectedCustomers.filter(customer => customer.EMAIL);
    if (customersWithEmail.length === 0) {
        showToast('No Email Addresses', 'None of the selected customers have email addresses.', 'warning');
        return;
    }
    
    try {
        setEmailButtonLoading(true);
        showProgressModal('Sending Emails', `Preparing to send ${customersWithEmail.length} emails...`);
        
        const customMessage = document.getElementById('customMessage').value;
        const includeAttachment = document.getElementById('includeAttachment')?.checked || false;
        const sendCopy = document.getElementById('sendCopyToManager')?.checked || false;
        
        // Generate letter content for each customer
        const emailData = customersWithEmail.map(customer => ({
            customer,
            subject: getEmailSubject(customer, AppState.currentIssueType),
            content: generateLetterTemplate(customer, AppState.currentIssueType, customMessage)
        }));
        
        // Send emails via API
        const response = await fetch(`${AppConfig.apiBaseUrl}/email/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customers: customersWithEmail,
                subject: emailData[0].subject,
                content: emailData[0].content,
                issueType: AppState.currentIssueType,
                options: {
                    includeAttachment,
                    sendCopy,
                    delayMs: 1000,
                    batchSize: 3
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Email sending failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            const stats = result.statistics;
            AppState.analytics.emailsSent += stats.sent;
            updateStatistics();
            
            hideProgressModal();
            showEmailResults(result);
        } else {
            throw new Error('Email sending failed');
        }
        
    } catch (error) {
        console.error('Email sending error:', error);
        hideProgressModal();
        showToast('Email Failed', error.message, 'error');
    } finally {
        setEmailButtonLoading(false);
    }
}

function getEmailSubject(customer, issueType) {
    const subjectMap = {
        account_closure: `Important Notice - Account Status - ${customer.ACCOUNT_NO}`,
        kyc_update: `Action Required - KYC Update - ${customer.ACCOUNT_NO}`,
        loan_default: `Payment Reminder - ${customer.ACCOUNT_NO}`,
        fee_waiver: `Fee Waiver Information - ${customer.ACCOUNT_NO}`,
        document_expiry: `Document Renewal Required - ${customer.ACCOUNT_NO}`
    };
    
    return subjectMap[issueType] || `Important Banking Notice - ${customer.ACCOUNT_NO}`;
}

function showEmailResults(result) {
    const stats = result.statistics;
    const successRate = Math.round((stats.sent / stats.total) * 100);
    
    const resultHtml = `
        <div class="row">
            <div class="col-md-3">
                <div class="text-center">
                    <div class="h4 text-success">${stats.sent}</div>
                    <small class="text-muted">Sent</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="text-center">
                    <div class="h4 text-danger">${stats.failed}</div>
                    <small class="text-muted">Failed</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="text-center">
                    <div class="h4 text-warning">${stats.skipped}</div>
                    <small class="text-muted">Skipped</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="text-center">
                    <div class="h4 text-info">${successRate}%</div>
                    <small class="text-muted">Success Rate</small>
                </div>
            </div>
        </div>
    `;
    
    showResults('Email Sending Complete!', resultHtml);
    
    if (stats.failed > 0) {
        showToast('Some Emails Failed', `${stats.failed} emails could not be sent. Check email configuration.`, 'warning');
    }
}

async function testEmailConfig() {
    try {
        const testEmail = prompt('Enter email address to test configuration:');
        if (!testEmail) return;
        
        const response = await fetch(`${AppConfig.apiBaseUrl}/email/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: testEmail,
                customMessage: 'This is a test email from SBI Letter Automation System.'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Test Email Sent', 'Email configuration is working correctly!', 'success');
        } else {
            throw new Error(result.message || 'Test email failed');
        }
        
    } catch (error) {
        console.error('Email test error:', error);
        showToast('Email Test Failed', error.message, 'error');
    }
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount).replace('₹', '');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// UI Helper Functions
function showUploadProgress(show) {
    const progressElement = document.getElementById('uploadProgress');
    if (progressElement) {
        progressElement.style.display = show ? 'block' : 'none';
    }
}

function updateUploadStatus(type, message) {
    const statusElement = document.getElementById('uploadStatus');
    if (!statusElement) return;
    
    const statusBadge = statusElement.querySelector('.badge');
    if (statusBadge) {
        statusBadge.className = `badge bg-${getStatusColor(type)}`;
        statusBadge.textContent = message;
    }
}

function getStatusColor(type) {
    const colorMap = {
        default: 'secondary',
        uploading: 'primary',
        success: 'success',
        error: 'danger',
        warning: 'warning'
    };
    return colorMap[type] || 'secondary';
}

function setAnalyzeButtonLoading(loading) {
    const btn = document.getElementById('analyzeBtn');
    const spinner = document.getElementById('analyzeSpinner');
    
    if (btn && spinner) {
        btn.disabled = loading;
        spinner.style.display = loading ? 'inline-block' : 'none';
        btn.innerHTML = loading ? 
            '<i class="fas fa-search me-2"></i>Analyzing... <div class="spinner-border spinner-border-sm ms-2" role="status"></div>' :
            '<i class="fas fa-search me-2"></i>Analyze Customers';
    }
}

function setPDFButtonLoading(loading) {
    const btn = document.getElementById('pdfBtn');
    if (btn) {
        btn.disabled = loading;
        if (loading) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating PDFs...';
        } else {
            btn.innerHTML = '<i class="fas fa-file-pdf me-2"></i>Generate PDFs';
        }
    }
}

function setEmailButtonLoading(loading) {
    const btn = document.getElementById('emailBtn');
    if (btn) {
        btn.disabled = loading;
        if (loading) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending Emails...';
        } else {
            btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Send Emails';
        }
    }
}

// Progress Modal Functions
function showProgressModal(title, message) {
    const modal = document.getElementById('progressModal');
    const titleEl = document.getElementById('progressTitle');
    const messageEl = document.getElementById('progressMessage');
    const progressBar = document.getElementById('progressBar');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (progressBar) progressBar.style.width = '0%';
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function updateProgressModal(percentage, message, details = '') {
    const progressBar = document.getElementById('progressBar');
    const messageEl = document.getElementById('progressMessage');
    const detailsEl = document.getElementById('progressDetails');
    
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (messageEl) messageEl.textContent = message;
    if (detailsEl) detailsEl.textContent = details;
}

function hideProgressModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('progressModal'));
    if (modal) {
        modal.hide();
    }
}

// Add this function to fix the error
function updateConfidenceValue(value) {
    const confidenceValue = document.getElementById('confidenceValue');
    if (confidenceValue) {
        confidenceValue.textContent = `${value}%`;
    }
}

// Also add this function that was referenced
function updateConfidenceDisplay() {
    const slider = document.getElementById('confidenceThreshold');
    if (slider) {
        updateConfidenceValue(slider.value);
    }
}


// Toast Notification System
function showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toastId = 'toast-' + Date.now();
    const iconMap = {
        success: 'fa-check-circle text-success',
        error: 'fa-times-circle text-danger',
        warning: 'fa-exclamation-triangle text-warning',
        info: 'fa-info-circle text-info'
    };
    
    const toastHtml = `
        <div class="toast" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="5000">
            <div class="toast-header">
                <i class="fas ${iconMap[type]} me-2"></i>
                <strong class="me-auto">${title}</strong>
                <small class="text-muted">${new Date().toLocaleTimeString()}</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('afterbegin', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

function showResults(title, content) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContent = document.getElementById('resultsContent');
    
    if (resultsSection && resultsContent) {
        resultsContent.innerHTML = `<h6>${title}</h6>${content}`;
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function hideResults() {
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) {
        resultsSection.style.display = 'none';
    }
}

// Statistics and Analytics
function updateStatistics() {
    const stats = AppState.analytics;
    
    document.getElementById('totalCustomers').textContent = stats.totalCustomers;
    document.getElementById('lettersGenerated').textContent = stats.lettersGenerated;
    document.getElementById('emailsSent').textContent = stats.emailsSent;
    document.getElementById('pendingActions').textContent = stats.pendingActions;
}

async function checkSystemStatus() {
    try {
        const response = await fetch(`${AppConfig.apiBaseUrl}/health`);
        const result = await response.json();
        
        if (result.status === 'OK') {
            console.log('✅ System status: Online');
        }
    } catch (error) {
        console.warn('⚠️ System status check failed:', error);
        showToast('System Warning', 'Backend services may be unavailable', 'warning');
    }
}

// User Preferences
function loadUserPreferences() {
    try {
        const prefs = localStorage.getItem('sbi-letter-prefs');
        if (prefs) {
            const preferences = JSON.parse(prefs);
            
            // Apply saved preferences
            if (preferences.useAI !== undefined) {
                const useAICheckbox = document.getElementById('useAI');
                if (useAICheckbox) useAICheckbox.checked = preferences.useAI;
            }
            
            if (preferences.confidenceThreshold) {
                const confidenceSlider = document.getElementById('confidenceThreshold');
                if (confidenceSlider) confidenceSlider.value = preferences.confidenceThreshold;
                updateConfidenceValue(preferences.confidenceThreshold);
            }
        }
    } catch (error) {
        console.warn('Failed to load user preferences:', error);
    }
}

function saveUserPreferences() {
    try {
        const preferences = {
            useAI: document.getElementById('useAI')?.checked || false,
            confidenceThreshold: document.getElementById('confidenceThreshold')?.value || 70,
            detailedAnalysis: document.getElementById('detailedAnalysis')?.checked || false
        };
        
        localStorage.setItem('sbi-letter-prefs', JSON.stringify(preferences));
    } catch (error) {
        console.warn('Failed to save user preferences:', error);
    }
}

// Drag and Drop Functionality
function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    uploadArea.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.classList.add('drag-over');
    }
}

function unhighlight(e) {
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        const excelFile = document.getElementById('excelFile');
        if (excelFile) {
            excelFile.files = files;
            handleFileUpload({ target: { files: files } });
        }
    }
}

// Confidence Threshold Display
function updateConfidenceValue(value) {
    const confidenceValue = document.getElementById('confidenceValue');
    if (confidenceValue) {
        confidenceValue.textContent = `${value}%`;
    }
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(event) {
    // Ctrl+U or Cmd+U for upload
    if ((event.ctrlKey || event.metaKey) && event.key === 'u') {
        event.preventDefault();
        document.getElementById('excelFile')?.click();
    }
    
    // Ctrl+A or Cmd+A for analyze (when in customer section)
    if ((event.ctrlKey || event.metaKey) && event.key === 'a' && AppState.customers.length > 0) {
        event.preventDefault();
        if (AppState.currentIssueType) {
            analyzeCustomers();
        }
    }
    
    // Escape to close modals or clear selections
    if (event.key === 'Escape') {
        clearAllCustomers();
    }
}

// Window Event Handlers
function handleBeforeUnload(event) {
    if (AppState.isProcessing) {
        event.preventDefault();
        event.returnValue = 'Processing in progress. Are you sure you want to leave?';
        return event.returnValue;
    }
    
    // Save user preferences
    saveUserPreferences();
}

function handleWindowResize() {
    // Adjust chatbot position on mobile
    const chatbot = document.getElementById('chatbotContainer');
    if (chatbot && window.innerWidth <= 768) {
        chatbot.style.width = 'calc(100vw - 20px)';
    } else if (chatbot) {
        chatbot.style.width = '380px';
    }
}

// Sample File Download
function downloadSampleFile() {
    // Create sample data
    const sampleData = [
        {
            'NAME': 'Rajesh Kumar',
            'ACCOUNT_NO': '1234567890',
            'BALANCE': 0,
            'EMAIL': 'rajesh@email.com',
            'MOBILE': '9876543210',
            'LAST_TRANSACTION': '2023-06-15',
            'ACCOUNT_TYPE': 'Savings',
            'KYC_STATUS': 'Complete',
            'OUTSTANDING_AMOUNT': 0
        },
        {
            'NAME': 'Priya Singh',
            'ACCOUNT_NO': '2345678901',
            'BALANCE': 1500,
            'EMAIL': 'priya@email.com',
            'MOBILE': '8765432109',
            'LAST_TRANSACTION': '2024-10-01',
            'ACCOUNT_TYPE': 'Current',
            'KYC_STATUS': 'Expired',
            'OUTSTANDING_AMOUNT': 0
        },
        {
            'NAME': 'Amit Sharma',
            'ACCOUNT_NO': '3456789012',
            'BALANCE': 50,
            'EMAIL': 'amit@email.com',
            'MOBILE': '7654321098',
            'LAST_TRANSACTION': '2023-12-20',
            'ACCOUNT_TYPE': 'Savings',
            'KYC_STATUS': 'Complete',
            'OUTSTANDING_AMOUNT': 25000
        }
    ];
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'sample-customers');
    
    // Save file
    XLSX.writeFile(wb, 'SBI_Customer_Sample_Data.xlsx');
    
    showToast('Sample Downloaded', 'Sample Excel file downloaded successfully', 'success');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure all elements are rendered
    setTimeout(() => {
        initializeApp();
    }, 100);
});

// Add these missing functions at the end of app.js

// Navigation Functions
function showAnalytics() {
    hideAllSections();
    document.getElementById('analyticsSection').style.display = 'block';
    document.getElementById('analyticsSection').classList.add('active');
}

function showTemplates() {
    hideAllSections();
    document.getElementById('templatesSection').style.display = 'block';
    document.getElementById('templatesSection').classList.add('active');
}

function hideAllSections() {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
}

// Quick Action Functions
function generateQuickLetters() {
    if (AppState.customers.length === 0) {
        showToast('No Data', 'Please upload customer data first', 'warning');
        return;
    }
    
    if (!AppState.currentIssueType) {
        showToast('No Issue Type', 'Please select an issue type and analyze customers first', 'warning');
        return;
    }
    
    // Auto-select all customers and generate PDFs
    selectAllCustomers();
    generatePDFs();
}

function showEmailComposer() {
    const modal = new bootstrap.Modal(document.getElementById('emailComposerModal'));
    modal.show();
}

// Customer Action Functions
function exportCustomerList() {
    if (AppState.filteredCustomers.length === 0) {
        showToast('No Data', 'No customers to export', 'warning');
        return;
    }
    
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(AppState.filteredCustomers);
        XLSX.utils.book_append_sheet(wb, ws, 'Filtered_Customers');
        XLSX.writeFile(wb, `SBI_Filtered_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Export Successful', 'Customer list exported successfully', 'success');
    } catch (error) {
        showToast('Export Failed', 'Failed to export customer list', 'error');
    }
}

function previewCustomerLetter(index) {
    const customer = AppState.filteredCustomers[index];
    if (!customer) return;
    
    showToast('Preview', `Previewing letter for ${customer.NAME}`, 'info');
    // You can implement detailed preview logic here
}

function editCustomerInfo(index) {
    const customer = AppState.filteredCustomers[index];
    if (!customer) return;
    
    showToast('Edit', `Edit functionality for ${customer.NAME} - Coming soon!`, 'info');
    // You can implement edit functionality here
}

// Action Functions
function scheduleEmails() {
    showToast('Schedule', 'Email scheduling feature - Coming soon!', 'info');
    // Implement email scheduling logic
}

function downloadAllPDFs() {
    showToast('Download', 'Bulk PDF download feature - Coming soon!', 'info');
    // Implement bulk download logic
}

// Report Functions
function generateReport() {
    showToast('Report', 'Generating comprehensive report...', 'info');
    
    // Create a simple report
    const reportData = {
        totalCustomers: AppState.analytics.totalCustomers,
        lettersGenerated: AppState.analytics.lettersGenerated,
        emailsSent: AppState.analytics.emailsSent,
        pendingActions: AppState.analytics.pendingActions,
        timestamp: new Date().toISOString()
    };
    
    console.log('Report Data:', reportData);
    
    // You can implement detailed reporting logic here
    showToast('Report Ready', 'Report data logged to console', 'success');
}

function exportToExcel() {
    showToast('Export', 'Excel export feature - Coming soon!', 'info');
    // Implement Excel export logic
}

function printSummary() {
    window.print();
}

// Letter Preview Functions
function printPreview() {
    window.print();
}

function downloadPreviewPDF() {
    showToast('PDF Download', 'PDF download from preview - Coming soon!', 'info');
}

// Email Composer Functions
function sendCustomEmails() {
    const subject = document.getElementById('emailSubject').value;
    const content = document.getElementById('emailContent').value;
    
    if (!subject || !content) {
        showToast('Missing Data', 'Please enter subject and content', 'warning');
        return;
    }
    
    showToast('Sending', 'Custom email sending - Feature coming soon!', 'info');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('emailComposerModal'));
    if (modal) modal.hide();
}


// Export functions for use in other files
// window.SBIApp = {
//     initializeApp,
//     handleFileUpload,
//     analyzeCustomers,
//     generatePDFs,
//     sendEmails,
//     showToast,
//     updateStatistics,
//     AppState,
//     AppConfig
    
// };


// Sample File Download
function downloadSampleFile() {
    // Create sample data
    const sampleData = [
        {
            'NAME': 'Rajesh Kumar',
            'ACCOUNT_NO': '1234567890',
            'BALANCE': 0,
            'EMAIL': 'rajesh@email.com',
            'MOBILE': '9876543210',
            'LAST_TRANSACTION': '2023-06-15',
            'ACCOUNT_TYPE': 'Savings',
            'KYC_STATUS': 'Complete',
            'OUTSTANDING_AMOUNT': 0
        },
        {
            'NAME': 'Priya Singh',
            'ACCOUNT_NO': '2345678901',
            'BALANCE': 1500,
            'EMAIL': 'priya@email.com',
            'MOBILE': '8765432109',
            'LAST_TRANSACTION': '2024-10-01',
            'ACCOUNT_TYPE': 'Current',
            'KYC_STATUS': 'Expired',
            'OUTSTANDING_AMOUNT': 0
        },
        {
            'NAME': 'Amit Sharma',
            'ACCOUNT_NO': '3456789012',
            'BALANCE': 50,
            'EMAIL': 'amit@email.com',
            'MOBILE': '7654321098',
            'LAST_TRANSACTION': '2023-12-20',
            'ACCOUNT_TYPE': 'Savings',
            'KYC_STATUS': 'Complete',
            'OUTSTANDING_AMOUNT': 25000
        }
    ];
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'sample-customers');
    
    // Save file
    XLSX.writeFile(wb, 'SBI_Customer_Sample_Data.xlsx');
    
    showToast('Sample Downloaded', 'Sample Excel file downloaded successfully', 'success');
}

// Add missing function
function setupPagination(totalItems) {
    // Simple pagination setup - can be enhanced later
    console.log(`Setting up pagination for ${totalItems} items`);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure all elements are rendered
    setTimeout(() => {
        initializeApp();
    }, 100);
});

// Navigation Functions
function showAnalytics() {
    hideAllSections();
    document.getElementById('analyticsSection').style.display = 'block';
    document.getElementById('analyticsSection').classList.add('active');
}

function showTemplates() {
    hideAllSections();
    document.getElementById('templatesSection').style.display = 'block';
    document.getElementById('templatesSection').classList.add('active');
}

function hideAllSections() {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
}

// Quick Action Functions
function generateQuickLetters() {
    if (AppState.customers.length === 0) {
        showToast('No Data', 'Please upload customer data first', 'warning');
        return;
    }
    
    if (!AppState.currentIssueType) {
        showToast('No Issue Type', 'Please select an issue type and analyze customers first', 'warning');
        return;
    }
    
    // Auto-select all customers and generate PDFs
    selectAllCustomers();
    generatePDFs();
}

function showEmailComposer() {
    const modal = new bootstrap.Modal(document.getElementById('emailComposerModal'));
    modal.show();
}

// Customer Action Functions
function exportCustomerList() {
    if (AppState.filteredCustomers.length === 0) {
        showToast('No Data', 'No customers to export', 'warning');
        return;
    }
    
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(AppState.filteredCustomers);
        XLSX.utils.book_append_sheet(wb, ws, 'Filtered_Customers');
        XLSX.writeFile(wb, `SBI_Filtered_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Export Successful', 'Customer list exported successfully', 'success');
    } catch (error) {
        showToast('Export Failed', 'Failed to export customer list', 'error');
    }
}

function previewCustomerLetter(index) {
    const customer = AppState.filteredCustomers[index];
    if (!customer) return;
    
    showToast('Preview', `Previewing letter for ${customer.NAME}`, 'info');
}

function editCustomerInfo(index) {
    const customer = AppState.filteredCustomers[index];
    if (!customer) return;
    
    showToast('Edit', `Edit functionality for ${customer.NAME} - Coming soon!`, 'info');
}

// Action Functions
function scheduleEmails() {
    showToast('Schedule', 'Email scheduling feature - Coming soon!', 'info');
}

function downloadAllPDFs() {
    showToast('Download', 'Bulk PDF download feature - Coming soon!', 'info');
}

// Report Functions
function generateReport() {
    showToast('Report', 'Generating comprehensive report...', 'info');
    
    const reportData = {
        totalCustomers: AppState.analytics.totalCustomers,
        lettersGenerated: AppState.analytics.lettersGenerated,
        emailsSent: AppState.analytics.emailsSent,
        pendingActions: AppState.analytics.pendingActions,
        timestamp: new Date().toISOString()
    };
    
    console.log('Report Data:', reportData);
    showToast('Report Ready', 'Report data logged to console', 'success');
}

function exportToExcel() {
    showToast('Export', 'Excel export feature - Coming soon!', 'info');
}

function printSummary() {
    window.print();
}

// Letter Preview Functions
function printPreview() {
    window.print();
}

function downloadPreviewPDF() {
    showToast('PDF Download', 'PDF download from preview - Coming soon!', 'info');
}

// Email Composer Functions
function sendCustomEmails() {
    const subject = document.getElementById('emailSubject').value;
    const content = document.getElementById('emailContent').value;
    
    if (!subject || !content) {
        showToast('Missing Data', 'Please enter subject and content', 'warning');
        return;
    }
    
    showToast('Sending', 'Custom email sending - Feature coming soon!', 'info');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('emailComposerModal'));
    if (modal) modal.hide();
}

// Export functions for use in other files
window.SBIApp = {
    initializeApp,
    handleFileUpload,
    analyzeCustomers,
    generatePDFs,
    sendEmails,
    showToast,
    updateStatistics,
    AppState,
    AppConfig
};
