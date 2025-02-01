document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKey');
    const startSummaryBtn = document.getElementById('startSummary');
    const statusDiv = document.getElementById('status');
  
    // Load saved API key
    chrome.storage.local.get(['meaningcloud_api_key'], (result) => {
      if (result.meaningcloud_api_key) {
        apiKeyInput.value = result.meaningcloud_api_key;
      }
    });
  
    saveKeyBtn.addEventListener('click', () => {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        chrome.storage.local.set({ meaningcloud_api_key: apiKey }, () => {
          statusDiv.textContent = 'API key saved successfully!';
          setTimeout(() => {
            statusDiv.textContent = '';
          }, 2000);
        });
      }
    });
  
    startSummaryBtn.addEventListener('click', async () => {
      try {
        // First check if we're on a YouTube video page
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
          statusDiv.textContent = 'Could not find active tab!';
          return;
        }
  
        // Check if API key exists
        const { meaningcloud_api_key } = await chrome.storage.local.get(['meaningcloud_api_key']);
        if (!meaningcloud_api_key) {
          statusDiv.textContent = 'Please save your MeaningCloud API key first!';
          return;
        }
  
        // Send message to background script to check if we're on YouTube
        chrome.runtime.sendMessage({ action: 'checkTab' }, async (response) => {
          if (!response || !response.isYouTube) {
            statusDiv.textContent = 'Please navigate to a YouTube video first!';
            return;
          }
  
          // Wait a bit for content script to initialize
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'startSummary' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Content script error:', chrome.runtime.lastError);
                statusDiv.textContent = 'Please refresh the page and try again.';
                return;
              }
              statusDiv.textContent = 'Starting summary...';
              setTimeout(() => window.close(), 2000);
            });
          }, 500);
        });
      } catch (error) {
        console.error('Popup error:', error);
        statusDiv.textContent = 'Error: ' + error.message;
      }
    });
  });