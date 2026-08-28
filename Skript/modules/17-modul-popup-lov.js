// ==UserScript==
// @name         Riscon: Modul Popup LOV
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.12
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
            // Skript běží s direktivou @noframes, takže se spouští POUZE v hlavním okně.
            // Veškerou logiku pro iframe (CSS, opener, close) proto musíme z hlavního okna
            // injektovat do iframu jakmile se načte (onload).
            
            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    // --- POMOCNÉ FUNKCE PRO VLASTNÍ DIALOG BEZ ZÁVISLOSTI NA JQUERY UI ---
                    function openInDialog(url, windowName) {
                        let modal = document.getElementById('riscon-custom-modal');
                        let iframe = document.getElementById('riscon-lov-iframe');

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
                            iframe = document.createElement('iframe');
                            iframe.id = 'riscon-lov-iframe';
                            iframe.name = 'riscon-lov-iframe';
                            iframe.style.cssText = 'width:100%; height:100%; border:none; background:#fff;';
                            
                            // Událost ONLOAD pro iframe
                            iframe.onload = function() {
                                try {
                                    let cw = iframe.contentWindow;
                                    let cd = iframe.contentDocument;
                                    if (!cw || !cd) return;

                                    cw.close = function() { closeDialog(); };
                                    if (cw.apex && cw.apex.navigation && cw.apex.navigation.dialog) {
                                        cw.apex.navigation.dialog.close = function() { closeDialog(); };
                                    }

                                    // 1. Záchyt kliknutí (ultimátní fallback) – reaguje na <a> i <tr> a čte onclick i href
                                    cd.addEventListener('click', function(e) {
                                        let target = e.target.closest('a, tr, button');
                                        if (!target) return;
                                        
                                        let code = (target.getAttribute('href') || '') + ' ' + (target.getAttribute('onclick') || '');
                                        
                                        if (code.includes('passBack') || code.includes('popup.close') || code.includes('_lov_passBack')) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            
                                            let match = code.match(/(?:passBack|close|_lov_passBack)\((.*?)\)/);
                                            if (match) {
                                                let argsStr = match[1];
                                                let args = argsStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                                                let pReturn = args[0] || '';
                                                let pDisplay = args[1] || pReturn;

                                                // A) Extrakce jména políčka z URL (7. parametr v APEX f?p= syntaxi)
                                                let targetItem = null;
                                                let urlMatch = iframe.src.match(/f\?p=[^:]+:[^:]+:[^:]+:[^:]*:[^:]*:[^:]*:([^:&]+)/);
                                                if (urlMatch && urlMatch[1]) {
                                                    targetItem = urlMatch[1].split(',')[0];
                                                }
                                                
                                                // B) Extrakce z původní funkce
                                                let fallbackItemId = null;
                                                try {
                                                    if (cw.passBack) {
                                                        let m = cw.passBack.toString().match(/getElementById\(['"](.*?)['"]\)/);
                                                        if (m) fallbackItemId = m[1];
                                                    }
                                                } catch(err){}
                                                
                                                let finalItem = targetItem || fallbackItemId;

                                                // ZÁPIS DO HLAVNÍHO OKNA
                                                if (finalItem) {
                                                    if (window.apex && window.apex.item) {
                                                        window.apex.item(finalItem).setValue(pReturn, pDisplay);
                                                    } else {
                                                        let item = window.document.getElementById(finalItem);
                                                        if (item) {
                                                            item.value = pReturn;
                                                            item.dispatchEvent(new Event('change', {bubbles: true}));
                                                        }
                                                    }
                                                } else if (window.apex && window.apex.navigation && window.apex.navigation.popup && typeof window.apex.navigation.popup.close === 'function') {
                                                    window.apex.navigation.popup.close(pReturn, pDisplay);
                                                }
                                                
                                                closeDialog();
                                            }
                                        }
                                    }, true);

                                    // 2. Vložení CSS proti zalamování
                                    const style = cd.createElement('style');
                                    style.textContent = \`
                                        body, .a-PopupLOV-results, .a-PopupLOV-dialog { white-space: nowrap !important; }
                                        td, th, a, span { white-space: nowrap !important; }
                                        table.t-Report-report { width: auto !important; max-width: none !important; }
                                        .t-Report-report td, .t-Report-report th { white-space: nowrap !important; }
                                    \`;
                                    cd.head.appendChild(style);

                                    // 3. Automatické roztažení podle obsahu (bez zpožděného poskakování)
                                    let resizeDialog = () => {
                                        try {
                                            let contentWidth = cd.documentElement.scrollWidth;
                                            if (contentWidth > 200) {
                                                let targetWidth = contentWidth + 40; 
                                                let maxScreenWidth = window.innerWidth * 0.95;
                                                if (targetWidth > maxScreenWidth) targetWidth = maxScreenWidth;

                                                // Získáme aktuální inline šířku z elementu
                                                let currentWidth = parseInt(content.style.width, 10) || 800;
                                                if (targetWidth > currentWidth) { 
                                                    content.style.width = targetWidth + 'px';
                                                }
                                            }
                                        } catch (e) {}
                                    };

                                    // Zavoláme hned po načtení
                                    resizeDialog();
                                    
                                    // Sledujeme dynamické změny uvnitř iframu
                                    const observer = new cw.MutationObserver(() => resizeDialog());
                                    observer.observe(cd.body, { childList: true, subtree: true, characterData: true });

                                } catch(err) {
                                    console.error("Riscon: Nelze přistoupit k iframe:", err);
                                }
                            };

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
                        document.getElementById('riscon-custom-modal-content').style.width = '800px'; 
                        
                        // Pojmenování okna pro APEX
                        iframe.name = windowName || 'winLov';
                        iframe.src = url || 'about:blank';
                    }

                    function closeDialog() {
                        let modal = document.getElementById('riscon-custom-modal');
                        if (modal) {
                            modal.style.display = 'none';
                            document.getElementById('riscon-lov-iframe').src = 'about:blank';
                        }
                    }

                    // --- ZACHYTÁVÁNÍ POPUPŮ ---
                    const originalOpen = window.open;
                    window.open = function(url, name, features) {
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
                })();
            `;
            document.documentElement.appendChild(script);
        }
    };
})();
