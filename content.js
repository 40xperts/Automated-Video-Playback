// Fortinet Video Auto-Advancer Content Script with Toggle and Debug Console
(function() {
    // Prevent duplicate script execution in the same context
    // Use timestamp to handle extension updates and page navigation
    const currentVersion = '1.0.0'; // Update when making significant changes
    const loadKey = '_faaScriptLoaded_' + currentVersion;
    
    if (window[loadKey]) {
        console.log('[FAA] Script already loaded in this context (v' + currentVersion + '), skipping...');
        return;
    }
    window[loadKey] = {
        loaded: true,
        timestamp: Date.now(),
        url: window.location.href
    };
    
    // Clean up old version flags
    Object.keys(window).forEach(key => {
        if (key.startsWith('_faaScriptLoaded_') && key !== loadKey) {
            delete window[key];
        }
    });
    
    // Track the current lesson number for sequential navigation
    let currentLessonNumber = 1; // Start with LESSON01
    
    // Ensure UI is only injected in the top frame
    const isTopFrame = window === window.top;
    // ================= UI SETUP =================
    function injectUI() {
        // Only inject UI in the top frame
        if (!isTopFrame) return;
        
        // Check if UI already exists on the page
        const oldUi = document.getElementById('fortinet-auto-advancer-ui');
        if (oldUi) oldUi.remove();
        
        const container = document.createElement('div');
        container.id = 'fortinet-auto-advancer-ui';
        container.innerHTML = `
            <style>
                #fortinet-auto-advancer-ui {
                    position: fixed;
                    top: 4px;
                    right: 4px;
                    z-index: 99999;
                    background: rgba(34, 34, 34, 0.97);
                    border-radius: 10px;
                    box-shadow: 0 2px 8px 0 rgba(0,0,0,0.12);
                    padding: 8px 10px 8px 12px;
                    min-width: 180px;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    color: #fff;
                    font-size: 14px;
                    max-width: 95vw;
                    max-height: 90vh;
                    overflow: auto;
                }
                #fortinet-auto-advancer-ui h4 {
                    margin: 0 0 6px 0;
                    font-size: 16px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                #faa-toggle-row, #faa-redirect-toggle-row, #faa-autoplay-toggle-row, #faa-delay-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                #faa-toggle-label, #faa-redirect-toggle-label, #faa-autoplay-toggle-label, #faa-fullscreen-toggle-label, #faa-delay-label {
                    margin-right: 8px;
                    min-width: 200px;
                    font-size: 13px;
                }
                #faa-toggle, #faa-redirect-toggle, #faa-autoplay-toggle, #faa-fullscreen-toggle {
                    width: 38px;
                    height: 20px;
                    appearance: none;
                    background: #444;
                    outline: none;
                    border-radius: 12px;
                    position: relative;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                #faa-toggle:checked, #faa-redirect-toggle:checked, #faa-autoplay-toggle:checked, #faa-fullscreen-toggle:checked {
                    background: #4caf50;
                }
                #faa-toggle::before, #faa-redirect-toggle::before, #faa-autoplay-toggle::before, #faa-fullscreen-toggle::before {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #fff;
                    transition: transform 0.2s;
                }
                #faa-toggle:checked::before, #faa-redirect-toggle:checked::before, #faa-autoplay-toggle:checked::before, #faa-fullscreen-toggle:checked::before {
                    transform: translateX(18px);
                }
                #faa-next-lesson-display {
                    margin-left: 10px;
                    font-size: 11px;
                    opacity: 0.9;
                }
                #faa-next-lesson-text {
                    font-style: italic;
                    text-decoration: underline;
                    transition: opacity 0.2s;
                }
                #faa-next-lesson-text:hover {
                    opacity: 0.8;
                }
                #faa-lessons-panel {
                    margin-top: 6px;
                    font-size: 13px;
                }
                #faa-lessons-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    padding: 4px 0;
                    border-bottom: 1px solid #666;
                }
                #faa-lessons-toggle {
                    font-weight: 500;
                    user-select: none;
                }
                #faa-lessons-refresh, #faa-completion-reset {
                    background: #444;
                    color: #fff;
                    border: none;
                    border-radius: 3px;
                    padding: 2px 6px;
                    cursor: pointer;
                    font-size: 12px;
                    line-height: 1;
                }
                #faa-lessons-refresh:hover, #faa-completion-reset:hover {
                    background: #555;
                }
                #faa-completion-reset {
                    background: #d9534f;
                }
                #faa-completion-reset:hover {
                    background: #c9302c;
                }
                #faa-lessons-list {
                    max-height: 150px;
                    overflow-y: auto;
                    margin-top: 4px;
                }
                .faa-lesson-item {
                    display: flex;
                    align-items: center;
                    padding: 6px 8px;
                    margin: 2px 0;
                    background: #333;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.2s;
                    font-size: 12px;
                    line-height: 1.3;
                }
                .faa-lesson-item:hover {
                    background: #444;
                }
                .faa-lesson-item.current {
                    background: #2d5a2d;
                    border-left: 3px solid #4caf50;
                }
                .faa-lesson-item.completed {
                    background: #3a3a3a !important; /* Completed lessons get gray background */
                    border-left: 3px solid #6a6a6a !important; /* Gray border for completed */
                    color: #aaa !important;
                }
                .faa-lesson-item.completed .faa-lesson-title {
                    opacity: 0.7;
                    text-decoration: line-through;
                }
                .faa-lesson-item.completed .faa-lesson-number {
                    text-decoration: line-through;
                    opacity: 0.7;
                }
                /* Completed lessons should never be current, but if somehow they are, completed wins */
                .faa-lesson-item.completed.current {
                    background: #3a3a3a !important;
                    border-left: 3px solid #6a6a6a !important;
                    box-shadow: none !important;
                }
                .faa-lesson-item.not-clickable {
                    background: #2a2a2a;
                    color: #888;
                    cursor: not-allowed;
                }
                .faa-lesson-item.not-clickable:hover {
                    background: #2a2a2a;
                }
                .faa-lesson-number {
                    color: #4caf50;
                    font-weight: 600;
                    margin-right: 8px;
                    min-width: 60px;
                }
                .faa-lesson-title {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .faa-lesson-checkbox {
                    margin-left: auto;
                    margin-right: 8px;
                    cursor: pointer;
                    scale: 1.1;
                }
                .faa-lesson-status {
                    font-size: 10px;
                }
                #faa-debug-console {
                    background: #222;
                    border-radius: 6px;
                    margin-top: 5px;
                    padding: 8px 6px;
                    font-size: 13px;
                    max-height: 120px;
                    overflow-y: auto;
                }
            </style>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <span style="font-weight:bold;font-size:14px;">Fortinet Auto Advancer</span>
                <div style="display:flex;gap:3px;">
                    <button id="faa-reset-btn" style="background:#d9534f;color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:12px;">Reset to LESSON01</button>
                    <button id="faa-showlog-btn" style="background:#444;color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:12px;">Show Log</button>
                    <button id="faa-hideui-btn" style="background:#444;color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:12px;">Hide UI</button>
                    <button id="faa-closeui-btn" style="background:#444;color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:12px;">×</button>
                </div>
            </div>
            <div id="faa-toggle-row" style="margin-top:6px;display:flex;align-items:center;gap:8px;">
                <span id="faa-toggle-label">Auto Play Next Video:</span>
                <input type="checkbox" id="faa-toggle" />
            </div>
            <div id="faa-redirect-toggle-row" style="margin-top:4px;display:flex;align-items:center;gap:8px;">
                <span id="faa-redirect-toggle-label">On Video Series Finish Redirect to Home:</span>
                <input type="checkbox" id="faa-redirect-toggle" />
            </div>
            <div id="faa-autoplay-toggle-row" style="margin-top:4px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                    <span id="faa-autoplay-toggle-label">Auto Play Next Video In Series:</span>
                    <input type="checkbox" id="faa-autoplay-toggle" />
                </div>
                <div id="faa-next-lesson-display" style="font-size:11px;color:#888;margin-left:8px;font-style:italic;">
                    Next: <span id="faa-next-lesson-text">Detecting...</span>
                </div>
            </div>
            <div id="faa-fullscreen-toggle-row" style="margin-top:4px;display:flex;align-items:center;gap:8px;">
                <span id="faa-fullscreen-toggle-label">Auto Fullscreen Video Player:</span>
                <input type="checkbox" id="faa-fullscreen-toggle" />
            </div>
            <div id="faa-delay-row" style="margin-top:4px;display:flex;align-items:center;gap:8px;">
                <span id="faa-delay-label">Transition Delay (seconds):</span>
                <input type="number" id="faa-delay-input" min="0.5" max="10" step="0.5" value="1" style="width:60px;padding:2px;border:1px solid #666;border-radius:3px;background:#333;color:#fff;text-align:center;" />
            </div>
            <div id="faa-lessons-panel" style="margin-top:6px;">
                <div id="faa-lessons-header" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:4px 0;">
                    <span id="faa-lessons-toggle">► Course Lessons (<span id="faa-lessons-count">0</span> found)</span>
                    <div style="display:flex;gap:4px;">
                        <button id="faa-completion-reset" title="Reset all completion data">🗑️</button>
                        <button id="faa-lessons-refresh" title="Refresh lessons">🔄</button>
                    </div>
                </div>
                <div id="faa-lessons-list" style="display:none;max-height:150px;overflow-y:auto;margin-top:4px;border-top:1px solid #666;">
                    <div id="faa-lessons-loading" style="padding:8px;text-align:center;color:#888;">🔍 Scanning for lessons...</div>
                </div>
            </div>
            <div id="faa-debug-console" style="margin-top:6px;display:none;"></div>

        `;
        document.body.appendChild(container);
        setupAdvancerUIButtons();
        
        // Load cached lessons immediately after UI creation to populate lesson list
        setTimeout(() => {
            loadAndDisplayCachedLessons();
        }, 100);
        // Ensure the UI stays within viewport if moved
        function clampToViewport() {
            const rect = container.getBoundingClientRect();
            let changed = false;
            let left = rect.left, top = rect.top;
            if (rect.right > window.innerWidth) { left -= (rect.right - window.innerWidth); changed = true; }
            if (rect.bottom > window.innerHeight) { top -= (rect.bottom - window.innerHeight); changed = true; }
            if (rect.left < 0) { left = 0; changed = true; }
            if (rect.top < 0) { top = 0; changed = true; }
            if (changed) {
                container.style.left = left + 'px';
                container.style.top = top + 'px';
                container.style.right = '';
            }
        }
        // Clamp after any mouseup (in case user moves it)
        window.addEventListener('mouseup', clampToViewport);
        // Clamp on window resize
        window.addEventListener('resize', clampToViewport);
        // Clamp initially
        setTimeout(clampToViewport, 100);
    }

    // ================ UI BUTTON LOGIC ================
    function setupAdvancerUIButtons() {
        var showLogBtn = document.getElementById('faa-showlog-btn');
        var debugConsole = document.getElementById('faa-debug-console');
        var hideUiBtn = document.getElementById('faa-hideui-btn');
        var closeUiBtn = document.getElementById('faa-closeui-btn');
        var resetBtn = document.getElementById('faa-reset-btn');
        var advUi = document.getElementById('fortinet-auto-advancer-ui');
        if (showLogBtn && debugConsole) {
            showLogBtn.addEventListener('click', function() {
                if (debugConsole.style.display === 'none') {
                    debugConsole.style.display = '';
                    showLogBtn.textContent = 'Hide Log';
                } else {
                    debugConsole.style.display = 'none';
                    showLogBtn.textContent = 'Show Log';
                }
            });
        }
        if (hideUiBtn && advUi) {
            hideUiBtn.addEventListener('click', function() {
                advUi.style.display = 'none';
                var restoreBtn = document.createElement('button');
                restoreBtn.id = 'faa-restoreui-btn';
                restoreBtn.textContent = 'Show Advancer';
                restoreBtn.style.position = 'fixed';
                restoreBtn.style.top = '4px';
                restoreBtn.style.right = '4px';
                restoreBtn.style.zIndex = 100000;
                restoreBtn.style.background = '#444';
                restoreBtn.style.color = '#fff';
                restoreBtn.style.border = 'none';
                restoreBtn.style.borderRadius = '8px';
                restoreBtn.style.fontSize = '12px';
                restoreBtn.style.padding = '2px 10px';
                restoreBtn.style.cursor = 'pointer';
                restoreBtn.onclick = function() {
                    advUi.style.display = '';
                    restoreBtn.remove();
                };
                document.body.appendChild(restoreBtn);
            });
        }
        if (closeUiBtn && advUi) {
            closeUiBtn.addEventListener('click', function() {
                advUi.style.display = 'none';
                var reopenBtn = document.createElement('button');
                reopenBtn.id = 'faa-reopenui-btn';
                reopenBtn.textContent = '🟢';
                reopenBtn.title = 'Show Fortinet Advancer';
                reopenBtn.style.position = 'fixed';
                reopenBtn.style.top = '4px';
                reopenBtn.style.right = '4px';
                reopenBtn.style.zIndex = 100000;
                reopenBtn.style.background = '#fff';
                reopenBtn.style.color = '#444';
                reopenBtn.style.border = '1px solid #444';
                reopenBtn.style.borderRadius = '10px';
                reopenBtn.style.fontSize = '16px';
                reopenBtn.style.padding = '2px 10px';
                reopenBtn.style.cursor = 'pointer';
                reopenBtn.onclick = function() {
                    advUi.style.display = '';
                    reopenBtn.remove();
                };
                document.body.appendChild(reopenBtn);
            });
        }
        
        // Add reset button event listener
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                setCurrentLessonNumber(1); // Reset to LESSON01
                logDebug('State reset - Current lesson set back to LESSON01');
                
                // If on homepage, attempt to find and click LESSON01 now
                if (isHomePage()) {
                    setTimeout(() => {
                        findAndClickNextLesson();
                    }, 500);
                }
            });
        }
        
    }

    // Call after UI is injected - but only in top frame
    // Prevent multiple UI instances - strengthen with version checking
    const uiKey = '_faaUiInjected_' + currentVersion;
    if (isTopFrame && !window[uiKey]) {
        // Only inject UI in top frame, regardless of whether we find a progress bar
        window[uiKey] = {
            injected: true,
            timestamp: Date.now(),
            url: window.location.href
        };
        
        // Clean up old UI version flags
        Object.keys(window).forEach(key => {
            if (key.startsWith('_faaUiInjected_') && key !== uiKey) {
                delete window[key];
            }
        });
        
        injectUI();
    }

    // ================ DEBUG CONSOLE ================
    let lastDebugMsg = null;
    let messageCache = new Set();
    const CACHE_TIMEOUT = 5000; // Clear cache after 5 seconds
    
    function logDebug(msg) {
        if (msg === lastDebugMsg) return; // suppress consecutive duplicate
        lastDebugMsg = msg;
        
        // Always log to console for debugging
        console.log('[FAA]', msg);
        
        // If we're in an iframe, send the message to the top frame
        if (!isTopFrame) {
            // Create a cache key with timestamp window to prevent rapid duplicates
            const cacheKey = msg;
            if (messageCache.has(cacheKey)) {
                return; // Skip sending duplicate message
            }
            
            messageCache.add(cacheKey);
            setTimeout(() => messageCache.delete(cacheKey), CACHE_TIMEOUT);
            
            try {
                window.top.postMessage({
                    type: 'faa-debug',
                    message: msg
                }, '*');
            } catch (e) {
                // Ignore cross-origin errors
            }
            return;
        }
        
        // In top frame, update the UI
        const consoleDiv = document.getElementById('faa-debug-console');
        if (consoleDiv) {
            const now = new Date();
            const timestr = now.toLocaleTimeString();
            const entry = document.createElement('div');
            entry.textContent = `[${timestr}] ${msg}`;
            consoleDiv.appendChild(entry);
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        }
    }
    
    // Listen for messages from iframes
    if (isTopFrame) {
        const topFrameMessageCache = new Set();
        
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'faa-debug') {
                const iframeMsg = `[iframe] ${event.data.message}`;
                
                // Prevent duplicate iframe messages at the top level
                if (topFrameMessageCache.has(iframeMsg)) {
                    return;
                }
                
                topFrameMessageCache.add(iframeMsg);
                setTimeout(() => topFrameMessageCache.delete(iframeMsg), CACHE_TIMEOUT);
                
                logDebug(iframeMsg);
            }
        });
    }


    // ================ TOGGLE HANDLING ================
    function setToggleState(enabled) {
        const toggle = document.getElementById('faa-toggle');
        if (toggle) toggle.checked = !!enabled;
        chrome.storage.local.set({ 'faa_enabled': !!enabled });
        logDebug('🎯 Auto Play Next Video ' + (enabled ? 'ENABLED' : 'DISABLED'));
    }
    function getToggleState(cb) {
        chrome.storage.local.get(['faa_enabled'], (result) => {
            cb(result.faa_enabled === true); // default OFF
        });
    }
    function getCurrentLessonNumber(cb) {
        chrome.storage.local.get(['faa_current_lesson'], (result) => {
            cb(result.faa_current_lesson || 1); // default to start with LESSON01
        });
    }
    function setCurrentLessonNumber(lessonNumber) {
        chrome.storage.local.set({ 'faa_current_lesson': lessonNumber });
        currentLessonNumber = lessonNumber;
        logDebug(`Current lesson number set to ${lessonNumber}`);
        
        // Update next lesson display when current lesson changes
        updateNextLessonDisplay();
    }
    
    // Last clicked lesson tracking (for next lesson display)
    function getLastClickedLessonNumber(cb) {
        chrome.storage.local.get(['faa_last_clicked_lesson'], (result) => {
            cb(result.faa_last_clicked_lesson || null); // null if no lesson clicked yet
        });
    }
    function setLastClickedLessonNumber(lessonNumber) {
        chrome.storage.local.set({ 'faa_last_clicked_lesson': lessonNumber });
        logDebug(`Last clicked lesson number set to ${lessonNumber}`);
        
        // Update next lesson display when last clicked lesson changes
        updateNextLessonDisplay();
    }
    
    // Auto-redirect toggle functions
    function setRedirectToggleState(enabled) {
        const toggle = document.getElementById('faa-redirect-toggle');
        if (toggle) toggle.checked = !!enabled;
        chrome.storage.local.set({ 'faa_redirect_enabled': !!enabled });
        logDebug('🏠 On Video Series Finish Redirect to Home ' + (enabled ? 'ENABLED' : 'DISABLED'));
    }
    function getRedirectToggleState(cb) {
        chrome.storage.local.get(['faa_redirect_enabled'], (result) => {
            cb(result.faa_redirect_enabled === true); // default OFF
        });
    }
    
    // Auto-play next video toggle functions
    function setAutoPlayToggleState(enabled) {
        const toggle = document.getElementById('faa-autoplay-toggle');
        if (toggle) toggle.checked = !!enabled;
        chrome.storage.local.set({ 'faa_autoplay_enabled': !!enabled });
        logDebug('▶️ Auto Play Next Video In Series ' + (enabled ? 'ENABLED' : 'DISABLED'));
    }
    function getAutoPlayToggleState(cb) {
        chrome.storage.local.get(['faa_autoplay_enabled'], (result) => {
            cb(result.faa_autoplay_enabled === true); // default OFF
        });
    }
    
    // Auto-fullscreen toggle functions
    function setFullscreenToggleState(enabled) {
        const toggle = document.getElementById('faa-fullscreen-toggle');
        if (toggle) toggle.checked = !!enabled;
        chrome.storage.local.set({ 'faa_fullscreen_enabled': !!enabled });
        logDebug('🖥️ Auto Fullscreen Video Player ' + (enabled ? 'ENABLED' : 'DISABLED'));
        
        // Handle immediate toggle response
        if (enabled) {
            // Toggle turned ON - set up listeners and check for playing videos
            setupVideoListeners();
            
            // Check if any videos are currently playing for immediate fullscreen
            if (currentlyPlayingVideos.size > 0) {
                logDebug(`🖥️ Toggle enabled with ${currentlyPlayingVideos.size} playing video(s)`);
                
                // Try immediate fullscreen first (might work if user just clicked the toggle)
                const immediateSuccess = attemptFullscreenDirect();
                
                // If immediate attempt failed, set up user gesture detection
                if (!immediateSuccess) {
                    logDebug('⚠️ Immediate fullscreen failed (likely no user gesture) - setting up user gesture detection');
                    pendingFullscreenRequest = true;
                    setupUserGestureDetection();
                }
            } else {
                logDebug('🖥️ Toggle enabled - waiting for video play events to trigger fullscreen');
            }
        } else {
            // Toggle turned OFF - clean up listeners and exit fullscreen
            logDebug('🖥️ Toggle disabled - cleaning up listeners and exiting fullscreen');
            
            // If currently in fullscreen, exit it
            if (isCurrentlyInFullscreen()) {
                logDebug('🖥️ Exiting fullscreen due to toggle disabled');
                exitFullscreen();
            }
            
            // Clean up all video state and pending requests
            cleanupVideoListeners();
            
            // Cancel any pending fullscreen request
            if (pendingFullscreenRequest) {
                logDebug('🖥️ Cancelling pending fullscreen request');
                pendingFullscreenRequest = false;
                
                // Remove user gesture listeners
                const userGestureEvents = ['click', 'keydown', 'mousedown', 'touchstart'];
                userGestureEvents.forEach(eventType => {
                    document.removeEventListener(eventType, arguments.callee, true);
                });
            }
        }
    }
    function getFullscreenToggleState(cb) {
        chrome.storage.local.get(['faa_fullscreen_enabled'], (result) => {
            cb(result.faa_fullscreen_enabled === true); // default OFF
        });
    }
    
    // Transition delay functions
    function setTransitionDelay(delaySeconds) {
        const delayInput = document.getElementById('faa-delay-input');
        if (delayInput) delayInput.value = delaySeconds;
        chrome.storage.local.set({ 'faa_transition_delay': delaySeconds });
        logDebug(`⏱️ Transition delay set to ${delaySeconds} seconds`);
    }
    function getTransitionDelay(cb) {
        chrome.storage.local.get(['faa_transition_delay'], (result) => {
            cb(result.faa_transition_delay || 1); // default 1 second
        });
    }
    
    // ================ LESSON COMPLETION TRACKING ================
    function getLessonCompletion(lessonNumber, cb) {
        chrome.storage.local.get(['faa_lesson_completion'], (result) => {
            const completionData = result.faa_lesson_completion || {};
            const lessonData = completionData[lessonNumber] || { 
                completed: false, 
                completedAt: null 
            };
            cb(lessonData);
        });
    }
    
    function setLessonCompleted(lessonNumber, completed) {
        chrome.storage.local.get(['faa_lesson_completion'], (result) => {
            const completionData = result.faa_lesson_completion || {};
            
            completionData[lessonNumber] = {
                completed: !!completed,
                completedAt: completed ? new Date().toISOString() : null
            };
            
            chrome.storage.local.set({ 'faa_lesson_completion': completionData });
            
            logDebug(`📚 LESSON${String(lessonNumber).padStart(2, '0')} marked as ${completed ? 'COMPLETED' : 'INCOMPLETE'}`);
            
            // If lesson was completed, advance current lesson to next incomplete lesson
            if (completed) {
                advanceToNextIncompleteLesson();
            }
            
            // Update UI if lessons are currently displayed
            if (currentFoundLessons.length > 0) {
                updateLessonsDisplay(currentFoundLessons);
            }
            
            // Always update next lesson display when completion changes
            updateNextLessonDisplay();
        });
    }
    
    // Auto-advance to next incomplete lesson when a lesson is completed
    function advanceToNextIncompleteLesson() {
        if (currentFoundLessons.length === 0) return;
        
        // Get current completion data
        chrome.storage.local.get(['faa_lesson_completion'], (result) => {
            const completionData = result.faa_lesson_completion || {};
            
            // Find the first incomplete lesson in sequence
            const sortedLessons = currentFoundLessons.sort((a, b) => a.number - b.number);
            const nextIncomplete = sortedLessons.find(lesson => {
                const lessonCompletion = completionData[lesson.number];
                return !lessonCompletion || !lessonCompletion.completed;
            });
            
            if (nextIncomplete) {
                const newCurrentLesson = nextIncomplete.number;
                logDebug(`🔄 Auto-advancing to next incomplete lesson: LESSON${String(newCurrentLesson).padStart(2, '0')}`);
                setCurrentLessonNumber(newCurrentLesson);
            } else {
                // All lessons completed - could set to last lesson or first lesson
                const lastLesson = Math.max(...sortedLessons.map(l => l.number));
                logDebug(`🎉 All lessons completed! Setting current to last lesson: LESSON${String(lastLesson).padStart(2, '0')}`);
                setCurrentLessonNumber(lastLesson);
            }
        });
    }
    
    function getAllCompletedLessons(cb) {
        chrome.storage.local.get(['faa_lesson_completion'], (result) => {
            const completionData = result.faa_lesson_completion || {};
            const completed = [];
            
            for (const [lessonNum, data] of Object.entries(completionData)) {
                if (data.completed) {
                    completed.push(parseInt(lessonNum));
                }
            }
            
            cb(completed.sort((a, b) => a - b));
        });
    }
    
    function getCompletionStats(foundLessons, cb) {
        chrome.storage.local.get(['faa_lesson_completion'], (result) => {
            const completionData = result.faa_lesson_completion || {};
            
            let completed = 0;
            let total = foundLessons.length;
            
            foundLessons.forEach(lesson => {
                const lessonData = completionData[lesson.number];
                if (lessonData && lessonData.completed) {
                    completed++;
                }
            });
            
            cb({
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0
            });
        });
    }
    
    function resetAllCompletions() {
        // Get current completion data for logging before reset
        chrome.storage.local.get(['faa_lesson_completion'], (result) => {
            const completionData = result.faa_lesson_completion || {};
            const completedLessons = Object.keys(completionData).filter(key => completionData[key].completed);
            
            if (completedLessons.length > 0) {
                logDebug(`🗑️ Resetting completion data for ${completedLessons.length} completed lessons:`);
                completedLessons.forEach(lessonNum => {
                    const data = completionData[lessonNum];
                    const completedDate = new Date(data.completedAt).toLocaleDateString();
                    logDebug(`   • LESSON${String(lessonNum).padStart(2, '0')} (completed ${completedDate})`);
                });
            }
            
            chrome.storage.local.set({ 'faa_lesson_completion': {} });
            logDebug('🗑️ All lesson completion data reset');
            
            // Update UI if lessons are currently displayed
            if (currentFoundLessons.length > 0) {
                updateLessonsDisplay(currentFoundLessons);
            }
            
            // Always update next lesson display when completion resets
            updateNextLessonDisplay();
        });
    }

    // ================ MAIN LOGIC ================
    let observer = null;
    let lastWasComplete = false;
    let advanceTimeout = null;
    let progressMonitorInterval = null;
    let lastLoggedProgress = null;

    // ================ PROGRESS MONITORING ================
    function getCurrentProgressPercentage() {
        // Check standard Fortinet progress bar first
        const standardProgressBar = document.querySelector('[data-ref="progressBarFill"]');
        if (standardProgressBar) {
            const style = standardProgressBar.getAttribute('style') || '';
            const match = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
            if (match) return match[1];
        }
        
        // Check for video/audio progress first (most reliable for media content)
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
            if (video.offsetParent !== null && video.duration > 0) {
                const progress = (video.currentTime / video.duration) * 100;
                if (progress > 0) {
                    return progress.toFixed(1);
                }
            }
        }
        
        const audioElements = document.querySelectorAll('audio');
        for (const audio of audioElements) {
            if (audio.offsetParent !== null && audio.duration > 0) {
                const progress = (audio.currentTime / audio.duration) * 100;
                if (progress > 0) {
                    return progress.toFixed(1);
                }
            }
        }
        
        // Check Storyline progress indicators with expanded selectors
        const storylineSelectors = [
            '[role="progressbar"]',
            '#progress-container',
            '.slide-progress',
            '[class*="progress"]',
            '[class*="seekbar"]',
            '[class*="scrubber"]',
            '.cp-progress-bar',
            '.storyline-progress',
            '[id*="progress"]',
            '[aria-label*="progress"]'
        ];
        
        for (const selector of storylineSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                // Try aria-valuenow/aria-valuemax approach
                const ariaValueNow = element.getAttribute('aria-valuenow');
                const ariaValueMax = element.getAttribute('aria-valuemax');
                if (ariaValueNow && ariaValueMax) {
                    return ((ariaValueNow / ariaValueMax) * 100).toFixed(1);
                }
                
                // Try width percentage approach
                const style = element.getAttribute('style') || '';
                const match = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
                if (match) return match[1];
                
                // Try looking for child elements with progress info
                const progressChild = element.querySelector('[style*="width"]');
                if (progressChild) {
                    const childStyle = progressChild.getAttribute('style') || '';
                    const childMatch = childStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
                    if (childMatch) return childMatch[1];
                }
            }
        }
        
        return null; // No progress found
    }
    
    function logProgressPeriodically() {
        const progress = getCurrentProgressPercentage();
        if (progress !== null && progress !== lastLoggedProgress) {
            logDebug(`📈 Video Progress: ${progress}%`);
            lastLoggedProgress = progress;
        }
    }
    
    function startProgressMonitoring() {
        if (progressMonitorInterval) return; // Already running
        
        // Check if progress monitoring is already running in another frame
        const monitorKey = '_faaProgressMonitorClaimed_' + currentVersion;
        if (isTopFrame) {
            // In top frame, check if any iframe has claimed monitoring
            if (window[monitorKey]) {
                logDebug('📊 Progress monitoring already claimed by another frame (v' + currentVersion + ')');
                return;
            }
            window[monitorKey] = {
                claimed: true,
                timestamp: Date.now(),
                frame: 'top'
            };
        } else {
            // In iframe, check if top frame or another iframe claimed monitoring
            try {
                if (window.top[monitorKey]) {
                    logDebug('📊 Progress monitoring already claimed by another frame (v' + currentVersion + ')');
                    return;
                }
                window.top[monitorKey] = {
                    claimed: true,
                    timestamp: Date.now(),
                    frame: 'iframe'
                };
            } catch (e) {
                // Cross-origin error, proceed with local monitoring
                // Use local monitoring flag in this case
                if (window[monitorKey]) {
                    logDebug('📊 Progress monitoring already claimed locally (cross-origin)');
                    return;
                }
                window[monitorKey] = {
                    claimed: true,
                    timestamp: Date.now(),
                    frame: 'local'
                };
            }
        }
        
        progressMonitorInterval = setInterval(logProgressPeriodically, 5000);
        logDebug('📊 Progress monitoring started (logging every 5 seconds)');
    }
    
    function stopProgressMonitoring() {
        if (progressMonitorInterval) {
            clearInterval(progressMonitorInterval);
            progressMonitorInterval = null;
            lastLoggedProgress = null;
            
            // Release the monitoring claim
            const monitorKey = '_faaProgressMonitorClaimed_' + currentVersion;
            try {
                if (isTopFrame) {
                    delete window[monitorKey];
                } else {
                    delete window.top[monitorKey];
                }
            } catch (e) {
                // Cross-origin error, try local cleanup
                delete window[monitorKey];
            }
            
            logDebug('📊 Progress monitoring stopped');
        }
    }
    
    // ================ NEXT LESSON DISPLAY ================
    function getNextLessonFromFound(foundLessons, currentLessonNum) {
        // Sort lessons by number to ensure proper order
        const sortedLessons = foundLessons.sort((a, b) => a.number - b.number);
        
        // Find the next lesson after current
        const nextLesson = sortedLessons.find(lesson => lesson.number > currentLessonNum);
        
        return nextLesson || null;
    }
    
    function updateNextLessonDisplay() {
        const nextLessonText = document.getElementById('faa-next-lesson-text');
        if (!nextLessonText) return;
        
        // If we have current lessons, use them directly
        if (currentFoundLessons.length > 0) {
            updateNextLessonDisplayWithLessons(currentFoundLessons);
            return;
        }
        
        // Otherwise, try to load cached lessons
        loadCachedLessons(cachedLessons => {
            if (cachedLessons.length > 0) {
                updateNextLessonDisplayWithLessons(cachedLessons);
            } else {
                nextLessonText.textContent = 'No lessons found';
                nextLessonText.style.color = '#888';
                nextLessonText.style.cursor = 'default';
                nextLessonText.onclick = null;
            }
        });
    }
    
    function updateNextLessonDisplayWithLessons(lessons) {
        const nextLessonText = document.getElementById('faa-next-lesson-text');
        if (!nextLessonText) return;
        
        getLastClickedLessonNumber(lastClickedLesson => {
            if (lastClickedLesson === null) {
                // No lesson has been clicked yet
                nextLessonText.textContent = 'Waiting for first lesson to start';
                nextLessonText.style.color = '#888';
                nextLessonText.style.cursor = 'default';
                nextLessonText.title = 'Click a lesson to start tracking';
                nextLessonText.onclick = null;
                return;
            }
            
            const nextLesson = getNextLessonFromFound(lessons, lastClickedLesson);
            
            if (nextLesson) {
                // Clean up the title by removing "LESSON XX:" prefix if it exists
                let cleanTitle = nextLesson.text.replace(/^LESSON\s*\d+:\s*/i, '');
                
                // Truncate if too long for UI
                if (cleanTitle.length > 40) {
                    cleanTitle = cleanTitle.substring(0, 37) + '...';
                }
                
                const lessonNumber = String(nextLesson.number).padStart(2, '0');
                nextLessonText.textContent = `LESSON${lessonNumber}: "${cleanTitle}"`;
                nextLessonText.style.color = nextLesson.clickable ? '#4caf50' : '#888';
                nextLessonText.style.cursor = nextLesson.clickable ? 'pointer' : 'default';
                nextLessonText.title = nextLesson.clickable ? 
                    `Click to go to: ${nextLesson.text}` : 
                    'Next lesson not clickable';
                
                // Make clickable if lesson is available and has element (not cached)
                if (nextLesson.clickable && nextLesson.element) {
                    nextLessonText.onclick = () => {
                        clickLesson(nextLesson.number, nextLesson.element);
                    };
                } else {
                    nextLessonText.onclick = null;
                    // Show different tooltip for cached lessons
                    if (nextLesson.clickable && !nextLesson.element) {
                        nextLessonText.title = `${nextLesson.text} (cached - not clickable from lesson page)`;
                        nextLessonText.style.cursor = 'default';
                    }
                }
            } else {
                // Check if we're at the end of available lessons
                const isAtEnd = lessons.every(lesson => lesson.number <= lastClickedLesson);
                nextLessonText.textContent = isAtEnd ? 'Course complete! 🎉' : 'No next lesson found';
                nextLessonText.style.color = isAtEnd ? '#4caf50' : '#888';
                nextLessonText.style.cursor = 'default';
                nextLessonText.title = isAtEnd ? 'All available lessons completed' : 'No next lesson available';
                nextLessonText.onclick = null;
            }
        });
    }

    // ================ LESSONS UI MANAGEMENT ================
    let currentFoundLessons = [];
    let lessonsExpanded = false;
    
    function updateLessonsDisplay(foundLessons) {
        currentFoundLessons = foundLessons;
        
        const countSpan = document.getElementById('faa-lessons-count');
        const lessonsList = document.getElementById('faa-lessons-list');
        const loadingDiv = document.getElementById('faa-lessons-loading');
        
        if (!countSpan || !lessonsList) return;
        
        // Update count with completion stats
        getCompletionStats(foundLessons, (stats) => {
            if (stats.total > 0) {
                countSpan.textContent = `${foundLessons.length} found, ${stats.completed} completed`;
            } else {
                countSpan.textContent = '0 found';
            }
        });
        
        // Clear loading state
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
        // Clear existing lessons
        lessonsList.innerHTML = '';
        
        if (foundLessons.length === 0) {
            lessonsList.innerHTML = '<div style="padding:8px;text-align:center;color:#888;">No lessons found</div>';
            return;
        }
        
        // Get current lesson number for highlighting
        getCurrentLessonNumber(currentLesson => {
            foundLessons.forEach(lesson => {
                getLessonCompletion(lesson.number, (completionData) => {
                    const lessonItem = document.createElement('div');
                    lessonItem.className = 'faa-lesson-item';
                    
                    if (!lesson.clickable) {
                        lessonItem.classList.add('not-clickable');
                    }
                    
                    // Apply classes with proper priority: completed lessons cannot be current
                    if (completionData.completed) {
                        lessonItem.classList.add('completed');
                        // Completed lessons override any current status
                    } else if (lesson.number === currentLesson) {
                        lessonItem.classList.add('current');
                    }
                    
                    const lessonNumber = document.createElement('span');
                    lessonNumber.className = 'faa-lesson-number';
                    lessonNumber.textContent = `L${String(lesson.number).padStart(2, '0')}`;
                    
                    const lessonTitle = document.createElement('span');
                    lessonTitle.className = 'faa-lesson-title';
                    // Clean up the title by removing "LESSON XX:" prefix if it exists
                    let cleanTitle = lesson.text.replace(/^LESSON\s*\d+:\s*/i, '');
                    lessonTitle.textContent = cleanTitle;
                    lessonTitle.title = cleanTitle; // Full title on hover
                    
                    const lessonStatus = document.createElement('span');
                    lessonStatus.className = 'faa-lesson-status';
                    
                    // Status priority: Completed > Current (only if not completed) > Clickable > Not clickable  
                    if (completionData.completed) {
                        lessonStatus.textContent = '✓';
                        lessonStatus.title = `Completed on ${new Date(completionData.completedAt).toLocaleString()}`;
                        // Completed lessons cannot be current - remove any current styling
                        lessonItem.classList.remove('current');
                    } else if (lesson.number === currentLesson) {
                        lessonStatus.textContent = '⭐';
                        lessonStatus.title = 'Current lesson';
                        lessonItem.classList.add('current');
                    } else if (lesson.clickable) {
                        lessonStatus.textContent = '✅';
                        lessonStatus.title = 'Clickable';
                    } else {
                        lessonStatus.textContent = '❌';
                        lessonStatus.title = 'Not clickable';
                    }
                    
                    // Add completion checkbox
                    const completionCheckbox = document.createElement('input');
                    completionCheckbox.type = 'checkbox';
                    completionCheckbox.className = 'faa-lesson-checkbox';
                    completionCheckbox.checked = completionData.completed;
                    completionCheckbox.title = completionData.completed ? 'Mark as incomplete' : 'Mark as complete';
                    
                    // Add checkbox event handler
                    completionCheckbox.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent lesson click
                        const isCompleted = e.target.checked;
                        setLessonCompleted(lesson.number, isCompleted);
                        logDebug(`📝 Lesson ${lesson.number} marked as ${isCompleted ? 'completed' : 'incomplete'}`);
                    });

                    lessonItem.appendChild(lessonNumber);
                    lessonItem.appendChild(lessonTitle);
                    lessonItem.appendChild(completionCheckbox);
                    lessonItem.appendChild(lessonStatus);
                    
                    // Add click handler for clickable lessons
                    if (lesson.clickable) {
                        lessonItem.addEventListener('click', (e) => {
                            // Don't navigate if clicking the checkbox
                            if (e.target.classList.contains('faa-lesson-checkbox')) return;
                            clickLesson(lesson.number, lesson.element);
                        });
                    }
                    
                    lessonsList.appendChild(lessonItem);
                });
            });
            
            // Update next lesson display after all lessons are rendered
            updateNextLessonDisplay();
        });
    }
    
    function toggleLessonsPanel() {
        const lessonsList = document.getElementById('faa-lessons-list');
        const toggleSpan = document.getElementById('faa-lessons-toggle');
        
        if (!lessonsList || !toggleSpan) return;
        
        lessonsExpanded = !lessonsExpanded;
        
        if (lessonsExpanded) {
            lessonsList.style.display = 'block';
            toggleSpan.innerHTML = toggleSpan.innerHTML.replace('►', '▼');
        } else {
            lessonsList.style.display = 'none';
            toggleSpan.innerHTML = toggleSpan.innerHTML.replace('▼', '►');
        }
    }
    
    function clickLesson(lessonNumber, lessonElement) {
        if (!lessonElement) {
            logDebug(`❌ Cannot navigate to LESSON${String(lessonNumber).padStart(2, '0')} - element not found`);
            return;
        }
        
        logDebug(`🎯 User clicked LESSON${String(lessonNumber).padStart(2, '0')} from lessons panel`);
        
        // Stop any existing progress monitoring
        stopProgressMonitoring();
        
        // Find the actual clickable element (anchor tag or the element itself)
        let clickTarget = lessonElement.querySelector('a') || lessonElement;
        
        // Scroll to the element to make sure it's visible
        clickTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Set a slight delay before clicking to ensure scrolling is complete
        setTimeout(() => {
            // Mark previous lesson as completed if we're moving forward
            getCurrentLessonNumber(currentLesson => {
                if (lessonNumber > currentLesson) {
                    setLessonCompleted(currentLesson, true);
                }
                
                // Update the current lesson number for tracking
                setCurrentLessonNumber(lessonNumber);
                
                // Track that this lesson was manually clicked for next lesson display
                setLastClickedLessonNumber(lessonNumber);
                
                // Update the UI to reflect the new current lesson
                updateLessonsDisplay(currentFoundLessons);
                
                // Click the lesson element
                logDebug(`🚀 Navigating to LESSON${String(lessonNumber).padStart(2, '0')}`);
                clickTarget.click();
            });
        }, 500);
    }

    // Removed waitForScormAndProgressBar, no longer needed


    function waitForProgressBarFill() {
        let hasLoggedNeverFound = false;
        let storylineProgressInterval = null;
        
        function checkForStorylineProgress() {
            // Check if Storyline content is actually complete before looking for progress
            const completionStates = [
                // Check if all media elements are complete
                ...Array.from(document.querySelectorAll('video')).map(v => 
                    v.offsetParent !== null ? (v.currentTime / v.duration >= 0.95) : true
                ),
                ...Array.from(document.querySelectorAll('audio')).map(a => 
                    a.offsetParent !== null ? (a.currentTime / a.duration >= 0.95) : true
                )
            ];
            
            // If there are media elements and any are not complete, wait
            const hasMedia = document.querySelectorAll('video, audio').length > 0;
            const allMediaComplete = completionStates.length === 0 || completionStates.every(Boolean);
            
            if (hasMedia && !allMediaComplete) {
                logDebug('📹 Storyline content has media that is not yet complete');
                // Still set up progress monitoring and continue to set up auto-advance logic
                startProgressMonitoring();
                // Don't return early - we still need to set up the auto-advance interval
            }
            
            // Check for Storyline 360 progress elements
            const storylineProgressIndicators = [
                // Check for Storyline's progress control div
                document.querySelector('#progress-container'),
                // Check for a control bar that might contain progress
                document.querySelector('#control-bar'),
                // Check for standard Storyline progress elements
                document.querySelector('.slide-progress'),
                // Look for any element with progress in the class name
                document.querySelector('[class*="progress"]'),
                // Look for any element with slider in the class name
                document.querySelector('[class*="slider"]'),
                // Check for video/audio elements as progress indicators
                document.querySelector('video'),
                document.querySelector('audio')
            ].filter(Boolean);
            
            if (storylineProgressIndicators.length > 0) {
                logDebug('Found Storyline progress indicators: ' + storylineProgressIndicators.length);
                // Clear interval since we found progress indicators
                if (storylineProgressInterval) {
                    clearInterval(storylineProgressInterval);
                    storylineProgressInterval = null;
                }
                
                // Start progress monitoring for Storyline content
                startProgressMonitoring();
                
                // Setup an interval to check for progress with improved logic
                let lastClickTime = 0;
                let hasClickedInCurrentSlide = false;
                let currentSlideId = null;
                
                setInterval(() => {
                    // For Storyline content, check for actual progress/completion before advancing
                    const now = Date.now();
                    
                    // Prevent clicking too frequently (minimum 3 seconds between clicks for completed content)
                    if (now - lastClickTime < 3000) {
                        return;
                    }
                    
                    // Try to detect current slide/screen to avoid clicking on same content repeatedly
                    const slideIndicators = [
                        document.querySelector('[data-slide-id]'),
                        document.querySelector('.slide'),
                        document.querySelector('[id*="slide"]'),
                        document.querySelector('.screen')
                    ];
                    
                    let newSlideId = null;
                    for (const indicator of slideIndicators) {
                        if (indicator) {
                            newSlideId = indicator.getAttribute('data-slide-id') || 
                                        indicator.id || 
                                        indicator.className;
                            break;
                        }
                    }
                    
                    // If we're on a new slide, reset the click tracking
                    if (newSlideId !== currentSlideId) {
                        currentSlideId = newSlideId;
                        hasClickedInCurrentSlide = false;
                        logDebug(`📄 New slide detected: ${newSlideId || 'unknown'}`);
                    }
                    
                    // Don't click if we've already clicked on this slide
                    if (hasClickedInCurrentSlide) {
                        return;
                    }
                    
                    // Check for actual video completion first
                    const videos = document.querySelectorAll('video');
                    let allVideosComplete = true;
                    let hasVideos = false;
                    
                    for (const video of videos) {
                        if (video.offsetParent !== null) { // Only check visible videos
                            hasVideos = true;
                            const progress = video.currentTime / video.duration;
                            if (progress < 0.95) { // Allow for 95% completion to account for buffering
                                allVideosComplete = false;
                                logDebug(`📹 Video not complete: ${Math.round(progress * 100)}%`);
                                break;
                            }
                        }
                    }
                    
                    // If there are videos and they're not complete, don't advance
                    if (hasVideos && !allVideosComplete) {
                        return;
                    }
                    
                    // Also check the extension's own progress monitoring
                    const currentProgress = getCurrentProgressPercentage();
                    if (currentProgress !== null && parseFloat(currentProgress) < 95) {
                        logDebug(`📊 Extension progress not complete: ${currentProgress}%`);
                        return;
                    }
                    
                    // Log completion detection
                    if (hasVideos && allVideosComplete) {
                        logDebug(`✅ All videos complete - ready to advance`);
                    }
                    if (currentProgress !== null && parseFloat(currentProgress) >= 95) {
                        logDebug(`✅ Extension progress complete (${currentProgress}%) - ready to advance`);
                    }
                    
                    // Check for audio completion
                    const audioElements = document.querySelectorAll('audio');
                    let allAudioComplete = true;
                    let hasAudio = false;
                    
                    for (const audio of audioElements) {
                        if (audio.offsetParent !== null) { // Only check visible audio
                            hasAudio = true;
                            const progress = audio.currentTime / audio.duration;
                            if (progress < 0.95) {
                                allAudioComplete = false;
                                logDebug(`🔊 Audio not complete: ${Math.round(progress * 100)}%`);
                                break;
                            }
                        }
                    }
                    
                    // If there's audio and it's not complete, don't advance
                    if (hasAudio && !allAudioComplete) {
                        return;
                    }
                    
                    // Check for completion indicators
                    const completionIndicators = [
                        document.querySelector('.completed'),
                        document.querySelector('.complete-slide'),
                        document.querySelector('.finish-slide'),
                        document.querySelector('[data-complete="true"]'),
                        document.querySelector('.slide-complete'),
                        document.querySelector('[aria-label*="complete"]')
                    ].filter(Boolean);
                    
                    // Only look for Next button if we have completion indicators OR no media to track
                    const shouldCheckNext = completionIndicators.length > 0 || (!hasVideos && !hasAudio);
                    
                    if (shouldCheckNext) {
                        // Enhanced Next button detection for Storyline content
                        const nextButtons = Array.from(document.querySelectorAll('button, .button, [role="button"], #next, #nextBtn, .next-slide, .nextslide, .button-next, [title*="next" i], [aria-label*="next" i]'));
                        const activeNextButton = nextButtons.find(btn => {
                            const text = (btn.textContent || '').toLowerCase();
                            const title = (btn.title || '').toLowerCase();
                            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                            const isVisible = btn.offsetParent !== null;
                            const isNext = text.includes('next') || 
                                          title.includes('next') || 
                                          ariaLabel.includes('next') ||
                                          btn.id.toLowerCase().includes('next') || 
                                          (btn.className && btn.className.toLowerCase().includes('next'));
                            const isEnabled = !btn.disabled && !btn.classList.contains('disabled');
                            
                            return isVisible && isNext && isEnabled;
                        });
                        
                        if (activeNextButton) {
                            getToggleState((enabled) => {
                                if (!enabled) return;
                                
                                lastClickTime = now;
                                hasClickedInCurrentSlide = true;
                                
                                logDebug(`✅ Content complete! Clicking Next button: "${activeNextButton.textContent || activeNextButton.title || 'no text'}"`);
                                activeNextButton.click();
                            });
                        } else {
                            logDebug('❌ Content appears complete but no active Next button found');
                        }
                    }
                }, 8000); // Increased to 8 seconds to be less aggressive
                
                return true;
            }
            
            return false;
        }
        
        function poll() {
            // First try to find standard Fortinet progress bar
            const progressBarFill = document.querySelector('[data-ref="progressBarFill"]');
            
            if (!progressBarFill) {
                // If no standard progress bar, check for Storyline progress
                if (checkForStorylineProgress()) {
                    // Found Storyline progress indicators, stop polling
                    return;
                }
                
                if (!hasLoggedNeverFound) {
                    logDebug('Waiting for progress bar...');
                    // Start a separate interval to check for Storyline content
                    if (!storylineProgressInterval) {
                        storylineProgressInterval = setInterval(() => {
                            if (checkForStorylineProgress()) {
                                clearInterval(storylineProgressInterval);
                                storylineProgressInterval = null;
                            }
                        }, 2000);
                    }
                    hasLoggedNeverFound = true;
                }
                setTimeout(poll, 1000);
                return;
            }
            
            // Clear Storyline check interval if we found the standard progress bar
            if (storylineProgressInterval) {
                clearInterval(storylineProgressInterval);
                storylineProgressInterval = null;
            }
            
            logDebug('Progress bar found. Observing...');
            observer = new MutationObserver(() => {
                checkAndAdvance(progressBarFill);
            });
            observer.observe(progressBarFill, { attributes: true, attributeFilter: ['style'] });
            checkAndAdvance(progressBarFill);
            
            // Start progress monitoring for this progress bar
            startProgressMonitoring();
        }
        
        poll();
    }

    function checkAndAdvance(progressBarFill) {
        getToggleState((enabled) => {
            if (!enabled) return;
            const style = progressBarFill.getAttribute('style') || '';
            if (style.includes('width: 100%')) {
                if (!lastWasComplete) {
                    getTransitionDelay((delaySeconds) => {
                        const delayMs = delaySeconds * 1000;
                        logDebug(`✅ Progress bar reached 100%! Waiting ${delaySeconds}s before auto-advance...`);
                        lastWasComplete = true;
                        if (advanceTimeout) clearTimeout(advanceTimeout);
                        advanceTimeout = setTimeout(() => {
                            logDebug('🚀 Auto-clicking NEXT button after delay!');
                            clickNextButton();
                        }, delayMs);
                    });
                }
            } else {
                lastWasComplete = false;
                if (advanceTimeout) {
                    clearTimeout(advanceTimeout);
                    advanceTimeout = null;
                }
            }
        });
    }

    // --- XHR Logging ---
    let logNextXhr = false;
    (function patchXHR() {
        const origOpen = window.XMLHttpRequest.prototype.open;
        const origSend = window.XMLHttpRequest.prototype.send;
        window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._faa_url = url;
            return origOpen.apply(this, [method, url, ...rest]);
        };
        window.XMLHttpRequest.prototype.send = function(...args) {
            this.addEventListener('load', function() {
                if (logNextXhr) {
                    // Only log .js XHRs (like in your screenshot)
                    if (typeof this._faa_url === 'string' && this._faa_url.match(/\.js(\?|$)/)) {
                        logDebug(`XHR: ${this._faa_url} [${this.status}] (${this.responseType || 'text'})`);
                    }
                }
            });
            return origSend.apply(this, args);
        };
    })();

    // Listen for manual clicks on NEXT
    function setupManualNextListener() {
        const navButtons = getNextButtons();
        if (navButtons.length === 0) {
            logDebug('No navigation button/link found for manual click listener.');
            return;
        }
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                logDebug('NEXT navigation triggered (manual or auto). Will log next XHRs.');
                logNextXhr = true;
                setTimeout(() => { logNextXhr = false; }, 2000);
            });
        });
    }

    function getNextButtons() {
        // Prefer #next button as seen in Storyline player
        const nextBtn = document.getElementById('next');
        if (nextBtn && nextBtn.offsetParent !== null) return [nextBtn];
        // Fallback to #next-activity-link if present (legacy/top-level)
        const nextLink = document.getElementById('next-activity-link');
        if (nextLink && nextLink.offsetParent !== null) return [nextLink];
        // Fallback: try visible buttons with NEXT label (for resilience)
        const candidates = Array.from(document.querySelectorAll('button, a')).filter(el => {
            return el.offsetParent !== null && /next/i.test(el.textContent);
        });
        return candidates;
    }

    function clickNextButton() {
        // Stop progress monitoring when navigating to next content
        stopProgressMonitoring();
        
        const navButtons = getNextButtons();
        if (navButtons.length > 0) {
            logDebug('🎯 Found and clicking NEXT navigation button');
            navButtons[0].click();
            logDebug('NEXT navigation triggered (auto). Will log next XHRs.');
            logNextXhr = true;
            setTimeout(() => { logNextXhr = false; }, 2000);
        } else {
            logDebug('❌ No NEXT navigation button found. Checking redirect settings...');
            getRedirectToggleState((redirectEnabled) => {
                if (!redirectEnabled) {
                    logDebug('🏠 Auto-redirect to homepage is DISABLED. Video series complete - stopping here.');
                    return;
                }
                
                logDebug('🏠 Attempting redirect to course homepage to continue series...');
                // Try to find the course homepage link in current frame
                var backToCourse = document.querySelector('a.backtocourse[href*="course/view.php?id="]');
                if (backToCourse && backToCourse.href) {
                    logDebug('🏠 Redirecting to course homepage: ' + backToCourse.href);
                    
                    // Mark current lesson as completed before navigating away
                    getCurrentLessonNumber(currentLesson => {
                        setLessonCompleted(currentLesson, true);
                        setCurrentLessonNumber(currentLesson + 1);
                        logDebug(`✅ Marked LESSON${String(currentLesson).padStart(2, '0')} as completed before redirect, next lesson: ${currentLesson + 1}`);
                    });
                    
                    window.location.href = backToCourse.href;
                    return;
                }
                // Try to find the course homepage link in top window (if not same as current)
                try {
                    if (window.top && window.top !== window && window.top.document) {
                        var topBackToCourse = window.top.document.querySelector('a.backtocourse[href*="course/view.php?id="]');
                        if (topBackToCourse && topBackToCourse.href) {
                            logDebug('Redirecting to course homepage from top window: ' + topBackToCourse.href);
                            
                            // Mark current lesson as completed before navigating away
                            getCurrentLessonNumber(currentLesson => {
                                setLessonCompleted(currentLesson, true);
                                setCurrentLessonNumber(currentLesson + 1);
                                logDebug(`✅ Marked LESSON${String(currentLesson).padStart(2, '0')} as completed before redirect, next lesson: ${currentLesson + 1}`);
                            });
                            
                            window.top.location.href = topBackToCourse.href;
                            return;
                        } else {
                            logDebug('No course homepage link found in top window.');
                        }
                    }
                } catch (e) {
                    logDebug('Unable to access top window for course homepage link (likely cross-origin).');
                }
                logDebug('No course homepage link found in any context.');
            });
        }
    }
    
    // Function to check if we're on the homepage
    function isHomePage() {
        // Check if we're on the course view page
        return window.location.href.includes('course/view.php');
    }
    
    // Function to scan and log all available lessons on homepage
    function scanAndLogAllLessons() {
        logDebug('🔍 Scanning homepage for available lessons...');
        
        const foundLessons = [];
        let consecutiveNotFound = 0;
        const maxNotFound = 5; // Stop after 5 consecutive lessons not found
        
        // Scan from LESSON01 up to LESSON99 or until we hit consecutive gaps
        for (let lessonNum = 1; lessonNum <= 99; lessonNum++) {
            const lessonNumber2Digits = String(lessonNum).padStart(2, '0');
            const lessonSpaceFormat = `LESSON ${lessonNumber2Digits}`;
            const lessonNoSpaceFormat = `LESSON${lessonNumber2Digits}`;
            
            let lessonFound = false;
            let lessonInfo = {
                number: lessonNum,
                element: null,
                text: '',
                method: '',
                clickable: false
            };
            
            // First approach: Find direct data-activityname attributes
            const activityElements = document.querySelectorAll('[data-activityname]');
            for (const element of activityElements) {
                const activityName = element.getAttribute('data-activityname');
                if (activityName && (
                    activityName.includes(lessonSpaceFormat) || 
                    activityName.includes(lessonNoSpaceFormat)
                )) {
                    lessonInfo.element = element;
                    lessonInfo.text = activityName.trim();
                    lessonInfo.method = 'data-activityname';
                    lessonInfo.clickable = !!(element.querySelector('a') || element.onclick);
                    lessonFound = true;
                    break;
                }
            }
            
            // Second approach: Look for div.activityname with matching text
            if (!lessonFound) {
                const activityNameDivs = document.querySelectorAll('div.activityname');
                for (const div of activityNameDivs) {
                    const text = div.textContent || '';
                    if (text.includes(lessonSpaceFormat) || text.includes(lessonNoSpaceFormat)) {
                        lessonInfo.element = div;
                        lessonInfo.text = text.trim();
                        lessonInfo.method = 'div.activityname';
                        // Check for clickable parent
                        let parent = div;
                        for (let i = 0; i < 5; i++) {
                            if (!parent) break;
                            if (parent.querySelector('a')) {
                                lessonInfo.clickable = true;
                                break;
                            }
                            parent = parent.parentElement;
                        }
                        lessonFound = true;
                        break;
                    }
                }
            }
            
            // Third approach: Look for any a[href] with text content matching our lesson
            if (!lessonFound) {
                const allLinks = document.querySelectorAll('a[href]');
                for (const link of allLinks) {
                    const text = link.textContent || '';
                    if (text.includes(lessonSpaceFormat) || text.includes(lessonNoSpaceFormat)) {
                        lessonInfo.element = link;
                        lessonInfo.text = text.trim();
                        lessonInfo.method = 'direct link';
                        lessonInfo.clickable = true;
                        lessonFound = true;
                        break;
                    }
                }
            }
            
            // Fourth approach: Look through any div that has the lesson text
            if (!lessonFound) {
                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                    const text = div.textContent || '';
                    if (text.includes(lessonSpaceFormat) || text.includes(lessonNoSpaceFormat)) {
                        lessonInfo.element = div;
                        lessonInfo.text = text.trim();
                        lessonInfo.method = 'div text match';
                        lessonInfo.clickable = !!(div.onclick || div.classList.contains('clickable') || 
                                                div.style.cursor === 'pointer' || div.closest('.activity-item'));
                        lessonFound = true;
                        break;
                    }
                }
            }
            
            if (lessonFound) {
                // Check if this lesson number already exists to prevent duplicates
                const existingLessonIndex = foundLessons.findIndex(lesson => lesson.number === lessonNum);
                if (existingLessonIndex === -1) {
                    foundLessons.push(lessonInfo);
                } else {
                    // Update existing lesson if the new one is clickable and the old one isn't
                    const existingLesson = foundLessons[existingLessonIndex];
                    if (lessonInfo.clickable && !existingLesson.clickable) {
                        foundLessons[existingLessonIndex] = lessonInfo;
                        logDebug(`   • Updated LESSON${String(lessonNum).padStart(2, '0')} with clickable version (${lessonInfo.method})`);
                    }
                }
                consecutiveNotFound = 0;
            } else {
                consecutiveNotFound++;
                if (consecutiveNotFound >= maxNotFound) {
                    break; // Stop scanning if we hit too many gaps
                }
            }
        }
        
        // Log the results
        if (foundLessons.length === 0) {
            logDebug('📚 No lessons found on homepage');
        } else {
            logDebug(`📚 Found ${foundLessons.length} lesson(s) on homepage:`);
            foundLessons.forEach(lesson => {
                const clickableStatus = lesson.clickable ? '✅ Clickable' : '❌ Not clickable';
                const shortText = lesson.text.length > 50 ? lesson.text.substring(0, 50) + '...' : lesson.text;
                logDebug(`   • LESSON${String(lesson.number).padStart(2, '0')}: "${shortText}" (${lesson.method}) ${clickableStatus}`);
            });
        }
        
        // Save discovered lessons to storage for use on lesson pages
        chrome.storage.local.set({ 
            'faa_cached_lessons': {
                lessons: foundLessons,
                timestamp: Date.now()
            }
        });
        
        // Update the lessons UI
        updateLessonsDisplay(foundLessons);
        
        // Update next lesson display
        updateNextLessonDisplay();
        
        return foundLessons;
    }
    
    // Function to load cached lessons from storage
    function loadCachedLessons(callback) {
        chrome.storage.local.get(['faa_cached_lessons'], (result) => {
            if (result.faa_cached_lessons && result.faa_cached_lessons.lessons) {
                const cached = result.faa_cached_lessons;
                const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
                
                // Use cache if less than 30 days old (720 hours)
                if (ageHours < 720) {
                    const ageDays = Math.round(ageHours / 24 * 10) / 10;
                    if (ageHours < 24) {
                        logDebug(`📚 Using cached lessons (${cached.lessons.length} lessons, ${Math.round(ageHours * 10) / 10}h old)`);
                    } else {
                        logDebug(`📚 Using cached lessons (${cached.lessons.length} lessons, ${ageDays}d old)`);
                    }
                    callback(cached.lessons);
                } else {
                    const ageDays = Math.round(ageHours / 24 * 10) / 10;
                    logDebug(`📚 Cached lessons too old (${ageDays}d), will need fresh scan`);
                    callback([]);
                }
            } else {
                logDebug(`📚 No cached lessons found`);
                callback([]);
            }
        });
    }
    
    // Function to load and display cached lessons in UI (for lesson pages)
    function loadAndDisplayCachedLessons() {
        loadCachedLessons(cachedLessons => {
            if (cachedLessons.length > 0) {
                // Update the current found lessons so UI functions work properly
                currentFoundLessons = cachedLessons;
                
                // Update the lessons display with cached data
                updateLessonsDisplay(cachedLessons);
                
                logDebug(`📚 Loaded ${cachedLessons.length} cached lessons into UI`);
            } else {
                logDebug(`📚 No cached lessons available for UI display`);
            }
        });
    }
    
    // ================ FULLSCREEN FUNCTIONALITY ================
    // Track video play listeners for cleanup
    let videoPlayListeners = new Map();
    let currentlyPlayingVideos = new Set();
    let pendingFullscreenRequest = false; // Flag for pending fullscreen after user gesture
    
    // Make debug function available globally for testing
    window.debugExtensionVideoDetection = function() {
        logDebug('🔍 Manual Extension Video Debug Called');
        setupVideoListeners();
        logDebug(`📊 Result: ${videoPlayListeners.size} video(s) monitored, ${currentlyPlayingVideos.size} playing`);
    };
    
    // Add user gesture detection for pending fullscreen requests
    function setupUserGestureDetection() {
        if (!pendingFullscreenRequest) return;
        
        const userGestureEvents = ['click', 'keydown', 'mousedown', 'touchstart'];
        
        function handleUserGesture(event) {
            if (pendingFullscreenRequest) {
                logDebug(`👆 User gesture detected (${event.type}) - attempting pending fullscreen`);
                pendingFullscreenRequest = false;
                
                // Remove the gesture listeners
                userGestureEvents.forEach(eventType => {
                    document.removeEventListener(eventType, handleUserGesture, true);
                });
                
                // Try fullscreen if videos are still playing
                if (currentlyPlayingVideos.size > 0) {
                    attemptFullscreenDirect();
                }
            }
        }
        
        // Add listeners for user gestures
        userGestureEvents.forEach(eventType => {
            document.addEventListener(eventType, handleUserGesture, true);
        });
        
        logDebug('👆 Waiting for user gesture to attempt fullscreen...');
    }
    
    function exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                logDebug('🖥️ Standard exitFullscreen called');
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
                logDebug('🖥️ WebKit exitFullscreen called');
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
                logDebug('🖥️ Mozilla exitFullscreen called');
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
                logDebug('🖥️ MS exitFullscreen called');
            } else {
                logDebug('❌ No exitFullscreen API available');
                return false;
            }
            return true;
        } catch (e) {
            logDebug('🖥️ Error exiting fullscreen: ' + e.message);
            return false;
        }
    }
    
    function isCurrentlyInFullscreen() {
        return !!(
            document.fullscreenElement || 
            document.webkitFullscreenElement || 
            document.mozFullScreenElement || 
            document.msFullscreenElement
        );
    }
    
    function isVideoActuallyPlaying(video) {
        return video.currentTime > 0 && 
               !video.paused && 
               !video.ended && 
               video.readyState > 2 &&
               video.offsetParent !== null && // visible
               video.duration > 0; // has actual content
    }
    
    function onVideoPlay(event) {
        const video = event.target;
        logDebug(`📹 Video play detected: ${video.src || 'unknown source'}`);
        
        // Add to currently playing set
        currentlyPlayingVideos.add(video);
        
        // Attempt fullscreen if toggle is enabled
        getFullscreenToggleState((enabled) => {
            if (enabled && !isCurrentlyInFullscreen()) {
                logDebug('🖥️ Auto-triggering fullscreen on video play (user gesture present)');
                
                // Small delay to ensure video play event is fully processed
                setTimeout(() => {
                    attemptFullscreenDirect();
                }, 100);
            }
        });
    }
    
    function onVideoPause(event) {
        const video = event.target;
        currentlyPlayingVideos.delete(video);
        logDebug(`📹 Video paused: ${video.src || 'unknown source'}`);
    }
    
    function onVideoEnded(event) {
        const video = event.target;
        currentlyPlayingVideos.delete(video);
        logDebug(`📹 Video ended: ${video.src || 'unknown source'}`);
    }
    
    function setupVideoListeners() {
        // Use the same logic that worked in console debugging
        logDebug('🔍 Video Detection Debug - Extension Version');
        
        // Check all frames (top + iframes) - same as working console script
        const frames = [window];
        try {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                try {
                    if (iframe.contentWindow && iframe.contentDocument) {
                        frames.push(iframe.contentWindow);
                        logDebug(`📄 Found accessible iframe: ${iframe.src || 'no src'}`);
                    }
                } catch (e) {
                    logDebug(`❌ Cannot access iframe: ${iframe.src || 'no src'} - ${e.message}`);
                }
            });
        } catch (e) {
            logDebug('❌ Error checking iframes:', e.message);
        }
        
        // Check videos in each frame - same as console script
        let allVideos = [];
        frames.forEach((frame, index) => {
            try {
                const frameVideos = frame.document.querySelectorAll('video');
                logDebug(`📺 Frame ${index} (${frame === window ? 'top' : 'iframe'}): ${frameVideos.length} video(s)`);
                
                frameVideos.forEach((video, i) => {
                    logDebug(`   Video ${i}: src="${video.src || 'no src'}", duration=${video.duration}, visible=${video.offsetParent !== null}`);
                    allVideos.push(video);
                });
            } catch (e) {
                logDebug(`❌ Cannot access frame ${index}:`, e.message);
            }
        });
        
        const videos = allVideos;
        
        videos.forEach(video => {
            // Skip if we already have listeners on this video
            if (videoPlayListeners.has(video)) return;
            
            // Use same criteria as the working console script
            const hasValidDuration = video.duration > 0;
            const isVisible = video.offsetParent !== null;
            const meetsConsoleCriteria = hasValidDuration && isVisible;
            
            logDebug(`📹 Video analysis: duration=${video.duration} (${hasValidDuration ? '✅' : '❌'}), visible=${isVisible ? '✅' : '❌'}, meets criteria=${meetsConsoleCriteria ? '✅' : '❌'}`);
            
            if (!meetsConsoleCriteria) {
                logDebug(`🚫 Skipping video: ${video.src || 'no src'} - doesn't meet criteria`);
                return;
            }
            
            logDebug(`✅ Setting up listeners on video: ${video.src || 'no src'}`);
            
            const playHandler = onVideoPlay.bind(null);
            const pauseHandler = onVideoPause.bind(null);
            const endedHandler = onVideoEnded.bind(null);
            
            video.addEventListener('play', playHandler);
            video.addEventListener('pause', pauseHandler);
            video.addEventListener('ended', endedHandler);
            
            // Store handlers for cleanup
            videoPlayListeners.set(video, {
                play: playHandler,
                pause: pauseHandler,
                ended: endedHandler
            });
            
            // Check if video is already playing
            if (isVideoActuallyPlaying(video)) {
                currentlyPlayingVideos.add(video);
                logDebug(`📹 Found already playing video: ${video.src || 'unknown source'}`);
            }
        });
        
        logDebug(`🎥 Set up fullscreen listeners on ${videoPlayListeners.size} video(s)`);
    }
    
    function cleanupVideoListeners() {
        videoPlayListeners.forEach((handlers, video) => {
            try {
                video.removeEventListener('play', handlers.play);
                video.removeEventListener('pause', handlers.pause);
                video.removeEventListener('ended', handlers.ended);
            } catch (e) {
                logDebug(`🧹 Error removing listener from video: ${e.message}`);
            }
        });
        
        videoPlayListeners.clear();
        currentlyPlayingVideos.clear();
        logDebug(`🧹 Cleaned up all video fullscreen listeners (${videoPlayListeners.size} listeners, ${currentlyPlayingVideos.size} playing videos)`);
    }
    
    function attemptFullscreenDirect() {
        // Don't attempt fullscreen if already in fullscreen
        if (isCurrentlyInFullscreen()) {
            logDebug('🖥️ Already in fullscreen mode');
            return false;
        }
        
        // Check all frames (including iframes) for fullscreen opportunities
        const frames = [window];
        try {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                try {
                    if (iframe.contentWindow && iframe.contentDocument) {
                        frames.push(iframe.contentWindow);
                    }
                } catch (e) {
                    // Cross-origin iframe, can't access
                }
            });
        } catch (e) {
            logDebug('❌ Error checking iframe access:', e.message);
        }
        
        // Try fullscreen in each accessible frame
        for (const frame of frames) {
            try {
                const frameDoc = frame.document;
                const isIframe = frame !== window;
                logDebug(`🖥️ Attempting fullscreen in ${isIframe ? 'iframe' : 'top frame'}`);
                
                // Method 2: Manual fullscreen button detection in this frame
                const possibleButtons = [
                    ...frameDoc.querySelectorAll('[title*="fullscreen" i]'),
                    ...frameDoc.querySelectorAll('[aria-label*="fullscreen" i]'),
                    ...frameDoc.querySelectorAll('.fullscreen-button'),
                    ...frameDoc.querySelectorAll('[class*="fullscreen"]'),
                    ...frameDoc.querySelectorAll('button')
                ];
                
                for (const button of possibleButtons) {
                    if (button.offsetParent !== null && !button.disabled) {
                        const text = (button.textContent || '').toLowerCase();
                        const title = (button.title || '').toLowerCase();
                        const innerHTML = button.innerHTML.toLowerCase();
                        const className = button.className.toLowerCase();
                        
                        if (text.includes('fullscreen') || title.includes('fullscreen') ||
                            innerHTML.includes('fullscreen') || className.includes('fullscreen') ||
                            innerHTML.includes('expand') || className.includes('expand')) {
                            
                            try {
                                button.click();
                                logDebug(`🖥️ Found and clicked fullscreen button in ${isIframe ? 'iframe' : 'top frame'}`);
                                return true;
                            } catch (e) {
                                logDebug(`🖥️ Error clicking fullscreen button in ${isIframe ? 'iframe' : 'top frame'}: ${e.message}`);
                            }
                        }
                    }
                }
                
                // Method 3: Direct video fullscreen in this frame
                const videos = frameDoc.querySelectorAll('video');
                for (const video of videos) {
                    if (video.offsetParent !== null) {
                        logDebug(`🖥️ Attempting direct fullscreen on video in ${isIframe ? 'iframe' : 'top frame'}`);
                        try {
                            if (video.requestFullscreen) {
                                video.requestFullscreen();
                                logDebug(`🖥️ Standard fullscreen requested on video in ${isIframe ? 'iframe' : 'top frame'}`);
                                return true;
                            } else if (video.webkitRequestFullscreen) {
                                video.webkitRequestFullscreen();
                                logDebug(`🖥️ WebKit fullscreen requested on video in ${isIframe ? 'iframe' : 'top frame'}`);
                                return true;
                            } else if (video.mozRequestFullScreen) {
                                video.mozRequestFullScreen();
                                logDebug(`🖥️ Mozilla fullscreen requested on video in ${isIframe ? 'iframe' : 'top frame'}`);
                                return true;
                            } else if (video.msRequestFullscreen) {
                                video.msRequestFullscreen();
                                logDebug(`🖥️ MS fullscreen requested on video in ${isIframe ? 'iframe' : 'top frame'}`);
                                return true;
                            }
                        } catch (e) {
                            logDebug(`🖥️ Error requesting fullscreen on video in ${isIframe ? 'iframe' : 'top frame'}: ${e.message}`);
                        }
                    }
                }
                
                // Method 4: Try to fullscreen the iframe document itself
                if (isIframe) {
                    try {
                        const element = frameDoc.documentElement;
                        if (element.requestFullscreen) {
                            element.requestFullscreen();
                            logDebug('🖥️ Fullscreen requested on iframe document element');
                            return true;
                        } else if (element.webkitRequestFullscreen) {
                            element.webkitRequestFullscreen();
                            logDebug('🖥️ WebKit fullscreen requested on iframe document');
                            return true;
                        } else if (element.mozRequestFullScreen) {
                            element.mozRequestFullScreen();
                            logDebug('🖥️ Mozilla fullscreen requested on iframe document');
                            return true;
                        } else if (element.msRequestFullscreen) {
                            element.msRequestFullscreen();
                            logDebug('🖥️ MS fullscreen requested on iframe document');
                            return true;
                        }
                    } catch (e) {
                        logDebug('🖥️ Error requesting fullscreen on iframe document: ' + e.message);
                    }
                }
                
            } catch (e) {
                logDebug(`❌ Cannot access frame for fullscreen: ${e.message}`);
            }
        }
        
        logDebug('❌ No fullscreen method succeeded in any frame');
        return false;
    }
    
    function attemptFullscreen() {
        getFullscreenToggleState((enabled) => {
            if (!enabled) return;
            attemptFullscreenDirect();
        });
    }
    
    // Function to check for and click restart button (for built-in lesson tracking)
    function checkForRestartButton() {
        // Look for restart button in various forms
        const restartSelectors = [
            '[title*="Restart"]',
            '[aria-label*="Restart"]',
            'button[onclick*="restart"]',
            '.restart-button',
            '#restart',
            'input[value*="Restart"]'
        ];
        
        // Check for text-based restart buttons
        const allButtons = document.querySelectorAll('button, input[type="button"], input[type="submit"], a, div[role="button"]');
        for (const button of allButtons) {
            const text = (button.textContent || button.value || button.title || '').toLowerCase();
            if (text.includes('restart')) {
                logDebug('🔄 Found restart button, clicking automatically');
                button.click();
                return true;
            }
        }
        
        // Try the CSS selectors
        for (const selector of restartSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    logDebug('🔄 Found restart button via selector, clicking automatically');
                    elements[0].click();
                    return true;
                }
            } catch (e) {
                // Skip selectors that don't work
                continue;
            }
        }
        
        return false;
    }
    
    // Function to find and click the next lesson in sequence
    function findAndClickNextLesson() {
        // Stop progress monitoring when navigating to next lesson
        stopProgressMonitoring();
        
        getCurrentLessonNumber(lessonNumber => {
            // Format with space after LESSON as seen in HTML: "LESSON 02"
            const lessonNumber2Digits = String(lessonNumber).padStart(2, '0');
            const lessonSpaceFormat = `LESSON ${lessonNumber2Digits}`;
            const lessonNoSpaceFormat = `LESSON${lessonNumber2Digits}`;
            
            logDebug(`Looking for lesson formats: "${lessonSpaceFormat}" or "${lessonNoSpaceFormat}"...`);
            
            // Track the clickable parent element
            let lessonElement = null;
            let lessonLink = null;
            
            // First approach: Find direct data-activityname attributes
            const activityElements = document.querySelectorAll('[data-activityname]');
            for (const element of activityElements) {
                const activityName = element.getAttribute('data-activityname');
                if (activityName && (
                    activityName.includes(lessonSpaceFormat) || 
                    activityName.includes(lessonNoSpaceFormat)
                )) {
                    // Found the lesson container - now find closest clickable element
                    lessonElement = element;
                    logDebug(`Found lesson ${lessonNumber} by data-activityname: "${activityName}"`);
                    
                    // Try to find the anchor tag within this container
                    const anchor = element.querySelector('a');
                    if (anchor) {
                        lessonLink = anchor;
                        logDebug('Found anchor element inside activity container');
                    } else {
                        // The element itself might be clickable
                        lessonLink = element;
                    }
                    break;
                }
            }
            
            // Second approach: Look for div.activityname with matching text inside its children
            if (!lessonLink) {
                const activityNameDivs = document.querySelectorAll('div.activityname');
                for (const div of activityNameDivs) {
                    const text = div.textContent || '';
                    if (text.includes(lessonSpaceFormat) || text.includes(lessonNoSpaceFormat)) {
                        // Found a matching activity name - check for parent link
                        let parent = div;
                        // Walk up 5 levels at most to find a clickable parent
                        for (let i = 0; i < 5; i++) {
                            if (!parent) break;
                            
                            // Check if this element has an anchor
                            const anchor = parent.querySelector('a');
                            if (anchor) {
                                lessonLink = anchor;
                                logDebug(`Found lesson ${lessonNumber} link from activityname div: "${text}"`);
                                break;
                            }
                            
                            // Move to parent
                            parent = parent.parentElement;
                        }
                        if (lessonLink) break;
                    }
                }
            }
            
            // Third approach: Look for any a[href] with text content matching our lesson
            if (!lessonLink) {
                const allLinks = document.querySelectorAll('a[href]');
                for (const link of allLinks) {
                    const text = link.textContent || '';
                    if (text.includes(lessonSpaceFormat) || text.includes(lessonNoSpaceFormat)) {
                        lessonLink = link;
                        logDebug(`Found lesson ${lessonNumber} by direct link text: "${text}"`);
                        break;
                    }
                }
            }
            
            // Fourth approach: Look through any div that has the lesson text
            if (!lessonLink) {
                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                    const text = div.textContent || '';
                    if (text.includes(lessonSpaceFormat) || text.includes(lessonNoSpaceFormat)) {
                        // Check if this div or its parent is clickable
                        if (div.onclick || div.classList.contains('clickable') || div.style.cursor === 'pointer') {
                            lessonLink = div;
                            logDebug(`Found lesson ${lessonNumber} via clickable div: "${text}"`);
                            break;
                        }
                        
                        // Try to find parent activity-item
                        let parent = div.closest('.activity-item');
                        if (parent) {
                            lessonLink = parent;
                            logDebug(`Found lesson ${lessonNumber} via parent activity-item`);
                            break;
                        }
                    }
                }
            }
            
            // If found a lesson link, click it and update lesson counter
            if (lessonLink) {
                // Scroll to the element to make sure it's visible
                lessonLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Set a slight delay before clicking to ensure scrolling is complete
                setTimeout(() => {
                    // Mark the previous lesson as completed since we successfully reached homepage
                    if (lessonNumber > 1) {
                        const prevLessonNumber = lessonNumber - 1;
                        setLessonCompleted(prevLessonNumber, true);
                        logDebug(`✅ Marked LESSON${String(prevLessonNumber).padStart(2, '0')} as completed (reached homepage)`);
                    }
                    
                    // Increment the lesson number for next time
                    setCurrentLessonNumber(lessonNumber + 1);
                    
                    // Track that this lesson was automatically clicked for next lesson display
                    setLastClickedLessonNumber(lessonNumber);
                    
                    // Click the lesson element
                    logDebug(`🚀 Clicking on lesson ${lessonNumber}`);
                    lessonLink.click();
                }, 500);
            } else {
                logDebug(`Could not find lesson ${lessonNumber} on the page. Course may be complete.`);
            }
        });
    }

    // ================ INIT ================
    function setupToggleUI() {
        // Only set up UI in top frame
        if (!isTopFrame) return;
        
        injectUI();
        const toggle = document.getElementById('faa-toggle');
        const redirectToggle = document.getElementById('faa-redirect-toggle');
        const autoPlayToggle = document.getElementById('faa-autoplay-toggle');
        if (!toggle) return; // UI wasn't injected
        
        // Initialize existing auto-advance toggle
        getToggleState((enabled) => {
            toggle.checked = !!enabled;
        });
        toggle.addEventListener('change', (e) => {
            setToggleState(e.target.checked);
        });
        
        // Initialize auto-redirect toggle
        getRedirectToggleState((enabled) => {
            redirectToggle.checked = !!enabled;
        });
        redirectToggle.addEventListener('change', (e) => {
            setRedirectToggleState(e.target.checked);
        });
        
        // Initialize auto-play next video toggle
        getAutoPlayToggleState((enabled) => {
            autoPlayToggle.checked = !!enabled;
        });
        autoPlayToggle.addEventListener('change', (e) => {
            setAutoPlayToggleState(e.target.checked);
        });
        
        // Initialize auto-fullscreen toggle
        const fullscreenToggle = document.getElementById('faa-fullscreen-toggle');
        getFullscreenToggleState((enabled) => {
            fullscreenToggle.checked = !!enabled;
        });
        fullscreenToggle.addEventListener('change', (e) => {
            setFullscreenToggleState(e.target.checked);
        });
        
        // Initialize delay input
        const delayInput = document.getElementById('faa-delay-input');
        getTransitionDelay((delay) => {
            delayInput.value = delay;
        });
        delayInput.addEventListener('change', (e) => {
            const delay = parseFloat(e.target.value);
            if (delay >= 0.5 && delay <= 10) {
                setTransitionDelay(delay);
            } else {
                // Reset to valid value if out of range
                getTransitionDelay((validDelay) => {
                    delayInput.value = validDelay;
                });
            }
        });
        
        // Initialize lessons panel event listeners
        const lessonsHeader = document.getElementById('faa-lessons-header');
        const refreshBtn = document.getElementById('faa-lessons-refresh');
        const resetBtn = document.getElementById('faa-completion-reset');
        
        if (lessonsHeader) {
            lessonsHeader.addEventListener('click', (e) => {
                // Don't toggle if user clicked the refresh or reset button
                if (e.target.id !== 'faa-lessons-refresh' && e.target.id !== 'faa-completion-reset') {
                    toggleLessonsPanel();
                }
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent header click from triggering
                logDebug('🔄 Refreshing lessons...');
                
                // Show loading state
                const loadingDiv = document.getElementById('faa-lessons-loading');
                if (loadingDiv) {
                    loadingDiv.style.display = 'block';
                    loadingDiv.textContent = '🔍 Scanning for lessons...';
                }
                
                // Rescan lessons after a short delay
                setTimeout(() => {
                    scanAndLogAllLessons();
                }, 500);
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent header click from triggering
                if (confirm('Reset all lesson completion data? This cannot be undone.')) {
                    resetAllCompletions();
                }
            });
        }
    }

    // Help identify what type of content we're in
    function detectContentType() {
        try {
            // Check for Storyline 360 indicators
            const isStoryline = !!document.querySelector('#app') || 
                            !!document.querySelector('[class*="player"]') ||
                            !!document.querySelector('[class*="slide"]') ||
                            document.title.includes('Storyline') ||
                            window.location.href.includes('story_content');
            
            // Check for SCORM wrapper indicators
            const isScormWrapper = !!document.querySelector('#scorm_object') ||
                                !!document.querySelector('#scormpage') ||
                                window.location.href.includes('/scorm/player.php');
            
            return {
                isStoryline,
                isScormWrapper,
                isCourseHomepage: isHomePage()
            };
        } catch (e) {
            // Fall back to basic detection if any errors
            return {
                isStoryline: window.location.href.includes('story_content'),
                isScormWrapper: window.location.href.includes('/scorm/player.php'),
                isCourseHomepage: isHomePage()
            };
        }
    }
    
    function startScript() {
        function afterDOMReady() {
            // Always set up UI in top frame only
            if (isTopFrame) {
                setupToggleUI();
                logDebug(`Extension loaded in top frame: ${window.location.href}`);
            }
            
            const contentType = detectContentType();
            
            // Log detected content type (only if interesting)
            if (contentType.isStoryline || contentType.isScormWrapper || contentType.isCourseHomepage) {
                logDebug(`Content type detected - Storyline: ${contentType.isStoryline}, SCORM: ${contentType.isScormWrapper}, Homepage: ${contentType.isCourseHomepage}`);
            }
            
            // Check if we're on the homepage and should click the next lesson
            if (contentType.isCourseHomepage) {
                logDebug('🏠 Detected course homepage - scanning for available lessons...');
                
                // Always scan and log lessons regardless of toggle states
                setTimeout(() => {
                    scanAndLogAllLessons();
                }, 500);
                
                getToggleState(enabled => {
                    if (!enabled) {
                        logDebug('🎯 Auto Play Next Video is DISABLED. Manual navigation required.');
                        return;
                    }
                    
                    getAutoPlayToggleState(autoPlayEnabled => {
                        if (!autoPlayEnabled) {
                            logDebug('▶️ Auto Play Next Video In Series is DISABLED. Staying on homepage.');
                            return;
                        }
                        
                        logDebug('🔍 Both auto-play settings enabled. Searching for next lesson...');
                        // Wait a moment for the page to fully load before searching for the next lesson
                        setTimeout(() => {
                            logDebug('⏰ Page load delay complete. Finding next lesson to auto-start...');
                            findAndClickNextLesson();
                        }, 1500);
                    });
                });
                return;
            }
            
            // For non-homepage pages, load cached lessons to populate UI
            loadAndDisplayCachedLessons();
            
            // Set up fullscreen video listeners if toggle is enabled
            getFullscreenToggleState((enabled) => {
                if (enabled) {
                    // Wait a moment for content to load, then set up listeners
                    setTimeout(() => {
                        setupVideoListeners();
                        
                        // Also set up periodic monitoring for dynamically loaded videos
                        const videoMonitorInterval = setInterval(() => {
                            getFullscreenToggleState((stillEnabled) => {
                                if (stillEnabled) {
                                    setupVideoListeners(); // This will skip already monitored videos
                                } else {
                                    clearInterval(videoMonitorInterval);
                                }
                            });
                        }, 2000); // Check every 2 seconds (more frequent for dynamic content)
                    }, 1000);
                }
            });
            
            // Check for restart button periodically (for lessons with built-in tracking)
            setTimeout(() => {
                const restartButtonInterval = setInterval(() => {
                    if (checkForRestartButton()) {
                        clearInterval(restartButtonInterval);
                    }
                }, 2000); // Check every 2 seconds
                
                // Clear the interval after 30 seconds if no restart button found
                setTimeout(() => {
                    clearInterval(restartButtonInterval);
                }, 30000);
            }, 1000); // Start checking after 1 second
            
            // For Storyline content, always try to watch for progress
            if (contentType.isStoryline) {
                logDebug('Detected Storyline content. Setting up progress monitoring.');
                waitForProgressBarFill();
                setupManualNextListener();
                return;
            }
            
            // For standard SCORM content, only run if progress bar is visible
            const progressBarElement = document.querySelector('[data-ref="progressBarFill"]');
            if (progressBarElement) {
                logDebug('Found standard progress bar element. Setting up monitoring.');
                waitForProgressBarFill();
                setupManualNextListener();
            } else if (!contentType.isScormWrapper && !contentType.isStoryline) {
                // If no progress bar and not in a wrapper or Storyline, still try to set up monitoring
                // This is a fallback for frames that might load content dynamically
                logDebug('No progress bar found. Will poll for it to appear.');
                waitForProgressBarFill();
                setupManualNextListener();
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', afterDOMReady);
        } else {
            afterDOMReady();
        }
    }
    startScript();
})();
