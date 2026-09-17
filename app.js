document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // DOM Elements
    const sourceText = document.getElementById('sourceText');
    const wordCount = document.getElementById('wordCount');
    const charCount = document.getElementById('charCount');
    const clearBtn = document.getElementById('clearBtn');
    
    const styleSelect = document.getElementById('styleSelect');
    const lengthSelect = document.getElementById('lengthSelect');
    const summarizeBtn = document.getElementById('summarizeBtn');
    
    const outputContent = document.getElementById('outputContent');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const apiKeyInput = document.getElementById('apiKey');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const toast = document.getElementById('toast');

    let currentSummaryRaw = "";

    const DEFAULT_GROQ_KEY = '';

    // Load API Key
    const savedKey = localStorage.getItem('groq_api_key') || DEFAULT_GROQ_KEY;
    apiKeyInput.value = savedKey;

    // Configure Marked.js
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true
    });

    // Event Listeners
    sourceText.addEventListener('input', updateTextMetrics);
    
    clearBtn.addEventListener('click', () => {
        sourceText.value = '';
        updateTextMetrics();
        sourceText.focus();
    });

    summarizeBtn.addEventListener('click', handleSummarize);
    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', downloadSummary);

    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    
    // Close modal on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    saveSettingsBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('groq_api_key', key);
            showToast('API Key saved successfully!', 'success');
            settingsModal.classList.add('hidden');
        } else {
            localStorage.removeItem('groq_api_key');
            showToast('API Key cleared.', 'success');
            settingsModal.classList.add('hidden');
        }
    });

    // Functions
    function updateTextMetrics() {
        const text = sourceText.value;
        const chars = text.length;
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        
        charCount.textContent = `${chars} characters`;
        wordCount.textContent = `${words} words`;
        
        summarizeBtn.disabled = text.trim().length === 0;
    }

    /**
 * Handles text summarization by fetching settings, constructing
 * prompt templates, and invoking the Groq chat completions endpoint.
 * @returns {Promise<void>}
 */
async function handleSummarize() {
        const text = sourceText.value.trim();
        const apiKey = localStorage.getItem('groq_api_key') || DEFAULT_GROQ_KEY;
        
        if (!text) {
            showToast('Please enter some text to summarize.', 'error');
            return;
        }

        if (!apiKey) {
            showToast('Please set your GROQ API key in Settings first.', 'error');
            settingsModal.classList.remove('hidden');
            return;
        }

        const style = styleSelect.value;
        const length = lengthSelect.value;

        // UI State: Loading
        loadingOverlay.classList.remove('hidden');
        summarizeBtn.disabled = true;
        copyBtn.disabled = true;
        downloadBtn.disabled = true;

        try {
            const systemPrompt = `Summarize the following text as ${style}. Keep the summary ${length}. Use markdown formatting. Do not include introductory phrases like "Here is the summary" or "Sure, I can help". Just provide the summary.`;
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'qwen/qwen3.8-27b',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.5,
                    max_tokens: 1024
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API request failed');
            }

            const data = await response.json();
            const summary = data.choices[0].message.content;
            
            currentSummaryRaw = summary;
            
            // Render Markdown
            outputContent.innerHTML = marked.parse(summary);
            
            // Enable Actions
            copyBtn.disabled = false;
            downloadBtn.disabled = false;
            
        } catch (error) {
            console.error('Error generating summary:', error);
            showToast(`Error: ${error.message}`, 'error');
            outputContent.innerHTML = `
                <div class="placeholder-state" style="color: var(--error);">
                    <i data-lucide="alert-triangle"></i>
                    <p>Failed to generate summary.</p>
                </div>
            `;
            lucide.createIcons({ root: outputContent });
        } finally {
            loadingOverlay.classList.add('hidden');
            summarizeBtn.disabled = false;
        }
    }

    async function copyToClipboard() {
        if (!currentSummaryRaw) return;
        
        try {
            await navigator.clipboard.writeText(currentSummaryRaw);
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i data-lucide="check"></i> Copied';
            lucide.createIcons({ root: copyBtn });
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                lucide.createIcons({ root: copyBtn });
            }, 2000);
            
            showToast('Summary copied to clipboard', 'success');
        } catch (err) {
            showToast('Failed to copy to clipboard', 'error');
        }
    }

    function downloadSummary() {
        if (!currentSummaryRaw) return;
        
        const blob = new Blob([currentSummaryRaw], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `summary_${timestamp}.txt`;
        
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        // Force reflow
        void toast.offsetWidth;
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
        
        toast.classList.remove('hidden');
    }

    // Initial setup
    updateTextMetrics();
});
