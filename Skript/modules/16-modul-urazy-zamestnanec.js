// ==UserScript==
// @name         Riscon: Detail a karta zaměstnance v úrazu
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.2.0
// @description  Přidá odkaz na detail a kartu zaměstnance přímo ze stránky Úraz.
// @author       Martin
// @copyright    2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/16-modul-urazy-zamestnanec.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/16-modul-urazy-zamestnanec.js
// @match        https://*/ords/*/f?p=110:6501:*
// @match        https://www.riscon.cz/go/f?p=110:6501:*
// @noframes
// @run-at       document-end
// @tag          Riscon
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    RS.Modules.UrazyZamestnanec = {
        init: function () {
            // Spouštíme pouze na stránce 6501
            if (window.location.href.indexOf('f?p=110:6501:') === -1 && window.location.href.indexOf(':6501:') === -1) return;

            // 1. Získání parametrů z URL pro zjištění Session ID a Page ID
            const urlParams = new URLSearchParams(window.location.search);
            const pParam = urlParams.get('p');
            
            let appId = "110";
            let pageId = "6501";
            let sessionId = "";

            if (pParam) {
                const pParts = pParam.split(':');
                if (pParts.length >= 3) {
                    appId = pParts[0];
                    pageId = pParts[1];
                    sessionId = pParts[2];
                }
            } else if (window.$v && window.$v('pInstance')) {
                sessionId = window.$v('pInstance');
            } else if (document.getElementById('pInstance')) {
                sessionId = document.getElementById('pInstance').value;
            }

            if (!sessionId) {
                const match = window.location.href.match(/f\?p=(\d+):(\d+):([^:&#]+)/);
                if (match) {
                    appId = match[1];
                    pageId = match[2];
                    sessionId = match[3];
                }
            }

            // 2. Najdeme skryté pole s ID zaměstnance
            // Z HTML vyplývá, že zaměstnanec je výběrové pole (Popup LOV) s ID P6501_EMPLOYEE_ID
            // Skutečné ID zaměstnance je schované v inputu typu hidden: P6501_EMPLOYEE_ID_HIDDENVALUE
            let empId = "";
            
            const hiddenInputId = `P${pageId}_EMPLOYEE_ID_HIDDENVALUE`;
            const hiddenInput = document.getElementById(hiddenInputId);
            
            if (hiddenInput && hiddenInput.value) {
                empId = hiddenInput.value;
            } else if (window.apex && apex.item && apex.item(`P${pageId}_EMPLOYEE_ID`)) {
                try {
                    empId = apex.item(`P${pageId}_EMPLOYEE_ID`).getValue();
                } catch (e) {}
            }
            
            if (!empId) {
                // Fallback pro případ, že by to byl obyčejný select box / input
                const regularInputId = `P${pageId}_EMPLOYEE_ID`;
                const regularInput = document.getElementById(regularInputId);
                if (regularInput && regularInput.value) {
                    empId = regularInput.value;
                }
            }

            if (!empId) {
                console.warn("Tampermonkey (Riscon): Nepodařilo se najít ID zaměstnance na stránce.");
                return;
            }

            // 3. Najdeme viditelné pole pro umístění odkazů
            const visibleInputId = `P${pageId}_EMPLOYEE_ID`;
            const visibleInput = document.getElementById(visibleInputId);
            if (!visibleInput) return;

            // Zamezení vícenásobnému vložení
            if (document.getElementById('cht-link-detail-zamestnanec') || document.getElementById('cht-link-karta-zamestnanec')) {
                return;
            }

            // 4. Vytvoření odkazů
            // Odkaz 1: Detail o zaměstnanci (Stránka 5101)
            const linkDetail = document.createElement('a');
            linkDetail.id = 'cht-link-detail-zamestnanec';
            linkDetail.textContent = "Detail o zaměstnanci";
            linkDetail.style.marginLeft = "15px";
            linkDetail.style.fontWeight = "bold";
            linkDetail.style.color = "#0056b3";
            linkDetail.style.textDecoration = "underline";
            linkDetail.target = "_blank"; // Otevřít v nové záložce
            linkDetail.href = `f?p=${appId}:5101:${sessionId}::NO::P5101_ID:${empId}`;

            // Odkaz 2: Karta zaměstnance (Stránka 5105)
            const linkKarta = document.createElement('a');
            linkKarta.id = 'cht-link-karta-zamestnanec';
            linkKarta.textContent = "Karta zaměstnance";
            linkKarta.style.marginLeft = "15px";
            linkKarta.style.fontWeight = "bold";
            linkKarta.style.color = "#0056b3";
            linkKarta.style.textDecoration = "underline";
            linkKarta.target = "_blank"; // Otevřít v nové záložce
            linkKarta.href = `f?p=${appId}:5105:${sessionId}::NO::P5105_ID:${empId}`;

            // 5. Připojení odkazů za pole se zaměstnancem
            // Prvek je obalený ve fieldsetu v buňce tabulky (td)
            const fieldset = visibleInput.closest('fieldset');
            if (fieldset && fieldset.parentNode) {
                fieldset.parentNode.appendChild(linkDetail);
                fieldset.parentNode.appendChild(linkKarta);
            } else if (visibleInput.parentNode) {
                visibleInput.parentNode.appendChild(linkDetail);
                visibleInput.parentNode.appendChild(linkKarta);
            }
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => RS.Modules.UrazyZamestnanec.init());
        } else {
            setTimeout(() => RS.Modules.UrazyZamestnanec.init(), 500);
        }
    }

})();
