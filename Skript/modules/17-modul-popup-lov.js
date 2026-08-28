// ==UserScript==
// @name         Riscon: Modul Popup LOV
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.7
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
            // Protože sdružený skript používá GM_ funkce, je spuštěn v izolovaném sandboxu.
            // Zde proto injektujeme kompletní logiku tohoto modulu přímo do nativního kontextu stránky,
            // abychom měli bezproblémový přístup k nativnímu window.open a window.jQuery (potažmo apex.jQuery).
            
            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    // --- POMOCNÉ FUNKCE PRO DIALOG ---
                    function openInDialog(url) {
                        let $ = window.apex ? window.apex.jQuery : window.jQuery;
                        if (!$) {
                            console.error("Riscon: jQuery není k dispozici pro vytvoření dialogu.");
                            return;
                        }
                        
                        let $dialog = $('#riscon-lov-dialog');
                        if ($dialog.length === 0) {
                            $dialog = $('<div id="riscon-lov-dialog" style="overflow:hidden; padding:0;"><iframe id="riscon-lov-iframe" name="riscon-lov-iframe" style="width:100%;height:100%;border:none;"></iframe></div>').appendTo('body');
                        }
                        
                        $('#riscon-lov-iframe').attr('src', url);
                        
                        $dialog.dialog({
                            modal: true,
                            title: "Vyhledávání",
                            width: 800,
                            height: 550,
                            close: function() {
                                $('#riscon-lov-iframe').attr('src', 'about:blank');
                            }
                        });
                    }

                    function closeDialog() {
                        let $ = window.apex ? window.apex.jQuery : window.jQuery;
                        if ($ && $('#riscon-lov-dialog').length) {
                            $('#riscon-lov-dialog').dialog('close');
                        }
                    }

                    // --- 1. JSME V HLAVNÍM OKNĚ: ZACHYTÁVÁNÍ POPUPŮ ---
                    if (window.self === window.top) {
                        const originalOpen = window.open;
                        window.open = function(url, name, features) {
                            if (url && (url.includes('wwv_flow.ajax') || url.includes('p_request=PLUGIN') || url.includes('f?p=110') || name === 'winLov' || name === 'PopupLov')) {
                                openInDialog(url);
                                return { focus: function(){}, close: closeDialog };
                            }
                            return originalOpen.apply(this, arguments);
                        };

                        if (window.apex && apex.navigation && apex.navigation.popup) {
                            const origApexPopup = apex.navigation.popup;
                            apex.navigation.popup = function(pOptions) {
                                if (pOptions && pOptions.url && (pOptions.url.includes('f?p=110') || pOptions.url.includes('wwv_flow.ajax'))) {
                                    openInDialog(pOptions.url);
                                    return { focus: function(){}, close: closeDialog };
                                }
                                return origApexPopup.apply(this, arguments);
                            };
                        }
                        
                        if (typeof window.popupURL === 'function') {
                            const origPopupURL = window.popupURL;
                            window.popupURL = function(url) {
                                if (url && url.includes('f?p=')) {
                                    openInDialog(url);
                                    return;
                                }
                                origPopupURL.apply(this, arguments);
                            };
                        }
                        
                        // Poskytneme funkci pro iframe, aby ji mohl zavolat
                        window.RS_PopupLov_closeDialog = closeDialog;
                    } 
                    // --- 2. JSME V IFRAME DIALOGU: ZAMEZENÍ ZALAMOVÁNÍ A RESIZE ---
                    else if (window.name === 'riscon-lov-iframe') {
                        // Úprava opener pro APEX návrat hodnoty
                        try {
                            Object.defineProperty(window, 'opener', {
                                get: function() { return window.parent; },
                                configurable: true
                            });
                        } catch(e) {
                            window.opener = window.parent;
                        }
                        
                        // Zavření okna přes rodiče
                        window.close = function() {
                            if (window.parent && typeof window.parent.RS_PopupLov_closeDialog === 'function') {
                                window.parent.RS_PopupLov_closeDialog();
                            }
                        };

                        // CSS
                        const style = document.createElement('style');
                        style.textContent = \`
                            body, .a-PopupLOV-results, .a-PopupLOV-dialog { white-space: nowrap !important; }
                            td, th, a, span { white-space: nowrap !important; }
                            table.t-Report-report { width: auto !important; max-width: none !important; }
                            .t-Report-report td, .t-Report-report th { white-space: nowrap !important; }
                        \`;
                        document.documentElement.appendChild(style);

                        // Resize logika
                        let resizeDialog = () => {
                            try {
                                let contentWidth = document.documentElement.scrollWidth;
                                if (contentWidth > 200 && window.parent && window.parent.apex && window.parent.apex.jQuery) {
                                    let $ = window.parent.apex.jQuery;
                                    let $dlg = $('#riscon-lov-dialog', window.parent.document);
                                    
                                    if ($dlg.length) {
                                        let targetWidth = contentWidth + 60; 
                                        let maxScreenWidth = $(window.parent).width() * 0.95;
                                        if (targetWidth > maxScreenWidth) targetWidth = maxScreenWidth;

                                        let currentWidth = $dlg.dialog("option", "width");
                                        if (targetWidth > currentWidth + 20) { 
                                            $dlg.dialog("option", "width", targetWidth);
                                            $dlg.dialog("option", "position", { my: "center", at: "center", of: window.parent });
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
