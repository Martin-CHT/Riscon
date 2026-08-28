// ==UserScript==
// @name         Riscon: Modul Popup LOV
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.4
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
            // Jsme v hlavním okně (rodič)
            if (window.self === window.top) {
                this.interceptWindowOpen();
            } 
            // Jsme uvnitř našeho vnořeného iframe dialogu
            else if (window.self !== window.top && window.name === 'riscon-lov-iframe') {
                this.setupIframePopup();
            }
        },

        interceptWindowOpen: function () {
            const originalOpen = window.open;
            window.open = function(url, name, features) {
                // Pokud APEX žádá o otevření vyhledávacího okna, zachytíme to
                if (url && (url.includes('wwv_flow.ajax') || url.includes('p_request=PLUGIN') || url.includes('f?p=110') || name === 'winLov' || name === 'PopupLov')) {
                    RS.Modules.PopupLov.openInDialog(url);
                    // Vrátíme falešný window objekt, kdyby na něj APEX volal např. .focus()
                    return { focus: function(){}, close: function(){ RS.Modules.PopupLov.closeDialog(); } };
                }
                // Pro ostatní případy zachováme původní chování
                return originalOpen.apply(this, arguments);
            };
        },

        openInDialog: function (url) {
            let $ = window.apex ? window.apex.jQuery : window.jQuery;
            if (!$) {
                console.error("Riscon: jQuery není k dispozici pro vytvoření dialogu.");
                return;
            }
            
            // Připravíme si jQuery UI Dialog kontejner
            let $dialog = $('#riscon-lov-dialog');
            if ($dialog.length === 0) {
                $dialog = $('<div id="riscon-lov-dialog" style="overflow:hidden; padding:0;"><iframe id="riscon-lov-iframe" name="riscon-lov-iframe" style="width:100%;height:100%;border:none;"></iframe></div>').appendTo('body');
            }
            
            // Nastavíme URL do iframe
            $('#riscon-lov-iframe').attr('src', url);
            
            // Otevřeme jako modální okno (vnořené)
            $dialog.dialog({
                modal: true,
                title: "Vyhledávání",
                width: 800,
                height: 550,
                close: function() {
                    $('#riscon-lov-iframe').attr('src', 'about:blank');
                }
            });
        },

        closeDialog: function () {
            let $ = window.apex ? window.apex.jQuery : window.jQuery;
            if ($ && $('#riscon-lov-dialog').length) {
                $('#riscon-lov-dialog').dialog('close');
            }
        },

        setupIframePopup: function () {
            // Vložíme do iframe skript, který APEXu podstrčí window.opener a window.close
            // APEX totiž potřebuje zapsat vybranou hodnotu do rodiče (window.opener)
            const script = document.createElement('script');
            script.textContent = `
                try {
                    Object.defineProperty(window, 'opener', {
                        get: function() { return window.parent; },
                        configurable: true
                    });
                } catch(e) {
                    window.opener = window.parent;
                }
                
                window.close = function() {
                    if (window.parent && window.parent.RS && window.parent.RS.Modules.PopupLov) {
                        window.parent.RS.Modules.PopupLov.closeDialog();
                    }
                };
            `;
            document.documentElement.appendChild(script);

            // Vložíme CSS pro zákaz zalamování textů
            const style = document.createElement('style');
            style.textContent = `
                body, .a-PopupLOV-results, .a-PopupLOV-dialog { white-space: nowrap !important; }
                td, th, a, span { white-space: nowrap !important; }
                table.t-Report-report { width: auto !important; max-width: none !important; }
                .t-Report-report td, .t-Report-report th { white-space: nowrap !important; }
            `;
            document.documentElement.appendChild(style);

            // Dynamické rozšíření dialogu podle obsahu s hlídáním přes MutationObserver
            let resizeDialog = () => {
                try {
                    let contentWidth = document.documentElement.scrollWidth;
                    // Pokud je co rozšiřovat a můžeme komunikovat s rodičem
                    if (contentWidth > 200 && window.parent && window.parent.apex && window.parent.apex.jQuery) {
                        let $ = window.parent.apex.jQuery;
                        let $dlg = $('#riscon-lov-dialog');
                        
                        if ($dlg.length) {
                            // Přidáme jen malou rezervu na scrollbar (60px), iframe okraje nepotřebuje
                            let targetWidth = contentWidth + 60; 
                            
                            // Nesmíme přesáhnout velikost okna rodiče
                            let maxScreenWidth = $(window.parent).width() * 0.95;
                            if (targetWidth > maxScreenWidth) {
                                targetWidth = maxScreenWidth;
                            }

                            // Pokud je obsah širší než výchozích 800px, rozšíříme dialog a vycentrujeme jej
                            let currentWidth = $dlg.dialog("option", "width");
                            if (targetWidth > currentWidth + 20) { // Změníme jen pokud je rozdíl znatelný
                                $dlg.dialog("option", "width", targetWidth);
                                $dlg.dialog("option", "position", { my: "center", at: "center", of: window.parent });
                            }
                        }
                    }
                } catch (e) {
                    console.error("Riscon: Chyba při změně velikosti iframe dialogu", e);
                }
            };

            // Zavoláme hned a navážeme na změny v DOM (kdyby se tabulka načetla AJAXem)
            setTimeout(resizeDialog, 250);
            setTimeout(resizeDialog, 1000);
            
            // Sledovat změny a přizpůsobit se, pokud se tabulka zvětší
            const observer = new MutationObserver(() => {
                resizeDialog();
            });
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true, characterData: true });
            } else {
                document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true, characterData: true }));
            }
        }
    };
})();
