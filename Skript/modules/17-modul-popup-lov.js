// ==UserScript==
// @name         Riscon: Modul Popup LOV
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.8
// @description  Vynutí otevírání vyskakovacích oken pro vyhledávání jako skutečně vnořených modálních dialogů (iframe) s nezalamujícím se textem.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/*
// @noframes
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    RS.Modules.PopupLov = {
        init: function () {
            // Vložíme kompletní logiku do nativního okna, abychom se vyhnuli sandboxu Tampermonkey
            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    // --- POMOCNÉ FUNKCE PRO VLASTNÍ DIALOG BEZ ZÁVISLOSTI NA JQUERY UI ---
                    function openInDialog(url, windowName) {
                        let modal = document.getElementById('riscon-custom-modal');
                        if (!modal) {
                            // Overlay
                            modal = document.createElement('div');
                            modal.id = 'riscon-custom-modal';
                            modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center;';
                            
                            // Content container
                            let content = document.createElement('div');
                            content.id = 'riscon-custom-modal-content';
                            content.style.cssText = 'background:#fff; width:800px; max-width:95vw; height:550px; position:relative; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border-radius:5px; display:flex; flex-direction:column; overflow:hidden; transition: width 0.3s;';
                            
                            // Header
                            let header = document.createElement('div');
                            header.style.cssText = 'padding:10px 15px; background:#f5f5f5; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center; font-family:sans-serif; font-weight:bold; font-size:14px;';
                            header.innerHTML = '<span>Vyhledávání (Riscon)</span><button id="riscon-custom-modal-close" style="cursor:pointer; background:none; border:none; font-size:20px; line-height:1; padding:0; color:#555;">&times;</button>';
                            
                            // Iframe container
                            let iframeContainer = document.createElement('div');
                            iframeContainer.style.cssText = 'flex-grow:1; position:relative; overflow:hidden;';
                            
                            // Iframe
                            let iframe = document.createElement('iframe');
                            iframe.id = 'riscon-lov-iframe';
                            iframe.name = 'riscon-lov-iframe'; // Jméno důležité pro náš detekční kód uvnitř!
                            iframe.style.cssText = 'width:100%; height:100%; border:none; background:#fff;';
                            
                            iframeContainer.appendChild(iframe);
                            content.appendChild(header);
                            content.appendChild(iframeContainer);
                            modal.appendChild(content);
                            document.body.appendChild(modal);
                            
                            // Zavírací tlačítko
                            document.getElementById('riscon-custom-modal-close').onclick = function() {
                                closeDialog();
                            };
                            
                            // Kliknutí mimo okno zavře dialog
                            modal.onclick = function(e) {
                                if (e.target === modal) closeDialog();
                            };
                        }
                        
                        document.getElementById('riscon-custom-modal').style.display = 'flex';
                        // Obnovíme výchozí šířku, kdyby předchozí okno bylo hodně široké
                        document.getElementById('riscon-custom-modal-content').style.width = '800px'; 
                        
                        // Zabráníme prázdnému URL
                        let finalUrl = url || 'about:blank';
                        document.getElementById('riscon-lov-iframe').src = finalUrl;
                    }

                    function closeDialog() {
                        let modal = document.getElementById('riscon-custom-modal');
                        if (modal) {
                            modal.style.display = 'none';
                            document.getElementById('riscon-lov-iframe').src = 'about:blank';
                        }
                    }

                    // --- 1. JSME V HLAVNÍM OKNĚ: ZACHYTÁVÁNÍ POPUPŮ ---
                    if (window.self === window.top) {
                        const originalOpen = window.open;
                        window.open = function(url, name, features) {
                            // Rozšířené podmínky pro zachycení LOV
                            let isLov = name === 'winLov' || name === 'PopupLov';
                            if (url && (url.includes('wwv_flow.ajax') || url.includes('p_request=PLUGIN') || url.includes('f?p=110'))) {
                                isLov = true;
                            }
                            
                            if (isLov) {
                                openInDialog(url, name);
                                return { focus: function(){}, close: closeDialog, location: { replace: function(u){ openInDialog(u, name); } } };
                            }
                            return originalOpen.apply(this, arguments);
                        };

                        if (window.apex && apex.navigation && apex.navigation.popup) {
                            const origApexPopup = apex.navigation.popup;
                            apex.navigation.popup = function(pOptions) {
                                if (pOptions && pOptions.url && (pOptions.url.includes('f?p=110') || pOptions.url.includes('wwv_flow.ajax'))) {
                                    openInDialog(pOptions.url, pOptions.name);
                                    return { focus: function(){}, close: closeDialog };
                                }
                                return origApexPopup.apply(this, arguments);
                            };
                        }
                        
                        if (typeof window.popupURL === 'function') {
                            const origPopupURL = window.popupURL;
                            window.popupURL = function(url) {
                                if (url && url.includes('f?p=')) {
                                    openInDialog(url, 'winLov');
                                    return;
                                }
                                origPopupURL.apply(this, arguments);
                            };
                        }
                        
                        window.RS_PopupLov_closeDialog = closeDialog;
                    } 
                    // --- 2. JSME V IFRAME DIALOGU: ZAMEZENÍ ZALAMOVÁNÍ A RESIZE ---
                    else if (window.name === 'riscon-lov-iframe') {
                        // Úprava opener pro APEX návrat hodnoty (aby fungovalo vrácení hodnoty do pole)
                        try {
                            Object.defineProperty(window, 'opener', {
                                get: function() { return window.parent; },
                                configurable: true
                            });
                        } catch(e) {
                            window.opener = window.parent;
                        }
                        
                        // Přepis window.close pro zavření našeho divu zevnitř iframu
                        window.close = function() {
                            if (window.parent && typeof window.parent.RS_PopupLov_closeDialog === 'function') {
                                window.parent.RS_PopupLov_closeDialog();
                            }
                        };

                        // Vložíme CSS pro zákaz zalamování textů
                        const style = document.createElement('style');
                        style.textContent = \`
                            body, .a-PopupLOV-results, .a-PopupLOV-dialog { white-space: nowrap !important; }
                            td, th, a, span { white-space: nowrap !important; }
                            table.t-Report-report { width: auto !important; max-width: none !important; }
                            .t-Report-report td, .t-Report-report th { white-space: nowrap !important; }
                        \`;
                        document.documentElement.appendChild(style);

                        // Resize logika – upravuje šířku nadřazeného divu místo jQuery dialogu
                        let resizeDialog = () => {
                            try {
                                let contentWidth = document.documentElement.scrollWidth;
                                if (contentWidth > 200 && window.parent && window.parent.document) {
                                    let contentDiv = window.parent.document.getElementById('riscon-custom-modal-content');
                                    
                                    if (contentDiv) {
                                        let targetWidth = contentWidth + 40; // rezerva na scrollbar a padding
                                        let maxScreenWidth = window.parent.innerWidth * 0.95;
                                        if (targetWidth > maxScreenWidth) {
                                            targetWidth = maxScreenWidth;
                                        }

                                        let currentWidth = parseInt(window.getComputedStyle(contentDiv).width, 10) || 800;
                                        if (targetWidth > currentWidth + 20) { 
                                            contentDiv.style.width = targetWidth + 'px';
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error("Riscon: Chyba při změně velikosti iframe dialogu", e);
                            }
                        };

                        setTimeout(resizeDialog, 250);
                        setTimeout(resizeDialog, 1000);
                        
                        const observer = new MutationObserver(() => resizeDialog());
                        if (document.body) {
                            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
                        } else {
                            document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true, characterData: true }));
                        }
                    }
                })();
            `;
            document.documentElement.appendChild(script);
        }
    };
})();
