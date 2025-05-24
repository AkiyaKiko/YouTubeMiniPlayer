// ==UserScript==
// @name         YouTube Mini Player
// @name:zh-CN   Youtube 小屏播放
// @namespace    http://tampermonkey.net/
// @version      2.4.0
// @license      MIT
// @description  Youtube Mini Player. When you scroll down the mini player will appear.
// @description:zh-CN   Youtube 小屏播放。当你向下滚动时，小屏播放器将会出现。
// @author       https://github.com/AkiyaKiko
// @homepage     https://github.com/AkiyaKiko/YouTubeMiniPlayer
// @match        https://www.youtube.com/*
// @icon         https://www.youtube.com/favicon.ico
// @run-at       document-end
// @grant        GM_addStyle
// @grant        GM_log
// ==/UserScript==

(function() {
    'use strict';

    GM_log('🛠️ 脚本 "YouTube Mini Player Fullscreen Check" 开始执行');

    const miniPlayerClass = 'youtube-mini-player-active';
    let playerElement = null; // The main player element, e.g., #player
    let outerContainer = null; // The outer container of the player, e.g., #player-container-outer
    let innerContainer = null; // The inner container of the player, e.g., #player-container-inner
    let videoElement = null; // The actual HTML5 video element
    let ivVideoContent = null; // Interactive video content overlay (annotations, cards)
    let bottomChrome = null; // The bottom control bar of the player

    // Store original styles to restore them when mini-player is deactivated
    let originalOuterContainerStyle = null;
    let originalInnerContainerStyle = null;
    let originalVideoStyle = null;
    let originalIvContentStyle = null;

    let intersectionObserver = null; // Observes when the player enters/leaves the viewport
    let observer = null; // MutationObserver to wait for player elements to load

    let isMiniPlayerActive = false; // Flag to track mini-player state
    let lastUrl = location.href; // Tracks the last URL to detect page navigation in SPAs
    let initializedUrl = null; // Stores the URL for which the script was last initialized

    // Variables for dragging functionality
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Variables for placeholder element
    let playerPlaceholder = null;
    let storedPlayerHeight = 0; // Stores the height the placeholder should take when mini-player is active

    /**
     * Checks if the browser is currently in fullscreen mode.
     * @returns {boolean} True if fullscreen, false otherwise.
     */
    function isFullscreen() {
        return !!document.fullscreenElement;
    }

    /**
     * Creates and inserts a hidden placeholder element right after the outerContainer.
     * This placeholder will expand to fill the player's original space when the player is minimized.
     */
    function createAndPlacePlaceholder() {
        // Only create if outerContainer exists and placeholder doesn't already exist
        if (!outerContainer || playerPlaceholder) {
            GM_log('🚧 createAndPlacePlaceholder: outerContainer不存在或占位符已存在，跳过。');
            return;
        }

        playerPlaceholder = document.createElement('div');
        playerPlaceholder.id = 'youtube-mini-player-placeholder';
        playerPlaceholder.style.height = '0px'; // Initially takes up no space
        playerPlaceholder.style.overflow = 'hidden'; // Prevents content overflow
        playerPlaceholder.style.transition = 'height 0.3s ease'; // Smooth transition for height changes
        playerPlaceholder.style.width = '100%'; // Ensures it takes full available width

        // Insert the placeholder directly after the outerContainer element
        // This ensures it's in the correct position in the document flow.
        if (outerContainer.nextSibling) {
            outerContainer.parentNode.insertBefore(playerPlaceholder, outerContainer.nextSibling);
        } else {
            outerContainer.parentNode.appendChild(playerPlaceholder);
        }

        GM_log('➕ 创建并放置占位符，初始高度0px。');
    }

    /**
     * Minimizes the YouTube player into a small floating window.
     * Activates the placeholder to fill the original player's space.
     */
    function minimizeOuterContainer() {
        // Prevent minimization if conditions are not met
        if (!outerContainer || isMiniPlayerActive || isFullscreen()) {
            GM_log('🔽 minimizeOuterContainer: 不满足小窗条件 (容器不存在, 已激活, 或全屏)，跳过。');
            return;
        }
        GM_log('🔽 minimizeOuterContainer: 开始进入小窗模式...');

        // Capture original styles of the outer container and its children before modification
        // This allows accurate restoration later.
        originalOuterContainerStyle = outerContainer.getAttribute('style');
        originalInnerContainerStyle = innerContainer?.getAttribute('style');
        originalVideoStyle = videoElement?.getAttribute('style');
        originalIvContentStyle = ivVideoContent?.getAttribute('style');

        // Store the player's current height (before it becomes fixed) for the placeholder.
        // This height represents the space the placeholder needs to fill.
        storedPlayerHeight = outerContainer.offsetHeight;
        GM_log(`📏 记录播放器当前高度为占位符: ${storedPlayerHeight}px`);

        // Activate the placeholder by setting its height to the stored player height.
        // This will cause the content below to shift down smoothly.
        if (playerPlaceholder) {
            playerPlaceholder.style.height = `${storedPlayerHeight}px`;
            GM_log(`🚀 激活占位符，高度设置为: ${storedPlayerHeight}px`);
        }

        // Calculate dimensions for the floating mini-player
        const floatingWidth = window.innerWidth / 5; // Mini-player width is 20% of window width
        // Calculate height based on the player's aspect ratio to avoid distortion
        const aspectRatio = outerContainer.offsetWidth / outerContainer.offsetHeight;
        const floatingHeight = floatingWidth / aspectRatio;
        const rightOffset = window.innerWidth * 0.03; // 3% from right edge
        const bottomOffset = window.innerHeight * 0.02; // 2% from bottom edge

        // Apply styles to make the player fixed and small
        outerContainer.style.position = 'fixed';
        outerContainer.style.bottom = `${bottomOffset}px`;
        outerContainer.style.right = `${rightOffset}px`;
        outerContainer.style.left = 'auto'; // Ensure left/top are auto for corner positioning
        outerContainer.style.top = 'auto';
        outerContainer.style.width = `${floatingWidth}px`;
        outerContainer.style.height = `${floatingHeight}px`;
        outerContainer.style.zIndex = '3000'; // High z-index to keep it on top
        outerContainer.style.boxShadow = '2px 2px 5px rgba(0, 0, 0, 0.3)'; // Add a subtle shadow
        outerContainer.style.minWidth = '0px'; // Allow it to shrink below YouTube's default min-width
        outerContainer.classList.add(miniPlayerClass); // Add class for CSS transitions
        isMiniPlayerActive = true;
        GM_log(`✅ 小窗模式激活: ${floatingWidth.toFixed(2)}x${floatingHeight.toFixed(2)}`);

        // Adjust internal player elements' sizes to fit the mini-player dimensions
        if (innerContainer) {
            innerContainer.style.width = `${floatingWidth}px`;
            innerContainer.style.height = `${floatingHeight}px`;
            innerContainer.style.paddingTop = '0px'; // Remove any top padding YouTube might add
        }
        if (bottomChrome) bottomChrome.style.display = 'none'; // Hide bottom controls in mini-player
        if (videoElement) {
            videoElement.style.width = `${floatingWidth}px`;
            videoElement.style.height = `${floatingHeight}px`;
        }
        if (ivVideoContent) {
            ivVideoContent.style.width = `${floatingWidth}px`;
            ivVideoContent.style.height = `${floatingHeight}px`;
        }

        enableDragging(); // Enable dragging for the mini-player
    }

    /**
     * Restores the YouTube player to its original size and position.
     * Deactivates the placeholder by collapsing its height.
     */
    function restoreOuterContainer() {
        // Prevent restoration if conditions are not met
        if (!outerContainer || !isMiniPlayerActive || isFullscreen()) {
            GM_log('🔼 restoreOuterContainer: 不满足恢复条件 (容器不存在, 未激活, 或全屏)，跳过。');
            return;
        }
        GM_log('🔼 restoreOuterContainer: 恢复播放器原状...');

        // Restore original styles to the outer container
        outerContainer.setAttribute('style', originalOuterContainerStyle || '');
        outerContainer.classList.remove(miniPlayerClass);
        originalOuterContainerStyle = null; // Clear stored style
        isMiniPlayerActive = false;
        GM_log('✅ 播放器已恢复。');

        // Deactivate the placeholder by setting its height back to 0.
        // This will cause the content below to shift up smoothly.
        if (playerPlaceholder) {
            playerPlaceholder.style.height = '0px';
            GM_log('⬇️ 占位符高度设置为0px (隐藏)。');
        }

        // Restore internal player elements' styles
        if (innerContainer) innerContainer.removeAttribute('style');
        if (bottomChrome) bottomChrome.style.display = ''; // Show bottom controls again
        if (videoElement) videoElement.setAttribute('style', originalVideoStyle || '');
        if (ivVideoContent) ivVideoContent.setAttribute('style', originalIvContentStyle || '');

        disableDragging(); // Disable dragging after restoration
    }

    /**
     * Enables dragging functionality for the mini-player.
     */
    function enableDragging() {
        if (!outerContainer) return;
        outerContainer.addEventListener('mousedown', onMouseDown);
        GM_log('🎯 小窗拖动启用');
    }

    /**
     * Disables dragging functionality for the mini-player.
     */
    function disableDragging() {
        if (!outerContainer) return;
        outerContainer.removeEventListener('mousedown', onMouseDown);
        GM_log('🛑 小窗拖动禁用');
    }

    /**
     * Handles mouse down event for initiating dragging.
     * @param {MouseEvent} e - The mouse event.
     */
    function onMouseDown(e) {
        if (!isMiniPlayerActive) return;
        isDragging = true;
        // Calculate the offset from the mouse click to the element's top-left corner
        dragOffsetX = e.clientX - outerContainer.getBoundingClientRect().left;
        dragOffsetY = e.clientY - outerContainer.getBoundingClientRect().top;

        // Add listeners for mouse move and mouse up on the document to track dragging globally
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault(); // Prevent default browser drag behavior (e.g., image dragging)
    }

    /**
     * Handles mouse move event during dragging.
     * @param {MouseEvent} e - The mouse event.
     */
    function onMouseMove(e) {
        if (!isDragging) return;
        // Update the player's position based on mouse movement and initial offset
        outerContainer.style.left = `${e.clientX - dragOffsetX}px`;
        outerContainer.style.top = `${e.clientY - dragOffsetY}px`;
        outerContainer.style.right = 'auto'; // Reset right and bottom to allow free movement
        outerContainer.style.bottom = 'auto';
    }

    /**
     * Handles mouse up event to stop dragging.
     */
    function onMouseUp() {
        isDragging = false;
        // Remove global event listeners
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    /**
     * Observes the visibility of the main player element to trigger mini-player mode.
     * Uses IntersectionObserver for efficient visibility tracking.
     */
    function observePlayerVisibility() {
        if (!playerElement) {
            GM_log('❌ observePlayerVisibility: playerElement不存在，无法监听可见性。');
            return;
        }

        // Disconnect any existing observer to prevent multiple instances
        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
        }

        GM_log('👀 开始监听播放器可见性 IntersectionObserver...');
        // Create a new IntersectionObserver.
        // `threshold: 0` means the callback will fire as soon as any part of the target element
        // crosses the root (viewport) boundary.
        intersectionObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const playerRect = entry.boundingClientRect;
                // Condition for mini-player: the bottom edge of the player is above the top of the viewport.
                // This means the entire player has scrolled out of view upwards.
                if (playerRect.bottom < 0) {
                    if (!isFullscreen()) {
                        GM_log('🔍 播放器底部离开视口顶部，且不是全屏，触发小窗模式。');
                        minimizeOuterContainer();
                    } else {
                        GM_log('🔍 播放器离开视口，但处于全屏模式，不触发小窗。');
                    }
                } else {
                    // Player's bottom edge is within or below the viewport, meaning it's visible.
                    GM_log('👁️ 播放器底部在视口内或以下，触发恢复大屏模式。');
                    restoreOuterContainer();
                }
            });
        }, { threshold: 0 });

        intersectionObserver.observe(playerElement); // Start observing the player element
    }

    /**
     * Waits for all necessary YouTube elements to be present in the DOM.
     * Uses a MutationObserver for robustness, as YouTube loads content dynamically.
     */
    function waitForElements() {
        if (!observer) {
            GM_log('⌛ 必要元素未找到，使用MutationObserver等待DOM变化...');
            // Create a new MutationObserver instance
            observer = new MutationObserver((mutations, obs) => {
                // Check if all required elements are present in the DOM
                if (document.getElementById('player') &&
                    document.getElementById('player-container-outer') &&
                    document.getElementById('player-container-inner') &&
                    document.querySelector('video.video-stream.html5-main-video') &&
                    document.getElementById('contents')) { // 'contents' often indicates the main page content is ready
                    obs.disconnect(); // Stop observing once elements are found
                    observer = null; // Clear observer reference
                    GM_log('✅ MutationObserver: 检测到所有必要元素，准备初始化。');
                    initialize(); // Proceed with script initialization
                }
            });
            // Observe the entire document body for changes to its children and any descendants
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    /**
     * Handles window resize events to adjust mini-player and placeholder size.
     * This is crucial for responsiveness when the browser window itself is resized (e.g., exiting browser fullscreen).
     */
    function handleResize() {
        // --- Adjust Mini-Player Size if active ---
        if (outerContainer && outerContainer.classList.contains(miniPlayerClass)) {
            GM_log('📐 窗口大小变化，重新调整小窗尺寸。');
            const floatingWidth = window.innerWidth / 5; // Recalculate mini-player width based on new window size
            // Recalculate aspect ratio based on the *current* mini-player dimensions to maintain proportions
            const aspectRatio = outerContainer.offsetWidth / outerContainer.offsetHeight;
            const floatingHeight = floatingWidth / aspectRatio;
            const rightOffset = window.innerWidth * 0.03;
            const bottomOffset = window.innerHeight * 0.02;

            // Apply new dimensions and position to the mini-player
            outerContainer.style.width = `${floatingWidth}px`;
            outerContainer.style.height = `${floatingHeight}px`;
            outerContainer.style.right = `${rightOffset}px`;
            outerContainer.style.bottom = `${bottomOffset}px`;
            outerContainer.style.left = 'auto'; // Reset left/top to ensure it snaps to corner
            outerContainer.style.top = 'auto';

            // Adjust internal player elements' sizes
            if (innerContainer) {
                innerContainer.style.width = `${floatingWidth}px`;
                innerContainer.style.height = `${floatingHeight}px`;
            }
            if (videoElement) {
                videoElement.style.width = `${floatingWidth}px`;
                videoElement.style.height = `${floatingHeight}px`;
            }
            if (ivVideoContent) {
                ivVideoContent.style.width = `${floatingWidth}px`;
                ivVideoContent.style.height = `${floatingHeight}px`;
            }
        }

        // --- Adjust Placeholder Height if Mini-Player is active ---
        // This ensures the placeholder continues to correctly fill the space
        // if the original player's size changes dynamically due to browser resize.
        if (playerPlaceholder && isMiniPlayerActive) {
            let currentOriginalHeight = 0;
            // The playerElement (main #player div) remains in the document flow even when outerContainer is fixed.
            // Its height will dynamically adjust with YouTube's responsive CSS.
            if (playerElement) {
                currentOriginalHeight = playerElement.getBoundingClientRect().height;

                // Fallback if getBoundingClientRect returns 0 (e.g., element temporarily unrendered or hidden)
                if (currentOriginalHeight === 0 && outerContainer) {
                    // Try to get the clientHeight of the outer container, which is often reliable
                    currentOriginalHeight = outerContainer.clientHeight;
                }
            }

            // Apply a minimum height to prevent the placeholder from becoming too small if
            // YouTube's player briefly renders with tiny dimensions during a resize.
            const minimumExpectedHeight = window.innerHeight * 0.5; // Example: 50% of viewport height
            currentOriginalHeight = Math.max(currentOriginalHeight, minimumExpectedHeight);

            // Update placeholder height only if a valid height is determined
            if (currentOriginalHeight > 0) {
                 playerPlaceholder.style.height = `${currentOriginalHeight}px`;
                 GM_log(`📐 占位符随窗口大小变化调整为: ${currentOriginalHeight.toFixed(2)}px`);
            } else {
                 GM_log('⚠️ 无法获取有效的原始播放器高度，占位符高度未调整。');
            }
        }
    }

    /**
     * Cleans up all script-related resources (observers, styles, elements)
     * This is called when navigating away from a watch page or during script re-initialization.
     */
    function cleanup() {
        GM_log('🧹 cleanup: 清理上一页状态...');

        // Disconnect and clear IntersectionObserver
        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
            GM_log('🛑 断开 IntersectionObserver。');
        }
        // Disconnect and clear MutationObserver
        if (observer) {
            observer.disconnect();
            observer = null;
            GM_log('🛑 断开 MutationObserver。');
        }

        // Restore player to its original state (if active) and collapse placeholder
        restoreOuterContainer();

        // Explicitly remove placeholder from DOM if it still exists (e.g., in case of an error or early cleanup)
        if (playerPlaceholder && playerPlaceholder.parentNode) {
            playerPlaceholder.parentNode.removeChild(playerPlaceholder);
            playerPlaceholder = null;
            GM_log('➖ 最终清理：移除占位符。');
        }

        // Remove window resize listener
        window.removeEventListener('resize', handleResize);

        // Reset all global element references and state flags
        playerElement = null;
        outerContainer = null;
        innerContainer = null;
        videoElement = null;
        ivVideoContent = null;
        bottomChrome = null;
        initializedUrl = null; // Clear the URL that was initialized
        isMiniPlayerActive = false; // Reset mini-player state
        isDragging = false; // Reset dragging state
        storedPlayerHeight = 0; // Reset stored height
    }

    /**
     * Initializes the script by finding necessary DOM elements, setting up observers,
     * and performing an initial check of the player's visibility.
     */
    function initialize() {
        // Get references to key YouTube player elements
        playerElement = document.getElementById('player');
        outerContainer = document.getElementById('player-container-outer');
        innerContainer = document.getElementById('player-container-inner');
        videoElement = document.querySelector('video.video-stream.html5-main-video');
        ivVideoContent = document.querySelector('.ytp-iv-video-content');
        bottomChrome = document.querySelector('.ytp-chrome-bottom');

        // Proceed only if all essential elements are found
        if (playerElement && outerContainer && innerContainer && videoElement && document.getElementById('contents')) {
            GM_log('🚀 initialize: 所有必要元素齐备，开始初始化。');

            // 1. Create and place the placeholder element immediately.
            // It will initially have height:0 and expand when needed.
            createAndPlacePlaceholder();

            // 2. Set up observers and event listeners
            observePlayerVisibility(); // Start observing player visibility for auto-minimization/restoration
            window.addEventListener('resize', handleResize); // Add resize listener for responsiveness
            if (observer) { // Disconnect MutationObserver if it was active (waiting for elements)
                observer.disconnect();
                observer = null;
            }
            isMiniPlayerActive = false; // Ensure initial state is not mini-player active

            // 3. Perform an initial check of the player's position on page load.
            // This determines if the mini-player should be active immediately.
            const rect = playerElement.getBoundingClientRect();
            if (rect.bottom < 0) {
                GM_log('初始状态：播放器已在视口外，立即小窗化。');
                minimizeOuterContainer();
            } else {
                GM_log('初始状态：播放器在视口内，保持大屏。');
                restoreOuterContainer(); // Ensure it's in a fully restored state
            }

            initializedUrl = location.href; // Mark the current URL as successfully initialized
            GM_log(`📌 初始化完成，记录当前URL: ${initializedUrl}`);
        } else {
            // If elements are not found, wait for them to appear using MutationObserver
            GM_log('❌ initialize: 缺少必要元素，将等待元素加载。');
            waitForElements();
        }
    }

    /**
     * Checks the current browser URL. If it's a new YouTube watch page,
     * it triggers a cleanup of the old state and re-initializes the script.
     */
    function checkUrlAndInitialize() {
        // Only execute logic on YouTube watch pages (`/watch` path)
        if (location.pathname.startsWith('/watch')) {
            // If the current URL is different from the last initialized URL
            if (location.href !== initializedUrl) {
                GM_log('🔄 检测到新watch页面或URL变化，需要重新初始化。');
                cleanup(); // First, clean up any previous script state
                // Introduce a small delay to allow YouTube's dynamic content to load
                // before trying to find and manipulate elements.
                setTimeout(() => initialize(), 500);
            } else {
                GM_log('⏩ 当前watch页面已初始化，跳过重复初始化。');
            }
        } else {
            // If not on a watch page, ensure all script effects are reverted and cleaned up
            GM_log('⏸️ 当前不是watch页面，执行清理。');
            cleanup();
        }
    }

    /**
     * Starts a continuous interval to monitor for URL changes.
     * This is necessary for Single-Page Applications (SPAs) like YouTube,
     * where the URL can change without a full page reload.
     */
    function startUrlWatcher() {
        setInterval(() => {
            if (location.href !== lastUrl) {
                GM_log(`🌍 URL变化检测到: ${lastUrl} -> ${location.href}`);
                lastUrl = location.href; // Update last known URL
                checkUrlAndInitialize(); // Trigger re-initialization based on new URL
            }
        }, 300); // Check every 300 milliseconds
    }

    /**
     * The main entry point for the UserScript.
     * It determines when to start the URL watcher and initial setup.
     */
    function start() {
        GM_log('⚡ 页面DOM准备完毕，启动URL变化检测和初始化流程。');
        checkUrlAndInitialize(); // Perform an immediate check on script load
        startUrlWatcher(); // Begin monitoring URL changes
    }

    // Attach the 'start' function to the appropriate DOMContentLoaded event
    // or run immediately if the document is already ready.
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        GM_log('✅ 页面已处于ready状态 (complete 或 interactive)，直接启动start()。');
        start();
    } else {
        GM_log('⏳ 页面未ready，等待DOMContentLoaded事件。');
        document.addEventListener('DOMContentLoaded', start);
    }

    // Add necessary CSS styles using GM_addStyle.
    // This includes transition effects for the mini-player and cursor changes.
    GM_addStyle(`
        .${miniPlayerClass} {
            /* Smooth transition for position and size changes */
            transition: width 0.3s ease, height 0.3s ease, right 0.3s ease, bottom 0.3s ease, top 0.3s ease, left 0.3s ease;
            cursor: move; /* Indicates the mini-player is draggable */
        }
        #youtube-mini-player-placeholder {
            /* Basic styling for the placeholder element */
            width: 100%; /* Ensures it takes the full available width */
            background-color: transparent; /* Makes it invisible */
            /* Height is controlled by JavaScript for smooth transitions */
            /* For debugging, uncomment the line below to see the placeholder taking space */
            /* border: 1px dashed green; */
        }
    `);
})();