// ==UserScript==
// @name         YouTube Mini Player
// @namespace    http://tampermonkey.net/
// @version      2.1
// @license      MIT
// @description  Youtube Mini Player. When you scroll down the mini player will appear.
// @author       https://github.com/AkiyaKiko
// @homepage     https://github.com/AkiyaKiko/YouTubeMiniPlayer
// @match        https://www.youtube.com/watch?*
// @icon         https://www.youtube.com/favicon.ico
// @run-at       document-end
// @grant        GM_addStyle
// @grant        GM_log
// ==/UserScript==

(function() {
    'use strict';

    GM_log('脚本 "YouTube Mini Player" 开始执行');

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

    function minimizeOuterContainer() {
        if (!outerContainer || isMiniPlayerActive) return;

        GM_log('minimizeOuterContainer: 开始缩小/移动 outer (设置 min-width: 0), 调整 inner 尺寸并移除 padding-top, 隐藏底部控制栏, 并更新视频/IV内容尺寸');
        originalOuterContainerStyle = outerContainer.getAttribute('style');
        originalInnerContainerStyle = innerContainer ? innerContainer.getAttribute('style') : null;
        originalVideoStyle = videoElement ? videoElement.getAttribute('style') : null;
        originalIvContentStyle = ivVideoContent ? ivVideoContent.getAttribute('style') : null;

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
        outerContainer.style.minWidth = '0px'; // 添加 min-width: 0
        outerContainer.classList.add(miniPlayerClass);
        isMiniPlayerActive = true;

        if (innerContainer) {
            innerContainer.style.width = `${floatingWidth}px`;
            innerContainer.style.height = `${floatingHeight}px`;
            innerContainer.style.paddingTop = '0px';
            GM_log(`minimizeOuterContainer: 更新 innerContainer 尺寸并设置 padding-top: 0 - width: ${floatingWidth}px, height: ${floatingHeight}px`);
        }
        if (bottomChrome) {
            bottomChrome.style.display = 'none';
            GM_log('minimizeOuterContainer: 隐藏底部控制栏');
        }
        if (videoElement) {
            videoElement.style.width = `${floatingWidth}px`;
            videoElement.style.height = `${floatingHeight}px`;
            GM_log(`minimizeOuterContainer: 更新 video 标签尺寸 - width: ${floatingWidth}px, height: ${floatingHeight}px`);
        }
        if (ivVideoContent) {
            ivVideoContent.style.width = `${floatingWidth}px`;
            ivVideoContent.style.height = `${floatingHeight}px`;
            GM_log(`minimizeOuterContainer: 更新 ytp-iv-video-content 尺寸 - width: ${floatingWidth}px, height: ${floatingHeight}px`);
        }

        GM_log(`minimizeOuterContainer: player-container-outer 缩小并移动完成 (min-width: 0) - width: ${floatingWidth}px, height: ${floatingHeight}px, right: ${rightOffset}px, bottom: ${bottomOffset}px`);
    }

    function restoreOuterContainer() {
        if (!outerContainer || !isMiniPlayerActive) return;

        GM_log('restoreOuterContainer: 开始恢复 outer 原始样式 (移除 min-width), 恢复 inner 原始样式 (移除 style 属性), 并显示底部控制栏');
        outerContainer.setAttribute('style', originalOuterContainerStyle || '');
        outerContainer.style.removeProperty('min-width'); // 移除 min-width 样式
        outerContainer.classList.remove(miniPlayerClass);
        originalOuterContainerStyle = null;
        isMiniPlayerActive = false;

        if (innerContainer) {
            innerContainer.removeAttribute('style');
            originalInnerContainerStyle = null;
            GM_log('restoreOuterContainer: 恢复 innerContainer 的原始样式 (移除 style 属性)');
        }
        if (bottomChrome) {
            bottomChrome.style.display = '';
            GM_log('restoreOuterContainer: 显示底部控制栏');
        }
        if (videoElement) {
            videoElement.setAttribute('style', originalVideoStyle || '');
            originalVideoStyle = null;
            GM_log('restoreOuterContainer: 恢复 video 标签的原始尺寸');
        }
        if (ivVideoContent) {
            ivVideoContent.setAttribute('style', originalIvContentStyle || '');
            originalIvContentStyle = null;
            GM_log('restoreOuterContainer: 恢复 ytp-iv-video-content 的原始尺寸');
        }

        GM_log('restoreOuterContainer: player-container-outer 的原始样式已恢复 (min-width removed)');
    }

    function observePlayerVisibility() {
        if (!playerElement) {
            GM_log('observePlayerVisibility: playerElement 为 null，无法创建 IntersectionObserver');
            return;
        }

        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
            GM_log('observePlayerVisibility: 断开之前的 Intersection Observer');
        }

        intersectionObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        GM_log("IntersectionObserver: playerElement 进入视野，恢复容器和控制栏");
                        restoreOuterContainer();
                    } else {
                        GM_log("IntersectionObserver: playerElement 离开视野，缩小容器并隐藏控制栏");
                        minimizeOuterContainer();
                    }
                });
            }, { threshold: 0 }
        );

        intersectionObserver.observe(playerElement);
        GM_log('observePlayerVisibility: 开始监听 playerElement 的可见性');
    }

    function initialize() {
        GM_log('initialize: 重新初始化脚本');
        playerElement = document.getElementById('player');
        outerContainer = document.getElementById('player-container-outer');
        innerContainer = document.getElementById('player-container-inner');
        videoElement = document.querySelector('video.video-stream.html5-main-video');
        ivVideoContent = document.querySelector('.ytp-iv-video-content');
        bottomChrome = document.querySelector('.ytp-chrome-bottom');
        GM_log(`initialize: 获取元素 - player: ${playerElement}, outer: ${outerContainer}, inner: ${innerContainer}, video: ${videoElement}, iv: ${ivVideoContent}, bottom: ${bottomChrome}`);

        if (playerElement && outerContainer && innerContainer && videoElement) {
            GM_log('initialize: 所有必要元素已找到，开始观察播放器可见性');
            observePlayerVisibility();
            window.addEventListener('resize', handleResize);
            GM_log('initialize: 添加 resize 事件监听器');
            if (observer) {
                observer.disconnect();
                observer = null;
                GM_log('initialize: 断开 DOM 变化监听器');
            }
            isMiniPlayerActive = false;
            restoreOuterContainer();
        } else {
            GM_log('initialize: 仍然有必要元素未找到，继续等待...');
            waitForElements();
        }
    }

    function handleResize() {
        if (outerContainer && outerContainer.classList.contains(miniPlayerClass)) {
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
            GM_log(`resize: 窗口大小改变，更新缩小容器/视频/IV内容尺寸和位置`);
        }
    }

    function waitForElements() {
        playerElement = document.getElementById('player');
        outerContainer = document.getElementById('player-container-outer');
        innerContainer = document.getElementById('player-container-inner');
        videoElement = document.querySelector('video.video-stream.html5-main-video');
        ivVideoContent = document.querySelector('.ytp-iv-video-content');
        bottomChrome = document.querySelector('.ytp-chrome-bottom');
        GM_log(`waitForElements: 尝试获取元素 - player: ${playerElement}, outer: ${outerContainer}, inner: ${innerContainer}, video: ${videoElement}, iv: ${ivVideoContent}, bottom: ${bottomChrome}`);

        if (playerElement && outerContainer && innerContainer && videoElement) {
            GM_log('waitForElements: 所有必要元素已找到，调用 initialize');
            initialize();
        } else {
            if (!observer) {
                observer = new MutationObserver(mutations => {
                    const foundPlayer = document.getElementById('player');
                    const foundOuterContainer = document.getElementById('player-container-outer');
                    const foundInnerContainer = document.getElementById('player-container-inner');
                    const foundVideo = document.querySelector('video.video-stream.html5-main-video');
                    if (foundPlayer && foundOuterContainer && foundInnerContainer && foundVideo) {
                        GM_log('MutationObserver: 检测到所有必要元素，调用 initialize');
                        initialize();
                    } else {
                        GM_log('MutationObserver: 仍然有必要元素未找到');
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                GM_log('waitForElements: 开始监听 DOM 变化');
            } else {
                GM_log('waitForElements: MutationObserver 已经在监听 DOM 变化');
            }
        }
    }

    // 监听页面 DOMContentLoaded 事件以进行重新初始化
    document.addEventListener('DOMContentLoaded', () => {
        GM_log('DOMContentLoaded: 页面加载完成，重新初始化脚本');
        window.removeEventListener('resize', handleResize);
        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
        }
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        setTimeout(initialize, 500);
    });
    GM_log('添加 DOMContentLoaded 事件监听器');

    // 初始执行
    setTimeout(initialize, 500);
    GM_log('脚本初始设置延迟后的元素检查');

    GM_addStyle(`
        .${miniPlayerClass} {
            transition: width 0.3s ease, height 0.3s ease, right 0.3s ease, bottom 0.3s ease;
        }
    `);
    GM_log('添加缩小状态的 CSS');
})();