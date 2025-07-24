# Fortinet Video Auto-Advancer Chrome Extension

This Chrome extension automatically clicks the "Next" button on Fortinet SCORM training videos when the progress bar reaches 100%, with a 2 second delay.

## Installation
1. Download or clone this folder to your computer.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select this folder.
5. Navigate to https://training.fortinet.com/ and the extension will work automatically.

## How it works
- Monitors the progress bar (`[data-ref="progressBarFill"]`).
- When its style reaches `width: 100%`, waits 2 seconds, then clicks the `#next` button.

No configuration is required.
