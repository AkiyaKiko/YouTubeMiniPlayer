// ==UserScript==
// @name         YouTube Mini Player
// @name:zh-CN   Youtube 小屏播放
// @namespace    http://tampermonkey.net/
// @version      2.3.0
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
    let playerElement = null;
    let outerContainer = null;
    let innerContainer = null;
    let videoElement = null;
    let ivVideoContent = null;
    let bottomChrome = null;
    let originalOuterContainerStyle = null;
    let originalInnerContainerStyle = null;
    let originalVideoStyle = null;
    let originalIvContentStyle = null;
    let intersectionObserver = null;
    let observer = null;
    let isMiniPlayerActive = false;
    let lastUrl = location.href;
    let initializedUrl = null;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    function isFullscreen() {
        return !!document.fullscreenElement;
    }

    function minimizeOuterContainer() {
        if (!outerContainer || isMiniPlayerActive || isFullscreen()) return;
        GM_log('🔽 minimizeOuterContainer: 开始小窗模式');

        originalOuterContainerStyle = outerContainer.getAttribute('style');
        originalInnerContainerStyle = innerContainer?.getAttribute('style');
        originalVideoStyle = videoElement?.getAttribute('style');
        originalIvContentStyle = ivVideoContent?.getAttribute('style');

        const floatingWidth = window.innerWidth / 5;
        const aspectRatio = outerContainer.offsetWidth / outerContainer.offsetHeight;
        const floatingHeight = floatingWidth / aspectRatio;
        const rightOffset = window.innerWidth * 0.03;
        const bottomOffset = window.innerHeight * 0.02;

        outerContainer.style.position = 'fixed';
        outerContainer.style.bottom = `${bottomOffset}px`;
        outerContainer.style.right = `${rightOffset}px`;
        outerContainer.style.left = 'auto';
        outerContainer.style.top = 'auto';
        outerContainer.style.width = `${floatingWidth}px`;
        outerContainer.style.height = `${floatingHeight}px`;
        outerContainer.style.zIndex = '3000';
        outerContainer.style.boxShadow = '2px 2px 5px rgba(0, 0, 0, 0.3)';
        outerContainer.style.minWidth = '0px';
        outerContainer.classList.add(miniPlayerClass);
        isMiniPlayerActive = true;

        if (innerContainer) {
            innerContainer.style.width = `${floatingWidth}px`;
            innerContainer.style.height = `${floatingHeight}px`;
            innerContainer.style.paddingTop = '0px';
        }
        if (bottomChrome) bottomChrome.style.display = 'none';
        if (videoElement) {
            videoElement.style.width = `${floatingWidth}px`;
            videoElement.style.height = `${floatingHeight}px`;
        }
        if (ivVideoContent) {
            ivVideoContent.style.width = `${floatingWidth}px`;
            ivVideoContent.style.height = `${floatingHeight}px`;
        }

        enableDragging();
    }

    function restoreOuterContainer() {
        if (!outerContainer || !isMiniPlayerActive || isFullscreen()) return;
        GM_log('🔼 restoreOuterContainer: 恢复播放器原状');

        outerContainer.setAttribute('style', originalOuterContainerStyle || '');
        outerContainer.classList.remove(miniPlayerClass);
        originalOuterContainerStyle = null;
        isMiniPlayerActive = false;

        if (innerContainer) innerContainer.removeAttribute('style');
        if (bottomChrome) bottomChrome.style.display = '';
        if (videoElement) videoElement.setAttribute('style', originalVideoStyle || '');
        if (ivVideoContent) ivVideoContent.setAttribute('style', originalIvContentStyle || '');

        disableDragging();
    }

    function enableDragging() {
        if (!outerContainer) return;

        outerContainer.addEventListener('mousedown', onMouseDown);
        GM_log('🎯 小窗拖动启用');
    }

    function disableDragging() {
        if (!outerContainer) return;

        outerContainer.removeEventListener('mousedown', onMouseDown);
        GM_log('🛑 小窗拖动禁用');
    }

    function onMouseDown(e) {
        if (!isMiniPlayerActive) return;
        isDragging = true;
        dragOffsetX = e.clientX - outerContainer.getBoundingClientRect().left;
        dragOffsetY = e.clientY - outerContainer.getBoundingClientRect().top;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    }

    function onMouseMove(e) {
        if (!isDragging) return;

        outerContainer.style.left = `${e.clientX - dragOffsetX}px`;
        outerContainer.style.top = `${e.clientY - dragOffsetY}px`;
        outerContainer.style.right = 'auto';
        outerContainer.style.bottom = 'auto';
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    function observePlayerVisibility() {
        if (!playerElement) {
            GM_log('❌ observePlayerVisibility: playerElement不存在，退出');
            return;
        }

        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
        }

        GM_log('👀 开始监听播放器可见性 IntersectionObserver');
        intersectionObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    GM_log('👁️ 播放器在视口内，恢复大屏');
                    restoreOuterContainer();
                } else {
                    if (!isFullscreen()) {
                        GM_log('🔍 播放器离开视口，且不是全屏，缩小为小窗');
                        minimizeOuterContainer();
                    }
                }
            });
        }, { threshold: 0 });

        intersectionObserver.observe(playerElement);
    }

    function waitForElements() {
        if (!observer) {
            GM_log('⌛ 必要元素未找到，使用MutationObserver等待...');
            observer = new MutationObserver(() => {
                if (document.getElementById('player') &&
                    document.getElementById('player-container-outer') &&
                    document.getElementById('player-container-inner') &&
                    document.querySelector('video.video-stream.html5-main-video') &&
                    document.getElementById('contents')) {
                    observer.disconnect();
                    observer = null;
                    GM_log('✅ MutationObserver: 检测到所有必要元素，开始initialize');
                    initialize();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    function handleResize() {
        if (outerContainer && outerContainer.classList.contains(miniPlayerClass)) {
            GM_log('📐 窗口大小变化，重新调整小窗尺寸');
            const floatingWidth = window.innerWidth / 5;
            const aspectRatio = outerContainer.offsetWidth / outerContainer.offsetHeight;
            const floatingHeight = floatingWidth / aspectRatio;
            const rightOffset = window.innerWidth * 0.03;
            const bottomOffset = window.innerHeight * 0.02;

            outerContainer.style.width = `${floatingWidth}px`;
            outerContainer.style.height = `${floatingHeight}px`;
            outerContainer.style.right = `${rightOffset}px`;
            outerContainer.style.bottom = `${bottomOffset}px`;

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
    }

    function cleanup() {
        GM_log('🧹 cleanup: 清理上一页状态');

        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
            GM_log('🛑 断开 IntersectionObserver');
        }
        if (observer) {
            observer.disconnect();
            observer = null;
            GM_log('🛑 断开 MutationObserver');
        }

        restoreOuterContainer();
        playerElement = null;
        outerContainer = null;
        innerContainer = null;
        videoElement = null;
        ivVideoContent = null;
        bottomChrome = null;
        initializedUrl = null;
    }

    function initialize() {
        playerElement = document.getElementById('player');
        outerContainer = document.getElementById('player-container-outer');
        innerContainer = document.getElementById('player-container-inner');
        videoElement = document.querySelector('video.video-stream.html5-main-video');
        ivVideoContent = document.querySelector('.ytp-iv-video-content');
        bottomChrome = document.querySelector('.ytp-chrome-bottom');

        if (playerElement && outerContainer && innerContainer && videoElement && document.getElementById('contents')) {
            GM_log('🚀 initialize: 必要元素齐备，初始化完成');
            observePlayerVisibility();
            window.addEventListener('resize', handleResize);
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            isMiniPlayerActive = false;

            const rect = playerElement.getBoundingClientRect();
            if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
                restoreOuterContainer();
            } else {
                minimizeOuterContainer();
            }

            initializedUrl = location.href;
            GM_log(`📌 初始化完成，记录当前URL: ${initializedUrl}`);
        } else {
            waitForElements();
        }
    }

    function checkUrlAndInitialize() {
        if (location.pathname.startsWith('/watch')) {
            if (location.href !== initializedUrl) {
                GM_log('🔄 检测到新watch页面，需要初始化');
                setTimeout(() => initialize(), 500);
            } else {
                GM_log('⏩ 当前watch页面已初始化，跳过');
            }
        } else {
            GM_log('⏸️ 当前不是watch页面，执行清理');
            cleanup();
        }
    }

    function startUrlWatcher() {
        setInterval(() => {
            if (location.href !== lastUrl) {
                GM_log(`🌍 URL变化: ${lastUrl} -> ${location.href}`);
                lastUrl = location.href;
                checkUrlAndInitialize();
            }
        }, 300);
    }

    function start() {
        GM_log('⚡ 页面准备完毕，开始检测URL变化');
        checkUrlAndInitialize();
        startUrlWatcher();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        GM_log('✅ 页面已ready，直接启动start()');
        start();
    } else {
        GM_log('⏳ 页面未ready，等待DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', start);
    }

    GM_addStyle(`
        .${miniPlayerClass} {
            transition: width 0.3s ease, height 0.3s ease, right 0.3s ease, bottom 0.3s ease;
            cursor: move;
        }
    `);
})();
