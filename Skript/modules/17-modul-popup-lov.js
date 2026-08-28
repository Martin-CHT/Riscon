// ==UserScript==
// @name         Riscon: Modul Popup LOV
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.1
// @description  Upravuje vyskakovací okna (Popup LOV), aby se text nezalamoval, okno se automaticky rozšířilo a chovalo se jako modální dialog.
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
            // Kontrola v rodičovském okně - odchytíme otevírání nových oken, abychom z nich udělali "modální"
            if (!window.opener && window.self === window.top) {
                this.interceptWindowOpen();
            }

            // Kontrola, zda jsme přímo ve vyskakovacím okně (Popup LOV)
            if (window.opener && window.location.href.includes('wwv_flow.ajax')) {
                this.adjustPopup();
            }
        },

        interceptWindowOpen: function () {
            const originalOpen = window.open;
            window.open = function(url, name, features) {
                // Zavoláme původní funkci pro otevření okna
                const popupWin = originalOpen.apply(this, arguments);
                
                // Pokud je to pravděpodobně LOV popup, přidáme modální chování (aby nešlo překliknout do pozadí)
                if (url && (url.includes('wwv_flow.ajax') || url.includes('p_request=PLUGIN')) && popupWin) {
                    RS.Modules.PopupLov.makeModal(popupWin);
                }
                return popupWin;
            };
        },
        
        makeModal: function(popupWin) {
            // Vytvoříme ztmavené překrytí přes celé rodičovské okno (aby na něj nešlo klikat)
            let overlay = document.getElementById('riscon-modal-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'riscon-modal-overlay';
                overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.4); z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center;';
                
                // Po kliknutí na overlay se zaměří vyskakovací okno, čímž se vrátí zpět do popředí
                overlay.addEventListener('click', () => {
                    if (popupWin && !popupWin.closed) {
                        popupWin.focus();
                    }
                });
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
            
            // Pravidelně kontrolujeme, zda bylo vyskakovací okno zavřeno
            const checkInterval = setInterval(() => {
                if (!popupWin || popupWin.closed) {
                    clearInterval(checkInterval);
                    overlay.style.display = 'none';
                }
            }, 500);
        },

        adjustPopup: function () {
            // Přidání CSS pro zamezení zalamování textu ve všech tabulkách a odkazech v popupu
            const style = document.createElement('style');
            style.textContent = `
                body, .a-PopupLOV-results, .a-PopupLOV-dialog { white-space: nowrap !important; }
                td, th, a, span { white-space: nowrap !important; }
                table.t-Report-report { width: auto !important; }
            `;
            document.head.appendChild(style);

            // Úprava velikosti okna po vykreslení obsahu
            let resizeAttempts = 0;
            const maxAttempts = 15;
            
            const attemptResize = () => {
                resizeAttempts++;
                try {
                    // Najdeme skutečnou šířku obsahu dokumentu. Zvýšíme rezervu na 150px
                    let contentWidth = document.documentElement.scrollWidth;
                    
                    if (contentWidth < 200 && resizeAttempts < maxAttempts) {
                        setTimeout(attemptResize, 200);
                        return;
                    }

                    // Větší rezerva (150px), aby se okno roztáhlo více, než je samotný obsah
                    let targetWidth = contentWidth + 150;
                    
                    // Omezíme maximální šířku okna podle obrazovky
                    let maxScreenWidth = window.screen.availWidth ? (window.screen.availWidth * 0.95) : 1200;
                    if (targetWidth > maxScreenWidth) {
                        targetWidth = maxScreenWidth;
                    }

                    // Zvětšíme okno
                    if (window.outerWidth < targetWidth) {
                        window.resizeTo(targetWidth, window.outerHeight);
                    }
                    
                    if (resizeAttempts < maxAttempts) {
                        setTimeout(attemptResize, 200);
                    }
                } catch (e) {
                    console.error("Riscon: Chyba při změně velikosti popup okna", e);
                }
            };
            
            setTimeout(attemptResize, 100);
        }
    };
})();
