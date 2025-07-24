// This script runs in the top frame and watches for iframes being added or changed
// If a new iframe matches the Fortinet player domain, it injects the content script

const TARGET_HOST = 'training.fortinet.com';
const TARGET_PATH = '/scorm/player.php'; // Main SCORM path
const STORY_CONTENT = 'story_content'; // Storyline 360 content path

// Keep track of frames we've already processed to avoid duplicates
const processedFrames = new Set();

// Throttle iframe scanning to prevent infinite loops
let scanTimeout = null;
let lastScanTime = 0;
const SCAN_DELAY = 2000; // 2 seconds between scans

// Get the frame ID based on URL and other attributes - returns a hash-like string
function getFrameIdentifier(iframe) {
    const src = iframe.src || '';
    const id = iframe.id || '';
    return `${src}|${id}`;
}

function injectIntoMatchingIframes() {
    const now = Date.now();
    if (now - lastScanTime < SCAN_DELAY) {
        console.log('[FAA] Throttling iframe scan - too soon since last scan');
        return;
    }
    lastScanTime = now;
    
    const iframes = Array.from(document.getElementsByTagName('iframe'));
    
    if (iframes.length === 0) {
        console.log('[FAA] No iframes found yet');
        return;
    }
    
    // Wait a bit for iframe to load before checking Chrome API
    setTimeout(() => {
        console.log(`[FAA] Scanning ${iframes.length} iframes...`);
        
        // Get all frames from Chrome API to map src to real frameId
        chrome.runtime.sendMessage({action: 'getAllFrames'}, (response) => {
        if (!response || !response.frames) {
            console.log('[FAA] Could not get frame information');
            return;
        }
        
        console.log(`[FAA] Chrome API found ${response.frames.length} frames:`, response.frames);
        
        for (const iframe of iframes) {
            try {
                const src = iframe.src || '';
                const id = iframe.id || '';
                const frameIdentifier = getFrameIdentifier(iframe);
                
                // If we've already processed this frame, skip it
                if (processedFrames.has(frameIdentifier)) {
                    continue;
                }
                
                let shouldInject = false;
                let frameType = 'unknown';
                
                // Check for Fortinet SCORM player
                if (src.includes(TARGET_HOST) && src.includes(TARGET_PATH)) {
                    shouldInject = true;
                    frameType = 'scorm';
                }
                
                // Also look for Storyline 360 content (often loaded in scorm_object iframe)  
                if (id === 'scorm_object' || src.includes(STORY_CONTENT)) {
                    shouldInject = true;
                    frameType = 'storyline';
                }
                
                // Detect storyline/SCORM content by URL patterns
                if (src.includes('loadSCO.php') || src.includes('story_html5.html') || 
                    src.includes('storyline') || src.includes('scorm')) {
                    shouldInject = true;
                    frameType = 'storyline';
                }
                
                // Enhanced detection: Look for any iframe from training.fortinet.com
                if (src.includes(TARGET_HOST)) {
                    shouldInject = true;
                    frameType = 'fortinet';
                }
                
                // Enhanced detection: Look for common LMS/SCORM patterns
                const scormPatterns = [
                    'player.php', 'content.php', 'launch.php', 'view.php',
                    'story_html5', 'story_content', 'presentation',
                    'articulate', 'captivate', 'lectora'
                ];
                if (scormPatterns.some(pattern => src.includes(pattern))) {
                    shouldInject = true;
                    frameType = frameType || 'content';
                }
                
                // Enhanced detection: Look for common iframe IDs that contain content
                const contentIds = ['scorm_object', 'content_frame', 'player_frame', 'lesson_frame'];
                if (contentIds.includes(id)) {
                    shouldInject = true;
                    frameType = frameType || 'content-id';
                }
                
                // Enhanced detection: Any iframe with video/audio elements (checked after load)
                if (!shouldInject && iframe.contentDocument) {
                    try {
                        const hasMedia = iframe.contentDocument.querySelector('video, audio, [data-ref="progressBarFill"]');
                        if (hasMedia) {
                            shouldInject = true;
                            frameType = 'media-content';
                        }
                    } catch (e) {
                        // Cross-origin, can't check content - but this is suspicious, so inject anyway
                        if (src && src !== 'about:blank' && !src.startsWith('javascript:')) {
                            shouldInject = true;
                            frameType = 'cross-origin';
                        }
                    }
                }
                
                if (shouldInject) {
                    console.log(`[FAA] Found ${frameType} iframe:`, src);
                    // Mark this frame as processed
                    processedFrames.add(frameIdentifier);
                    
                    // Multiple strategies to find matching frame
                    let matchingFrame = null;
                    const srcBase = src.split('?')[0]; // Remove query params
                    
                    // Strategy 1: Exact URL match
                    matchingFrame = response.frames.find(frame => frame.url === src);
                    
                    // Strategy 2: Base URL match (without query params)
                    if (!matchingFrame) {
                        matchingFrame = response.frames.find(frame => 
                            frame.url && frame.url.split('?')[0] === srcBase
                        );
                    }
                    
                    // Strategy 3: Partial URL match (contains key parts)
                    if (!matchingFrame) {
                        matchingFrame = response.frames.find(frame => 
                            frame.url && (
                                frame.url.includes('loadSCO.php') ||
                                frame.url.includes('story_html5.html') ||
                                (src.includes('loadSCO.php') && frame.url.includes('loadSCO.php'))
                            )
                        );
                    }
                    
                    // Strategy 4: Fallback to non-top frame (frameId !== 0)
                    if (!matchingFrame) {
                        const nonTopFrames = response.frames.filter(frame => frame.frameId !== 0);
                        if (nonTopFrames.length === 1) {
                            matchingFrame = nonTopFrames[0];
                            console.log('[FAA] Using fallback: single non-top frame');
                        }
                    }
                    
                    const frameId = matchingFrame ? matchingFrame.frameId : null;
                    
                    if (frameId !== null) {
                        console.log(`[FAA] Injecting into iframe with real frameId: ${frameId} (${matchingFrame.url})`);
                        // Inject content.js into this iframe
                        chrome.runtime.sendMessage({
                            action: 'injectContentScript',
                            frameId: frameId,
                            frameSrc: src,
                            frameType: frameType
                        });
                    } else {
                        console.log(`[FAA] Could not find real frameId for iframe: ${src}`);
                        console.log('[FAA] Available frame URLs:', response.frames.map(f => f.url));
                        
                        // Fallback: Try direct iframe loading approach
                        console.log('[FAA] Attempting direct iframe content injection fallback');
                        tryDirectIframeInjection(iframe, frameType);
                    }
                }
            } catch (e) {
                // Ignore cross-origin errors
                console.log('[FAA] Error checking iframe:', e.message);
            }
        }
        });
    }, 1000); // Wait 1 second for iframe to load
}

// Fallback approach: Try to inject by listening for iframe load event
function tryDirectIframeInjection(iframe, frameType) {
    try {
        const src = iframe.src || '';
        
        // Wait for iframe to fully load
        const checkIframeLoad = () => {
            try {
                if (iframe.contentWindow && iframe.contentDocument) {
                    console.log('[FAA] Iframe loaded, requesting injection via background script');
                    
                    // Tell background script to try injection on all non-top frames
                    chrome.runtime.sendMessage({
                        action: 'injectIntoAllFrames',
                        frameSrc: src,
                        frameType: frameType
                    });
                } else {
                    // Retry in 500ms if not loaded yet
                    setTimeout(checkIframeLoad, 500);
                }
            } catch (e) {
                console.log('[FAA] Cross-origin iframe, cannot access content:', e.message);
                
                // Still try to inject via background script
                chrome.runtime.sendMessage({
                    action: 'injectIntoAllFrames', 
                    frameSrc: src,
                    frameType: frameType
                });
            }
        };
        
        // Start checking after 1 second
        setTimeout(checkIframeLoad, 1000);
        
    } catch (e) {
        console.log('[FAA] Error in direct iframe injection:', e.message);
    }
}

// Observe for new iframes added with throttling
const observer = new MutationObserver(() => {
    // Clear any existing timeout
    if (scanTimeout) {
        clearTimeout(scanTimeout);
    }
    
    // Schedule a scan with delay to avoid rapid firing
    scanTimeout = setTimeout(() => {
        injectIntoMatchingIframes();
    }, 500);
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial scan after page load
setTimeout(() => {
    console.log('[FAA] Initial iframe scan');
    injectIntoMatchingIframes();
}, 2000);

// Additional scans at intervals for dynamic content
let scanCount = 0;
const scanInterval = setInterval(() => {
    scanCount++;
    if (scanCount > 20) { // Increased from 10 to 20 for better coverage
        clearInterval(scanInterval);
        console.log('[FAA] Stopping periodic iframe scans');
        return;
    }
    
    console.log(`[FAA] Periodic iframe scan #${scanCount}`);
    injectIntoMatchingIframes();
}, 3000); // Reduced from 5000 to 3000 for more frequent scans

// Recovery mechanism: Look for iframes that should have extension but don't
const recoveryInterval = setInterval(() => {
    const iframes = Array.from(document.getElementsByTagName('iframe'));
    let recoveryAttempts = 0;
    
    iframes.forEach(iframe => {
        try {
            const src = iframe.src || '';
            const shouldHaveExtension = src.includes('training.fortinet.com') || 
                                      src.includes('scorm') || 
                                      src.includes('story');
            
            if (shouldHaveExtension && iframe.contentWindow) {
                // Check if extension is loaded in this frame
                try {
                    const hasExtension = iframe.contentWindow._faaExtensionLoaded;
                    if (!hasExtension) {
                        console.log(`[FAA] Recovery: Found iframe without extension, attempting injection:`, src);
                        recoveryAttempts++;
                        
                        // Force injection attempt
                        chrome.runtime.sendMessage({
                            action: 'injectIntoAllFrames',
                            frameSrc: src,
                            frameType: 'recovery'
                        });
                    }
                } catch (e) {
                    // Cross-origin frame, try injection anyway
                    console.log(`[FAA] Recovery: Cross-origin frame detected, attempting injection:`, src);
                    chrome.runtime.sendMessage({
                        action: 'injectIntoAllFrames',
                        frameSrc: src,
                        frameType: 'cross-origin-recovery'
                    });
                }
            }
        } catch (e) {
            // Ignore errors from inaccessible frames
        }
    });
    
    if (recoveryAttempts > 0) {
        console.log(`[FAA] Recovery scan completed: ${recoveryAttempts} injection attempts`);
    }
}, 10000); // Check every 10 seconds

// Stop recovery after 5 minutes
setTimeout(() => {
    clearInterval(recoveryInterval);
    console.log('[FAA] Stopping recovery scans');
}, 300000);

// Listen for SPA navigation (history.pushState, replaceState, popstate)
function hookHistoryEvents() {
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;
    function trigger() {
        setTimeout(() => {
            console.log('[FAA] Navigation detected, scanning iframes');
            injectIntoMatchingIframes();
        }, 1000);
    }
    history.pushState = function() {
        _pushState.apply(this, arguments);
        trigger();
    };
    history.replaceState = function() {
        _replaceState.apply(this, arguments);
        trigger();
    };
    window.addEventListener('popstate', trigger);
}
hookHistoryEvents();
