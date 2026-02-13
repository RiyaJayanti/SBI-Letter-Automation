// SBI Letter Automation - AI Chatbot Module
'use strict';

class SBIChatbot {
    constructor() {
        this.apiUrl = '/api';
        this.isOnline = false;
        this.conversationHistory = [];
        this.isTyping = false;
        this.responses = this.initializeResponses();
        this.shortcuts = this.initializeShortcuts();
        this.contextData = {};
        
        this.init();
    }

    // Initialize chatbot
    init() {
        this.setupEventListeners();
        this.checkOnlineStatus();
        this.loadConversationHistory();
        this.showWelcomeMessage();
    }

    // Setup event listeners
    setupEventListeners() {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendChatBtn');
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => this.handleKeyPress(e));
            chatInput.addEventListener('input', () => this.handleInputChange());
        }
        
        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendMessage());
        }

        // Setup suggestion buttons
        this.setupSuggestionButtons();
    }

    // Handle keyboard input
    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    // Handle input changes for typing indicators
    handleInputChange() {
        const input = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendChatBtn');
        
        if (input && sendButton) {
            sendButton.disabled = input.value.trim() === '';
        }

        // Show typing suggestions
        this.showTypingSuggestions(input.value);
    }

    // Send message
    async sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        // Clear input and show user message
        input.value = '';
        this.addUserMessage(message);

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Get response
            const response = await this.getResponse(message);
            this.hideTypingIndicator();
            this.addBotMessage(response);

            // Update conversation history
            this.addToHistory(message, response);

        } catch (error) {
            console.error('Chatbot error:', error);
            this.hideTypingIndicator();
            this.addBotMessage('I apologize, but I\'m having trouble processing your request right now. Please try again or contact technical support.');
        }
    }

    // Get response from AI or local knowledge base
    async getResponse(message) {
        // Update context with current app state
        this.updateContext();

        // Try AI response first if available
        if (this.isOnline) {
            try {
                const aiResponse = await this.getAIResponse(message);
                if (aiResponse) return aiResponse;
            } catch (error) {
                console.warn('AI response failed, using local knowledge:', error);
            }
        }

        // Fallback to local knowledge base
        return this.getLocalResponse(message);
    }

    // Get AI response from backend
    async getAIResponse(message) {
        try {
            const response = await fetch(`${this.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    context: this.contextData,
                    conversationHistory: this.conversationHistory.slice(-5) // Last 5 exchanges
                })
            });

            if (!response.ok) {
                throw new Error('AI service unavailable');
            }

            const result = await response.json();
            return result.response || this.getLocalResponse(message);

        } catch (error) {
            throw error;
        }
    }

    // Get local response from knowledge base
    getLocalResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // Check for exact matches first
        for (const [key, response] of Object.entries(this.responses.exact)) {
            if (lowerMessage === key) {
                return this.processResponse(response);
            }
        }

        // Check for keyword matches
        for (const [keywords, response] of Object.entries(this.responses.keywords)) {
            const keywordList = keywords.split('|');
            if (keywordList.some(keyword => lowerMessage.includes(keyword))) {
                return this.processResponse(response);
            }
        }

        // Check for pattern matches
        for (const [pattern, response] of Object.entries(this.responses.patterns)) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(message)) {
                return this.processResponse(response);
            }
        }

        // Default responses based on context
        if (this.contextData.hasCustomers && !this.contextData.hasAnalyzed) {
            return "I see you have customer data uploaded. You can select an issue type and click 'Analyze Customers' to identify affected customers. Would you like help with a specific issue type?";
        }

        if (this.contextData.hasAnalyzed && this.contextData.selectedCustomers === 0) {
            return "You've analyzed customers but haven't selected any yet. Use the checkboxes to select customers for letter generation, or try the 'Select High Priority' button to automatically select urgent cases.";
        }

        // Generic helpful response
        return this.responses.default[Math.floor(Math.random() * this.responses.default.length)];
    }

    // Process response template with context data
    processResponse(response) {
        if (typeof response === 'function') {
            return response(this.contextData);
        }

        // Replace placeholders with context data
        return response.replace(/\{(\w+)\}/g, (match, key) => {
            return this.contextData[key] || match;
        });
    }

    // Initialize response knowledge base
    initializeResponses() {
        return {
            exact: {
                'help': 'I can help you with:\n\n📁 **File Upload**: Excel file requirements and troubleshooting\n🔍 **Customer Analysis**: Issue types and filtering options\n📄 **Letter Generation**: Creating and customizing letters\n📧 **Email Sending**: SMTP setup and bulk email sending\n🛠️ **System Features**: Navigation and advanced options\n\nJust ask me about any specific topic!',
                
                'hello': 'Hello! Welcome to the SBI Letter Automation System. I\'m your AI assistant, ready to help you streamline customer communications. What would you like to know?',
                
                'hi': 'Hi there! I\'m here to help you with the SBI Letter Automation System. Whether you need help with file uploads, customer analysis, or letter generation, just ask!',
                
                'thanks': 'You\'re welcome! I\'m always here to help. Is there anything else you\'d like to know about the SBI Letter Automation System?',
                
                'bye': 'Goodbye! Feel free to return anytime if you need help with the SBI Letter Automation System. Have a great day!'
            },

            keywords: {
                'excel|upload|file': (context) => {
                    let response = '📁 **Excel File Upload Help**\n\n';
                    response += '**Required Format**: .xlsx or .xls files only\n';
                    response += '**Maximum Size**: 10MB\n';
                    response += '**Required Columns**: NAME, ACCOUNT_NO, BALANCE\n';
                    response += '**Optional Columns**: EMAIL, MOBILE, LAST_TRANSACTION, KYC_STATUS\n\n';
                    
                    if (context.hasCustomers) {
                        response += `✅ You currently have ${context.totalCustomers} customers loaded.`;
                    } else {
                        response += '💡 **Tip**: You can drag and drop files directly onto the upload area!';
                    }
                    
                    return response;
                },

                'account closure|closure': '🏦 **Account Closure Letters**\n\nThese are sent to customers with:\n• Zero balance accounts\n• Accounts with balance ≤ ₹100\n• No transactions for 90+ days\n\nThe system will automatically identify such accounts and generate RBI-compliant closure notices with reactivation instructions.',

                'kyc|kyc update': '📋 **KYC Update Letters**\n\nSent to customers who need:\n• Missing email or mobile number\n• Expired KYC documents\n• Incomplete documentation\n\nLetters include required document lists and multiple update options (branch visit, online, video KYC).',

                'loan|loan default|payment': '💰 **Loan Payment Reminders**\n\nFor customers with:\n• Outstanding loan amounts > ₹0\n• Overdue EMI payments\n• Missed payment deadlines\n\nIncludes payment options, consequences of non-payment, and contact information for assistance.',

                'email|smtp|send': (context) => {
                    let response = '📧 **Email Configuration & Sending**\n\n';
                    response += '**Setup Requirements**:\n';
                    response += '• Gmail SMTP credentials in .env file\n';
                    response += '• App-specific password (not regular password)\n';
                    response += '• 2-factor authentication enabled\n\n';
                    
                    if (context.selectedCustomers > 0) {
                        response += `You have ${context.selectedCustomers} customers selected for emailing.`;
                    } else {
                        response += '💡 **Tip**: Use "Test Email Setup" to verify configuration before bulk sending.';
                    }
                    
                    return response;
                },

                'error|problem|issue|not working': '🛠️ **Common Issues & Solutions**\n\n**Excel Upload Problems**:\n• Check file format (.xlsx/.xls)\n• Verify required columns exist\n• File size under 10MB\n\n**Analysis Issues**:\n• Select issue type first\n• Ensure customer data loaded\n• Check confidence threshold settings\n\n**Email Problems**:\n• Verify SMTP credentials\n• Use app-specific password\n• Check customer email addresses\n\n**PDF Generation**:\n• Allow pop-ups in browser\n• Check file download permissions\n\nNeed help with a specific error?',

                'ai|artificial intelligence|gemini': '🧠 **AI Features**\n\nThis system uses Google Gemini AI for:\n• Enhanced customer analysis\n• Intelligent priority scoring\n• Context-aware responses\n• Letter content optimization\n\nAI analysis provides:\n• Confidence scores (0-100%)\n• Priority levels (High/Medium/Low)\n• Specific reasoning for each customer\n• Recommendations for action\n\nEnable "Enhanced AI Analysis" in Step 2 for smarter filtering!',

                'template|letter template|customize': '📝 **Letter Templates**\n\nAvailable templates:\n• Account Closure Notice\n• KYC Update Required\n• Loan Payment Reminder\n• Fee Waiver Information\n• Document Expiry Notice\n\nEach template includes:\n• Official SBI letterhead\n• Regulatory compliance language\n• Customer-specific details\n• Contact information\n• Professional formatting\n\nUse the "Custom Instructions" field to add specific messages to all letters.',

                'statistics|analytics|report': (context) => {
                    let response = '📊 **System Statistics**\n\n';
                    response += `📋 Total Customers: ${context.totalCustomers}\n`;
                    response += `📄 Letters Generated: ${context.lettersGenerated}\n`;
                    response += `📧 Emails Sent: ${context.emailsSent}\n`;
                    response += `⚠️ Pending Actions: ${context.pendingActions}\n\n`;
                    response += 'Use the Analytics section for detailed charts and trends!';
                    return response;
                }
            },

            patterns: {
                'how to|how do i|how can i': '🎯 **Step-by-Step Process**\n\n1️⃣ **Upload**: Drop Excel file with customer data\n2️⃣ **Analyze**: Select issue type and analyze customers\n3️⃣ **Select**: Choose affected customers from results\n4️⃣ **Generate**: Create PDF letters or send emails\n\n**Quick Actions**: Use the blue buttons at the top for common tasks!\n\nWhat specific step do you need help with?',
                
                'what is|what are|explain': 'I\'d be happy to explain! The SBI Letter Automation System helps branch managers efficiently communicate with customers by:\n\n✨ **Automating** customer issue identification\n✨ **Generating** personalized letters\n✨ **Streamlining** bulk email sending\n✨ **Ensuring** regulatory compliance\n✨ **Tracking** communication analytics\n\nWhat specific feature would you like me to explain in detail?',
                
                '\\b\\d{10,16}\\b': 'I see you\'ve mentioned an account number. If you need help with a specific customer account, you can:\n\n🔍 Use the search box in the customer table\n📋 Filter customers by account number\n👁️ Preview individual letters\n✏️ Edit customer information\n\nIs there something specific you need help with for this account?'
            },

            default: [
                'I\'m here to help with the SBI Letter Automation System! Try asking about "file upload", "customer analysis", "letter generation", or "email sending". You can also type "help" for a complete list of topics.',
                
                'I can assist with Excel uploads, customer filtering, letter templates, email configuration, and system troubleshooting. What specific area would you like help with?',
                
                'Not sure what you need help with? Try these topics:\n• "Excel format" - File requirements\n• "Account closure" - Closure letter process\n• "Email setup" - SMTP configuration\n• "Error help" - Troubleshooting guide',
                
                'I\'m your SBI Letter Automation assistant! I can help with technical questions, guide you through processes, and troubleshoot issues. What would you like to know?'
            ]
        };
    }

    // Initialize shortcut suggestions
    initializeShortcuts() {
        return [
            { text: 'Help', query: 'help' },
            { text: 'Excel Format', query: 'excel upload requirements' },
            { text: 'Account Closure', query: 'account closure process' },
            { text: 'Email Setup', query: 'email configuration help' },
            { text: 'KYC Updates', query: 'kyc update letters' },
            { text: 'Error Help', query: 'troubleshoot problems' },
            { text: 'AI Features', query: 'artificial intelligence analysis' },
            { text: 'Templates', query: 'letter templates customize' }
        ];
    }

    // Update context with current application state
    updateContext() {
        this.contextData = {
            hasCustomers: window.SBIApp?.AppState?.customers?.length > 0 || false,
            totalCustomers: window.SBIApp?.AppState?.customers?.length || 0,
            hasAnalyzed: window.SBIApp?.AppState?.filteredCustomers?.length > 0 || false,
            selectedCustomers: window.SBIApp?.AppState?.selectedCustomers?.length || 0,
            currentIssue: window.SBIApp?.AppState?.currentIssueType || '',
            lettersGenerated: window.SBIApp?.AppState?.analytics?.lettersGenerated || 0,
            emailsSent: window.SBIApp?.AppState?.analytics?.emailsSent || 0,
            pendingActions: window.SBIApp?.AppState?.analytics?.pendingActions || 0
        };
    }

    // Add user message to chat
    addUserMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'user-message';
        messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(message)}</div>
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    // Add bot message to chat
    addBotMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'bot-message';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">${this.formatMessage(message)}</div>
        `;

        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Add quick action suggestions if relevant
        this.addQuickActions(message, messageDiv);
    }

    // Format message with markdown-like syntax
    formatMessage(message) {
        return message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>')
            .replace(/^(#{1,3})\s*(.*$)/gim, (match, hashes, text) => {
                const level = hashes.length;
                return `<h${level + 3}>${text}</h${level + 3}>`;
            });
    }

    // Add quick action buttons to relevant messages
    addQuickActions(message, messageDiv) {
        const actions = [];

        if (message.includes('Excel') || message.includes('upload')) {
            actions.push({
                text: 'Upload File',
                action: () => document.getElementById('excelFile')?.click()
            });
        }

        if (message.includes('analyze') || message.includes('customer')) {
            actions.push({
                text: 'Analyze Customers',
                action: () => window.SBIApp?.analyzeCustomers?.()
            });
        }

        if (message.includes('email') && message.includes('test')) {
            actions.push({
                text: 'Test Email',
                action: () => window.SBIApp?.testEmailConfig?.()
            });
        }

        if (actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions mt-2';
            
            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'btn btn-outline-primary btn-sm me-2 mb-1';
                button.textContent = action.text;
                button.onclick = action.action;
                actionsDiv.appendChild(button);
            });

            messageDiv.appendChild(actionsDiv);
        }
    }

    // Show typing indicator
    showTypingIndicator() {
        if (this.typingIndicator) return;

        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'bot-message typing-indicator';
        this.typingIndicator.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        chatMessages.appendChild(this.typingIndicator);
        this.scrollToBottom();
        this.isTyping = true;
    }

    // Hide typing indicator
    hideTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.remove();
            this.typingIndicator = null;
        }
        this.isTyping = false;
    }

    // Show typing suggestions
    showTypingSuggestions(input) {
        if (!input || input.length < 2) {
            this.hideSuggestions();
            return;
        }

        const suggestions = this.shortcuts
            .filter(shortcut => 
                shortcut.text.toLowerCase().includes(input.toLowerCase()) ||
                shortcut.query.toLowerCase().includes(input.toLowerCase())
            )
            .slice(0, 4);

        if (suggestions.length > 0) {
            this.displaySuggestions(suggestions);
        } else {
            this.hideSuggestions();
        }
    }

    // Display suggestions
    displaySuggestions(suggestions) {
        const chatSuggestions = document.getElementById('chatSuggestions');
        if (!chatSuggestions) return;

        chatSuggestions.innerHTML = '';
        suggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-primary btn-sm me-1 mb-1';
            button.textContent = suggestion.text;
            button.onclick = () => this.sendSuggestion(suggestion.query);
            chatSuggestions.appendChild(button);
        });
    }

    // Hide suggestions
    hideSuggestions() {
        const chatSuggestions = document.getElementById('chatSuggestions');
        if (chatSuggestions) {
            chatSuggestions.innerHTML = this.getDefaultSuggestions();
        }
    }

    // Get default suggestion buttons
    getDefaultSuggestions() {
        return `
            <button class="btn btn-outline-primary btn-sm me-1 mb-1" onclick="chatbot.sendSuggestion('help')">Help</button>
            <button class="btn btn-outline-primary btn-sm me-1 mb-1" onclick="chatbot.sendSuggestion('excel format')">Excel Format</button>
            <button class="btn btn-outline-primary btn-sm me-1 mb-1" onclick="chatbot.sendSuggestion('account closure')">Account Closure</button>
        `;
    }

    // Setup suggestion buttons
    setupSuggestionButtons() {
        const chatSuggestions = document.getElementById('chatSuggestions');
        if (chatSuggestions) {
            chatSuggestions.innerHTML = this.getDefaultSuggestions();
        }
    }

    // Send suggestion
    sendSuggestion(suggestion) {
        const input = document.getElementById('chatInput');
        if (input) {
            input.value = suggestion;
            this.sendMessage();
        }
    }

    // Clear chat
    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            this.showWelcomeMessage();
        }
        
        this.conversationHistory = [];
        this.saveConversationHistory();
    }

    // Show welcome message
    showWelcomeMessage() {
        setTimeout(() => {
            this.addBotMessage('Welcome to SBI Letter Automation! 👋\n\nI can help you with:\n• **Excel file uploads** and formatting\n• **Customer analysis** and filtering\n• **Letter generation** and templates\n• **Email configuration** and sending\n• **System troubleshooting**\n\nType "help" for detailed guidance or click the suggestions below!');
        }, 500);
    }

    // Add to conversation history
    addToHistory(userMessage, botResponse) {
        this.conversationHistory.push({
            user: userMessage,
            bot: botResponse,
            timestamp: new Date().toISOString()
        });

        // Keep only last 20 exchanges
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }

        this.saveConversationHistory();
    }

    // Save conversation to localStorage
    saveConversationHistory() {
        try {
            localStorage.setItem('sbi-chat-history', JSON.stringify(this.conversationHistory));
        } catch (error) {
            console.warn('Failed to save chat history:', error);
        }
    }

    // Load conversation from localStorage
    loadConversationHistory() {
        try {
            const saved = localStorage.getItem('sbi-chat-history');
            if (saved) {
                this.conversationHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Failed to load chat history:', error);
            this.conversationHistory = [];
        }
    }

    // Check online status
    async checkOnlineStatus() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            this.isOnline = response.ok;
        } catch (error) {
            this.isOnline = false;
        }

        this.updateStatusIndicator();
    }

    // Update status indicator
    updateStatusIndicator() {
        const statusElement = document.getElementById('chatbotStatus');
        if (statusElement) {
            statusElement.textContent = this.isOnline ? 'Online' : 'Offline';
            statusElement.className = `chatbot-status ${this.isOnline ? 'online' : 'offline'}`;
        }
    }

    // Scroll to bottom of chat
    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 100);
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Toggle chatbot visibility
    toggle() {
        const chatbotBody = document.getElementById('chatbotBody');
        if (chatbotBody) {
            const isVisible = chatbotBody.style.display !== 'none';
            chatbotBody.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                // Focus input when opening
                setTimeout(() => {
                    const input = document.getElementById('chatInput');
                    if (input) input.focus();
                }, 100);
            }
        }
    }

    // Get chat statistics
    getStatistics() {
        return {
            totalMessages: this.conversationHistory.length * 2, // user + bot messages
            conversationCount: this.conversationHistory.length,
            isOnline: this.isOnline,
            lastActivity: this.conversationHistory.length > 0 ? 
                new Date(this.conversationHistory[this.conversationHistory.length - 1].timestamp) : null
        };
    }
}

// Global functions for HTML onclick handlers
function toggleChatbot() {
    if (window.chatbot) {
        window.chatbot.toggle();
    }
}

function sendChatMessage() {
    if (window.chatbot) {
        window.chatbot.sendMessage();
    }
}

function sendSuggestion(suggestion) {
    if (window.chatbot) {
        window.chatbot.sendSuggestion(suggestion);
    }
}

function clearChat() {
    if (window.chatbot) {
        window.chatbot.clearChat();
    }
}

function handleChatKeyPress(event) {
    if (window.chatbot) {
        window.chatbot.handleKeyPress(event);
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize chatbot after a short delay
    setTimeout(() => {
        window.chatbot = new SBIChatbot();
        console.log('🤖 SBI Chatbot initialized');
    }, 1000);
});

// Export for other modules
window.SBIChatbot = SBIChatbot;
