// Fortinet Training Auto Video Next - Background Service Worker
console.log('[FAA Background] Service worker starting...');

// Check if Chrome APIs are available
function checkAPIAvailability() {
    if (!chrome.webNavigation) {
        console.error('[FAA Background] webNavigation API not available');
        return false;
    }
    if (!chrome.scripting) {
        console.error('[FAA Background] scripting API not available');
        return false;
    }
    if (!chrome.runtime) {
        console.error('[FAA Background] runtime API not available');
        return false;
    }
    return true;
}

// Safe script injection with error handling
function injectScript(tabId, frameIds, files, context = 'unknown') {
    try {
        const fileNames = Array.isArray(files) ? files.join(', ') : String(files);
        chrome.scripting.executeScript({
            target: {tabId: tabId, frameIds: frameIds},
            files: files
        }).catch((error) => {
            console.error(`[FAA Background] Failed to inject ${fileNames} into ${context}:`, error);
        });
    } catch (error) {
        const fileNames = Array.isArray(files) ? files.join(', ') : String(files);
        console.error(`[FAA Background] Error setting up injection for ${context} (${fileNames}):`, error);
    }
}

// Wait for APIs to be ready before setting up listeners
function initializeBackgroundScript() {
    if (!checkAPIAvailability()) {
        console.error('[FAA Background] Required APIs not available. Retrying in 1 second...');
        setTimeout(initializeBackgroundScript, 1000);
        return;
    }

    console.log('[FAA Background] All APIs available. Setting up listeners...');

    // Always inject iframe-watcher.js into the top frame on Fortinet pages
    try {
        chrome.webNavigation.onCommitted.addListener(function(details) {
            try {
                if (details.frameId === 0) {
                    console.log(`[FAA Background] Injecting scripts into top frame of tab ${details.tabId}`);
                    
                    // Inject both watcher and content script in top frame
                    injectScript(details.tabId, [0], ["iframe-watcher.js"], 'top frame watcher');
                    injectScript(details.tabId, [0], ["content.js"], 'top frame content');
                }
            } catch (error) {
                console.error('[FAA Background] Error in webNavigation.onCommitted listener:', error);
            }
        }, {
            url: [{hostContains: "training.fortinet.com"}]
        });

        console.log('[FAA Background] webNavigation listener registered');
    } catch (error) {
        console.error('[FAA Background] Failed to register webNavigation listener:', error);
    }

    // Listen for messages from iframe-watcher.js to inject content.js into discovered iframes
    try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (message.action === 'getAllFrames' && sender.tab && sender.tab.id) {
                    // Get all frames for the tab to help iframe-watcher map src to real frameIds
                    chrome.webNavigation.getAllFrames({ tabId: sender.tab.id }, (frames) => {
                        if (chrome.runtime.lastError) {
                            console.error('[FAA Background] Error getting frames:', chrome.runtime.lastError);
                            sendResponse({ frames: [] });
                        } else {
                            console.log(`[FAA Background] Found ${frames ? frames.length : 0} frames in tab ${sender.tab.id}`);
                            sendResponse({ frames: frames || [] });
                        }
                    });
                    return true; // Will respond asynchronously
                }
                
                if (message.action === 'injectContentScript' && sender.tab && sender.tab.id) {
                    console.log(`[FAA Background] Injecting content script into frame ${message.frameId} of tab ${sender.tab.id} (${message.frameType})`);
                    
                    // Enhanced injection with better error handling
                    chrome.scripting.executeScript({
                        target: {tabId: sender.tab.id, frameIds: [message.frameId]},
                        files: ["content.js"]
                    }).then(() => {
                        console.log(`[FAA Background] Successfully injected content.js into frame ${message.frameId}`);
                    }).catch((error) => {
                        console.error(`[FAA Background] Failed to inject content.js into frame ${message.frameId}:`, error);
                        console.error(`[FAA Background] Frame details - ID: ${message.frameId}, Src: ${message.frameSrc}, Type: ${message.frameType}`);
                    });
                }
                
                if (message.action === 'injectIntoAllFrames' && sender.tab && sender.tab.id) {
                    console.log(`[FAA Background] Fallback: injecting into all non-top frames of tab ${sender.tab.id} (${message.frameType})`);
                    
                    // Get all frames and try to inject into non-top ones
                    chrome.webNavigation.getAllFrames({ tabId: sender.tab.id }, (frames) => {
                        if (chrome.runtime.lastError || !frames) {
                            console.error('[FAA Background] Could not get frames for fallback injection');
                            return;
                        }
                        
                        const nonTopFrames = frames.filter(frame => frame.frameId !== 0);
                        console.log(`[FAA Background] Found ${nonTopFrames.length} non-top frames for fallback injection`);
                        
                        nonTopFrames.forEach(frame => {
                            console.log(`[FAA Background] Attempting fallback injection into frame ${frame.frameId}: ${frame.url}`);
                            chrome.scripting.executeScript({
                                target: {tabId: sender.tab.id, frameIds: [frame.frameId]},
                                files: ["content.js"]
                            }).then(() => {
                                console.log(`[FAA Background] Fallback injection successful for frame ${frame.frameId}`);
                            }).catch((error) => {
                                console.log(`[FAA Background] Fallback injection failed for frame ${frame.frameId}: ${error.message}`);
                            });
                        });
                    });
                }
            } catch (error) {
                console.error('[FAA Background] Error in runtime.onMessage listener:', error);
            }
        });

        console.log('[FAA Background] runtime.onMessage listener registered');
    } catch (error) {
        console.error('[FAA Background] Failed to register runtime.onMessage listener:', error);
    }

    console.log('[FAA Background] Background script initialization complete');
}

// Handle service worker startup
try {
    // Initialize immediately if APIs are ready
    initializeBackgroundScript();
} catch (error) {
    console.error('[FAA Background] Critical error during initialization:', error);
}

