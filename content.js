let videoElement = null;
let transcriptText = '';
let isRecording = false;
let isInitialized = false;

// Initialize when the page loads
function initialize() {
  if (isInitialized) return;
  
  videoElement = document.querySelector('video');
  if (!videoElement) {
    setTimeout(initialize, 1000);
    return;
  }
  
  isInitialized = true;
  setupListeners();
}

function setupListeners() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSummary') {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
      sendResponse({ success: true });
    }
    return true;
  });
}

function startRecording() {
  if (!videoElement) return;
  
  // Enhanced caption detection
  const captionsButton = document.querySelector('.ytp-subtitles-button');
  const captionsEnabled = document.querySelector('.captions-text') || 
                         document.querySelector('.ytp-caption-segment') ||
                         document.querySelector('.caption-window');
  
  // Check if captions are actually displaying
  if (!captionsEnabled) {
    // Try to enable captions automatically if button exists
    if (captionsButton && !captionsButton.classList.contains('ytp-button-active')) {
      captionsButton.click();
      // Wait a brief moment for captions to initialize
      setTimeout(() => {
        const captionsNowEnabled = document.querySelector('.captions-text') || 
                                 document.querySelector('.ytp-caption-segment') ||
                                 document.querySelector('.caption-window');
        if (!captionsNowEnabled) {
          showError('Please ensure captions are available for this video and enabled (CC)');
          return;
        }
        continueRecording();
      }, 1000);
    } else {
      showError('No captions found. Please ensure this video has captions available.');
      return;
    }
  } else {
    continueRecording();
  }
}

function continueRecording() {
  isRecording = true;
  transcriptText = '';
  
  // Create floating indicator
  const indicator = document.createElement('div');
  indicator.id = 'summary-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;
  indicator.textContent = 'Recording for summary...';
  document.body.appendChild(indicator);

  // Enhanced caption observer
  const captionsObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'characterData') {
        const text = mutation.target.textContent.trim();
        if (text) transcriptText += text + ' ';
      }
      
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
          const text = node.textContent.trim();
          if (text) transcriptText += text + ' ';
        }
      });
    });
  });

  // Try multiple caption container selectors
  const captionsContainer = document.querySelector('.ytp-caption-window-container') ||
                          document.querySelector('.caption-window') ||
                          document.querySelector('.ytp-caption-segment') ||
                          document.querySelector('.captions-text') ||
                          document.querySelector('.ytp-caption-window');

  if (!captionsContainer) {
    showError('Cannot find captions container. Please ensure captions are enabled and visible.');
    stopRecording();
    return;
  }

  // Observe the captions container with enhanced options
  captionsObserver.observe(captionsContainer, {
    childList: true,
    characterData: true,
    subtree: true,
    characterDataOldValue: true
  });
  
  // Stop after 30 seconds
  setTimeout(() => {
    captionsObserver.disconnect();
    stopRecording();
  }, 60000);
}
function stopRecording() {
  if (!isRecording) {
    return;
  }
  
  isRecording = false;
  
  // Remove recording indicator
  const indicator = document.getElementById('summary-indicator');
  if (indicator) {
    indicator.remove();
  }

  // Pause the video
  if (videoElement) {
    videoElement.pause();
  }

  // Show loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'summary-loading';
  loadingDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;
  loadingDiv.textContent = 'Generating summary...';
  document.body.appendChild(loadingDiv);

  if (transcriptText.trim()) {
    // Show the captured captions first
    showCapturedText(transcriptText.trim());
    generateSummary(transcriptText);
  } else {
    if (loadingDiv) {
      loadingDiv.remove();
    }
    showError('No captions were detected. Please ensure captions are enabled and visible on the video.');
  }
}

function showCapturedText(text) {
  const captionsDiv = document.createElement('div');
  captionsDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    max-width: 300px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;
  
  captionsDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h3 style="margin: 0;">Captured Captions</h3>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; cursor: pointer;">✕</button>
    </div>
    <p style="margin: 0; line-height: 1.4; font-size: 14px;">${text}</p>
  `;
  
  document.body.appendChild(captionsDiv);
}
// ... (keep all existing code until the generateSummary function)

// ... (keep all existing code until the generateSummary function)

// ... (keep all existing code until the generateSummary function)

// Keep all existing code up to generateSummary function unchanged...

async function generateSummary(text) {
  try {
    const loadingDiv = document.getElementById('summary-loading');
    
    // Get API key from storage
    const { meaningcloud_api_key } = await chrome.storage.local.get(['meaningcloud_api_key']);
    if (!meaningcloud_api_key) {
      throw new Error('Please set your MeaningCloud API key in the extension popup');
    }
    
    // Make parallel requests to both classification and topics extraction
    const [classResponse, topicsResponse] = await Promise.all([
      // Classification request - using IPTC model which works better for shorter texts
      fetch('https://api.meaningcloud.com/class-2.0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'key': meaningcloud_api_key,
          'txt': text,
          'model': 'IPTC_en', // Changed from IAB_2.0_en to IPTC_en for better short text handling
          'detailed': '1'
        })
      }),
      // Topics extraction request - adjusted for shorter content
      fetch('https://api.meaningcloud.com/topics-2.0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'key': meaningcloud_api_key,
          'txt': text,
          'lang': 'en',
          'tt': 'ec',  // Changed from 'a' to 'ec' (entities and concepts only) for more focused analysis
          'min_relevance': '10' // Lowered relevance threshold for shorter texts
        })
      })
    ]);

    const [classData, topicsData] = await Promise.all([
      classResponse.json(),
      topicsResponse.json()
    ]);

    console.log('Classification Response:', classData);
    console.log('Topics Response:', topicsData);

    if (loadingDiv) {
      loadingDiv.remove();
    }

    // Handle API errors
    for (const data of [classData, topicsData]) {
      if (data.status) {
        switch (data.status.code) {
          case '0':
            break;
          case '100':
            throw new Error('Operation denied. Please check your API key and permissions.');
          case '104':
            throw new Error('Request rate limit exceeded. Please try again later.');
          case '200':
            throw new Error('Missing required parameters. Please try again.');
          case '201':
            throw new Error('Text is too short. Please capture more captions.');
          default:
            throw new Error(data.status.msg || 'API Error: ' + data.status.code);
        }
      }
    }

    // Process classification results - lowered relevance threshold
    const categories = classData.category_list
      ?.filter(cat => cat.relevance && parseFloat(cat.relevance) > 10) // Lowered from 15 to 10
      .map(cat => ({
        label: cat.label.split('>').pop().trim(),
        relevance: parseFloat(cat.relevance)
      })) || [];

    // Process topics results - adjusted for shorter content
    const concepts = topicsData.concept_list
      ?.filter(concept => concept.relevance && parseFloat(concept.relevance) > 10) // Lowered from 15 to 10
      .map(concept => ({
        text: concept.form,
        relevance: parseFloat(concept.relevance)
      })) || [];

    // Create a formatted summary
    let summaryText = '📊 Content Analysis\n\n';
    
    if (categories.length > 0) {
      summaryText += '🏷️ Main Topics:\n';
      categories
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3) // Limited to top 3 categories for more focused results
        .forEach(cat => {
          summaryText += `• ${cat.label} (${cat.relevance}%)\n`;
        });
    }

    if (concepts.length > 0) {
      summaryText += '\n🔑 Key Concepts:\n';
      concepts
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3)  // Limited to top 3 concepts for more focused results
        .forEach(concept => {
          summaryText += `• ${concept.text} (${concept.relevance}%)\n`;
        });
    }

    // More lenient check for content extraction
    if (categories.length === 0 && concepts.length === 0) {
      throw new Error('No meaningful content could be extracted. Try a different section of the video.');
    }

    showSummary(summaryText);
  } catch (error) {
    console.error('Summary generation error:', error);
    
    const loadingDiv = document.getElementById('summary-loading');
    if (loadingDiv) {
      loadingDiv.remove();
    }

    showError(`API Error: ${error.message}`);
  }
}

// Keep all remaining code unchanged...
function generateSentimentSummary(data) {
  const overallSentiment = data.score_tag;
  const confidence = data.confidence;
  const sentences = data.sentence_list;

  let sentimentText = 'Overall sentiment: ';
  switch (overallSentiment) {
    case 'P+': sentimentText += 'Strong Positive'; break;
    case 'P': sentimentText += 'Positive'; break;
    case 'NEU': sentimentText += 'Neutral'; break;
    case 'N': sentimentText += 'Negative'; break;
    case 'N+': sentimentText += 'Strong Negative'; break;
    default: sentimentText += 'Mixed';
  }

  let summary = `${sentimentText} (Confidence: ${confidence}%)\n\nKey points:\n`;
  
  // Add up to 3 most confident sentences
  const topSentences = sentences
    .filter(s => s.confidence > 90)
    .slice(0, 3)
    .map(s => `• ${s.text} (${s.score_tag})`);

  summary += topSentences.join('\n');
  
  return summary;
}
function showSummary(summary) {
  const summaryDiv = document.createElement('div');
  summaryDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    max-width: 300px;
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;
  
  summaryDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h3 style="margin: 0;">Summary</h3>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; cursor: pointer;">✕</button>
    </div>
    <p style="margin: 0; line-height: 1.4;">${summary}</p>
    <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
      <button id="resume-video-btn" style="padding: 8px 16px; background: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Resume Video
      </button>
    </div>
  `;
  
  document.body.appendChild(summaryDiv);

  // Add click handler for resume button
  document.getElementById('resume-video-btn').addEventListener('click', () => {
    if (videoElement) {
      videoElement.play();
    }
    summaryDiv.remove();
  });
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 15px;
    border-radius: 8px;
    max-width: 300px;
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;
  
  errorDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span>${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; margin-left: 10px;">✕</button>
    </div>
  `;
  
  document.body.appendChild(errorDiv);
}

// Start initialization
initialize();

// Enhanced re-initialization on navigation
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    if (currentUrl.includes('youtube.com/watch')) {
      // Reset state
      videoElement = null;
      isRecording = false;
      transcriptText = '';
      isInitialized = false;
      
      // Remove any existing indicators or messages
      const indicator = document.getElementById('summary-indicator');
      if (indicator) indicator.remove();
      
      // Reinitialize
      setTimeout(initialize, 1500); // Give YouTube more time to load
    }
  }
}).observe(document, {subtree: true, childList: true});