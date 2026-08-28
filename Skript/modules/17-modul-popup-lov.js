// ==UserScript==
// @name         Riscon: Modul Popup LOV
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.0
// @description  Upravuje vyskakovací okna (Popup LOV), aby se text nezalamoval a okno se automaticky rozšířilo na celou délku řádku.
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
            // Kontrola, zda jsme ve vyskakovacím okně (Popup LOV)
            // wwv_flow.ajax s p_request=PLUGIN se typicky používá pro tyto vyhledávací dialogy
            if (window.opener && window.location.href.includes('wwv_flow.ajax')) {
                this.adjustPopup();
            }
        },

        adjustPopup: function () {
            // Přidání CSS pro zamezení zalamování textu ve všech tabulkách a odkazech v popupu
            const style = document.createElement('style');
            style.textContent = `
                body, .a-PopupLOV-results, .a-PopupLOV-dialog { white-space: nowrap !important; }
                td, th, a, span { white-space: nowrap !important; }
            `;
            document.head.appendChild(style);

            // Úprava velikosti okna po vykreslení obsahu
            // Použijeme interval pro případ, že se obsah načítá dynamicky (AJAX uvnitř popupu)
            let resizeAttempts = 0;
            const maxAttempts = 10; // Zkusíme 10x po 200ms (celkem 2 sekundy)
            
            const attemptResize = () => {
                resizeAttempts++;
                try {
                    // Najdeme skutečnou šířku obsahu dokumentu
                    let contentWidth = document.documentElement.scrollWidth;
                    
                    // Pokud je šířka podezřele malá a ještě jsme nevyčerpali pokusy, zkusíme to znovu
                    if (contentWidth < 200 && resizeAttempts < maxAttempts) {
                        setTimeout(attemptResize, 200);
                        return;
                    }

                    // Přidáme rezervu pro okraje a případný vertikální scrollbar
                    let targetWidth = contentWidth + 60;
                    
                    // Omezíme maximální šířku okna podle velikosti obrazovky
                    let maxScreenWidth = window.screen.availWidth ? (window.screen.availWidth * 0.9) : 1200;
                    if (targetWidth > maxScreenWidth) {
                        targetWidth = maxScreenWidth;
                    }

                    // Zvětšíme okno, pokud je současné menší
                    if (window.outerWidth < targetWidth) {
                        window.resizeTo(targetWidth, window.outerHeight);
                    }
                    
                    // Pokud ještě zbývají pokusy (např. pro případ, že by se vyhledávání updatovalo)
                    if (resizeAttempts < maxAttempts) {
                        setTimeout(attemptResize, 200);
                    }
                } catch (e) {
                    console.error("Riscon: Chyba při změně velikosti popup okna", e);
                }
            };
            
            // Spustíme první pokus
            setTimeout(attemptResize, 100);
        }
    };
})();
