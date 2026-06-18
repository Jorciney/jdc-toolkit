class PopupController {
  constructor() {
    this.elements = {
      // Status and Banner
      statusBanner: document.getElementById('status-banner'),
      
      // Views
      setupView: document.getElementById('setup-view'),
      dashboardView: document.getElementById('dashboard-view'),
      settingsView: document.getElementById('settings-view'),
      credentialsView: document.getElementById('credentials-view'),
      
      // Setup View Elements
      apiKeyInput: document.getElementById('api-key'),
      gitlabTokenInput: document.getElementById('gitlab-token'),
      gitlabUrlInput: document.getElementById('gitlab-url'),
      toggleApiKeyBtn: document.getElementById('toggle-api-key'),
      toggleGitlabTokenBtn: document.getElementById('toggle-gitlab-token'),
      resetGitlabUrlBtn: document.getElementById('reset-gitlab-url'),
      apiKeyStatus: document.getElementById('api-key-status'),
      gitlabTokenStatus: document.getElementById('gitlab-token-status'),
      gitlabUrlStatus: document.getElementById('gitlab-url-status'),
      gitlabUrlFieldStatus: document.getElementById('gitlab-url-field-status'),
      saveKeysBtn: document.getElementById('save-keys-btn'),
      testConnectionBtn: document.getElementById('test-connection-btn'),
      setupSettingsBtn: document.getElementById('setup-settings-btn'),
      
      // Dashboard View Elements
      startReviewBtn: document.getElementById('start-review-btn'),
      stopReviewBtn: document.getElementById('stop-review-btn'),
      settingsBtn: document.getElementById('settings-btn'),
      manageKeysBtn: document.getElementById('manage-keys-btn'),
      
      // Settings View Elements
      backFromSettingsBtn: document.getElementById('back-from-settings'),
      modelSelect: document.getElementById('model-select'),
      maxFilesInput: document.getElementById('max-files'),
      includeTestsCheckbox: document.getElementById('include-tests'),
      projectTypeSelect: document.getElementById('project-type'),
      customContextTextarea: document.getElementById('custom-context'),
      
      // Context Configuration Elements
      manualProjectInfoTextarea: document.getElementById('manual-project-info'),
      manualDirectionsTextarea: document.getElementById('manual-directions'),
      
      // Credentials View Elements
      backFromCredentialsBtn: document.getElementById('back-from-credentials'),
      apiKeyManageInput: document.getElementById('api-key-manage'),
      gitlabTokenManageInput: document.getElementById('gitlab-token-manage'),
      gitlabUrlManageInput: document.getElementById('gitlab-url-manage'),
      toggleApiKeyManageBtn: document.getElementById('toggle-api-key-manage'),
      toggleGitlabTokenManageBtn: document.getElementById('toggle-gitlab-token-manage'),
      resetGitlabUrlManageBtn: document.getElementById('reset-gitlab-url-manage'),
      apiKeyStatusManage: document.getElementById('api-key-status-manage'),
      gitlabTokenStatusManage: document.getElementById('gitlab-token-status-manage'),
      gitlabUrlStatusManage: document.getElementById('gitlab-url-status-manage'),
      testClaudeBtn: document.getElementById('test-claude-btn'),
      debugClaudeBtn: document.getElementById('debug-claude-btn'),
      testGitlabBtn: document.getElementById('test-gitlab-btn'),
      saveCredentialsBtn: document.getElementById('save-credentials-btn'),
      clearAllBtn: document.getElementById('clear-all-btn'),
      
      // Footer
      version: document.getElementById('version'),
      versionDisplay: document.getElementById('version-display'),
    };

    this.settings = {};
    this.previousView = 'dashboard'; // Track which view to return to from settings
    this.init();
  }

  async init() {
    console.log('🚀 Initializing popup...');
    
    // Debug elements
    console.log('📋 Element check:', {
      setupView: !!this.elements.setupView,
      dashboardView: !!this.elements.dashboardView,
      settingsView: !!this.elements.settingsView,
      credentialsView: !!this.elements.credentialsView,
      apiKeyInput: !!this.elements.apiKeyInput,
      settingsBtn: !!this.elements.settingsBtn
    });
    
    this.addEventListeners();
    await this.loadSettings();
    console.log('🔧 Settings loaded, updating UI...');
    this.updateUI();
    
    // Initialize button states (stop button should be hidden by default)
    this.setReviewState(false);
    
    console.log('🔍 Checking current tab...');
    this.checkCurrentTab();
    
    // Update version in both footer and header
    const version = chrome.runtime.getManifest().version;
    if (this.elements.version) {
      this.elements.version.textContent = `v${version}`;
    }
    if (this.elements.versionDisplay) {
      this.elements.versionDisplay.textContent = `v${version}`;
    }
  }

  addEventListeners() {
    // Setup View
    this.elements.saveKeysBtn?.addEventListener('click', () => this.saveApiKeys());
    this.elements.testConnectionBtn?.addEventListener('click', () => this.testApiConnection());
    this.elements.setupSettingsBtn?.addEventListener('click', () => this.showSettingsView());
    this.elements.toggleApiKeyBtn?.addEventListener('click', () => this.toggleApiKeyVisibility());
    this.elements.toggleGitlabTokenBtn?.addEventListener('click', () => this.toggleGitlabTokenVisibility());
    this.elements.resetGitlabUrlBtn?.addEventListener('click', () => this.resetGitlabUrl());
    this.elements.apiKeyInput?.addEventListener('input', () => this.updateApiKeyStatus());
    this.elements.gitlabTokenInput?.addEventListener('input', () => this.updateGitlabTokenStatus());
    this.elements.gitlabUrlInput?.addEventListener('input', () => this.updateGitlabUrlStatus());

    // Dashboard View
    this.elements.startReviewBtn?.addEventListener('click', () => this.triggerReview());
    this.elements.stopReviewBtn?.addEventListener('click', () => this.stopReview());
    this.elements.settingsBtn?.addEventListener('click', () => this.showSettingsView());
    this.elements.manageKeysBtn?.addEventListener('click', () => this.showCredentialsView());

    // Settings View
    this.elements.backFromSettingsBtn?.addEventListener('click', () => this.showPreviousView());
    this.elements.modelSelect?.addEventListener('change', () => this.saveSettings());
    this.elements.maxFilesInput?.addEventListener('change', () => this.saveSettings());
    this.elements.includeTestsCheckbox?.addEventListener('change', () => this.saveSettings());
    this.elements.projectTypeSelect?.addEventListener('change', () => this.saveSettings());
    this.elements.customContextTextarea?.addEventListener('change', () => this.saveSettings());
    
    // Context Configuration listeners
    this.elements.manualProjectInfoTextarea?.addEventListener('change', () => this.saveSettings());
    this.elements.manualDirectionsTextarea?.addEventListener('change', () => this.saveSettings());

    // Credentials View
    this.elements.backFromCredentialsBtn?.addEventListener('click', () => this.showDashboardView());
    this.elements.saveCredentialsBtn?.addEventListener('click', () => this.saveApiKeysFromManage());
    this.elements.clearAllBtn?.addEventListener('click', () => this.clearApiKeysFromManage());
    this.elements.testClaudeBtn?.addEventListener('click', () => this.testApiConnectionFromManage());
    this.elements.debugClaudeBtn?.addEventListener('click', () => this.debugApiCall());
    this.elements.testGitlabBtn?.addEventListener('click', () => this.testGitlabConnection());
    this.elements.toggleApiKeyManageBtn?.addEventListener('click', () => this.toggleApiKeyManageVisibility());
    this.elements.toggleGitlabTokenManageBtn?.addEventListener('click', () => this.toggleGitlabTokenManageVisibility());
    this.elements.resetGitlabUrlManageBtn?.addEventListener('click', () => this.resetGitlabUrlManage());
    this.elements.apiKeyManageInput?.addEventListener('input', () => this.updateApiKeyManageStatus());
    this.elements.gitlabTokenManageInput?.addEventListener('input', () => this.updateGitlabTokenManageStatus());
    this.elements.gitlabUrlManageInput?.addEventListener('input', () => this.updateGitlabUrlManageStatus());
  }

  async loadSettings() {
    const result = await chrome.storage.sync.get(['claudeApiKey', 'gitlabAccessToken', 'gitlabUrl', 'reviewSettings']);
    console.log('📥 Raw storage result:', result);
    console.log('📥 reviewSettings from storage:', result.reviewSettings);
    
    // Use defaults only if no settings exist at all
    const defaults = {
      model: 'claude-opus-4-8',
      maxFiles: 10,
      includeTests: true,
      projectContext: {
        projectType: '',
        customContext: ''
      },
      manualContext: {
        projectInfo: '',
        directions: '',
        useManual: true
      }
    };
    
    // If we have stored settings, use them; otherwise use defaults
    this.settings = result.reviewSettings || defaults;
    console.log('📥 Final loaded settings:', this.settings);
    
    // Ensure projectContext exists for backwards compatibility
    if (!this.settings.projectContext) {
      this.settings.projectContext = {
        projectType: '',
        customContext: ''
      };
    }
    
    // Ensure manualContext exists for backwards compatibility
    if (!this.settings.manualContext) {
      this.settings.manualContext = {
        projectInfo: '',
        directions: '',
        useManual: true
      };
      console.log('🔧 Created missing manualContext structure');
      // Save the updated structure
      await chrome.storage.sync.set({ reviewSettings: this.settings });
    } else {
      // Ensure useManual is set to true for existing users
      if (this.settings.manualContext.useManual === undefined) {
        this.settings.manualContext.useManual = true;
        console.log('🔧 Set useManual to true for existing user');
        await chrome.storage.sync.set({ reviewSettings: this.settings });
      }
    }
    
    if (this.elements.apiKeyInput) this.elements.apiKeyInput.value = result.claudeApiKey || '';
    if (this.elements.gitlabTokenInput) this.elements.gitlabTokenInput.value = result.gitlabAccessToken || '';
    if (this.elements.gitlabUrlInput) this.elements.gitlabUrlInput.value = result.gitlabUrl || '';
    if (this.elements.apiKeyManageInput) this.elements.apiKeyManageInput.value = result.claudeApiKey || '';
    if (this.elements.gitlabTokenManageInput) this.elements.gitlabTokenManageInput.value = result.gitlabAccessToken || '';
    if (this.elements.gitlabUrlManageInput) this.elements.gitlabUrlManageInput.value = result.gitlabUrl || '';
    if (this.elements.modelSelect) this.elements.modelSelect.value = this.settings.model;
    if (this.elements.maxFilesInput) this.elements.maxFilesInput.value = this.settings.maxFiles;
    if (this.elements.includeTestsCheckbox) this.elements.includeTestsCheckbox.checked = this.settings.includeTests;
    
    // Load project context
    if (this.elements.projectTypeSelect) this.elements.projectTypeSelect.value = this.settings.projectContext.projectType;
    if (this.elements.customContextTextarea) this.elements.customContextTextarea.value = this.settings.projectContext.customContext;
    
    // Load manual context
    console.log('📋 Loading manual context:', this.settings.manualContext);
    if (this.elements.manualProjectInfoTextarea) {
      const projectInfo = this.settings.manualContext.projectInfo || '';
      this.elements.manualProjectInfoTextarea.value = projectInfo;
      console.log('✅ Loaded project info:', projectInfo ? projectInfo.substring(0, 50) + '...' : '(empty)');
    }
    if (this.elements.manualDirectionsTextarea) {
      const directions = this.settings.manualContext.directions || '';
      this.elements.manualDirectionsTextarea.value = directions;
      console.log('✅ Loaded directions:', directions ? directions.substring(0, 50) + '...' : '(empty)');
    }
    
    // Update status indicators
    this.updateApiKeyStatus();
    this.updateGitlabTokenStatus();
    this.updateGitlabUrlStatus();
    this.updateApiKeyManageStatus();
    this.updateGitlabTokenManageStatus();
    this.updateGitlabUrlManageStatus();
  }

  async saveSettings() {
    this.settings.model = this.elements.modelSelect.value;
    this.settings.maxFiles = parseInt(this.elements.maxFilesInput.value, 10);
    this.settings.includeTests = this.elements.includeTestsCheckbox.checked;
    
    // Save project context
    this.settings.projectContext = {
      projectType: this.elements.projectTypeSelect?.value || '',
      customContext: this.elements.customContextTextarea?.value.trim() || ''
    };
    
    // Save manual context
    this.settings.manualContext = {
      projectInfo: this.elements.manualProjectInfoTextarea?.value.trim() || '',
      directions: this.elements.manualDirectionsTextarea?.value.trim() || '',
      useManual: true
    };
    
    console.log('💾 Saving settings:', this.settings);
    console.log('💾 Manual context being saved:', this.settings.manualContext);
    
    await chrome.storage.sync.set({ reviewSettings: this.settings });
    this.showStatus('Settings saved.', 'success');
  }

  async saveApiKeys() {
    const apiKey = this.elements.apiKeyInput.value.trim();
    const gitlabToken = this.elements.gitlabTokenInput.value.trim();
    let gitlabUrl = this.elements.gitlabUrlInput.value.trim();

    if (!apiKey || !gitlabToken) {
      this.showStatus('API key and token are required.', 'error');
      return;
    }

    // Validate and clean GitLab URL if provided
    if (gitlabUrl) {
      if (!this.isValidUrl(gitlabUrl)) {
        this.showStatus('Invalid GitLab URL format.', 'error');
        return;
      }
      // Clean the URL to remove any path components
      const cleanedUrl = this.cleanGitLabUrl(gitlabUrl);
      if (cleanedUrl !== gitlabUrl) {
        console.log('Cleaned GitLab URL from:', gitlabUrl, 'to:', cleanedUrl);
        gitlabUrl = cleanedUrl;
        this.elements.gitlabUrlInput.value = cleanedUrl;
      }
    }

    await chrome.storage.sync.set({
      claudeApiKey: apiKey,
      gitlabAccessToken: gitlabToken,
      gitlabUrl: gitlabUrl
    });
    this.showStatus('API keys saved!', 'success');
    this.updateApiKeyStatus();
    this.updateGitlabTokenStatus();
    this.updateUI();
  }

  updateUI() {
    const apiKey = this.elements.apiKeyInput?.value || '';
    const gitlabToken = this.elements.gitlabTokenInput?.value || '';

    console.log('🔄 UpdateUI - API Key length:', apiKey.length, 'GitLab Token length:', gitlabToken.length);
    console.log('🔍 Current view state:', {
      setupViewHidden: this.elements.setupView?.classList.contains('hidden'),
      dashboardViewHidden: this.elements.dashboardView?.classList.contains('hidden'),
      settingsViewHidden: this.elements.settingsView?.classList.contains('hidden')
    });

    if (apiKey && gitlabToken) {
      console.log('✅ Both keys present, showing dashboard');
      this.showDashboardView();
    } else {
      console.log('❌ Missing keys, showing setup');
      this.showSetupView();
    }
  }

  async checkCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isMrPage = tab && tab.url && tab.url.includes('/merge_requests/');
    
    console.log('🔍 Current tab URL:', tab?.url);
    console.log('🔍 Is MR page:', isMrPage);
    console.log('🔍 Start review button exists:', !!this.elements.startReviewBtn);

    if (isMrPage) {
      // Add retry logic for content script communication
      let retries = 3;
      while (retries > 0) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getReviewStatus' });
          if (response) {
            if (this.elements.startReviewBtn) this.elements.startReviewBtn.disabled = false;
            if (response.isReviewing) {
              this.setReviewState(true);
              this.showStatus('Review in progress.', 'info');
            } else {
              this.setReviewState(false);
              this.showStatus('Ready to review MR.', 'success');
            }
            return; // Success, exit retry loop
          }
        } catch (e) {
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
          }
        }
      }
      
      // All retries failed
      this.showStatus('Content script not loaded. Please reload the page.', 'warning');
      if (this.elements.startReviewBtn) this.elements.startReviewBtn.disabled = true;
      this.setReviewState(false); // Ensure stop button is hidden when content script isn't responding
    } else {
      this.showStatus('Not on a GitLab MR page.', 'warning');
      if (this.elements.startReviewBtn) this.elements.startReviewBtn.disabled = true;
      this.setReviewState(false); // Ensure stop button is hidden when not on MR page
    }
  }

  async triggerReview() {
    this.setLoading(true);
    this.showStatus('Starting review...', 'info');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Get API keys first
      const keysResponse = await chrome.runtime.sendMessage({ action: 'getApiKeys' });
      if (!keysResponse.apiKey || !keysResponse.gitlabToken) {
        this.showStatus('Please set API keys first.', 'error');
        this.setLoading(false);
        return;
      }

      // Get settings
      const settings = {
        model: 'claude-opus-4-8',
        maxFiles: 10,
        includeTests: true,
        deepAnalysis: true
      };

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'startReview',
        settings: settings,
        apiKey: keysResponse.apiKey,
        gitlabToken: keysResponse.gitlabToken
      });

      if (response && response.success) {
        this.showStatus('Review in progress.', 'info');
        // The UI will remain in a loading state until the review is complete or stopped.
      } else {
        this.showStatus(response?.error || 'Failed to start review', 'error');
        this.setLoading(false);
      }
    } catch (e) {
      this.showStatus('Failed to communicate with the page.', 'error');
      this.setLoading(false);
    }
  }

  async stopReview() {
    this.setLoading(false);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'stopReview' });
      this.showStatus('Review stopped.', 'info');
    } catch (e) {
      this.showStatus('Failed to stop review.', 'error');
    }
  }

  showStatus(message, type = 'info') {
    if (this.elements.statusBanner) {
      this.elements.statusBanner.textContent = message;
      this.elements.statusBanner.className = `status-banner ${type}`;
      this.elements.statusBanner.classList.remove('hidden');
      setTimeout(() => this.elements.statusBanner.classList.add('hidden'), 3000);
    }
  }

  setLoading(isLoading) {
    if (this.elements.startReviewBtn) {
      const btnText = this.elements.startReviewBtn.querySelector('.btn-text');
      if (btnText) btnText.classList.toggle('hidden', isLoading);
      
      this.elements.startReviewBtn.disabled = isLoading;
      this.elements.startReviewBtn.classList.toggle('hidden', isLoading);
    }
    
    // Stop button should only be visible when actively reviewing (not just loading)
    if (this.elements.stopReviewBtn) {
      this.elements.stopReviewBtn.classList.add('hidden');
    }
  }

  setReviewState(isReviewing) {
    console.log('🔄 Setting review state:', isReviewing);
    
    if (this.elements.startReviewBtn) {
      this.elements.startReviewBtn.disabled = isReviewing;
      this.elements.startReviewBtn.classList.toggle('hidden', isReviewing);
    }
    
    if (this.elements.stopReviewBtn) {
      this.elements.stopReviewBtn.classList.toggle('hidden', !isReviewing);
    }
  }

  showSetupView() {
    console.log('📱 Showing setup view');
    this.hideAllViews();
    if (this.elements.setupView) {
      this.elements.setupView.classList.remove('hidden');
      console.log('✅ Setup view shown');
    } else {
      console.error('❌ Setup view element not found');
    }
  }

  showDashboardView() {
    console.log('📱 Showing dashboard view');
    this.hideAllViews();
    if (this.elements.dashboardView) {
      this.elements.dashboardView.classList.remove('hidden');
      console.log('✅ Dashboard view shown');
    } else {
      console.error('❌ Dashboard view element not found');
    }
  }

  showSettingsView(fromView = null) {
    console.log('📱 Showing settings view from:', fromView);
    
    // Track which view to return to
    if (fromView) {
      this.previousView = fromView;
    } else {
      // Determine current view based on what's visible
      if (!this.elements.setupView?.classList.contains('hidden')) {
        this.previousView = 'setup';
      } else if (!this.elements.dashboardView?.classList.contains('hidden')) {
        this.previousView = 'dashboard';
      }
    }
    
    this.hideAllViews();
    if (this.elements.settingsView) {
      this.elements.settingsView.classList.remove('hidden');
      console.log('✅ Settings view shown, will return to:', this.previousView);
    } else {
      console.error('❌ Settings view element not found');
    }
  }

  showPreviousView() {
    console.log('🔙 Returning to previous view:', this.previousView);
    if (this.previousView === 'setup') {
      this.showSetupView();
    } else {
      this.showDashboardView();
    }
  }

  showCredentialsView() {
    this.hideAllViews();
    if (this.elements.credentialsView) this.elements.credentialsView.classList.remove('hidden');
    
    // Sync the values from storage
    this.loadApiKeysIntoManageView();
  }

  hideAllViews() {
    [this.elements.setupView, this.elements.dashboardView, this.elements.settingsView, this.elements.credentialsView]
      .forEach(view => view?.classList.add('hidden'));
  }

  async testApiConnection() {
    const apiKey = this.elements.apiKeyInput.value.trim();
    
    if (!apiKey) {
      this.showStatus('Please enter your Claude API key first.', 'error');
      return;
    }

    const testBtn = this.elements.testConnectionBtn;
    if (!testBtn) {
      this.showStatus('Test button not found.', 'error');
      return;
    }
    
    const originalText = testBtn.textContent;
    testBtn.textContent = 'Testing...';
    testBtn.disabled = true;

    try {
      console.log('🧪 Testing Claude API connectivity via background script...');
      
      // Test via background script to bypass CORS/network issues
      const result = await chrome.runtime.sendMessage({
        action: 'makeAnthropicAPICall',
        data: {
          apiKey: apiKey,
          body: {
            model: 'claude-haiku-4-5', // Use fastest model for testing
            max_tokens: 10,
            messages: [{
              role: 'user',
              content: 'Hi'
            }]
          }
        }
      });

      console.log('📡 Background API Test Result:', result);

      if (result.success) {
        console.log('✅ API Test successful via background script');
        this.showStatus('✅ API connection successful!', 'success');
      } else {
        console.error('❌ Background API Test failed:', result.error);
        
        let errorMessage = '❌ API Test failed';
        if (result.status === 401) {
          errorMessage = '❌ Invalid API key. Please check your Claude API key.';
        } else if (result.status === 429) {
          errorMessage = '⚠️ Rate limit exceeded. Your API key works but you need to wait.';
        } else if (result.error) {
          errorMessage = `❌ ${result.error}`;
        }
        
        this.showStatus(errorMessage, 'error');
      }
    } catch (fetchError) {
      console.error('🚨 Background script error during API test:', fetchError);
      
      if (fetchError.message && fetchError.message.includes('Extension context invalidated')) {
        this.showStatus('❌ Extension needs to be reloaded. Please reload the extension and try again.', 'error');
      } else {
        this.showStatus(`❌ Background script test failed: ${fetchError.message}`, 'error');
      }
    } finally {
      const testBtn = this.elements.testConnectionBtn;
      if (testBtn) {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
      }
    }
  }

  toggleApiKeyVisibility() {
    const input = this.elements.apiKeyInput;
    const button = this.elements.toggleApiKeyBtn;
    
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '🙈';
      button.title = 'Hide API Key';
    } else {
      input.type = 'password';
      button.textContent = '👁️';
      button.title = 'Show API Key';
    }
  }

  toggleGitlabTokenVisibility() {
    const input = this.elements.gitlabTokenInput;
    const button = this.elements.toggleGitlabTokenBtn;
    
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '🙈';
      button.title = 'Hide Token';
    } else {
      input.type = 'password';
      button.textContent = '👁️';
      button.title = 'Show Token';
    }
  }

  async clearApiKeys() {
    if (confirm('Are you sure you want to clear all API keys? This cannot be undone.')) {
      await chrome.storage.sync.remove(['claudeApiKey', 'gitlabAccessToken']);
      this.elements.apiKeyInput.value = '';
      this.elements.gitlabTokenInput.value = '';
      this.updateApiKeyStatus();
      this.updateGitlabTokenStatus();
      this.updateUI();
      this.showStatus('API keys cleared.', 'info');
    }
  }

  updateApiKeyStatus() {
    const apiKey = this.elements.apiKeyInput.value;
    const status = this.elements.apiKeyStatus;
    
    if (!apiKey) {
      status.textContent = 'No API key saved';
      status.className = 'api-key-status status-missing';
    } else if (apiKey.length < 20) {
      status.textContent = 'API key appears to be invalid (too short)';
      status.className = 'api-key-status status-invalid';
    } else {
      const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
      status.textContent = `Saved: ${maskedKey}`;
      status.className = 'api-key-status status-valid';
    }
  }

  updateGitlabTokenStatus() {
    const token = this.elements.gitlabTokenInput.value;
    const status = this.elements.gitlabTokenStatus;
    
    if (!token) {
      status.textContent = 'No GitLab token saved';
      status.className = 'gitlab-token-status status-missing';
    } else if (token.length < 10) {
      status.textContent = 'Token appears to be invalid (too short)';
      status.className = 'gitlab-token-status status-invalid';
    } else {
      const maskedToken = `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
      status.textContent = `Saved: ${maskedToken}`;
      status.className = 'gitlab-token-status status-valid';
    }
  }

  updateGitlabUrlStatus() {
    const url = this.elements.gitlabUrlInput?.value?.trim();
    const status = this.elements.gitlabUrlStatus;
    
    if (!status) return;
    
    if (!url) {
      status.textContent = 'Using default (gitlab.com)';
      status.className = 'field-status valid';
    } else if (!this.isValidUrl(url)) {
      status.textContent = 'Invalid URL format';
      status.className = 'field-status invalid';
    } else {
      try {
        const urlObj = new URL(url);
        status.textContent = `Custom: ${urlObj.host}`;
        status.className = 'field-status valid';
      } catch {
        status.textContent = 'Invalid URL format';
        status.className = 'field-status invalid';
      }
    }
  }

  resetGitlabUrl() {
    if (this.elements.gitlabUrlInput) {
      this.elements.gitlabUrlInput.value = '';
      this.updateGitlabUrlStatus();
    }
  }

  // API Management View Methods
  async loadApiKeysIntoManageView() {
    const result = await chrome.storage.sync.get(['claudeApiKey', 'gitlabAccessToken', 'gitlabUrl']);
    this.elements.apiKeyManageInput.value = result.claudeApiKey || '';
    this.elements.gitlabTokenManageInput.value = result.gitlabAccessToken || '';
    if (this.elements.gitlabUrlManageInput) {
      this.elements.gitlabUrlManageInput.value = result.gitlabUrl || '';
    }
    this.updateApiKeyManageStatus();
    this.updateGitlabTokenManageStatus();
    this.updateGitlabUrlManageStatus();
  }

  async saveApiKeysFromManage() {
    const apiKey = this.elements.apiKeyManageInput.value.trim();
    const gitlabToken = this.elements.gitlabTokenManageInput.value.trim();
    let gitlabUrl = this.elements.gitlabUrlManageInput?.value?.trim();

    if (!apiKey || !gitlabToken) {
      this.showStatus('API key and token are required.', 'error');
      return;
    }

    // Validate and clean GitLab URL if provided
    if (gitlabUrl) {
      if (!this.isValidUrl(gitlabUrl)) {
        this.showStatus('Invalid GitLab URL format.', 'error');
        return;
      }
      // Clean the URL to remove any path components
      const cleanedUrl = this.cleanGitLabUrl(gitlabUrl);
      if (cleanedUrl !== gitlabUrl) {
        console.log('Cleaned GitLab URL from:', gitlabUrl, 'to:', cleanedUrl);
        gitlabUrl = cleanedUrl;
        this.elements.gitlabUrlManageInput.value = cleanedUrl;
      }
    }

    await chrome.storage.sync.set({
      claudeApiKey: apiKey,
      gitlabAccessToken: gitlabToken,
      gitlabUrl: gitlabUrl || ''
    });

    // Update both views
    this.elements.apiKeyInput.value = apiKey;
    this.elements.gitlabTokenInput.value = gitlabToken;
    if (this.elements.gitlabUrlInput) {
      this.elements.gitlabUrlInput.value = gitlabUrl || '';
    }

    this.showStatus('Credentials saved!', 'success');
    this.updateApiKeyStatus();
    this.updateGitlabTokenStatus();
    this.updateGitlabUrlStatus();
    this.updateApiKeyManageStatus();
    this.updateGitlabTokenManageStatus();
    this.updateGitlabUrlManageStatus();
    this.updateUI();
  }

  async clearApiKeysFromManage() {
    if (confirm('Are you sure you want to clear all credentials? This cannot be undone.')) {
      await chrome.storage.sync.remove(['claudeApiKey', 'gitlabAccessToken', 'gitlabUrl']);
      
      // Clear both views
      this.elements.apiKeyInput.value = '';
      this.elements.gitlabTokenInput.value = '';
      if (this.elements.gitlabUrlInput) this.elements.gitlabUrlInput.value = '';
      this.elements.apiKeyManageInput.value = '';
      this.elements.gitlabTokenManageInput.value = '';
      if (this.elements.gitlabUrlManageInput) this.elements.gitlabUrlManageInput.value = '';
      
      this.updateApiKeyStatus();
      this.updateGitlabTokenStatus();
      this.updateGitlabUrlStatus();
      this.updateApiKeyManageStatus();
      this.updateGitlabTokenManageStatus();
      this.updateGitlabUrlManageStatus();
      this.updateUI();
      this.showStatus('All credentials cleared.', 'info');
    }
  }

  async testApiConnectionFromManage() {
    const apiKey = this.elements.apiKeyManageInput.value.trim();
    
    if (!apiKey) {
      this.showStatus('Please enter your Claude API key first.', 'error');
      return;
    }

    const originalText = this.elements.testClaudeBtn.textContent;
    this.elements.testClaudeBtn.textContent = 'Testing...';
    this.elements.testClaudeBtn.disabled = true;

    try {
      console.log('🧪 Testing Claude API connectivity via background script...');
      
      const result = await chrome.runtime.sendMessage({
        action: 'makeAnthropicAPICall',
        data: {
          apiKey: apiKey,
          body: {
            model: 'claude-haiku-4-5',
            max_tokens: 10,
            messages: [{
              role: 'user',
              content: 'Hi'
            }]
          }
        }
      });

      console.log('📡 Background API Test Result:', result);

      if (result.success) {
        console.log('✅ API Test successful via background script');
        this.showStatus('✅ API connection successful!', 'success');
      } else {
        console.error('❌ Background API Test failed:', result.error);
        
        let errorMessage = '❌ API Test failed';
        if (result.status === 401) {
          errorMessage = '❌ Invalid API key. Please check your Claude API key.';
        } else if (result.status === 429) {
          errorMessage = '⚠️ Rate limit exceeded. Your API key works but you need to wait.';
        } else if (result.error) {
          errorMessage = `❌ ${result.error}`;
        }
        
        this.showStatus(errorMessage, 'error');
      }
    } catch (fetchError) {
      console.error('🚨 Background script error during API test:', fetchError);
      
      if (fetchError.message && fetchError.message.includes('Extension context invalidated')) {
        this.showStatus('❌ Extension needs to be reloaded. Please reload the extension and try again.', 'error');
      } else {
        this.showStatus(`❌ Background script test failed: ${fetchError.message}`, 'error');
      }
    } finally {
      this.elements.testClaudeBtn.textContent = originalText;
      this.elements.testClaudeBtn.disabled = false;
    }
  }

  toggleApiKeyManageVisibility() {
    const input = this.elements.apiKeyManageInput;
    const button = this.elements.toggleApiKeyManageBtn;
    
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '🙈';
      button.title = 'Hide API Key';
    } else {
      input.type = 'password';
      button.textContent = '👁️';
      button.title = 'Show API Key';
    }
  }

  toggleGitlabTokenManageVisibility() {
    const input = this.elements.gitlabTokenManageInput;
    const button = this.elements.toggleGitlabTokenManageBtn;
    
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '🙈';
      button.title = 'Hide Token';
    } else {
      input.type = 'password';
      button.textContent = '👁️';
      button.title = 'Show Token';
    }
  }

  updateApiKeyManageStatus() {
    const apiKey = this.elements.apiKeyManageInput.value;
    const status = this.elements.apiKeyStatusManage;
    
    if (!apiKey) {
      status.textContent = 'No API key saved';
      status.className = 'api-key-status status-missing';
    } else if (apiKey.length < 20) {
      status.textContent = 'API key appears to be invalid (too short)';
      status.className = 'api-key-status status-invalid';
    } else {
      const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
      status.textContent = `Current: ${maskedKey}`;
      status.className = 'api-key-status status-valid';
    }
  }

  updateGitlabTokenManageStatus() {
    const token = this.elements.gitlabTokenManageInput.value;
    const status = this.elements.gitlabTokenStatusManage;
    
    if (!token) {
      status.textContent = 'No GitLab token saved';
      status.className = 'gitlab-token-status status-missing';
    } else if (token.length < 10) {
      status.textContent = 'Token appears to be invalid (too short)';
      status.className = 'gitlab-token-status status-invalid';
    } else {
      const maskedToken = `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
      status.textContent = `Current: ${maskedToken}`;
      status.className = 'gitlab-token-status status-valid';
    }
  }

  updateGitlabUrlManageStatus() {
    const url = this.elements.gitlabUrlManageInput?.value?.trim();
    const status = this.elements.gitlabUrlStatusManage;
    
    if (!status) return;
    
    if (!url) {
      status.textContent = 'Using default (gitlab.com)';
      status.className = 'field-status valid';
    } else if (!this.isValidUrl(url)) {
      status.textContent = 'Invalid URL format';
      status.className = 'field-status invalid';
    } else {
      try {
        const urlObj = new URL(url);
        status.textContent = `Custom: ${urlObj.host}`;
        status.className = 'field-status valid';
      } catch {
        status.textContent = 'Invalid URL format';
        status.className = 'field-status invalid';
      }
    }
  }

  resetGitlabUrlManage() {
    if (this.elements.gitlabUrlManageInput) {
      this.elements.gitlabUrlManageInput.value = '';
      this.updateGitlabUrlManageStatus();
    }
  }

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  cleanGitLabUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      // Return only protocol and host, stripping any path
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return url; // If parsing fails, return as-is
    }
  }

  async debugApiCall() {
    const apiKey = this.elements.apiKeyManageInput.value.trim();
    
    if (!apiKey) {
      this.showStatus('Please enter your Claude API key first.', 'error');
      return;
    }

    console.log('🔍 Starting API Debug...');
    
    // Test 1: Check what's actually stored
    const stored = await chrome.storage.sync.get(['claudeApiKey', 'reviewSettings']);
    console.log('📦 Stored API Key:', stored.claudeApiKey ? stored.claudeApiKey.substring(0, 15) + '...' : 'NONE');
    console.log('📦 Stored Settings:', stored.reviewSettings);
    
    // Test 2: Check if keys match
    const inputKey = this.elements.apiKeyManageInput.value;
    const storedKey = stored.claudeApiKey;
    console.log('🔍 Keys match:', inputKey === storedKey);
    console.log('🔍 Input key length:', inputKey.length);
    console.log('🔍 Stored key length:', storedKey ? storedKey.length : 0);
    
    // Test 3: Try the exact curl request format
    console.log('🧪 Testing with exact curl format...');
    console.log('🔍 Using API key:', apiKey.substring(0, 15) + '...');
    try {
      const requestBody = {
        model: 'claude-opus-4-8',
        max_tokens: 50,
        messages: [
          {"role": "user", "content": "Hello, world"}
        ]
      };
      
      console.log('📋 Request body:', requestBody);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 Direct fetch response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Direct fetch successful:', result);
        this.showStatus('✅ Direct API call works! The issue might be in the background script.', 'success');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Direct fetch failed:', response.status, errorData);
        this.showStatus(`❌ Direct API call failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('🚨 Direct fetch error:', error);
      this.showStatus(`❌ Direct fetch error: ${error.message}`, 'error');
    }
    
    // Test 4: Try via background script with detailed logging
    console.log('🧪 Testing via background script...');
    try {
      const bgResult = await chrome.runtime.sendMessage({
        action: 'makeAnthropicAPICall',
        data: {
          apiKey: apiKey,
          body: {
            model: 'claude-opus-4-8',
            max_tokens: 50,
            messages: [
              {"role": "user", "content": "Hello, world"}
            ]
          }
        }
      });
      
      console.log('📡 Background script result:', bgResult);
      
      if (bgResult.success) {
        this.showStatus('✅ Background script works too!', 'success');
      } else {
        this.showStatus(`❌ Background script failed: ${bgResult.error}`, 'error');
      }
    } catch (bgError) {
      console.error('🚨 Background script error:', bgError);
      this.showStatus(`❌ Background script error: ${bgError.message}`, 'error');
    }
  }

  async testGitlabConnection() {
    const token = this.elements.gitlabTokenManageInput?.value.trim();
    
    if (!token) {
      this.showStatus('Please enter your GitLab token first.', 'error');
      return;
    }

    const testBtn = this.elements.testGitlabBtn;
    if (!testBtn) return;
    
    const originalText = testBtn.textContent;
    testBtn.textContent = 'Testing...';
    testBtn.disabled = true;

    try {
      // Use configured GitLab URL or detect from current tab
      let gitlabBaseUrl = this.elements.gitlabUrlManageInput?.value?.trim() || '';
      
      if (!gitlabBaseUrl) {
        // Fallback to tab detection
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        gitlabBaseUrl = 'https://gitlab.com';
        
        if (tab?.url) {
          if (tab.url.includes('gitlab.cmt.apps.telenet.be')) {
            gitlabBaseUrl = 'https://gitlab.cmt.apps.telenet.be';
          } else if (tab.url.match(/https:\/\/[^\/]*\.gitlab\.com/)) {
            const match = tab.url.match(/https:\/\/[^\/]*\.gitlab\.com/);
            gitlabBaseUrl = match[0];
          }
        }
      }
      
      // Validate URL format
      if (gitlabBaseUrl && !this.isValidUrl(gitlabBaseUrl)) {
        this.showStatus('❌ Invalid GitLab URL format. Please check the URL.', 'error');
        return;
      }
      
      console.log('🧪 Testing GitLab API connection to:', `${gitlabBaseUrl}/api/v4/user`);
      
      // Test GitLab API connection
      const response = await fetch(`${gitlabBaseUrl}/api/v4/user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        const urlObj = new URL(gitlabBaseUrl);
        this.showStatus(`✅ GitLab connection successful! Logged in as ${userData.username} on ${urlObj.host}`, 'success');
      } else {
        console.error('❌ GitLab API error:', response.status, response.statusText);
        if (response.status === 401) {
          this.showStatus('❌ Invalid GitLab token. Please check your Personal Access Token has "api" scope.', 'error');
        } else {
          this.showStatus(`❌ GitLab token test failed (${response.status}). Please check your token.`, 'error');
        }
      }
    } catch (error) {
      console.error('❌ GitLab connection error:', error);
      this.showStatus(`❌ GitLab connection error: ${error.message}`, 'error');
    } finally {
      testBtn.textContent = originalText;
      testBtn.disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupController());