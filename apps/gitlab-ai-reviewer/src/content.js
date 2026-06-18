// content.js - Enhanced content script for GitLab MR

// GitLab API Helper Class
class GitLabAPI {
  constructor(token, baseUrl) {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}/api/v4${endpoint}`;
    console.log('🌐 GitLab API Request:', { url, method: options.method || 'GET', hasBody: !!options.body });
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    console.log('📡 GitLab API Response:', { status: response.status, statusText: response.statusText });

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorData = await response.json();
        errorDetails = JSON.stringify(errorData);
        console.error('🚨 GitLab API Error Details:', errorData);
      } catch (e) {
        const errorText = await response.text();
        errorDetails = errorText;
        console.error('🚨 GitLab API Error Text:', errorText);
      }
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}. Details: ${errorDetails}`);
    }

    return response.json();
  }

  async getMergeRequestChanges(projectId, mrIid) {
    return this.makeRequest(`/projects/${projectId}/merge_requests/${mrIid}/changes`);
  }

  async getFileContent(projectId, filePath, ref) {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await this.makeRequest(`/projects/${projectId}/repository/files/${encodedPath}?ref=${ref}`);
      
      // Use UTF-8 safe base64 decoding
      try {
        return this.base64ToUtf8(response.content);
      } catch (decodeError) {
        console.warn(`Failed to decode content for ${filePath}:`, decodeError);
        // Fallback to regular atob for binary files
        return atob(response.content);
      }
    } catch (error) {
      console.warn(`Failed to get content for ${filePath}:`, error);
      return null;
    }
  }

  // UTF-8 safe base64 decoder
  base64ToUtf8(base64String) {
    try {
      // First decode base64 to binary string
      const binaryString = atob(base64String);
      
      // Convert binary string to Uint8Array
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Decode as UTF-8
      return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
      // If UTF-8 decoding fails, try as Latin1
      try {
        return atob(base64String);
      } catch (atobError) {
        console.warn('Both UTF-8 and Latin1 decoding failed:', error, atobError);
        return null;
      }
    }
  }


  async getProjectInfo(projectId) {
    return this.makeRequest(`/projects/${projectId}`);
  }

  async getMergeRequestInfo(projectId, mrIid) {
    return this.makeRequest(`/projects/${projectId}/merge_requests/${mrIid}`);
  }

  async postMergeRequestComment(projectId, mrIid, comment, position = null) {
    // URL-encode the project ID to handle slashes in group/project format
    const encodedProjectId = encodeURIComponent(projectId);
    console.log('💬 Posting comment:', { 
      originalProjectId: projectId, 
      encodedProjectId, 
      mrIid, 
      commentLength: comment.length,
      position: position 
    });
    
    const body = { body: comment };
    
    // If position is provided, add it for file-specific or line-specific commenting
    if (position) {
      Object.assign(body, position);
    }
    
    return this.makeRequest(`/projects/${encodedProjectId}/merge_requests/${mrIid}/notes`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async postFileSpecificComment(projectId, mrIid, comment, filePath, mrData = null, lineNumber = 1) {
    console.log('📁 Posting file-specific comment:', { 
      projectId, 
      mrIid, 
      filePath,
      lineNumber,
      commentLength: comment.length,
      mrData: mrData ? 'provided' : 'missing'
    });
    
    // Use GitLab's standard API for discussions (file-specific comments)
    const encodedProjectId = encodeURIComponent(projectId);
    
    // Build position object for file-specific comments
    const position = {
      base_sha: mrData?.baseSha || "9bc6cbc32f93e0828115541397f918f931f6988a",
      start_sha: mrData?.baseSha || "9bc6cbc32f93e0828115541397f918f931f6988a",
      head_sha: mrData?.diffHeadSha || "ae40c525dbce96049df53bd4860e90aee562dbca",
      old_path: filePath,
      new_path: filePath,
      position_type: "text",
      old_line: null,
      new_line: lineNumber || 1
    };
    
    // Create the request body for discussions API
    const body = {
      body: comment,
      position: position
    };
    
    console.log('📋 File-specific comment request:', {
      projectId: encodedProjectId,
      mrIid: mrIid,
      filePath: filePath,
      lineNumber: lineNumber,
      position: position,
      apiEndpoint: `/projects/${encodedProjectId}/merge_requests/${mrIid}/discussions`
    });
    
    // Use the standard GitLab API discussions endpoint
    return this.makeRequest(`/projects/${encodedProjectId}/merge_requests/${mrIid}/discussions`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
  
}

class GitLabCodeReviewer {
  constructor() {
    this.apiKey = null;
    this.gitlabToken = null;
    this.settings = {};
    this.currentReview = null;
    this.monorepoContext = null;
    this.gitlabApi = null;
    this.isReviewing = false; // Tracks review status
    this.reviewButtonInitialized = false; // Prevent duplicate button creation
    this.lastFileDetectionTime = null; // Cache file detection results
    this.lastFileDetectionResult = null;
    this.init();
  }

  async init() {
    // Listen for messages from popup and background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });

    if (this.isMergeRequestPage()) {
      await this.setupMRInterface();
      await this.detectMonorepoContext();
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'startReview':
          const result = await this.startReview(message.settings, message.apiKey, message.gitlabToken);
          sendResponse({ success: true, result });
          break;

        case 'analyzeChanges':
          const analysis = await this.analyzeChanges(message.settings);
          sendResponse({ success: true, fileCount: analysis.fileCount });
          break;

        case 'startReviewFromContext':
          await this.startReviewFromButton();
          sendResponse({ success: true });
          break;

        case 'getReviewStatus':
          sendResponse({ isReviewing: this.isReviewing });
          break;

        case 'stopReview':
          this.stopReview();
          sendResponse({ success: true });
          break;

        case 'showLastReview':
          this.showLastReview();
          sendResponse({ success: true });
          break;

        case 'ping':
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ error: error.message });
    }
  }

  isMergeRequestPage() {
    return window.location.pathname.includes('/merge_requests/') && 
           window.location.pathname.match(/\/merge_requests\/\d+/);
  }

  async setupMRInterface() {
    // Wait for GitLab to load
    await this.waitForElement('.merge-request-details, [data-testid="merge-request-details"], .merge-request');
    
    // Add review button to MR interface
    this.addReviewButton();
    
    // Add review buttons to individual files
    this.addReviewButtonsToFiles();

    // Add single file review button only if a specific file is being viewed
    this.setupSingleFileReviewButton();
    
    // Add review status indicator
    this.addReviewStatusIndicator();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Monitor for file navigation changes
    this.monitorFileChanges();
  }

  async detectMonorepoContext() {
    try {
      const mrData = await this.extractMergeRequestData();
      
      // Detect if this is a customer-web-monorepo based project
      this.monorepoContext = {
        isMonorepo: false,
        isCustomerWeb: false,
        mfeType: null,
        hasNx: false,
        hasAngular: false
      };

      // Check for monorepo indicators in files
      const changedFiles = await this.getChangedFiles();
      
      // Detect Angular monorepo patterns
      if (changedFiles.some(f => f.path.includes('nx.json') || f.path.includes('workspace.json'))) {
        this.monorepoContext.hasNx = true;
        this.monorepoContext.isMonorepo = true;
      }

      if (changedFiles.some(f => f.path.includes('angular.json') || f.path.includes('@angular'))) {
        this.monorepoContext.hasAngular = true;
      }

      // Detect customer-web specific patterns
      if (changedFiles.some(f => f.path.includes('customer-web') || f.path.includes('mfe'))) {
        this.monorepoContext.isCustomerWeb = true;
      }

      // Detect MFE type from file paths
      const mfePatterns = [
        'dashboard-mfe', 'payment-mfe', 'invoice-mfe', 'fleet-mfe',
        'billing-', 'account-', 'engagement-', 'sales-', 'marketing-'
      ];

      for (const pattern of mfePatterns) {
        if (changedFiles.some(f => f.path.includes(pattern))) {
          this.monorepoContext.mfeType = pattern;
          break;
        }
      }

      console.log('Detected monorepo context:', this.monorepoContext);
    } catch (error) {
      console.warn('Failed to detect monorepo context:', error);
    }
  }

  addReviewButton() {
    // Prevent duplicate button creation attempts
    if (this.reviewButtonInitialized || document.getElementById('ai-review-btn')) {
      return;
    }
    
    console.log('🔍 Adding review button...');
    this.reviewButtonInitialized = true;
    
    const tryAddButton = () => {
      // Try multiple possible selectors for GitLab's header actions
      const selectors = [
        // GitLab 18+ selectors
        '[data-testid="merge-request-actions"]',
        '.merge-request-header-actions',
        '.gl-mr-actions',
        '.mr-header-actions',
        '[data-testid="mr-actions-dropdown"]',
        '.merge-request-actions-container',
        // Legacy selectors for older GitLab versions
        '.merge-request-details .detail-page-header-actions',
        '.detail-page-header-actions',
        '.page-header-actions',
        '.issuable-header-actions',
        '.merge-request-header .header-action-buttons',
        '.mr-state-widget .mr-widget-header-actions',
        // Additional fallback selectors
        '.merge-request-details .gl-display-flex.gl-justify-content-end',
        '.merge-request-tabs + div .gl-display-flex',
        'header .gl-display-flex.gl-gap-2'
      ];
      
      for (const selector of selectors) {
        const actionsContainer = document.querySelector(selector);
        
        if (actionsContainer && !document.getElementById('ai-review-btn')) {
          console.log('✅ Found actions container, creating button');
          this.createReviewButton(actionsContainer);
          return true;
        }
      }
      
      return false;
    };
    
    // Try immediately
    if (tryAddButton()) {
      return;
    }
    
    // If not found, observe for changes with debouncing
    let observerTimeout;
    const observer = new MutationObserver((mutations) => {
      clearTimeout(observerTimeout);
      observerTimeout = setTimeout(() => {
        if (tryAddButton()) {
          observer.disconnect();
        }
      }, 200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also try after a small delay for slower loading pages
    setTimeout(() => {
      if (!document.getElementById('ai-review-btn')) {
        tryAddButton();
      }
    }, 2000);
  }

  createReviewButton(container) {
    const reviewButton = document.createElement('button');
    reviewButton.id = 'ai-review-btn';
    reviewButton.className = 'ai-code-reviewer__btn ai-code-reviewer__btn--primary';
    reviewButton.innerHTML = `
      <svg class="ai-code-reviewer__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      <span class="ai-code-reviewer__btn-text">🤖 Review this MR</span>
      <span class="ai-code-reviewer__loading ai-code-reviewer__hidden">
        <span class="ai-code-reviewer__spinner"></span>
        Reviewing...
      </span>
    `;

    const stopButton = document.createElement('button');
    stopButton.id = 'stop-review-btn';
    stopButton.className = 'ai-code-reviewer__btn ai-code-reviewer__btn--danger ai-code-reviewer__hidden';
    stopButton.innerHTML = `
      <svg class="ai-code-reviewer__icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 6h12v12H6z"/>
      </svg>
      Stop Review
    `;

    reviewButton.addEventListener('click', () => {
      this.startReviewFromButton();
    });

    stopButton.addEventListener('click', () => {
      this.stopReview();
    });

    container.appendChild(reviewButton);
    container.appendChild(stopButton);
    
    // Ensure buttons are in correct initial state
    this.setReviewButtonsLoading(false);
  }

  addReviewButtonsToFiles() {
    console.log('addReviewButtonsToFiles called');
    
    // Flag to prevent infinite loops when we're creating our own elements
    this.isCreatingButtons = false;
    
    // Debounce function to prevent excessive calls
    let debounceTimer;
    const debouncedCheck = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!this.isCreatingButtons) {
          this.checkAndAddFileButtons();
        }
      }, 300);
    };
    
    // Try immediately for already loaded files
    this.checkAndAddFileButtons();
    
    // Initial check with multiple attempts
    setTimeout(() => {
      this.checkAndAddFileButtons();
    }, 1000);
    
    // Additional check after longer delay
    setTimeout(() => {
      this.checkAndAddFileButtons();
    }, 3000);
    
    const observer = new MutationObserver((mutations) => {
      // Skip if we're currently creating buttons
      if (this.isCreatingButtons) {
        return;
      }
      
      // Skip mutations caused by our own button creation
      const hasOurMutations = mutations.some(mutation => {
        return mutation.addedNodes && Array.from(mutation.addedNodes).some(node => {
          return node.classList?.contains('ai-file-buttons-container') ||
                 node.classList?.contains('ai-review-file-btn') ||
                 node.querySelector?.('.ai-file-buttons-container, .ai-review-file-btn');
        });
      });
      
      if (hasOurMutations) {
        return;
      }
      
      // Only process if there are relevant changes
      const hasRelevantChanges = mutations.some(mutation => {
        return mutation.target.classList?.contains('diff-files') ||
               mutation.target.classList?.contains('diffs') ||
               mutation.target.closest('.diff-file') ||
               mutation.target.closest('[data-testid="diff-file"]');
      });
      
      if (hasRelevantChanges) {
        debouncedCheck();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  checkAndAddFileButtons() {
    const diffFiles = document.querySelectorAll('.diff-file, [data-testid="diff-file"], .file-holder');
    console.log(`🔍 Found ${diffFiles.length} diff files for button creation`);
    
    // Set flag to prevent mutation observer from triggering
    this.isCreatingButtons = true;
    
    diffFiles.forEach((diffFile, index) => {
      // First check if this diff file already has our buttons to avoid duplicates
      const existingContainer = diffFile.querySelector('.ai-file-buttons-container');
      const existingButton = diffFile.querySelector('.ai-review-file-btn');
      
      if (existingContainer || existingButton) {
        console.log(`🔍 File ${index + 1}: Already has AI review button, skipping`);
        return;
      }
      
      // Debug: Show what selectors we're trying
      const selectorCandidates = [
        '.diff-file-header',
        '.file-header', 
        '[data-testid="file-header"]',
        '.js-file-header',
        '.gl-border-b',
        '.file-title-flex-parent',
        '.diff-file-path',
        'header'
      ];
      
      let fileHeader = null;
      for (const selector of selectorCandidates) {
        const candidate = diffFile.querySelector(selector);
        if (candidate) {
          fileHeader = candidate;
          console.log(`🔍 File ${index + 1}: Found header with selector '${selector}'`);
          break;
        }
      }
      
      if (!fileHeader) {
        console.log(`🔍 File ${index + 1}: Trying to find any suitable element...`);
        // If no specific header found, look for any element with file path info
        const pathElements = diffFile.querySelectorAll('[title], [data-testid]');
        for (const elem of pathElements) {
          if (elem.textContent?.includes('.') || elem.title?.includes('.')) {
            fileHeader = elem.closest('div, header, section') || elem;
            console.log(`🔍 File ${index + 1}: Using path element as header:`, elem.tagName);
            break;
          }
        }
      }
      
      console.log(`🔍 File ${index + 1}: fileHeader found:`, !!fileHeader);
      
      if (fileHeader) {
        // Look for existing button containers or create in appropriate location
        let buttonContainer = fileHeader.querySelector('.diff-file-actions, .file-actions, [data-testid="file-actions"], .js-file-actions');
        console.log(`🔍 File ${index + 1}: primary buttonContainer found:`, !!buttonContainer);
        
        if (!buttonContainer) {
          // In GitLab 18.2, buttons might be in a different location
          buttonContainer = fileHeader.querySelector('.gl-display-flex.gl-gap-2, .file-header-actions');
          console.log(`🔍 File ${index + 1}: fallback buttonContainer found:`, !!buttonContainer);
        }
        
        // If still no container, create one ourselves
        if (!buttonContainer) {
          console.log(`🔍 File ${index + 1}: Creating button container`);
          buttonContainer = document.createElement('div');
          buttonContainer.style.display = 'inline-flex';
          buttonContainer.style.gap = '8px';
          buttonContainer.style.marginLeft = 'auto';
          buttonContainer.className = 'ai-file-buttons-container';
          buttonContainer.setAttribute('data-ai-created', 'true'); // Mark as our creation
          
          // Try to append to the best location
          const appendTarget = fileHeader.querySelector('.gl-display-flex, .file-actions, div:last-child') || fileHeader;
          appendTarget.appendChild(buttonContainer);
        }
        
        // Double check for existing buttons in this specific container
        const hasExistingButton = buttonContainer.querySelector('.ai-review-file-btn');
        console.log(`🔍 File ${index + 1}: existing button check:`, !!hasExistingButton);
        
        if (!hasExistingButton) {
          this.createFileReviewButton(buttonContainer);
          const filePath = fileHeader.querySelector('.diff-file-path-text, .file-title-name, [data-testid="file-title-name"], .file-path, .file-title')?.textContent?.trim();
          console.log('✅ Created file review button for:', filePath);
        }
      } else {
        console.log(`⚠️ File ${index + 1}: No fileHeader found`);
      }
    });
    
    // Reset flag after a short delay to allow DOM to settle
    setTimeout(() => {
      this.isCreatingButtons = false;
    }, 100);
  }

  createFileReviewButton(container) {
    const reviewFileButton = document.createElement('button');
    reviewFileButton.className = 'ai-code-reviewer__btn ai-code-reviewer__btn--secondary ai-review-file-btn';
    reviewFileButton.innerHTML = `
      <svg class="ai-code-reviewer__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
      <span class="ai-code-reviewer__btn-text">Review this file</span>
    `;

    reviewFileButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.reviewCurrentFile(e.target.closest('.diff-file'));
    });

    // Create stop button for this file
    const stopFileButton = document.createElement('button');
    stopFileButton.className = 'ai-code-reviewer__btn ai-code-reviewer__btn--danger ai-review-file-stop-btn ai-code-reviewer__hidden';
    stopFileButton.innerHTML = `
      <svg class="ai-code-reviewer__icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 6h12v12H6z"/>
      </svg>
      Stop Review
    `;

    stopFileButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.stopReview();
    });

    // Use the passed container directly, or try to find actions container within it
    let actionsContainer = container.querySelector && container.querySelector('.diff-file-actions, .file-actions, [data-testid="file-actions"]');
    if (!actionsContainer) {
      actionsContainer = container; // Use the container itself if no actions container found
    }
    
    if (actionsContainer && actionsContainer.prepend && actionsContainer.appendChild) {
      actionsContainer.prepend(reviewFileButton);
      actionsContainer.appendChild(stopFileButton);
    } else {
      console.warn('⚠️ Container does not support prepend/appendChild, trying alternative approach');
      // Fallback approach
      if (container && container.appendChild) {
        container.appendChild(reviewFileButton);
        container.appendChild(stopFileButton);
      } else {
        console.error('❌ Cannot add file review buttons - no valid container');
      }
    }
  }

  // Enhanced method to detect if user is currently viewing a specific file
  isCurrentlyViewingFile() {
    const urlParams = new URLSearchParams(window.location.search);
    const filePath = urlParams.get('file_path');
    const hash = window.location.hash;
    
    // Cache the result to avoid repeated detection calls
    const currentTime = Date.now();
    if (this.lastFileDetectionTime && (currentTime - this.lastFileDetectionTime < 1000)) {
      return this.lastFileDetectionResult;
    }
    
    // Method 1: URL parameter contains file_path
    if (filePath) {
      this.lastFileDetectionResult = { method: 'url_param', filePath };
      this.lastFileDetectionTime = currentTime;
      return this.lastFileDetectionResult;
    }
    
    // Method 2: Hash contains file reference (GitLab's single file view)
    if (hash && hash.match(/[a-f0-9]{40}_\d+_\d+/)) {
      this.lastFileDetectionResult = { method: 'hash_pattern', hash };
      this.lastFileDetectionTime = currentTime;
      return this.lastFileDetectionResult;
    }
    
    // Method 3: Check if we're on a specific file diff page
    const pathSegments = window.location.pathname.split('/');
    if (pathSegments.includes('diffs') && hash.startsWith('#')) {
      this.lastFileDetectionResult = { method: 'diff_page', hash };
      this.lastFileDetectionTime = currentTime;
      return this.lastFileDetectionResult;
    }
    
    // Method 4: Check if there's only one visible diff file (focused view)
    const visibleDiffFiles = document.querySelectorAll('.diff-file:not(.d-none):not([style*="display: none"]), [data-testid="diff-file"]:not(.d-none):not([style*="display: none"]), .file-holder:not(.d-none):not([style*="display: none"])');
    if (visibleDiffFiles.length === 1) {
      const singleFile = visibleDiffFiles[0];
      const filePathElement = singleFile.querySelector('.diff-file-path-text, .file-title-name, [data-testid="file-title-name"], .file-path, [data-testid="file-path"]');
      const singleFilePath = filePathElement?.textContent?.trim();
      if (singleFilePath) {
        this.lastFileDetectionResult = { method: 'single_visible', filePath: singleFilePath, element: singleFile };
        this.lastFileDetectionTime = currentTime;
        return this.lastFileDetectionResult;
      }
    }
    
    // Method 5: Check if user clicked on a specific file and it's highlighted
    const highlightedFile = document.querySelector('.diff-file.is-active, .diff-file[data-file-hash]:target, [data-testid="diff-file"].is-active, [data-testid="diff-file"][data-file-hash]:target');
    if (highlightedFile) {
      const highlightedFilePathElement = highlightedFile.querySelector('.diff-file-path-text, .file-title-name, [data-testid="file-title-name"], .file-path, [data-testid="file-path"]');
      const highlightedFilePath = highlightedFilePathElement?.textContent?.trim();
      if (highlightedFilePath) {
        this.lastFileDetectionResult = { method: 'highlighted', filePath: highlightedFilePath, element: highlightedFile };
        this.lastFileDetectionTime = currentTime;
        return this.lastFileDetectionResult;
      }
    }
    
    this.lastFileDetectionResult = false;
    this.lastFileDetectionTime = currentTime;
    return false;
  }

  addSingleFileReviewButton() {
    console.log('addSingleFileReviewButton called');
    
    // Enhanced file detection logic
    const fileDetectionResult = this.isCurrentlyViewingFile();
    
    console.log('🔍 File detection result:', fileDetectionResult);
    
    if (fileDetectionResult) {
      // Try multiple container selectors to find where to place the button
      const containerSelectors = [
        '.merge-request-details .detail-page-header-actions',
        '.detail-page-header .detail-page-header-actions',
        '.detail-page-header-actions',
        '.merge-request-header .merge-request-header-actions',
        '.gl-display-flex.gl-gap-3'
      ];
      
      let actionsContainer = null;
      for (const selector of containerSelectors) {
        actionsContainer = document.querySelector(selector);
        if (actionsContainer) break;
      }
      
      if (actionsContainer && !document.getElementById('ai-review-single-file-btn')) {
        const detectedFileName = fileDetectionResult.filePath || 'Current File';
        const fileName = detectedFileName.split('/').pop();
        
        const reviewSingleFileButton = document.createElement('button');
        reviewSingleFileButton.id = 'ai-review-single-file-btn';
        reviewSingleFileButton.className = 'ai-code-reviewer__btn ai-code-reviewer__btn--primary';
        reviewSingleFileButton.style.marginLeft = '8px';
        reviewSingleFileButton.innerHTML = `
          <svg class="ai-code-reviewer__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <span class="ai-code-reviewer__btn-text">🤖 Review ${fileName}</span>
        `;

        reviewSingleFileButton.addEventListener('click', () => {
          // Pass the detected file information
          if (fileDetectionResult.element) {
            this.reviewCurrentFile(fileDetectionResult.element);
          } else {
            this.reviewCurrentFile(); // Fallback to URL-based detection
          }
        });
        
        actionsContainer.appendChild(reviewSingleFileButton);
        
        // Add the global stop button after the single file review button
        const existingStopButton = document.getElementById('stop-review-btn');
        if (existingStopButton) {
          // Move existing stop button to this container
          actionsContainer.appendChild(existingStopButton);
        }
        
        console.log('Created single file review button for:', fileName);
      }
    }
    
    // Also check if we're on a diff page with visible file diffs and add buttons to each file
    this.addFileSpecificReviewButtons();
  }

  addFileSpecificReviewButtons() {
    // Add review buttons to individual file diff headers
    const observer = new MutationObserver((mutations) => {
      const diffFiles = document.querySelectorAll('.diff-file, [data-testid="diff-file"], .file-holder');
      diffFiles.forEach(diffFile => {
        const fileHeader = diffFile.querySelector('.diff-file-header, .file-header, [data-testid="file-header"]');
        const fileActions = diffFile.querySelector('.diff-file-actions, .file-actions, [data-testid="file-actions"]');
        
        if (fileHeader && fileActions && !fileActions.querySelector('.ai-review-specific-file-btn')) {
          this.createSpecificFileReviewButton(fileHeader, fileActions, diffFile);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Run immediately as well
    setTimeout(() => {
      const diffFiles = document.querySelectorAll('.diff-file, [data-testid="diff-file"], .file-holder');
      diffFiles.forEach(diffFile => {
        const fileHeader = diffFile.querySelector('.diff-file-header, .file-header, [data-testid="file-header"]');
        const fileActions = diffFile.querySelector('.diff-file-actions, .file-actions, [data-testid="file-actions"]');
        
        if (fileHeader && fileActions && !fileActions.querySelector('.ai-review-specific-file-btn')) {
          this.createSpecificFileReviewButton(fileHeader, fileActions, diffFile);
        }
      });
    }, 1000);
  }

  createSpecificFileReviewButton(fileHeader, fileActions, diffFile) {
    const filePathElement = fileHeader.querySelector('.diff-file-path-text, .file-title-name, [data-testid="file-title-name"], .file-path, [data-testid="file-path"]');
    const filePath = filePathElement?.textContent?.trim();
    
    if (!filePath) return;
    
    const reviewSpecificFileButton = document.createElement('button');
    reviewSpecificFileButton.className = 'ai-code-reviewer__btn ai-code-reviewer__btn--secondary ai-review-specific-file-btn';
    reviewSpecificFileButton.style.fontSize = '12px';
    reviewSpecificFileButton.style.padding = '4px 8px';
    reviewSpecificFileButton.style.marginLeft = '4px';
    reviewSpecificFileButton.innerHTML = `
      <svg class="ai-code-reviewer__icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span class="ai-code-reviewer__btn-text">Review</span>
    `;

    reviewSpecificFileButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.reviewSpecificFile(diffFile, filePath);
    });

    fileActions.appendChild(reviewSpecificFileButton);
    console.log('Created specific file review button for:', filePath);
  }

  addReviewStatusIndicator() {
    const statusContainer = document.createElement('div');
    statusContainer.id = 'ai-review-status';
    statusContainer.className = 'ai-code-reviewer__status ai-code-reviewer__hidden';
    statusContainer.innerHTML = `
      <div class="ai-code-reviewer__status-content">
        <div class="ai-code-reviewer__status-icon">🤖</div>
        <div class="ai-code-reviewer__status-text">AI Review Status</div>
        <div class="ai-code-reviewer__status-details"></div>
        <div class="ai-code-reviewer__status-close" onclick="this.closest('.ai-code-reviewer__status').classList.add('ai-code-reviewer__hidden')">×</div>
      </div>
    `;
    
    const mrDetails = document.querySelector('.merge-request-details, [data-testid="merge-request-details"], .merge-request');
    if (mrDetails) {
      mrDetails.insertBefore(statusContainer, mrDetails.firstChild);
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + R for review
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.startReviewFromButton();
      }
    });
  }

  async startReviewFromButton() {
    const button = document.getElementById('ai-review-btn');
    if (!button || button.disabled) return;

    // Get API keys from storage
    const result = await chrome.runtime.sendMessage({ action: 'getApiKeys' });
    console.log('🔑 API Key retrieval result:', {
      hasApiKey: !!result.apiKey,
      hasGitlabToken: !!result.gitlabToken,
      apiKeyLength: result.apiKey ? result.apiKey.length : 0,
      apiKeyPrefix: result.apiKey ? result.apiKey.substring(0, 15) + '...' : 'MISSING'
    });
    
    if (!result.apiKey) {
      this.showNotification('Please set your Claude API key in the extension popup', 'error');
      return;
    }
    if (!result.gitlabToken) {
      this.showNotification('Please set your GitLab access token in the extension popup', 'error');
      return;
    }

    // Get actual settings from storage
    let settings;
    try {
      const settingsResult = await chrome.runtime.sendMessage({ action: 'getSettings' });
      settings = settingsResult.settings || {
        model: 'claude-opus-4-20250514',
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
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
      settings = {
        model: 'claude-opus-4-20250514',
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
    }

    await this.startReview(settings, result.apiKey, result.gitlabToken);
  }

  async startReview(settings, apiKey, gitlabToken) {
    if (this.isReviewing) {
      this.showNotification('A review is already in progress.', 'warning');
      return;
    }

    this.isReviewing = true;
    this.apiKey = apiKey;
    this.gitlabToken = gitlabToken;
    this.settings = settings;
    this.gitlabApi = new GitLabAPI(gitlabToken, await this.extractBaseUrl());

    try {
      this.setReviewStatus('Starting review...', 'running');
      this.setReviewButtonsLoading(true);

      const mrData = await this.extractMergeRequestData();
      this.setReviewStatus('Analyzing merge request...', 'running');

      if (!this.isReviewing) return; // Check if stopped

      const repoContext = await this.getRepositoryContext(mrData);
      this.setReviewStatus('Getting repository context...', 'running');

      if (!this.isReviewing) return; // Check if stopped

      const review = await this.performAIReview(mrData, repoContext);
      if (!this.isReviewing) return; // Check if stopped

      this.setReviewStatus('Review completed', 'success');
      this.displayReviewResults(review, mrData);

      await chrome.runtime.sendMessage({
        action: 'saveReviewResult',
        data: { mrUrl: window.location.href, mrData, review, timestamp: Date.now() },
      });

      await chrome.runtime.sendMessage({
        action: 'notifyReviewComplete',
        data: { 
          fileCount: repoContext.changedFiles.length, 
          issueCount: this.extractIssueCount(review), 
          tabId: null 
        },
      });

      return { success: true, review };
    } catch (error) {
      if (this.isReviewing) {
        console.error('Review failed:', error);
        this.setReviewStatus(`Review failed: ${error.message}`, 'error');
        this.showNotification('Review failed: ' + error.message, 'error');
        throw error;
      }
    } finally {
      this.isReviewing = false;
      this.setReviewButtonsLoading(false);
    }
  }

  stopReview() {
    if (!this.isReviewing) return;
    this.isReviewing = false;
    this.setReviewStatus('Review stopped by user.', 'warning');
    this.setReviewButtonsLoading(false);
    this.showNotification('Review has been stopped.', 'info');
  }

  async extractBaseUrl() {
    // First, check if user has configured a custom GitLab URL
    try {
      const result = await chrome.storage.sync.get(['gitlabUrl']);
      if (result.gitlabUrl && result.gitlabUrl.trim()) {
        const configuredUrl = result.gitlabUrl.trim();
        console.log('🔗 Configured GitLab URL from storage:', configuredUrl);

        // Clean the URL to ensure it only contains protocol and host
        try {
          const urlObj = new URL(configuredUrl);
          const cleanedUrl = `${urlObj.protocol}//${urlObj.host}`;

          if (cleanedUrl !== configuredUrl) {
            console.warn('⚠️ Configured GitLab URL contained path, cleaned to:', cleanedUrl);
            console.warn('⚠️ Original URL:', configuredUrl);
            console.warn('⚠️ Please update your GitLab URL setting to just the base URL');
          }

          console.log('🔗 Using cleaned GitLab URL:', cleanedUrl);
          return cleanedUrl;
        } catch (urlError) {
          console.error('❌ Invalid GitLab URL in settings:', configuredUrl, urlError);
          console.warn('⚠️ Falling back to current page URL');
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load GitLab URL from storage:', error);
    }

    // Fallback to current page URL
    const url = new URL(window.location.href);
    const baseUrl = `${url.protocol}//${url.host}`;
    console.log('🔗 Using detected GitLab URL from current page:', baseUrl);
    return baseUrl;
  }

    async extractMergeRequestData() {
    const url = window.location.href;
    
    // Try multiple URL patterns for different GitLab configurations
    const patterns = [
      // Standard GitLab.com and self-hosted format: /group/project/-/merge_requests/123
      /\/([^/]+\/[^/]+)\/-\/merge_requests\/(\d+)/,
      // Alternative format: /group/project/merge_requests/123
      /\/([^/]+\/[^/]+)\/merge_requests\/(\d+)/,
      // Legacy format or variations
      /\/([^/]+\/[^/]+)\/\-\/merge_requests\/(\d+)/
    ];
    
    let match = null;
    let projectPath = '';
    let mrIid = '';
    
    for (let pattern of patterns) {
      match = url.match(pattern);
      if (match) {
        [, projectPath, mrIid] = match;
        console.log('✅ URL pattern matched:', { pattern: pattern.toString(), projectPath, mrIid });
        break;
      }
    }

    if (!match) {
      console.error('❌ Could not parse merge request URL:', url);
      throw new Error(`Could not parse merge request URL: ${url}`);
    }

    // Use project path as primary identifier, fallback to numeric ID
    const numericProjectId = this.extractProjectId();
    const projectId = numericProjectId || projectPath;

    console.log('🔍 Project extraction results:', {
      projectPath,
      numericProjectId,
      finalProjectId: projectId,
      url
    });

    // Ensure we have a valid project identifier
    if (!projectId) {
      throw new Error('Could not extract project identifier from merge request page');
    }

    // Ensure we have a valid MR IID
    if (!mrIid) {
      throw new Error('Could not extract merge request IID from URL');
    }

    return {
      projectPath,
      projectId: projectId,
      mrIid,
      url,
      title: document.querySelector('.merge-request-details .title, .merge-request-title, [data-testid="mr-title"], h1.title, .page-title')?.textContent?.trim(),
      description: document.querySelector('.description .md, [data-testid="mr-description"], .description-content, .issuable-description')?.textContent?.trim(),
      author: document.querySelector('.author-link, [data-testid="mr-author"], .issuable-author-link')?.textContent?.trim(),
      targetBranch: this.extractBranchName('[data-testid="target-branch"]'),
      sourceBranch: this.extractBranchName('[data-testid="source-branch"]'),
      labels: this.extractLabels(),
      assignees: this.extractAssignees(),
      milestone: this.extractMilestone(),
      changedFilesCount: this.extractChangedFilesCount()
    };
  }

  extractProjectId() {
    console.log('🔍 Attempting to extract numeric project ID...');
    
    // Method 1: Try meta tag
    const metaElement = document.querySelector('meta[name="project-id"]');
    if (metaElement) {
      const id = metaElement.getAttribute('content');
      console.log('✅ Found project ID in meta tag:', id);
      return id;
    }

    // Method 2: Look in data attributes
    const projectElement = document.querySelector('[data-project-id]');
    if (projectElement) {
      const id = projectElement.getAttribute('data-project-id');
      console.log('✅ Found project ID in data attribute:', id);
      return id;
    }

    // Method 3: Look for GitLab's gon.project_id
    if (window.gon && window.gon.project_id) {
      console.log('✅ Found project ID in window.gon:', window.gon.project_id);
      return window.gon.project_id.toString();
    }

    // Method 4: Look in page scripts for project data
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
      // Look for various project ID patterns
      const patterns = [
        /project_id['":\s]*(\d+)/,
        /"project_id":\s*(\d+)/,
        /'project_id':\s*(\d+)/,
        /projectId['":\s]*(\d+)/,
        /"id":\s*(\d+).*"name":/  // project object pattern
      ];
      
      for (let pattern of patterns) {
        const match = script.textContent.match(pattern);
        if (match) {
          console.log('✅ Found project ID in script:', match[1]);
          return match[1];
        }
      }
    }

    // Method 5: Try to extract from URL patterns (numeric project IDs)
    const urlMatch = window.location.pathname.match(/\/(\d+)\/merge_requests/);
    if (urlMatch) {
      console.log('✅ Found project ID in URL:', urlMatch[1]);
      return urlMatch[1];
    }

    console.log('❌ No numeric project ID found, will use project path instead');
    return null;
  }

  extractBranchName(selector) {
    // Try multiple selectors for GitLab 18.2 compatibility
    const selectors = [
      selector, // Original selector
      '.merge-request-source-branch .gl-link',
      '.merge-request-target-branch .gl-link',
      '[data-testid="source-branch"] .gl-link',
      '[data-testid="target-branch"] .gl-link',
      '.mr-info .gl-font-monospace',
      '.issuable-meta .gl-font-monospace'
    ];
    
    for (const sel of selectors) {
      const element = document.querySelector(sel);
      const text = element?.textContent?.trim();
      if (text && text !== 'unknown' && text.length > 0) {
        return text;
      }
    }
    
    return 'main'; // Default to 'main' instead of 'unknown'
  }

  extractLabels() {
    const labels = [];
    document.querySelectorAll('.issuable-show-labels .label').forEach(label => {
      labels.push(label.textContent.trim());
    });
    return labels;
  }

  extractAssignees() {
    const assignees = [];
    document.querySelectorAll('.assignee .author-link, [data-testid="assignee-avatar"], .assignee-avatar-link').forEach(assignee => {
      const text = assignee.textContent?.trim() || assignee.getAttribute('title') || assignee.getAttribute('data-original-title');
      if (text) assignees.push(text);
    });
    return assignees;
  }

  extractMilestone() {
    const milestone = document.querySelector('.milestone .milestone-title, [data-testid="milestone"], .issuable-milestone');
    return milestone?.textContent?.trim() || milestone?.getAttribute('title') || null;
  }

  extractChangedFilesCount() {
    const changesTab = document.querySelector('[data-testid="changes-tab"], .merge-request-tabs a[href*="diffs"], .diffs-tab');
    const match = changesTab?.textContent?.match(/(\d+)/);
    if (match) return parseInt(match[1]);
    
    // Fallback: count diff files directly
    const diffFiles = document.querySelectorAll('.diff-file, [data-testid="diff-file"]');
    return diffFiles.length || 0;
  }

  async getRepositoryContext(mrData) {
    try {
      // Get changed files via GitLab API
      const apiChanges = await this.gitlabApi.getMergeRequestChanges(mrData.projectId, mrData.mrIid);
      const changedFiles = this.parseApiChanges(apiChanges.changes || []);
      
      // Filter files based on settings
      const filteredFiles = this.filterFiles(changedFiles);
      
      // Get file contents via GitLab API
      const fileContents = await this.getFileContentsViaApi(filteredFiles.slice(0, this.settings.maxFiles), mrData);
      
      // Get config files for context
      const configFiles = await this.getConfigFilesViaApi(mrData);

      return {
        changedFiles: filteredFiles,
        fileContents,
        configFiles,
        monorepoContext: this.monorepoContext,
        projectType: this.detectProjectType(configFiles),
        totalFiles: changedFiles.length,
        reviewedFiles: fileContents.length
      };
    } catch (error) {
      console.warn('Could not get repository context via API, falling back to DOM parsing:', error);
      
      // Fallback to original DOM-based approach
      const changedFiles = await this.getChangedFiles();
      const filteredFiles = this.filterFiles(changedFiles);
      const fileContents = await this.getFileContents(filteredFiles.slice(0, this.settings.maxFiles));
      const configFiles = await this.getConfigFiles();

      return { 
        changedFiles: filteredFiles, 
        fileContents, 
        configFiles,
        monorepoContext: this.monorepoContext,
        projectType: this.detectProjectType(configFiles),
        totalFiles: changedFiles.length,
        reviewedFiles: fileContents.length
      };
    }
  }

  parseApiChanges(changes) {
    return changes.map(change => ({
      path: change.new_path || change.old_path,
      diff: change.diff,
      isNew: change.new_file,
      isDeleted: change.deleted_file,
      isRenamed: change.renamed_file,
      addedLines: (change.diff?.match(/^\+/gm) || []).length,
      removedLines: (change.diff?.match(/^\-/gm) || []).length,
      totalChanges: (change.diff?.match(/^[+-]/gm) || []).length
    }));
  }

  async getFileContentsViaApi(files, mrData) {
    const contents = [];
    
    for (const file of files) {
      if (this.shouldAnalyzeFile(file.path) && !file.isDeleted) {
        try {
          const content = await this.gitlabApi.getFileContent(
            mrData.projectId, 
            file.path, 
            mrData.sourceBranch
          );
          
          if (content) {
            contents.push({
              path: file.path,
              content: content.substring(0, 4000),
              diff: file.diff?.substring(0, 2000),
              addedLines: file.addedLines,
              removedLines: file.removedLines,
              isNew: file.isNew
            });
          }
        } catch (error) {
          console.warn(`Could not get API content for ${file.path}:`, error);
          
          // Add diff-only entry as fallback
          if (file.diff) {
            contents.push({
              path: file.path,
              content: null,
              diff: file.diff.substring(0, 2000),
              addedLines: file.addedLines,
              removedLines: file.removedLines,
              isNew: file.isNew
            });
          }
        }
      }
    }
    
    return contents;
  }

  async getConfigFilesViaApi(mrData) {
    const configFiles = {};
    const configs = [
      'package.json', 'tsconfig.json', '.eslintrc.json', 
      'angular.json', 'nx.json', 'project.json', 'workspace.json'
    ];
    
    // Get correct branch reference
    let branchRef = mrData.sourceBranch;
    
    // If branch is still unknown/main, try to get it from GitLab API
    if (!branchRef || branchRef === 'unknown' || branchRef === 'main') {
      try {
        const mrInfo = await this.gitlabApi.getMergeRequestInfo(mrData.projectId, mrData.mrIid);
        branchRef = mrInfo.source_branch || mrInfo.head?.ref || 'main';
      } catch (error) {
        console.warn('Could not get branch info from API, using default');
        branchRef = 'main';
      }
    }
    
    for (const config of configs) {
      try {
        const content = await this.gitlabApi.getFileContent(
          mrData.projectId, 
          config, 
          branchRef
        );
        if (content) {
          configFiles[config] = content;
        }
      } catch (error) {
        // Config file not available, skip
      }
    }
    
    return configFiles;
  }

  async getChangedFiles() {
    // Navigate to changes tab if needed
    const changesTab = document.querySelector('[data-testid="changes-tab"], .merge-request-tabs a[href*="diffs"], .js-diffs-tab');
    if (changesTab && !changesTab.classList.contains('active')) {
      changesTab.click();
      await this.waitForElement('.diff-files-holder, [data-testid="diff-files-holder"], .diffs-container', 10000);
    }

    const files = [];
    const diffFiles = document.querySelectorAll('.diff-file, [data-testid="diff-file"], .file-holder');
    
    diffFiles.forEach(diffFile => {
      const fileHeader = diffFile.querySelector('.diff-file-path-text, .file-title-name, [data-testid="file-title-name"], .file-path');
      const fileName = fileHeader?.textContent?.trim();
      
      if (fileName) {
        const diffContent = diffFile.querySelector('.diff-content')?.textContent?.trim();
        const addedLines = (diffContent?.match(/^\+/gm) || []).length;
        const removedLines = (diffContent?.match(/^\-/gm) || []).length;
        
        files.push({
          path: fileName,
          diff: diffContent,
          isNew: diffFile.querySelector('.file-addition') !== null,
          isDeleted: diffFile.querySelector('.file-deletion') !== null,
          isRenamed: diffFile.querySelector('.file-modified') !== null,
          addedLines,
          removedLines,
          totalChanges: addedLines + removedLines
        });
      }
    });

    return files;
  }

  filterFiles(files) {
    return files.filter(file => {
      // Always include if deleted (for context)
      if (file.isDeleted) return true;
      
      // Check if should analyze this file type
      if (!this.shouldAnalyzeFile(file.path)) return false;
      
      // Filter out test files if not included
      if (!this.settings.includeTests && this.isTestFile(file.path)) return false;
      
      return true;
    });
  }

  shouldAnalyzeFile(path) {
    const extensions = ['.ts', '.js', '.html', '.scss', '.css', '.json', '.py', '.java', '.md'];
    const excludes = [
      'node_modules/', 'dist/', 'build/', '.git/', 'coverage/',
      'package-lock.json', 'yarn.lock', '.angular/'
    ];
    
    return extensions.some(ext => path.endsWith(ext)) &&
           !excludes.some(exclude => path.includes(exclude));
  }

  isTestFile(path) {
    return /\.(spec|test)\.(ts|js)$/.test(path) || 
           path.includes('/test/') || 
           path.includes('/__tests__/') ||
           path.includes('/e2e/');
  }

  async getFileContents(files) {
    const contents = [];
    
    for (const file of files) {
      if (this.shouldAnalyzeFile(file.path) && !file.isDeleted) {
        try {
          // Try to get the actual file content
          const content = await this.fetchFileContent(file.path);
          if (content) {
            contents.push({
              path: file.path,
              content: content.substring(0, 4000), // Increased limit
              diff: file.diff?.substring(0, 2000),
              addedLines: file.addedLines,
              removedLines: file.removedLines,
              isNew: file.isNew
            });
          }
        } catch (error) {
          console.warn(`Could not get content for ${file.path}:`, error);
          
          // Fallback: use diff content if available
          if (file.diff) {
            contents.push({
              path: file.path,
              content: null,
              diff: file.diff.substring(0, 2000),
              addedLines: file.addedLines,
              removedLines: file.removedLines,
              isNew: file.isNew
            });
          }
        }
      }
    }
    
    return contents;
  }

  async fetchFileContent(filePath) {
    // Try multiple methods to get file content
    
    // Method 1: Look for "View file" link
    const viewFileLink = document.querySelector(`a[href*="${filePath}"][href*="blob"]`);
    if (viewFileLink) {
      try {
        const response = await fetch(viewFileLink.href);
        const html = await response.text();
        
        // Extract content from GitLab's blob view
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const codeElement = doc.querySelector('.blob-content code, .blob-content pre');
        
        if (codeElement) {
          return codeElement.textContent;
        }
      } catch (error) {
        console.warn('Method 1 failed:', error);
      }
    }

    // Method 2: Try raw view if available
    const currentUrl = new URL(window.location.href);
    const rawUrl = `${currentUrl.origin}/${currentUrl.pathname.split('/merge_requests')[0]}/-/raw/${this.extractSourceBranch()}/${filePath}`;
    
    try {
      const response = await fetch(rawUrl);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.warn('Method 2 failed:', error);
    }

    return null;
  }

  extractSourceBranch() {
    const sourceBranchElement = document.querySelector('[data-testid="source-branch"]');
    return sourceBranchElement?.textContent?.trim() || 'main';
  }

  async getConfigFiles() {
    const configFiles = {};
    const configs = [
      'package.json', 'tsconfig.json', '.eslintrc.json', 
      'angular.json', 'nx.json', 'project.json'
    ];
    
    // Try to fetch common config files
    for (const config of configs) {
      try {
        const content = await this.fetchFileContent(config);
        if (content) {
          configFiles[config] = content;
        }
      } catch (error) {
        // Config file not available, skip
      }
    }
    
    return configFiles;
  }

  detectProjectType(configFiles) {
    if (configFiles['package.json']) {
      try {
        const pkg = JSON.parse(configFiles['package.json']);
        if (pkg.dependencies?.['@angular/core']) return 'angular';
        if (pkg.dependencies?.['react']) return 'react';
        if (pkg.dependencies?.['vue']) return 'vue';
        if (pkg.dependencies?.['@nx/workspace']) return 'nx-monorepo';
      } catch (e) {
        // Invalid JSON
      }
    }
    
    if (configFiles['nx.json']) return 'nx-monorepo';
    if (configFiles['angular.json']) return 'angular';
    
    return 'unknown';
  }

  async performAIReview(mrData, repoContext) {
    const prompt = await this.buildEnhancedReviewPrompt(mrData, repoContext);
    
    console.log('🤖 Starting AI review with prompt length:', prompt.length);
    
    if (!this.apiKey) {
      throw new Error('Claude API key not provided');
    }

    // More thorough API key validation
    const trimmedKey = this.apiKey.trim();
    if (trimmedKey !== this.apiKey) {
      console.warn('⚠️ API key has leading/trailing whitespace, trimming...');
      this.apiKey = trimmedKey;
    }

    if (this.apiKey.length < 20) {
      throw new Error(`Invalid Claude API key format. Key length: ${this.apiKey.length}, expected 20+ characters`);
    }

    if (!this.apiKey.startsWith('sk-ant-')) {
      throw new Error(`Invalid Claude API key format. Key should start with 'sk-ant-', got: '${this.apiKey.substring(0, 10)}...'`);
    }

    console.log('🔑 API Key validation passed:', {
      length: this.apiKey.length,
      prefix: this.apiKey.substring(0, 15) + '...',
      hasValidFormat: this.apiKey.startsWith('sk-ant-')
    });

    // Run network diagnostics before making the API call
    await this.runNetworkDiagnostics();
    
    const requestBody = {
      model: this.settings.model || 'claude-opus-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    };

    console.log('🌐 Making API request via background script...');
    console.log('📋 Request details:', {
      model: requestBody.model,
      maxTokens: requestBody.max_tokens,
      promptLength: prompt.length,
      apiKeyPresent: !!this.apiKey,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 15) + '...' : 'MISSING'
    });

    try {
      // First try background script (preferred method)
      console.log('🔑 Sending API key to background script:', {
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey ? this.apiKey.length : 0,
        apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 15) + '...' : 'MISSING'
      });
      
      const result = await chrome.runtime.sendMessage({
        action: 'makeAnthropicAPICall',
        data: {
          apiKey: this.apiKey,
          body: requestBody
        }
      });

      console.log('📡 Background API call result:', result.success ? 'SUCCESS' : 'FAILED');

      if (!result.success) {
        console.error('🚨 API Error from background:', result.error);
        throw new Error(result.error);
      }

      console.log('✅ AI review completed successfully via background script');
      return result.data;
      
    } catch (fetchError) {
      console.error('🚨 Background API call error:', fetchError);
      
      // If background script fails, try direct CORS-enabled call as fallback
      console.log('🔄 Attempting direct API call with CORS headers as fallback...');
      
      try {
        const directResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify(requestBody)
        });

        if (!directResponse.ok) {
          const errorText = await directResponse.text();
          throw new Error(`Direct API call failed: ${directResponse.status} ${directResponse.statusText}. ${errorText}`);
        }

        const directResult = await directResponse.json();
        
        if (!directResult.content || !directResult.content[0] || !directResult.content[0].text) {
          throw new Error('Invalid response format from direct API call');
        }

        console.log('✅ AI review completed successfully via direct CORS-enabled call');
        return directResult.content[0].text;
        
      } catch (directError) {
        console.error('🚨 Direct API call also failed:', directError);
        
        if (fetchError.message && fetchError.message.includes('Extension context invalidated')) {
          throw new Error('Extension needs to be reloaded. Please refresh the page and try again.');
        }
        
        throw new Error(`Both background and direct API calls failed. Background error: ${fetchError.message || 'Unknown error'}. Direct error: ${directError.message || 'Unknown error'}`);
      }
    }
  }

  async buildEnhancedReviewPrompt(mrData, repoContext) {
    const projectContext = await this.buildProjectContext();
    console.log('📤 Enhanced review prompt - project context:', projectContext ? 'INCLUDED' : 'MISSING');
    console.log('📤 Project context content preview:', projectContext.substring(0, 200) + '...');
    
    const finalPrompt = `You are an expert code reviewer specializing in Angular monorepo architectures and micro-frontend development. Review this GitLab merge request and provide direct, actionable feedback without meta-commentary or introductory phrases.

IMPORTANT: Start directly with your review sections. Do not include any introductory phrases like "Thank you for providing", "Based on the information", "Here is my review", etc. Jump straight into the technical analysis.

## MERGE REQUEST CONTEXT
- **Title**: ${mrData.title}
- **Author**: ${mrData.author}
- **Target Branch**: ${mrData.targetBranch}
- **Source Branch**: ${mrData.sourceBranch}
- **Labels**: ${mrData.labels.join(', ') || 'None'}
- **Changed Files**: ${repoContext.totalFiles} total, ${repoContext.reviewedFiles} analyzed
- **Description**: ${mrData.description || 'No description provided'}

## MONOREPO ARCHITECTURE CONTEXT
${this.buildMonorepoContext(repoContext)}

## PROJECT ANALYSIS
- **Project Type**: ${repoContext.projectType}
- **Has NX**: ${repoContext.monorepoContext?.hasNx ? 'Yes' : 'No'}
- **Has Angular**: ${repoContext.monorepoContext?.hasAngular ? 'Yes' : 'No'}
- **Customer Web Monorepo**: ${repoContext.monorepoContext?.isCustomerWeb ? 'Yes' : 'No'}
- **MFE Type**: ${repoContext.monorepoContext?.mfeType || 'Unknown'}

## CUSTOM PROJECT CONTEXT
${projectContext}

## CHANGED FILES ANALYSIS
${repoContext.fileContents.map(file => `
### 📁 ${file.path} ${file.isNew ? '(NEW FILE)' : `(+${file.addedLines}/-${file.removedLines})`}

${file.content ? `**Current Content:**
\`\`\`${this.getFileExtension(file.path)}
${file.content}
\`\`\`` : ''}

${file.diff ? `**Changes:**
\`\`\`diff
${file.diff}
\`\`\`` : ''}
`).join('\n')}

## SPECIALIZED REVIEW CRITERIA

### 🏗️ **Monorepo Architecture**
- Proper import boundaries between apps and libs
- Correct use of shared libraries (@telenet/*, @libs/*)
- No circular dependencies
- Proper NX project tags and constraints
- MFE isolation and independence

### 🔧 **Angular Best Practices**
- OnPush change detection strategy
- Proper RxJS usage and subscription management
- Standalone components implementation
- Lazy loading and code splitting
- Proper lifecycle hook usage

### 📦 **Bundle Size & Performance**
- Impact on MFE bundle sizes
- Tree shaking opportunities
- Lazy loading implementation
- Core Web Vitals considerations
- Unused imports and dead code

### 🧪 **Testing Strategy**
- Unit test coverage for new features
- Component testing setup
- E2E test considerations for MFE changes
- Mock strategies for shared dependencies

### 🔒 **Security & Quality**
- TypeScript strict mode compliance
- No 'any' types usage
- Proper error handling
- Input validation and sanitization
- Security best practices

## REVIEW OUTPUT FORMAT

Provide a direct technical review using these sections:

### 🚨 **CRITICAL ISSUES**
(Security vulnerabilities, breaking changes, performance regressions, architectural violations)

### 💡 **IMPROVEMENTS**
(Code quality enhancements, best practice implementations, maintainability improvements, performance optimizations)

### ✅ **SUGGESTIONS**
(Style improvements, documentation updates, testing enhancements, minor optimizations)

### 🏗️ **MONOREPO IMPACT**
(Effects on other MFEs, shared library changes impact, build and deployment considerations, dependency graph implications)

### 📊 **METRICS**
(Estimated bundle size impact, test coverage assessment, code complexity analysis, performance implications)

For each issue, provide:
- **File and line reference** (when possible)
- **Clear problem description**
- **Specific solution with code examples**
- **Severity level** (Critical/High/Medium/Low)
- **Impact assessment** on the monorepo

Focus on issues that are most relevant to this ${repoContext.monorepoContext?.isCustomerWeb ? 'Customer Web monorepo' : 'project'} architecture and development patterns.

REMEMBER: Begin directly with the first section header. No introduction, acknowledgment, or meta-commentary.`;
    
    console.log('🔍 Final enhanced review prompt preview (chars 3000-3500):', finalPrompt.substring(3000, 3500));
    console.log('📏 Final enhanced prompt length:', finalPrompt.length);
    console.log('🔍 Custom project context section in prompt:', finalPrompt.includes('## CUSTOM PROJECT CONTEXT') ? 'FOUND' : 'MISSING');
    return finalPrompt;
  }

  buildMonorepoContext(repoContext) {
    if (!repoContext.monorepoContext?.isMonorepo) {
      return 'This appears to be a standard single-application project.';
    }

    let context = 'This is a monorepo project with the following characteristics:\n';
    
    if (repoContext.monorepoContext.isCustomerWeb) {
      context += `- **Telenet Customer Web Monorepo**: Micro-frontend architecture\n`;
      context += `- **MFE Type**: ${repoContext.monorepoContext.mfeType || 'Unknown'}\n`;
      context += `- **Expected Patterns**: Angular standalone components, shared libraries, module federation\n`;
    }
    
    if (repoContext.monorepoContext.hasNx) {
      context += `- **NX Workspace**: Build optimization, dependency graph management\n`;
    }
    
    if (repoContext.monorepoContext.hasAngular) {
      context += `- **Angular Framework**: Component-based architecture, TypeScript\n`;
    }

    return context;
  }

  async buildProjectContext() {
    let contextString = '';

    console.log('🔧 buildProjectContext called with settings:', this.settings);
    console.log('📝 Manual context settings:', this.settings?.manualContext);

    // Use manual context override if enabled
    if (this.settings?.manualContext?.useManual) {
      console.log('📝 Using manual context override');
      
      if (this.settings.manualContext.projectInfo) {
        console.log('📝 Adding project info:', this.settings.manualContext.projectInfo.substring(0, 100) + '...');
        contextString += `**Project Information:**\n${this.settings.manualContext.projectInfo.trim()}\n\n`;
      } else {
        console.log('⚠️ No project info found in manual context');
      }
      
      if (this.settings.manualContext.directions) {
        console.log('📝 Adding directions:', this.settings.manualContext.directions.substring(0, 100) + '...');
        contextString += `**Review Directions:**\n${this.settings.manualContext.directions.trim()}\n\n`;
      } else {
        console.log('⚠️ No directions found in manual context');
      }
    } else {
      console.log('⚠️ Manual context not enabled or not found. useManual:', this.settings?.manualContext?.useManual);
    }

    // Always add user-configured project context
    if (this.settings?.projectContext) {
      const context = this.settings.projectContext;

      if (context.projectType) {
        const projectTypeMap = {
          // Frontend - Angular
          'angular-app': 'Angular Application',
          'angular-lib': 'Angular Library',
          'nx-monorepo': 'NX Monorepo',
          'microfrontend': 'Micro Frontend',
          // Frontend - Other
          'react-app': 'React Application',
          'vue-app': 'Vue.js Application',
          'svelte-app': 'Svelte Application',
          'nextjs-app': 'Next.js Application',
          'nuxt-app': 'Nuxt.js Application',
          'vanilla-js': 'Vanilla JavaScript',
          // Backend
          'nodejs-api': 'Node.js API',
          'express-api': 'Express.js API',
          'nestjs-api': 'NestJS API',
          'spring-boot': 'Spring Boot Application',
          'dotnet-api': '.NET API',
          'python-api': 'Python API',
          'fastapi': 'FastAPI Application',
          'django-api': 'Django API',
          'go-api': 'Go API',
          'rust-api': 'Rust API',
          // Other
          'fullstack': 'Full-stack Application',
          'mobile-app': 'Mobile Application',
          'desktop-app': 'Desktop Application',
          'other': 'Other'
        };
        contextString += `- **Project Type**: ${projectTypeMap[context.projectType] || context.projectType}\n`;
      }

      if (context.customContext) {
        contextString += `- **Additional Context**: ${context.customContext}\n`;
      }
    }

    const finalContext = contextString.trim() || 'No project context available.';
    console.log('📋 Final project context:', finalContext.substring(0, 200) + '...');
    return finalContext;
  }


  getFileExtension(filePath) {
    const ext = filePath.split('.').pop();
    const extMap = {
      'ts': 'typescript',
      'js': 'javascript',
      'html': 'html',
      'scss': 'scss',
      'css': 'css',
      'json': 'json',
      'md': 'markdown'
    };
    return extMap[ext] || 'text';
  }

  displayReviewResults(review, mrData) {
    // Remove existing modal if present
    const existingModal = document.getElementById('ai-review-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create and show new modal
    const modal = this.createEnhancedModal(review, mrData);
    document.body.appendChild(modal);
    
    // Focus management
    modal.focus();
    
    // Close on escape key
    const closeHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', closeHandler);
      }
    };
    document.addEventListener('keydown', closeHandler);
  }

  createEnhancedModal(review, mrData) {
    const modal = document.createElement('div');
    modal.id = 'ai-review-modal';
    modal.className = 'ai-code-reviewer__modal';
    modal.tabIndex = -1;
    
    const issueCount = this.extractIssueCount(review);
    const criticalCount = this.extractCriticalCount(review);
    
    // Encode data safely for UI buttons
    const encodedReview = this.utf8ToBase64(review);
    const encodedExportData = this.utf8ToBase64(JSON.stringify({ review, mrData, timestamp: Date.now() }));
    
    modal.innerHTML = `
      <div class="ai-code-reviewer__modal-backdrop">
        <div class="ai-code-reviewer__modal-content">
          <div class="ai-code-reviewer__modal-header">
            <div class="ai-code-reviewer__header-content">
              <h3 class="ai-code-reviewer__modal-title">🤖 AI Code Review Results</h3>
              <div class="ai-code-reviewer__review-summary">
                <span class="ai-code-reviewer__issue-badge ai-code-reviewer__issue-badge--critical">${criticalCount} Critical</span>
                <span class="ai-code-reviewer__issue-badge ai-code-reviewer__issue-badge--total">${issueCount} Total Issues</span>
              </div>
            </div>
            <button class="ai-code-reviewer__close-btn" id="main-modal-close-btn">&times;</button>
          </div>
          
          <div class="ai-code-reviewer__modal-body">
            <div class="ai-code-reviewer__review-tabs">
              <button class="ai-code-reviewer__tab-btn ai-code-reviewer__tab-btn--active" data-tab="review">📋 Review</button>
              <button class="ai-code-reviewer__tab-btn" data-tab="summary">📊 Summary</button>
            </div>
            
            <div class="ai-code-reviewer__tab-content">
              <div class="ai-code-reviewer__tab-panel ai-code-reviewer__tab-panel--active" id="review-panel">
                <div class="ai-code-reviewer__review-content">${this.formatReview(review)}</div>
              </div>
              
              <div class="ai-code-reviewer__tab-panel" id="summary-panel">
                <div class="ai-code-reviewer__summary-content">${this.generateSummary(review, mrData)}</div>
              </div>
            </div>
          </div>
          
          <div class="ai-code-reviewer__modal-footer">
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--secondary ai-code-reviewer__close-modal-btn">Close</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--primary ai-code-reviewer__copy-review-btn">📋 Copy Review</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--primary ai-code-reviewer__export-review-btn">💾 Export</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--success ai-code-reviewer__post-comment-btn">💬 Post Comment to MR</button>
          </div>
        </div>
      </div>
    `;
    
    // Add tab switching functionality
    modal.querySelectorAll('.ai-code-reviewer__tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active tab
        modal.querySelectorAll('.ai-code-reviewer__tab-btn').forEach(b => b.classList.remove('ai-code-reviewer__tab-btn--active'));
        modal.querySelectorAll('.ai-code-reviewer__tab-panel').forEach(p => p.classList.remove('ai-code-reviewer__tab-panel--active'));
        
        btn.classList.add('ai-code-reviewer__tab-btn--active');
        modal.querySelector(`#${tabName}-panel`).classList.add('ai-code-reviewer__tab-panel--active');
      });
    });
    
    // Add button event listeners
    const closeBtn = modal.querySelector('.ai-code-reviewer__close-modal-btn');
    const copyBtn = modal.querySelector('.ai-code-reviewer__copy-review-btn');
    const exportBtn = modal.querySelector('.ai-code-reviewer__export-review-btn');
    const postCommentBtn = modal.querySelector('.ai-code-reviewer__post-comment-btn');
    
    closeBtn?.addEventListener('click', () => this.closeModalAndResetState(modal));
    copyBtn?.addEventListener('click', () => this.copyReview(encodedReview));
    exportBtn?.addEventListener('click', () => this.exportReview(encodedExportData));
    postCommentBtn?.addEventListener('click', () => this.promptPostComment(encodedReview, null)); // No file info for main modal
    
    
    // Add event listener for inline close button
    const inlineCloseBtn = modal.querySelector('#main-modal-close-btn');
    inlineCloseBtn?.addEventListener('click', () => this.closeModalAndResetState(modal));
    
    return modal;
  }

  createFileReviewModal(review, fileInfo, mrData) {
    const modal = document.createElement('div');
    modal.id = 'ai-file-review-modal';
    modal.className = 'ai-code-reviewer__modal';
    modal.tabIndex = -1;
    
    // Encode data for buttons
    const encodedReview = this.utf8ToBase64(review);
    const encodedExportData = this.utf8ToBase64(JSON.stringify({ 
      review, 
      fileInfo, 
      mrData, 
      timestamp: Date.now(),
      reviewType: 'single-file'
    }));
    
    modal.innerHTML = `
      <div class="ai-code-reviewer__modal-backdrop">
        <div class="ai-code-reviewer__modal-content">
          <div class="ai-code-reviewer__modal-header">
            <div class="ai-code-reviewer__header-content">
              <h3 class="ai-code-reviewer__modal-title">📄 AI File Review: ${fileInfo.filePath}</h3>
              <div class="ai-code-reviewer__file-info">
                <span class="ai-code-reviewer__file-path">${fileInfo.filePath}</span>
                <span class="ai-code-reviewer__file-status">${fileInfo.isNewFile ? 'New' : fileInfo.isDeletedFile ? 'Deleted' : 'Modified'}</span>
              </div>
            </div>
            <button class="ai-code-reviewer__close-btn" id="file-modal-close-btn">&times;</button>
          </div>
          
          <div class="ai-code-reviewer__modal-body">
            <div class="ai-code-reviewer__review-content">${this.formatReview(review)}</div>
          </div>
          
          <div class="ai-code-reviewer__modal-footer">
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--secondary ai-code-reviewer__close-modal-btn">Close</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--primary ai-code-reviewer__copy-review-btn">📋 Copy Review</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--primary ai-code-reviewer__export-review-btn">💾 Export</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--success ai-code-reviewer__post-comment-btn">💬 Post Comment to MR</button>
          </div>
        </div>
      </div>
    `;

    // Add button event listeners for the file review modal
    const closeBtnFile = modal.querySelector('.ai-code-reviewer__close-modal-btn');
    const copyBtnFile = modal.querySelector('.ai-code-reviewer__copy-review-btn');
    const exportBtnFile = modal.querySelector('.ai-code-reviewer__export-review-btn');
    const postCommentBtnFile = modal.querySelector('.ai-code-reviewer__post-comment-btn');

    closeBtnFile?.addEventListener('click', () => this.closeModalAndResetState(modal));
    copyBtnFile?.addEventListener('click', () => this.copyReview(encodedReview));
    exportBtnFile?.addEventListener('click', () => this.exportReview(encodedExportData));
    postCommentBtnFile?.addEventListener('click', () => this.promptPostComment(encodedReview));
    
    // Add event listener for inline close button
    const inlineCloseBtnFile = modal.querySelector('#file-modal-close-btn');
    inlineCloseBtnFile?.addEventListener('click', () => this.closeModalAndResetState(modal));
    
    return modal;
  }

  formatReview(review) {
    let formatted = review;
    
    // First, protect and process code blocks with more flexible regex
    const codeBlocks = [];
    let codeBlockIndex = 0;
    
    // Handle code blocks with various patterns
    formatted = formatted.replace(/```(\w*)\s*([\s\S]*?)```/g, (match, language, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
      const lang = language || 'text';
      const cleanCode = code.trim();
      codeBlocks[codeBlockIndex] = `<pre><code class="language-${lang}">${this.escapeHtml(cleanCode)}</code></pre>`;
      codeBlockIndex++;
      return placeholder;
    });
    
    // Process other markdown elements
    formatted = formatted
      .replace(/#{1,3}\s(.+)/g, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
      .replace(/🚨/g, '<span class="issue-icon critical">🚨</span>')
      .replace(/💡/g, '<span class="issue-icon improvement">💡</span>')
      .replace(/✅/g, '<span class="issue-icon suggestion">✅</span>');
    
    // Restore code blocks
    for (let i = 0; i < codeBlocks.length; i++) {
      formatted = formatted.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
    }
    
    return formatted;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  generateSummary(review, mrData) {
    const issueCount = this.extractIssueCount(review);
    const criticalCount = this.extractCriticalCount(review);
    
    return `
      <div class="summary-stats">
        <div class="stat-card">
          <h4>Review Overview</h4>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-label">Total Issues</span>
              <span class="stat-value">${issueCount}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Critical Issues</span>
              <span class="stat-value critical">${criticalCount}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Files Reviewed</span>
              <span class="stat-value">${this.extractFileCount(review)}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Review Time</span>
              <span class="stat-value">${new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card">
          <h4>MR Details</h4>
          <div class="mr-info">
            <p><strong>Title:</strong> ${mrData.title}</p>
            <p><strong>Author:</strong> ${mrData.author}</p>
            <p><strong>Branch:</strong> ${mrData.sourceBranch} → ${mrData.targetBranch}</p>
            <p><strong>Files Changed:</strong> ${mrData.changedFilesCount}</p>
          </div>
        </div>
      </div>
    `;
  }


  extractIssueCount(review) {
    const issues = (review.match(/[🚨💡✅]/g) || []).length;
    return issues;
  }

  extractCriticalCount(review) {
    const critical = (review.match(/🚨/g) || []).length;
    return critical;
  }

  extractFileCount(review) {
    const files = (review.match(/### 📁/g) || []).length;
    return files;
  }

  setReviewButtonsLoading(loading, filePath = null) {
    const reviewButton = document.getElementById('ai-review-btn');
    const stopButton = document.getElementById('stop-review-btn');
    
    if (reviewButton) {
      reviewButton.disabled = loading;
      // Show/hide loading state for main review button
      const btnText = reviewButton.querySelector('.ai-code-reviewer__btn-text');
      const loadingText = reviewButton.querySelector('.ai-code-reviewer__loading');
      if (btnText && loadingText) {
        if (loading) {
          btnText.classList.add('ai-code-reviewer__hidden');
          loadingText.classList.remove('ai-code-reviewer__hidden');
        } else {
          btnText.classList.remove('ai-code-reviewer__hidden');
          loadingText.classList.add('ai-code-reviewer__hidden');
        }
      } else if (btnText) {
        // Fallback for buttons without loading element - just update text
        btnText.textContent = loading ? 'Reviewing...' : '🤖 Review this MR';
      }
    }
    
    // Toggle stop button visibility based on actual review state
    if (stopButton) {
      console.log('🔘 Stop button state - isReviewing:', this.isReviewing, 'loading:', loading);
      if (this.isReviewing) {
        console.log('🔘 Showing stop button');
        stopButton.classList.remove('ai-code-reviewer__hidden');
      } else {
        console.log('🔘 Hiding stop button');
        stopButton.classList.add('ai-code-reviewer__hidden');
      }
    } else {
      console.log('🔘 Stop button not found in DOM');
    }

    const singleFileReviewButton = document.getElementById('ai-review-single-file-btn');
    if (singleFileReviewButton) {
      singleFileReviewButton.disabled = this.isReviewing;
      const btnText = singleFileReviewButton.querySelector('.ai-code-reviewer__btn-text');
      if (btnText) {
        if (loading && filePath) {
          btnText.textContent = 'Reviewing...';
        } else {
          btnText.textContent = `Review ${filePath ? filePath.split('/').pop() : 'this file'}`;
        }
      }
    }

    const fileReviewButtons = document.querySelectorAll('.ai-review-file-btn');
    fileReviewButtons.forEach(button => {
      const fileElement = button.closest('.diff-file');
      const currentFilePath = this.getCurrentFileInfo(fileElement)?.filePath;
      if (filePath && currentFilePath === filePath) {
        // This specific file is being reviewed
        button.disabled = loading;
        const btnText = button.querySelector('.ai-code-reviewer__btn-text');
        if (btnText) {
          btnText.textContent = loading ? 'Reviewing...' : 'Review this file';
        }
      } else {
        // Other files should be disabled when any review is in progress
        button.disabled = this.isReviewing;
      }
    });

    // Handle file-specific stop buttons
    const fileStopButtons = document.querySelectorAll('.ai-review-file-stop-btn');
    fileStopButtons.forEach(stopBtn => {
      const fileElement = stopBtn.closest('.diff-file');
      const currentFilePath = this.getCurrentFileInfo(fileElement)?.filePath;
      if (filePath && currentFilePath === filePath && this.isReviewing) {
        // Show stop button for the file being reviewed
        stopBtn.classList.remove('ai-code-reviewer__hidden');
      } else {
        // Hide stop button for files not being reviewed
        stopBtn.classList.add('ai-code-reviewer__hidden');
      }
    });
  }

  closeModalAndResetState(modal) {
    console.log('🔄 Closing modal and resetting review state...');
    
    // Reset review state
    if (this.isReviewing) {
      console.log('⚠️ Review was in progress, resetting state');
      this.isReviewing = false;
    }
    
    // Reset button states
    this.setReviewButtonsLoading(false);
    
    // Remove the modal
    if (modal && modal.parentNode) {
      modal.remove();
      console.log('✅ Modal closed and state reset');
    }
  }

  setReviewStatus(message, type = 'info') {
    const statusContainer = document.getElementById('ai-review-status');
    if (!statusContainer) return;
    
    const statusText = statusContainer.querySelector('.ai-code-reviewer__status-text');
    const statusDetails = statusContainer.querySelector('.ai-code-reviewer__status-details');
    
    statusText.textContent = message;
    statusDetails.textContent = new Date().toLocaleTimeString();
    
    statusContainer.className = `ai-code-reviewer__status ai-code-reviewer__status--${type}`;
    statusContainer.classList.remove('ai-code-reviewer__hidden');
    
    // Auto-hide after delay unless error
    if (type !== 'error') {
      setTimeout(() => {
        statusContainer.classList.add('ai-code-reviewer__hidden');
      }, 5000);
    }
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.ai-code-reviewer__notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `ai-code-reviewer__notification ai-code-reviewer__notification--${type}`;
    notification.innerHTML = `
      <div class="ai-code-reviewer__notification-content">
        <span class="ai-code-reviewer__notification-icon">${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
        <span class="ai-code-reviewer__notification-text">${message}</span>
        <button class="ai-code-reviewer__notification-close" onclick="this.closest('.ai-code-reviewer__notification').remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
    
    // Remove on click
    notification.addEventListener('click', () => {
      notification.remove();
    });
  }

  async analyzeChanges(settings) {
    try {
      const changedFiles = await this.getChangedFiles();
      const filteredFiles = this.filterFiles(changedFiles);
      
      return {
        fileCount: filteredFiles.length,
        totalChanges: filteredFiles.reduce((sum, f) => sum + f.totalChanges, 0),
        fileTypes: this.analyzeFileTypes(filteredFiles)
      };
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  }

  analyzeFileTypes(files) {
    const types = {};
    files.forEach(file => {
      const ext = file.path.split('.').pop();
      types[ext] = (types[ext] || 0) + 1;
    });
    return types;
  }

  showLastReview() {
    // Show the last review results if available
    const existingModal = document.getElementById('ai-review-modal');
    if (existingModal) {
      existingModal.style.display = 'flex';
      existingModal.focus();
    } else {
      this.showNotification('No recent review found', 'warning');
    }
  }

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  // Global methods for UI interactions
  copyReview(encodedReview) {
    try {
      const review = this.base64ToUtf8Safe(encodedReview);
      navigator.clipboard.writeText(review).then(() => {
        this.showNotification('Review copied to clipboard!', 'success');
      });
    } catch (error) {
      console.error('Failed to copy review:', error);
      this.showNotification('Failed to copy review', 'error');
    }
  }

  exportReview(encodedData) {
    try {
      const jsonString = this.base64ToUtf8Safe(encodedData);
      const data = JSON.parse(jsonString);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-review-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showNotification('Review exported successfully!', 'success');
    } catch (error) {
      this.showNotification('Failed to export review', 'error');
    }
  }

  promptPostComment(encodedReview, fileInfo = null) {
    console.log('promptPostComment called with fileInfo:', fileInfo);
    try {
      const review = this.base64ToUtf8Safe(encodedReview);
      // Close all existing modals to avoid stacking
      const existingModals = document.querySelectorAll('.ai-code-reviewer__modal');
      existingModals.forEach(modal => {
        modal.style.display = 'none';
      });
      this.showCommentApprovalDialog(review, fileInfo);
    } catch (error) {
      console.error('Failed to decode review for comment posting:', error);
      this.showNotification('Failed to prepare comment for posting', 'error');
    }
  }

  showCommentApprovalDialog(review, fileInfo = null) {
    // Close any existing comment dialog first
    const existingDialog = document.querySelector('.ai-code-reviewer__comment-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Create approval dialog
    const dialog = document.createElement('div');
    dialog.className = 'ai-code-reviewer__modal ai-code-reviewer__comment-dialog';
    dialog.style.zIndex = '10002'; // Higher than main modal (which is 10000)
    
    const isFileSpecific = fileInfo && fileInfo.filePath;
    const commentTypeOptions = isFileSpecific ? `
      <div class="ai-code-reviewer__comment-options">
        <h4>Comment Location:</h4>
        <label class="ai-code-reviewer__radio-container">
          <input type="radio" name="comment-type" value="general" ${isFileSpecific ? '' : 'checked'}>
          <span class="ai-code-reviewer__radio-text">General MR comment</span>
        </label>
        <label class="ai-code-reviewer__radio-container">
          <input type="radio" name="comment-type" value="file-specific" ${isFileSpecific ? 'checked' : ''}>
          <span class="ai-code-reviewer__radio-text">File-specific comment (${fileInfo.filePath})</span>
        </label>
      </div>
    ` : '';
    
    dialog.innerHTML = `
      <div class="ai-code-reviewer__modal-backdrop">
        <div class="ai-code-reviewer__modal-content ai-code-reviewer__comment-dialog-content">
          <div class="ai-code-reviewer__modal-header">
            <h3 class="ai-code-reviewer__modal-title">💬 Post AI Review Comment</h3>
            <button class="ai-code-reviewer__close-btn ai-code-reviewer__close-comment-dialog">&times;</button>
          </div>
          
          <div class="ai-code-reviewer__modal-body">
            <p class="ai-code-reviewer__dialog-description">
              Review the AI-generated comment below and make any edits before posting it to the merge request:
            </p>
            
            ${commentTypeOptions}
            
            <div class="ai-code-reviewer__comment-preview">
              <label for="comment-text" class="ai-code-reviewer__label">Comment Text:</label>
              <textarea 
                id="comment-text" 
                class="ai-code-reviewer__comment-textarea"
                rows="12"
                placeholder="Edit the AI review comment..."
              >${this.formatReviewForComment(review)}</textarea>
            </div>
          </div>
          
          <div class="ai-code-reviewer__modal-footer">
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--secondary ai-code-reviewer__cancel-comment-btn">Cancel</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--secondary ai-code-reviewer__make-shorter-btn">✂️ Make it shorter</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--success ai-code-reviewer__post-approved-comment-btn">✅ Post Comment</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Focus the textarea
    const textarea = dialog.querySelector('#comment-text');
    textarea.focus();
    textarea.setSelectionRange(0, 0); // Place cursor at start
    
    // Store dialog reference and file info for posting
    this.currentCommentDialog = dialog;
    this.currentFileInfo = fileInfo;
    
    // Add button event listeners
    const cancelBtn = dialog.querySelector('.ai-code-reviewer__cancel-comment-btn');
    const postBtn = dialog.querySelector('.ai-code-reviewer__post-approved-comment-btn');
    const closeBtn = dialog.querySelector('.ai-code-reviewer__close-comment-dialog');
    const makeShorterBtn = dialog.querySelector('.ai-code-reviewer__make-shorter-btn');
    
    const closeHandler = () => {
      dialog.remove();
      // Close all modals when dialog closes
      this.closeAllModals();
    };
    
    cancelBtn?.addEventListener('click', closeHandler);
    closeBtn?.addEventListener('click', closeHandler);
    postBtn?.addEventListener('click', () => this.postApprovedComment());
    makeShorterBtn?.addEventListener('click', () => this.makeShorterComment());
    
    // Add keyboard shortcuts
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeHandler();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        this.postApprovedComment();
      }
    });
  }

  formatReviewForComment(review) {
    // Clean up the review text for GitLab comment format and remove AI traces
    let formattedReview = review
      // Remove common AI preambles and meta-commentary
      .replace(/^Thank you for providing.*?Based on.*?, here is my.*?review[:\.]?\s*/gi, '')
      .replace(/^I'll review this.*?merge request.*?\s*/gi, '')
      .replace(/^Here's my.*?review.*?for.*?\s*/gi, '')
      .replace(/^Based on.*?provided.*?here.*?is.*?\s*/gi, '')
      .replace(/^I'll analyze.*?and provide.*?\s*/gi, '')
      .replace(/^Thank you for.*?I'll provide.*?\s*/gi, '')
      .replace(/^Here are my.*?findings.*?\s*/gi, '')
      .replace(/^After reviewing.*?code.*?here.*?\s*/gi, '')
      .replace(/^I've reviewed.*?here.*?are.*?\s*/gi, '')
      // Remove other common AI phrases
      .replace(/As an AI.*?reviewer.*?\s*/gi, '')
      .replace(/Based on.*?analysis.*?\s*/gi, '')
      .replace(/According to.*?review.*?\s*/gi, '')
      .replace(/Here's what I found.*?\s*/gi, '')
      .replace(/My recommendations.*?are.*?\s*/gi, '')
      // Remove empty "## " headers that might be left over
      .replace(/^##\s*$/gm, '')
      .replace(/^###\s*$/gm, '')
      // Convert markdown to GitLab markdown format
      .replace(/^### /gm, '## ')  // Convert h3 to h2
      .replace(/^#### /gm, '### ') // Convert h4 to h3
      // Ensure code blocks are properly formatted
      .replace(/```(\w+)?\n/g, '```$1\n')
      // Clean up excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace
      .trim();
    
    // If the review starts with a section header, that's fine, but remove any introductory paragraphs before the first section
    const lines = formattedReview.split('\n');
    let firstSectionIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Look for section headers (## or numbered lists or bullet points)
      if (line.match(/^##\s+/) || line.match(/^\d+\./) || line.match(/^[\*\-\+]\s+/) || line.match(/^🚨|💡|✅|⚠️/)) {
        firstSectionIndex = i;
        break;
      }
    }
    
    // If we found a section header and there's text before it, check if it's just AI preamble
    if (firstSectionIndex > 0) {
      const beforeSection = lines.slice(0, firstSectionIndex).join('\n').trim();
      // If the text before the first section looks like AI preamble, remove it
      if (beforeSection.length < 200 && 
          (beforeSection.includes('review') || beforeSection.includes('analysis') || 
           beforeSection.includes('findings') || beforeSection.includes('recommendations'))) {
        formattedReview = lines.slice(firstSectionIndex).join('\n').trim();
      }
    }
    
    return formattedReview;
  }

  async postApprovedComment() {
    const dialog = this.currentCommentDialog;
    if (!dialog) return;
    
    const textarea = dialog.querySelector('#comment-text');
    console.log('postApprovedComment called');
    const postButton = dialog.querySelector('.ai-code-reviewer__btn--success');
    
    let commentText = textarea.value.trim();
    if (!commentText) {
      this.showNotification('Comment cannot be empty', 'error');
      return;
    }
    
    // Check if file-specific comment is selected
    const fileSpecificRadio = dialog.querySelector('input[name="comment-type"][value="file-specific"]');
    const isFileSpecific = fileSpecificRadio && fileSpecificRadio.checked;
    
    // Show loading state
    postButton.innerHTML = '<span class="ai-code-reviewer__loading-spinner"></span> Posting...';
    postButton.disabled = true;
    
    try {
      // Get current MR info
      const mrInfo = await this.extractMRInfo();
      if (!mrInfo) {
        throw new Error('Could not extract merge request information from current page');
      }
      
      console.log('📋 MR Info for comment posting:', {
        projectId: mrInfo.projectId,
        projectPath: mrInfo.projectPath,
        mrIid: mrInfo.mrIid,
        url: mrInfo.url,
        title: mrInfo.title,
        isFileSpecific: isFileSpecific,
        fileInfo: this.currentFileInfo
      });
      
      // Ensure we have required fields
      if (!mrInfo.projectId) {
        throw new Error('Could not extract project ID from merge request page');
      }
      if (!mrInfo.mrIid) {
        throw new Error('Could not extract merge request IID from page');
      }
      
      // Ensure GitLab API instance exists and is up to date
      if (!this.gitlabApi || !this.gitlabApi.token) {
        console.log('🔄 Initializing GitLab API for comment posting...');
        await this.ensureGitLabAPI();
      }
      
      console.log('🔐 GitLab API Info:', {
        hasToken: !!this.gitlabApi.token,
        tokenPrefix: this.gitlabApi.token ? this.gitlabApi.token.substring(0, 8) + '...' : 'NONE',
        baseUrl: this.gitlabApi.baseUrl
      });
      
      // Post comment via GitLab API - either general or file-specific
      if (isFileSpecific && this.currentFileInfo) {
        console.log('📁 Posting file-specific comment to:', this.currentFileInfo.filePath);
        
        // Get additional MR data needed for file-specific comments
        const extendedMrInfo = await this.getExtendedMRInfo(mrInfo);
        
        await this.gitlabApi.postFileSpecificComment(
          mrInfo.projectId, 
          mrInfo.mrIid, 
          commentText,
          this.currentFileInfo.filePath,
          extendedMrInfo,
          this.currentFileInfo.lineNumber || 1
        );
      } else {
        console.log('💬 Posting general MR comment');
        await this.gitlabApi.postMergeRequestComment(mrInfo.projectId, mrInfo.mrIid, commentText);
      }
      
      // Success!
      dialog.remove();
      // Close all modals when posting comment
      this.closeAllModals();
      const commentType = isFileSpecific ? 'file-specific' : 'general';
      this.showNotification(`✅ ${commentType} comment posted successfully!`, 'success');
      
      // Don't automatically show previous modal
      
      
    } catch (error) {
      console.error('Failed to post comment:', error);
      this.showNotification(`Failed to post comment: ${error.message}`, 'error');
      
      // Reset button state
      postButton.innerHTML = '✅ Post Comment';
      postButton.disabled = false;
    }
  }

  async makeShorterComment() {
    const dialog = this.currentCommentDialog;
    if (!dialog) return;
    
    const textarea = dialog.querySelector('#comment-text');
    const makeShorterBtn = dialog.querySelector('.ai-code-reviewer__make-shorter-btn');
    const originalText = textarea.value.trim();
    
    if (!originalText) {
      this.showNotification('Comment cannot be empty', 'error');
      return;
    }
    
    // Show loading state
    makeShorterBtn.innerHTML = '<span class="ai-code-reviewer__loading-spinner"></span> Making shorter...';
    makeShorterBtn.disabled = true;
    
    try {
      // Get Claude API key from storage
      const result = await chrome.runtime.sendMessage({ action: 'getApiKeys' });
      if (!result.apiKey) {
        throw new Error('Claude API key not found');
      }
      
      // Create prompt to make comment shorter and more human-like
      const prompt = `Please make this code review comment shorter, more concise, and more human-like. Remove any AI-like phrasing and make it sound like a human developer wrote it. Keep all the important technical points but make it more direct and to the point:

${originalText}

Make it sound natural and conversational while keeping the technical accuracy.`;
      
      // Call Claude API through background script to avoid CORS
      const apiResponse = await chrome.runtime.sendMessage({
        action: 'callClaudeAPI',
        apiKey: result.apiKey,
        model: this.settings?.model || 'claude-3-sonnet-20240229',
        prompt: prompt,
        maxTokens: 1000
      });
      
      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'API request failed');
      }
      
      const shorterComment = apiResponse.content.trim();
      
      // Update textarea with shorter comment
      textarea.value = shorterComment;
      
      // Reset button state
      makeShorterBtn.innerHTML = '✂️ Make it shorter';
      makeShorterBtn.disabled = false;
      
      this.showNotification('Comment made shorter successfully!', 'success');
      
    } catch (error) {
      console.error('Failed to make comment shorter:', error);
      this.showNotification(`Failed to make comment shorter: ${error.message}`, 'error');
      
      // Reset button state
      makeShorterBtn.innerHTML = '✂️ Make it shorter';
      makeShorterBtn.disabled = false;
    }
  }

  closeAllModals() {
    // Close all AI reviewer modals
    const modals = document.querySelectorAll('.ai-code-reviewer__modal');
    modals.forEach(modal => {
      modal.remove();
    });
    
    // Clear any stored references
    this.currentCommentDialog = null;
    this.currentFileInfo = null;
  }

  showQuickFixes() {
    alert('Quick fixes feature coming soon! This will provide automated code improvements.');
  }

  async extractMRInfo() {
    // Use the existing extractMergeRequestData method (it's async)
    return await this.extractMergeRequestData();
  }

  async getExtendedMRInfo(mrInfo) {
    try {
      // Get additional MR info from GitLab API
      const apiMrInfo = await this.gitlabApi.getMergeRequestInfo(mrInfo.projectId, mrInfo.mrIid);
      
      // Extract target ID from page (needed for notes API)
      const targetId = this.extractTargetId();
      
      // Extract SHA values from page or API
      const diffHeadSha = this.extractDiffHeadSha() || apiMrInfo.diff_refs?.head_sha || apiMrInfo.sha;
      const baseSha = this.extractBaseSha() || apiMrInfo.diff_refs?.base_sha;
      
      console.log('🔍 Extended MR Info:', {
        targetId,
        diffHeadSha,
        baseSha,
        sourceBranch: apiMrInfo.source_branch,
        targetBranch: apiMrInfo.target_branch
      });
      
      return {
        ...mrInfo,
        ...apiMrInfo,
        targetId: targetId,
        diffHeadSha: diffHeadSha,
        baseSha: baseSha,
        sourceBranch: apiMrInfo.source_branch,
        targetBranch: apiMrInfo.target_branch
      };
    } catch (error) {
      console.warn('Could not get extended MR info, using basic info:', error);
      return {
        ...mrInfo,
        targetId: this.extractTargetId(),
        diffHeadSha: this.extractDiffHeadSha(),
        baseSha: this.extractBaseSha()
      };
    }
  }

  extractDiffHeadSha() {
    // Try to extract diff head SHA from page
    // Look for merge_request_diff_head_sha in scripts
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
      const headShaMatch = script.textContent.match(/merge_request_diff_head_sha['":\s]*["']([a-f0-9]{40})["']/);
      if (headShaMatch) {
        console.log('✅ Found diff_head_sha in script:', headShaMatch[1]);
        return headShaMatch[1];
      }
    }
    
    // Try data attributes
    const diffElement = document.querySelector('[data-commit-sha], [data-head-sha]');
    if (diffElement) {
      const sha = diffElement.getAttribute('data-commit-sha') || diffElement.getAttribute('data-head-sha');
      if (sha && sha.length === 40) {
        console.log('✅ Found head SHA in data attribute:', sha);
        return sha;
      }
    }
    
    console.warn('❌ Could not extract diff_head_sha');
    return null;
  }

  extractBaseSha() {
    // Try to extract base SHA from page
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
      const baseShaMatch = script.textContent.match(/base_sha['":\s]*["']([a-f0-9]{40})["']/);
      if (baseShaMatch) {
        console.log('✅ Found base_sha in script:', baseShaMatch[1]);
        return baseShaMatch[1];
      }
    }
    
    console.warn('❌ Could not extract base_sha');
    return null;
  }

  extractTargetId() {
    // Try to extract target_id from page content or URL
    // Looking at the network trace, target_id is 176334 for MR 5108
    
    // Method 1: Try to find it in page scripts
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
      const targetIdMatch = script.textContent.match(/target_id['":\s]*(\d+)/);
      if (targetIdMatch) {
        console.log('✅ Found target_id in script:', targetIdMatch[1]);
        return parseInt(targetIdMatch[1]);
      }
    }
    
    // Method 2: Try to find it in data attributes
    const noteableElement = document.querySelector('[data-noteable-id]');
    if (noteableElement) {
      const noteableId = noteableElement.getAttribute('data-noteable-id');
      if (noteableId) {
        console.log('✅ Found noteable-id in data attribute:', noteableId);
        return parseInt(noteableId);
      }
    }
    
    // Method 3: Try window.gon
    if (window.gon && window.gon.merge_request_id) {
      console.log('✅ Found merge_request_id in window.gon:', window.gon.merge_request_id);
      return window.gon.merge_request_id;
    }
    
    console.warn('❌ Could not extract target_id, using MR IID as fallback');
    return null;
  }

  async ensureGitLabAPI() {
    // Get the current API keys
    const result = await chrome.runtime.sendMessage({ action: 'getApiKeys' });
    if (!result.gitlabToken) {
      throw new Error('GitLab access token not found. Please set your GitLab API token in the extension settings.');
    }
    
    this.gitlabToken = result.gitlabToken;
    this.gitlabApi = new GitLabAPI(this.gitlabToken, await this.extractBaseUrl());
    
    console.log('✅ GitLab API initialized for comment posting');
  }

  async reviewCurrentFile(fileElement) {
    try {
      // Prevent concurrent reviews
      if (this.isReviewing) {
        this.showNotification('A review is already in progress. Please wait for it to complete.', 'warning');
        return;
      }

      // Set review state to prevent other reviews
      this.isReviewing = true;

      // Always reload settings to get latest changes from popup
      const [apiResult, settingsResult] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getApiKeys' }),
        chrome.runtime.sendMessage({ action: 'getSettings' })
      ]);
      
      if (!apiResult.apiKey || !apiResult.gitlabToken) {
        this.showNotification('Please set your API keys in the extension popup first', 'error');
        this.isReviewing = false;
        return;
      }
      
      this.apiKey = apiResult.apiKey;
      this.gitlabToken = apiResult.gitlabToken;
      this.gitlabApi = new GitLabAPI(this.gitlabToken, await this.extractBaseUrl());
      
      // Load settings for context and model configuration (always refresh)
      this.settings = settingsResult.settings || {
        model: 'claude-opus-4-20250514',
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
      
      console.log('🔄 Reloaded settings for reviewCurrentFile:', this.settings.manualContext);

      // Get current file information from the GitLab UI
      const currentFileInfo = this.getCurrentFileInfo(fileElement);
      if (!currentFileInfo) {
        this.showNotification('Could not identify the file to review. Please try again.', 'warning');
        this.isReviewing = false;
        return;
      }

      this.setReviewButtonsLoading(true, currentFileInfo.filePath);
      this.showNotification(`🔍 Analyzing ${currentFileInfo.filePath}...`, 'info');

      // Get MR information
      const mrInfo = await this.extractMRInfo();
      if (!mrInfo) {
        throw new Error('Could not extract merge request information');
      }

      // Get the file content and changes
      const fileData = await this.getFileDataForReview(currentFileInfo, mrInfo);
      
      // Generate AI review for the current file
      const review = await this.generateFileReview(fileData, mrInfo);
      
      // Display the review results
      this.displayFileReviewResults(review, currentFileInfo, mrInfo);
      
      this.showNotification(`✅ Review complete for ${currentFileInfo.filePath}!`, 'success');

    } catch (error) {
      console.error('Error reviewing current file:', error);
      this.showNotification(`Failed to review file: ${error.message}`, 'error');
    } finally {
      this.isReviewing = false;
      this.setReviewButtonsLoading(false);
    }
  }

  async reviewSpecificFile(diffFile, filePath) {
    try {
      // Prevent concurrent reviews
      if (this.isReviewing) {
        this.showNotification('A review is already in progress. Please wait for it to complete.', 'warning');
        return;
      }

      // Set review state to prevent other reviews
      this.isReviewing = true;

      // Always reload settings to get latest changes from popup
      const [apiResult, settingsResult] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getApiKeys' }),
        chrome.runtime.sendMessage({ action: 'getSettings' })
      ]);
      
      if (!apiResult.apiKey || !apiResult.gitlabToken) {
        this.showNotification('Please set your API keys in the extension popup first', 'error');
        this.isReviewing = false;
        return;
      }
      
      this.apiKey = apiResult.apiKey;
      this.gitlabToken = apiResult.gitlabToken;
      this.gitlabApi = new GitLabAPI(this.gitlabToken, await this.extractBaseUrl());
      
      // Load settings for context and model configuration (always refresh)
      this.settings = settingsResult.settings || {
        model: 'claude-opus-4-20250514',
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
      
      console.log('🔄 Reloaded settings for reviewSpecificFile:', this.settings.manualContext);

      // Create file info object for this specific file
      const currentFileInfo = {
        filePath: filePath,
        element: diffFile
      };

      this.setReviewButtonsLoading(true, filePath);
      this.showNotification(`🔍 Analyzing ${filePath}...`, 'info');

      // Get MR information
      const mrInfo = await this.extractMRInfo();
      if (!mrInfo) {
        throw new Error('Could not extract merge request information');
      }

      // Get the file content and changes
      const fileData = await this.getFileDataForReview(currentFileInfo, mrInfo);
      
      // Generate AI review for the current file
      const review = await this.generateFileReview(fileData, mrInfo);
      
      // Display the review results
      this.displayFileReviewResults(review, currentFileInfo, mrInfo);
      
      this.showNotification(`✅ Review complete for ${filePath}!`, 'success');

    } catch (error) {
      console.error('Error reviewing specific file:', error);
      this.showNotification(`Failed to review file: ${error.message}`, 'error');
    } finally {
      this.isReviewing = false;
      this.setReviewButtonsLoading(false);
    }
  }

  getCurrentFileInfo(fileElement) {
    console.log('getCurrentFileInfo called with fileElement:', fileElement);
    
    if (fileElement) {
      // Try multiple selectors to find the file path
      const filePathSelectors = [
        '.diff-file-path-text',
        '.file-title-name',
        '[data-testid="file-title-name"]',
        '.js-file-title-name',
        '.file-title',
        '.diff-file-path',
        '.diff-title-file'
      ];
      
      let filePath = null;
      
      // Try to find file path in the provided element
      for (const selector of filePathSelectors) {
        const pathElement = fileElement.querySelector(selector);
        if (pathElement) {
          filePath = pathElement.textContent?.trim() || pathElement.getAttribute('title') || pathElement.getAttribute('data-original-title');
          if (filePath) {
            console.log('Found file path using selector:', selector, 'path:', filePath);
            break;
          }
        }
      }
      
      // If not found, try to extract from data attributes
      if (!filePath) {
        const dataAttrs = ['data-path', 'data-file-path', 'data-original-title', 'title'];
        for (const attr of dataAttrs) {
          filePath = fileElement.getAttribute(attr);
          if (filePath) {
            console.log('Found file path from attribute:', attr, 'path:', filePath);
            break;
          }
        }
      }

      if (filePath) {
        // Try to extract line number if we're viewing a specific line
        const lineNumber = this.extractLineNumberFromContext(fileElement);
        
        return {
          filePath: filePath,
          element: fileElement,
          lineNumber: lineNumber
        };
      }
    } 
    
    // If no fileElement or no path found, try URL-based detection
    const urlParams = new URLSearchParams(window.location.search);
    let filePath = urlParams.get('file_path');
    
    if (filePath) {
      console.log('Found file path from URL params:', filePath);
      return {
        filePath: decodeURIComponent(filePath),
        element: null
      };
    }
    
    // Try to extract from hash (for single file views)
    const hash = window.location.hash;
    if (hash) {
      // Look for file path patterns in hash
      const hashMatch = hash.match(/#[a-f0-9]{40}_\d+_\d+/);
      if (hashMatch) {
        // Try to find a visible file diff to extract the path
        const visibleFile = document.querySelector('.diff-file:not(.hidden)');
        if (visibleFile) {
          return this.getCurrentFileInfo(visibleFile);
        }
      }
    }
    
    // Last resort: try to find any visible diff file
    const visibleDiffFile = document.querySelector('.diff-file');
    if (visibleDiffFile) {
      console.log('Fallback: using first visible diff file');
      return this.getCurrentFileInfo(visibleDiffFile);
    }
    
    console.warn('Could not identify file path from any method');
    return null;
  }

  extractFilePathFromElement(fileElement) {
    // Try various selectors to get the file path
    const pathElement = fileElement.querySelector('[data-original-title], [title], .file-title-name, .js-file-title-name');
    if (pathElement) {
      return pathElement.getAttribute('data-original-title') || 
             pathElement.getAttribute('title') || 
             pathElement.textContent?.trim();
    }

    // Try to extract from the text content directly
    const text = fileElement.textContent?.trim();
    if (text && !text.includes(' ')) {
      return text;
    }

    return null;
  }

  extractLineNumberFromContext(fileElement) {
    // Method 1: Check URL hash for line number (e.g., #L123 or #0d11f20d3db5aa72aee787833a1c9433e7f7a9ed_0_4)
    const hash = window.location.hash;
    if (hash) {
      // GitLab line hash format: #0d11f20d3db5aa72aee787833a1c9433e7f7a9ed_0_4 (last number is line)
      const lineHashMatch = hash.match(/#[a-f0-9]{40}_\d+_(\d+)/);
      if (lineHashMatch) {
        const lineNum = parseInt(lineHashMatch[1]);
        console.log('✅ Extracted line number from hash:', lineNum);
        return lineNum;
      }
      
      // Simple line format: #L123
      const simpleLlineMatch = hash.match(/#L(\d+)/);
      if (simpleLlineMatch) {
        const lineNum = parseInt(simpleLlineMatch[1]);
        console.log('✅ Extracted line number from simple hash:', lineNum);
        return lineNum;
      }
    }
    
    // Method 2: Find any highlighted line in the diff
    if (fileElement) {
      const highlightedLine = fileElement.querySelector('.line_holder.hll, .diff-line-num.hll, .line.hll');
      if (highlightedLine) {
        // Try to get line number from data attributes
        const lineNum = highlightedLine.getAttribute('data-line-number') || 
                       highlightedLine.getAttribute('data-new-line') ||
                       highlightedLine.getAttribute('data-old-line');
        if (lineNum) {
          console.log('✅ Extracted line number from highlighted element:', parseInt(lineNum));
          return parseInt(lineNum);
        }
        
        // Try to extract from text content of line number element
        const lineNumElement = highlightedLine.querySelector('.diff-line-num, .line-num');
        if (lineNumElement) {
          const lineText = lineNumElement.textContent.trim();
          const lineMatch = lineText.match(/(\d+)/);
          if (lineMatch) {
            console.log('✅ Extracted line number from text content:', parseInt(lineMatch[1]));
            return parseInt(lineMatch[1]);
          }
        }
      }
    }
    
    // Method 3: Try to find any focused or active line in the viewport
    const activeLine = document.querySelector('.diff-line-num.selected, .line_holder.selected, .diff-line.selected');
    if (activeLine) {
      const lineNum = activeLine.getAttribute('data-line-number') || 
                     activeLine.getAttribute('data-new-line');
      if (lineNum) {
        console.log('✅ Extracted line number from active line:', parseInt(lineNum));
        return parseInt(lineNum);
      }
    }
    
    console.log('ℹ️ No specific line number found, will use line 1 as default');
    return 1; // Default to line 1 if no specific line is identified
  }

  async getFileDataForReview(currentFileInfo, mrInfo) {
    try {
      // Get the file content from both source and target branches
      const sourceContent = await this.gitlabApi.getFileContent(
        mrInfo.projectId, 
        currentFileInfo.filePath, 
        mrInfo.sourceBranch
      );

      const targetContent = await this.gitlabApi.getFileContent(
        mrInfo.projectId, 
        currentFileInfo.filePath, 
        mrInfo.targetBranch
      );

      // Get the diff information if available
      const mrChanges = await this.gitlabApi.getMergeRequestChanges(mrInfo.projectId, mrInfo.mrIid);
      const fileDiff = mrChanges.changes?.find(change => 
        change.new_path === currentFileInfo.filePath || change.old_path === currentFileInfo.filePath
      );

      return {
        filePath: currentFileInfo.filePath,
        sourceContent: sourceContent,
        targetContent: targetContent,
        diff: fileDiff?.diff || null,
        isNewFile: fileDiff?.new_file || false,
        isDeletedFile: fileDiff?.deleted_file || false,
        isRenamedFile: fileDiff?.renamed_file || false,
        oldPath: fileDiff?.old_path,
        newPath: fileDiff?.new_path
      };
    } catch (error) {
      console.error('Error getting file data:', error);
      throw new Error(`Failed to retrieve file data: ${error.message}`);
    }
  }

  async generateFileReview(fileData, mrInfo) {
    const prompt = await this.buildFileReviewPrompt(fileData, mrInfo);
    
    const result = await chrome.runtime.sendMessage({
      action: 'makeAnthropicAPICall',
      data: {
        apiKey: this.apiKey,
        body: {
          model: this.settings.model || 'claude-opus-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: prompt
          }]
        }
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }

    return result.data;
  }

  async buildFileReviewPrompt(fileData, mrInfo) {
    const projectContext = await this.buildProjectContext();
    
    const context = `
Merge Request Context:
- Title: ${mrInfo.title}
- Description: ${mrInfo.description || 'No description provided'}
- Source Branch: ${mrInfo.sourceBranch} → Target Branch: ${mrInfo.targetBranch}
- File: ${fileData.filePath}

Project Context:
${projectContext}
`;

    let fileContext = '';
    if (fileData.isNewFile) {
      fileContext = `This is a new file being added in this MR.`;
    } else if (fileData.isDeletedFile) {
      fileContext = `This file is being deleted in this MR.`;
    } else if (fileData.isRenamedFile) {
      fileContext = `This file is being renamed from '${fileData.oldPath}' to '${fileData.newPath}'.`;
    } else {
      fileContext = `This file is being modified in this MR.`;
    }

    const prompt = `You are an expert code reviewer. Review this file from the merge request and provide direct technical feedback. Do not include introductory phrases or meta-commentary.

${context}

File Status: ${fileContext}

${fileData.sourceContent ? `
Current File Content:
\`\`\`
${fileData.sourceContent}
\`\`\`
` : ''}

${fileData.diff ? `
Changes Made (Diff):
\`\`\`diff
${fileData.diff}
\`\`\`
` : ''}

Review criteria:
1. **Code Quality**: Issues with code quality, style, or best practices
2. **Logic & Bugs**: Potential bugs or logical issues
3. **Security**: Security concerns
4. **Performance**: Performance considerations
5. **Maintainability**: Impact on code maintainability
6. **Context Fit**: How well this change fits with the overall MR goal

Format your response according to the review directions provided in the project context. If no specific format is given, include:
- Specific issues found (if any) with line references
- Suggestions for improvement  
- Overall assessment (approve/needs changes/concerns)

IMPORTANT: Follow the review directions exactly as specified in the project context. Start directly with your technical analysis. No introductory phrases like "Here's my review", "Thank you for", etc.`;

    console.log('📤 Final prompt being sent to AI (first 500 chars):', prompt.substring(0, 500) + '...');
    console.log('📤 Project context in prompt:', projectContext ? 'INCLUDED' : 'MISSING');
    return prompt;
  }

  displayFileReviewResults(review, fileInfo, mrData) {
    // Create a specialized modal for file review
    const modal = this.createFileReviewModal(review, fileInfo, mrData);
    document.body.appendChild(modal);
    
    // Focus management
    modal.focus();
    
    // Close on escape
    const closeHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', closeHandler);
      }
    };
    document.addEventListener('keydown', closeHandler);
  }

  createFileReviewModal(review, fileInfo, mrData) {
    const modal = document.createElement('div');
    modal.id = 'ai-file-review-modal';
    modal.className = 'ai-code-reviewer__modal';
    modal.tabIndex = -1;
    
    // Encode data for buttons
    const encodedReview = this.utf8ToBase64(review);
    const encodedExportData = this.utf8ToBase64(JSON.stringify({ 
      review, 
      fileInfo, 
      mrData, 
      timestamp: Date.now(),
      reviewType: 'single-file'
    }));
    
    modal.innerHTML = `
      <div class="ai-code-reviewer__modal-backdrop">
        <div class="ai-code-reviewer__modal-content">
          <div class="ai-code-reviewer__modal-header">
            <div class="ai-code-reviewer__header-content">
              <h3 class="ai-code-reviewer__modal-title">📄 AI File Review: ${fileInfo.filePath}</h3>
              <div class="ai-code-reviewer__file-info">
                <span class="ai-code-reviewer__file-badge">Single File Review</span>
              </div>
            </div>
            <button class="ai-code-reviewer__close-btn ai-code-reviewer__close-file-modal-btn">&times;</button>
          </div>
          
          <div class="ai-code-reviewer__modal-body">
            <div class="ai-code-reviewer__review-content">
              ${this.formatReview(review)}
            </div>
          </div>
          
          <div class="ai-code-reviewer__modal-footer">
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--secondary ai-code-reviewer__close-file-modal-btn">Close</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--primary ai-code-reviewer__copy-file-review-btn">📋 Copy Review</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--primary ai-code-reviewer__export-file-review-btn">💾 Export</button>
            <button class="ai-code-reviewer__btn ai-code-reviewer__btn--success ai-code-reviewer__post-file-comment-btn">💬 Post Comment to MR</button>
          </div>
        </div>
      </div>
    `;
    
    // Add button event listeners
    const closeButtons = modal.querySelectorAll('.ai-code-reviewer__close-file-modal-btn');
    const copyBtn = modal.querySelector('.ai-code-reviewer__copy-file-review-btn');
    const exportBtn = modal.querySelector('.ai-code-reviewer__export-file-review-btn');
    const postCommentBtn = modal.querySelector('.ai-code-reviewer__post-file-comment-btn');
    
    closeButtons.forEach(btn => btn?.addEventListener('click', () => modal.remove()));
    copyBtn?.addEventListener('click', () => this.copyReview(encodedReview));
    exportBtn?.addEventListener('click', () => this.exportReview(encodedExportData));
    postCommentBtn?.addEventListener('click', () => this.promptPostComment(encodedReview, fileInfo));
    
    return modal;
  }


  createIssues() {
    alert('Create issues feature coming soon! This will convert review items to GitLab issues.');
  }

  generateReport() {
    alert('Generate report feature coming soon! This will create a detailed PDF report.');
  }

  rerunReview() {
    const modal = document.getElementById('ai-review-modal');
    if (modal) modal.remove();
    
    this.startReviewFromButton();
  }

  async runNetworkDiagnostics() {
    console.log('🔍 Running optional network diagnostics (these don\'t affect functionality)...');
    
    try {
      // Test basic connectivity to a reliable endpoint
      const testResponse = await fetch('https://httpbin.org/status/200', {
        method: 'GET',
        mode: 'cors'
      });
      
      if (testResponse.ok) {
        console.log('✅ Basic internet connectivity: OK');
      } else {
        console.warn('⚠️ Basic connectivity test failed:', testResponse.status);
      }
    } catch (error) {
      console.warn('⚠️ Basic connectivity test failed (this is only diagnostic):', error);
      // Don't throw error - this is just diagnostic, background script will handle the real call
    }

    try {
      // Test if we can make direct calls to Anthropic API (diagnostic only)
      console.log('🧪 Testing direct API access (background script will be used for actual calls)...');
      const anthropicTest = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({}) // Empty body will get 400/401 but proves we can reach the endpoint
      }).catch(() => null);
      
      if (anthropicTest) {
        // 400/401 are expected without proper auth - this means we CAN reach the API
        if (anthropicTest.status === 400 || anthropicTest.status === 401) {
          console.log('✅ Direct API access: Available (got expected auth error)');
        } else {
          console.log(`✅ Direct API access: Available (status: ${anthropicTest.status})`);
        }
      } else {
        console.log('ℹ️ Direct API access: Not available (will use background script - this is normal)');
      }
    } catch (error) {
      console.log('ℹ️ Direct API access: Not available (will use background script - this is normal)');
    }

    // Check for common network issues
    console.log('🌐 Environment info:', {
      userAgent: navigator.userAgent.substring(0, 50) + '...',
      onLine: navigator.onLine,
      connectionType: navigator.connection?.effectiveType || 'unknown'
    });
  }

  // UTF-8 safe base64 encoder
  utf8ToBase64(str) {
    try {
      // Use escape/unescape method for UTF-8 encoding
      return btoa(unescape(encodeURIComponent(str)));
    } catch (error) {
      console.error('Failed to encode string to base64:', error);
      // Fallback: try simple btoa (might fail with Unicode)
      try {
        return btoa(str);
      } catch (fallbackError) {
        console.error('Fallback btoa also failed:', fallbackError);
        return '';
      }
    }
  }

  // UTF-8 safe base64 decoder for UI operations
  base64ToUtf8Safe(base64String) {
    try {
      // Use escape/unescape method for UTF-8 decoding
      return decodeURIComponent(escape(atob(base64String)));
    } catch (error) {
      console.error('Failed to decode base64 string:', error);
      // Fallback: try simple atob
      try {
        return atob(base64String);
      } catch (fallbackError) {
        console.error('Fallback atob also failed:', fallbackError);
        return '';
      }
    }
  }

  // New method to set up single file review button with enhanced detection
  setupSingleFileReviewButton() {
    // Initial check
    this.checkAndAddSingleFileButton();
    
    // Set up periodic checking for file changes
    this.singleFileButtonInterval = setInterval(() => {
      this.checkAndAddSingleFileButton();
    }, 2000);
  }

  checkAndAddSingleFileButton() {
    const fileDetectionResult = this.isCurrentlyViewingFile();
    const existingButton = document.getElementById('ai-review-single-file-btn');
    
    if (fileDetectionResult && !existingButton) {
      // File is detected, add button
      this.addSingleFileReviewButtonToDOM(fileDetectionResult);
    } else if (fileDetectionResult && existingButton) {
      // File is detected and button exists, update the button with new file info
      this.updateSingleFileReviewButton(existingButton, fileDetectionResult);
    } else if (!fileDetectionResult && existingButton) {
      // No file detected, remove existing button
      existingButton.remove();
      console.log('📍 Removed single file review button - no file detected');
    }
  }

  updateSingleFileReviewButton(existingButton, fileDetectionResult) {
    const detectedFileName = fileDetectionResult.filePath || 'Current File';
    const fileName = detectedFileName.split('/').pop();
    
    // Update button text with new filename
    const buttonTextElement = existingButton.querySelector('.ai-code-reviewer__btn-text');
    if (buttonTextElement) {
      buttonTextElement.textContent = `🤖 Review ${fileName}`;
      console.log('📍 Updated single file review button for file:', fileName);
    }
    
    // Update the click event handler to use the new file detection result
    // Remove existing event listeners by cloning the button
    const newButton = existingButton.cloneNode(true);
    newButton.addEventListener('click', () => {
      // Pass the detected file information
      if (fileDetectionResult.element) {
        this.reviewCurrentFile(fileDetectionResult.element);
      } else {
        // Fallback: find the file element based on the current detection
        const currentFileResult = this.isCurrentlyViewingFile();
        if (currentFileResult && currentFileResult.element) {
          this.reviewCurrentFile(currentFileResult.element);
        } else {
          console.log('📍 No specific file element found, will use current file detection in review');
          this.reviewCurrentFile(null);
        }
      }
    });
    
    // Replace the old button with the updated one
    existingButton.parentNode.replaceChild(newButton, existingButton);
  }

  addSingleFileReviewButtonToDOM(fileDetectionResult) {
    // Try multiple container selectors to find where to place the button
    const containerSelectors = [
      '.merge-request-details .detail-page-header-actions',
      '.detail-page-header .detail-page-header-actions',
      '.detail-page-header-actions',
      '.merge-request-header .merge-request-header-actions',
      '.gl-display-flex.gl-gap-3'
    ];
    
    let actionsContainer = null;
    for (const selector of containerSelectors) {
      actionsContainer = document.querySelector(selector);
      if (actionsContainer) break;
    }
    
    if (actionsContainer) {
      const detectedFileName = fileDetectionResult.filePath || 'Current File';
      const fileName = detectedFileName.split('/').pop();
      
      const reviewSingleFileButton = document.createElement('button');
      reviewSingleFileButton.id = 'ai-review-single-file-btn';
      reviewSingleFileButton.className = 'ai-code-reviewer__btn ai-code-reviewer__btn--primary';
      reviewSingleFileButton.style.marginLeft = '8px';
      reviewSingleFileButton.innerHTML = `
        <svg class="ai-code-reviewer__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <span class="ai-code-reviewer__btn-text">🤖 Review ${fileName}</span>
      `;

      reviewSingleFileButton.addEventListener('click', () => {
        // Pass the detected file information
        if (fileDetectionResult.element) {
          this.reviewCurrentFile(fileDetectionResult.element);
        } else {
          this.reviewCurrentFile(); // Fallback to URL-based detection
        }
      });
      
      actionsContainer.appendChild(reviewSingleFileButton);
      
      // Add the global stop button after the single file review button
      const existingStopButton = document.getElementById('stop-review-btn');
      if (existingStopButton) {
        // Move existing stop button to this container
        actionsContainer.appendChild(existingStopButton);
      }
      
      console.log('📍 Created single file review button for:', fileName);
    }
  }

  // Monitor for file navigation changes (hash changes, URL changes, etc.)
  monitorFileChanges() {
    // Listen for hash changes (common in GitLab file navigation)
    window.addEventListener('hashchange', () => {
      setTimeout(() => {
        this.checkAndAddSingleFileButton();
        // Also check for file buttons when navigation happens
        this.checkAndAddFileButtons();
      }, 500);
    });
    
    // Listen for URL changes (GitLab's SPA navigation)
    let lastUrl = window.location.href;
    const urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        setTimeout(() => {
          this.checkAndAddSingleFileButton();
          // Also check for file buttons when URL changes
          this.checkAndAddFileButtons();
        }, 1000);
      }
    }, 1000);
    
    // Monitor for diffs tab activation
    const tabClickHandler = (event) => {
      const target = event.target;
      if (target.matches('[data-testid="changes-tab"], a[href*="diffs"]')) {
        console.log('🔍 User clicked on diffs tab, will add file buttons');
        setTimeout(() => {
          this.checkAndAddFileButtons();
        }, 1000);
      }
    };
    
    document.addEventListener('click', tabClickHandler);
    
    // Store interval reference for cleanup if needed
    this.urlCheckInterval = urlCheckInterval;
  }
}

// Initialize the code reviewer and expose globally for UI interactions
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.aiReviewer = new GitLabCodeReviewer();
  });
} else {
  window.aiReviewer = new GitLabCodeReviewer();
}

// Handle SPA navigation in GitLab
let currentUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    
    // Re-initialize if navigated to a new MR
    setTimeout(() => {
      if (window.aiReviewer && window.aiReviewer.isMergeRequestPage()) {
        window.aiReviewer.setupMRInterface();
        window.aiReviewer.detectMonorepoContext();
      }
    }, 1000);
  }
});

urlObserver.observe(document.body, {
  childList: true,
  subtree: true
});

