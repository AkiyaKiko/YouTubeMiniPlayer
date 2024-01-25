// ==UserScript==
// @name         YouTube Mini Player
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  let you watch video and comments at the same time!
// @author       https://github.com/AkiyaKiko
// @homepage     https://github.com/AkikaKiko/YouTubeMiniPlayer
// @match        https://www.youtube.com/watch*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let video = document.getElementsByTagName('video')[0];
    let button = document.createElement('button');
    button.id = 'YTMiniPlayerButton';
    button.style.position = 'fixed';
    button.style.right = '90px';
    button.style.bottom = '40px';
    button.style.zIndex = '1000000 !important'
    button.innerText = 'PIP';
    button.style.opacity = '0';
    button.style.pointerEvents = 'none';
    button.onclick = function(){
        RPIP(video);
        button.style.opacity = '0';
        button.style.pointerEvents = 'none';
    }
    document.body.appendChild(button);


    let buttonDOM = document.getElementById('YTMiniPlayerButton');
    let io = new IntersectionObserver(
        entries => {
            entries.forEach(
                entry => {
                    if (entry.isIntersecting){
                        // if (document.pictureInPictureElement === video){
                            buttonDOM.style.opacity = '0';
                            buttonDOM.style.pointerEvents = 'none';
                            document.exitPictureInPicture();
                            // document.body.click();
                            console.log("videoContainerGetintofView");
                        // }
                    }else{
                        if (document.pictureInPictureElement !== video || document.pictureInPictureElement === null || !document.hasFocus()){
                            buttonDOM.style.opacity = '1';
                            buttonDOM.style.pointerEvents = '';
                            // document.body.click();
                            console.log("videoContainerOutofView");
                        }
                    }
                }
            );
        },{threshold:0}
    );
    io.observe(video);
    // Your code here...
})();

function RPIP(video){
    video.requestPictureInPicture();
}