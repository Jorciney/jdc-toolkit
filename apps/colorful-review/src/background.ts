const baseUrl = 'https://github.com';
chrome.runtime.onInstalled.addListener(() => {
  chrome.webNavigation.onCompleted.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([{ id }]) => {
      if (id) {
        chrome.action.disable(id);
      }
    });
  }, { url: [{ hostContains: baseUrl }] });
});

chrome.webNavigation.onCompleted.addListener(function(details) {
  if (details.url.includes("github")) {
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: [
        'main.js'
      ]
    });
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      func: updateBackgroundColor,
      args: ['orange']
    });
  }
});
const updateBackgroundColor = (color: string) => {
  const elementById = document.getElementById('user-profile-frame');
  console.log('FROM BACKGROUND:', elementById);
  if (elementById) {
    elementById.style.background = color;
  }
};
