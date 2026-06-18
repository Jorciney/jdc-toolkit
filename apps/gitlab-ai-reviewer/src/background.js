// background.js - Service Worker for Chrome Extension
class BackgroundController {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details);
    });

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });

    // Handle tab updates to inject content script
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Handle context menu clicks
    if (chrome.contextMenus) {
      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleContextMenu(info, tab);
      });
    }

    // Handle notification button clicks
    if (chrome.notifications) {
      chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
        this.handleNotificationClick(notificationId, buttonIndex);
      });
    }

    // Handle scheduled alarms
    if (chrome.alarms) {
      chrome.alarms.onAlarm.addListener((alarm) => {
        this.handleAlarm(alarm);
      });
    }
  }

  handleInstall(details) {
    console.log('AI Code Reviewer extension installed:', details);

    // Set default settings
    chrome.storage.sync.set({
      reviewSettings: {
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
      },
      installDate: Date.now(),
      version: chrome.runtime.getManifest().version
    }).catch(error => {
      console.error('Failed to set default settings:', error);
    });

    // Create context menu for GitLab pages
    if (chrome.contextMenus) {
      chrome.contextMenus.create({
        id: 'ai-review',
        title: '🤖 AI Review this MR',
        contexts: ['page'],
        documentUrlPatterns: [
          '*://gitlab.com/*/merge_requests/*',
          '*://*.gitlab.com/*/merge_requests/*',
          '*://gitlab.cmt.apps.telenet.be/*/merge_requests/*'
        ]
      });
    }

    // Open welcome page on first install
    if (details.reason === 'install') {
      chrome.tabs.create({
        url: 'data:text/html,<html><body style="font-family: Arial, sans-serif; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;"><h1>🤖 AI Code Reviewer Installed!</h1><p style="font-size: 18px; margin: 20px 0;">Successfully installed! Here\'s how to use it:</p><ol style="text-align: left; max-width: 500px; margin: 0 auto; font-size: 16px; line-height: 1.6;"><li>Visit any GitLab merge request</li><li>Look for the "🤖 AI Review" button</li><li>Set your Claude API key in the extension popup</li><li>Start reviewing!</li></ol><p style="margin-top: 30px;"><a href="https://console.anthropic.com" target="_blank" style="color: #fff; text-decoration: underline;">Get your Claude API key here</a></p></body></html>'
      }).catch(error => {
        console.warn('Failed to open welcome page:', error);
      });
    }

    // Setup cleanup schedule
    if (chrome.alarms) {
      chrome.alarms.create('cleanup', { periodInMinutes: 60 * 24 }); // Daily cleanup
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getApiKey':
          const result = await chrome.storage.sync.get(['claudeApiKey']);
          sendResponse({ apiKey: result.claudeApiKey });
          break;

        case 'getApiKeys':
          const keys = await chrome.storage.sync.get(['claudeApiKey', 'gitlabAccessToken']);
          sendResponse({
            apiKey: keys.claudeApiKey,
            gitlabToken: keys.gitlabAccessToken
          });
          break;

        case 'getSettings':
          const settingsResult = await chrome.storage.sync.get(['reviewSettings']);
          sendResponse({
            settings: settingsResult.reviewSettings
          });
          break;

        case 'saveReviewResult':
          await this.saveReviewResult(message.data);
          sendResponse({ success: true });
          break;

        case 'getReviewHistory':
          const history = await this.getReviewHistory();
          sendResponse({ history });
          break;

        case 'checkGitLabAccess':
          const hasAccess = await this.checkGitLabAccess(sender.tab);
          sendResponse({ hasAccess });
          break;

        case 'checkNetworkPermissions':
          const permissions = await this.checkNetworkPermissions();
          sendResponse({ permissions });
          break;

        case 'makeAnthropicAPICall':
          const apiResult = await this.makeAnthropicAPICall(message.data);
          sendResponse(apiResult);
          break;

        case 'callClaudeAPI':
          const claudeResult = await this.callClaudeAPI(message);
          sendResponse(claudeResult);
          break;

        case 'stopReview':
          // Forward the stop message to the content script
          chrome.tabs.sendMessage(sender.tab.id, { action: 'stopReview' });
          sendResponse({ success: true });
          break;

        case 'notifyReviewComplete':
          await this.notifyReviewComplete(message.data);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      if (await this.isGitLabMR(tab.url)) {
        try {
          const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' }).catch(() => null);

          // Content script is already loaded via manifest.json

          chrome.action.setBadgeText({
            tabId: tabId,
            text: 'MR'
          });

          chrome.action.setBadgeBackgroundColor({
            tabId: tabId,
            color: '#667eea'
          });

        } catch (error) {
          console.warn('Failed to inject content script:', error);
        }
      } else {
        try {
          chrome.action.setBadgeText({
            tabId: tabId,
            text: ''
          });
        } catch (error) {
          console.warn('Failed to clear badge:', error);
        }
      }
    }
  }

  async isGitLabMR(url) {
    if (!url || !url.includes('/merge_requests/')) {
      return false;
    }
    
    // Check common GitLab patterns first (fast path)
    if (url.includes('gitlab.com') || url.includes('gitlab.cmt.apps.telenet.be')) {
      return true;
    }
    
    // Check if user has configured a custom GitLab URL
    try {
      const result = await chrome.storage.sync.get(['gitlabUrl']);
      if (result.gitlabUrl && result.gitlabUrl.trim()) {
        const configuredUrl = new URL(result.gitlabUrl.trim());
        const currentUrl = new URL(url);
        return currentUrl.host === configuredUrl.host;
      }
    } catch (error) {
      console.warn('Error checking configured GitLab URL:', error);
    }
    
    // Fallback: check if URL looks like a GitLab instance
    // Look for common GitLab path patterns and avoid false positives
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Check for gitlab in hostname but be more specific
      if (hostname.includes('gitlab') && !hostname.includes('github')) {
        return true;
      }
      
      // Check for common self-hosted GitLab patterns in path
      const path = urlObj.pathname;
      if (path.match(/\/[^\/]+\/[^\/]+\/-?\/merge_requests\/\d+/)) {
        return true;
      }
    } catch (error) {
      console.warn('Error parsing URL for GitLab detection:', error);
    }
    
    return false;
  }

  async handleContextMenu(info, tab) {
    if (info.menuItemId === 'ai-review') {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'startReviewFromContext'
        });
      } catch (error) {
        console.error('Context menu action failed:', error);
        try {
          chrome.action.openPopup();
        } catch (popupError) {
          console.warn('Failed to open popup:', popupError);
        }
      }
    }
  }

  handleNotificationClick(notificationId, buttonIndex) {
    if (buttonIndex === 0) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'showLastReview'
          }).catch(error => {
            console.warn('Failed to show last review:', error);
          });
        }
      });
    }

    if (chrome.notifications) {
      chrome.notifications.clear(notificationId);
    }
  }

  handleAlarm(alarm) {
    if (alarm.name === 'cleanup') {
      this.cleanupOldReviews();
    }
  }

  async saveReviewResult(data) {
    try {
      const storageKey = `review_${Date.now()}`;
      const reviewData = {
        ...data,
        timestamp: Date.now(),
        url: data.mrUrl,
        id: storageKey
      };

      await chrome.storage.local.set({
        [storageKey]: reviewData
      });

      const result = await chrome.storage.local.get(['recentReviews']);
      const recentReviews = result.recentReviews || [];
      recentReviews.unshift(storageKey);
      const trimmedReviews = recentReviews.slice(0, 20);
      await chrome.storage.local.set({
        recentReviews: trimmedReviews
      });

      console.log('Review result saved:', storageKey);
    } catch (error) {
      console.error('Failed to save review result:', error);
      throw error;
    }
  }

  async getReviewHistory() {
    try {
      const result = await chrome.storage.local.get(['recentReviews']);
      const recentReviews = result.recentReviews || [];

      if (recentReviews.length === 0) {
        return [];
      }

      const reviewData = await chrome.storage.local.get(recentReviews);
      return recentReviews
        .map(key => reviewData[key])
        .filter(review => review)
        .sort((a, b) => b.timestamp - a.timestamp);

    } catch (error) {
      console.error('Failed to get review history:', error);
      return [];
    }
  }

  async checkGitLabAccess(tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async notifyReviewComplete(data) {
    try {
      if (chrome.notifications) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '🤖 AI Review Complete',
          message: `Found ${data.issueCount} issues in ${data.fileCount} files`,
          buttons: [
            { title: 'View Results' },
            { title: 'Dismiss' }
          ]
        });
      }

      if (data.tabId) {
        chrome.action.setBadgeText({
          tabId: data.tabId,
          text: data.issueCount.toString()
        });

        chrome.action.setBadgeBackgroundColor({
          tabId: data.tabId,
          color: data.issueCount > 0 ? '#ff4444' : '#28a745'
        });
      }

    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  async cleanupOldReviews() {
    try {
      const result = await chrome.storage.local.get(['recentReviews']);
      const recentReviews = result.recentReviews || [];
      const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago

      for (const reviewKey of recentReviews) {
        const reviewData = await chrome.storage.local.get([reviewKey]);
        const review = reviewData[reviewKey];

        if (review && review.timestamp < cutoffTime) {
          await chrome.storage.local.remove([reviewKey]);
        }
      }

      console.log('Cleaned up old reviews');
    } catch (error) {
      console.error('Failed to cleanup old reviews:', error);
    }
  }

  async checkNetworkPermissions() {
    try {
      const manifest = chrome.runtime.getManifest();
      const hostPermissions = manifest.host_permissions || [];
      
      console.log('📋 Checking extension permissions...');
      console.log('Host permissions:', hostPermissions);
      
      // Check if we have the required permissions
      const hasAnthropicPermission = hostPermissions.some(perm => perm.includes('api.anthropic.com'));
      const hasGitLabPermissions = hostPermissions.some(perm => perm.includes('gitlab'));
      
      const permissions = {
        hasAnthropicAccess: hasAnthropicPermission,
        hasGitLabAccess: hasGitLabPermissions,
        hostPermissions: hostPermissions,
        manifestVersion: manifest.manifest_version
      };
      
      console.log('✅ Permission check results:', permissions);
      return permissions;
      
    } catch (error) {
      console.error('❌ Failed to check permissions:', error);
      return { error: error.message };
    }
  }

  async makeAnthropicAPICall(requestData) {
    try {
      console.log('🌐 Background script making API call to Anthropic...');
      console.log('📋 Request data received:', {
        hasRequestData: !!requestData,
        hasApiKey: !!requestData?.apiKey,
        hasBody: !!requestData?.body,
        apiKeyType: typeof requestData?.apiKey,
        apiKeyLength: requestData?.apiKey ? requestData.apiKey.length : 0
      });
      
      if (!requestData || !requestData.apiKey) {
        console.error('🚨 No API key received in background script!');
        return { 
          success: false, 
          error: 'No API key provided to background script'
        };
      }
      
      console.log('📋 Request details:', {
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        apiKeyPresent: !!requestData.apiKey,
        apiKeyPrefix: requestData.apiKey ? requestData.apiKey.substring(0, 15) + '...' : 'MISSING',
        model: requestData.body?.model,
        maxTokens: requestData.body?.max_tokens,
        bodySize: requestData.body ? JSON.stringify(requestData.body).length : 0
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': requestData.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestData.body)
      });

      console.log('📡 Background API Response status:', response.status);

      if (!response.ok) {
        console.error('🚨 API Response not OK. Status:', response.status);
        console.error('🚨 Response headers:', Object.fromEntries(response.headers.entries()));
        
        let errorData = {};
        let rawErrorText = '';
        
        try {
          rawErrorText = await response.text();
          console.error('🚨 Raw error response:', rawErrorText);
          errorData = JSON.parse(rawErrorText);
          console.error('🚨 Parsed error data:', errorData);
        } catch (parseError) {
          console.error('🚨 Could not parse error response as JSON:', parseError);
          console.error('🚨 Raw error text was:', rawErrorText);
          errorData = { raw_error: rawErrorText };
        }
        
        let errorMessage = `API request failed: ${response.status}`;
        if (response.status === 401) {
          errorMessage = 'Invalid API key. Please check your Claude API key in the extension settings.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (response.status === 400) {
          errorMessage = `Bad request: ${errorData.error?.message || errorData.message || rawErrorText || 'Invalid request format'}`;
        } else {
          errorMessage = `API Error (${response.status}): ${errorData.error?.message || errorData.message || rawErrorText || 'Unknown error'}`;
        }
        
        return { 
          success: false, 
          error: errorMessage,
          status: response.status,
          details: errorData,
          rawError: rawErrorText
        };
      }

      const result = await response.json();
      console.log('✅ Background API call successful');
      
      if (!result.content || !result.content[0] || !result.content[0].text) {
        return { 
          success: false, 
          error: 'Invalid response format from API',
          details: result
        };
      }
      
      return { 
        success: true, 
        data: result.content[0].text,
        fullResponse: result
      };
      
    } catch (fetchError) {
      console.error('🚨 Background fetch error:', fetchError);
      
      let errorMessage = `Network error: ${fetchError.message}`;
      if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to Claude API. This may be due to corporate firewall, VPN, or network restrictions.';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        fetchError: fetchError.message
      };
    }
  }

  async callClaudeAPI(message) {
    try {
      const { apiKey, model, prompt, maxTokens } = message;
      
      const requestBody = {
        model: model || 'claude-opus-4-8',
        max_tokens: maxTokens || 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API request failed: ${response.status} ${response.statusText}. ${errorText}`
        };
      }

      const result = await response.json();
      
      if (!result.content || !result.content[0] || !result.content[0].text) {
        return {
          success: false,
          error: 'Invalid response format from API'
        };
      }

      return {
        success: true,
        content: result.content[0].text
      };

    } catch (error) {
      console.error('Claude API call failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Initialize background controller
try {
  console.log('🚀 Starting background controller initialization...');
  const backgroundController = new BackgroundController();
  console.log('✅ Background controller initialized successfully');
  
  // Test if background controller methods work
  console.log('🧪 Testing background controller methods...');
  if (typeof backgroundController.handleMessage === 'function') {
    console.log('✅ handleMessage method exists');
  }
  if (typeof backgroundController.makeAnthropicAPICall === 'function') {
    console.log('✅ makeAnthropicAPICall method exists');
  }
  
} catch (error) {
  console.error('❌ Failed to initialize background controller:', error);
  console.error('Error stack:', error.stack);
}
