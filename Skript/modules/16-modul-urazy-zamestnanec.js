// ==UserScript==
// @name         Riscon: Detail zaměstnance v úrazu
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.1.0
// @description  Přidá odkaz na detail zaměstnance přímo ze stránky Úraz.
// @author       Martin
// @copyright    2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/16-modul-urazy-zamestnanec.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/16-modul-urazy-zamestnanec.js
// @match        https://www.riscon.cz/go/f?p=110:6501:
// @noframes
// @run-at       document-end
// @tag          Riscon
// ==/UserScript==

(function() {
    'use strict';

    // 1. Získání parametrů z URL pro zjištění Session ID a Page ID
    const urlParams = new URLSearchParams(window.location.search);
    const pParam = urlParams.get('p');
    if (!pParam) return;
    
    const pParts = pParam.split(':');
    if (pParts.length < 3) return;
    
    const appId = pParts[0]; // 110
    const pageId = pParts[1]; // 6501
    const sessionId = pParts[2];

    // 2. Najdeme skryté pole s ID zaměstnance
    // Z HTML vyplývá, že zaměstnanec je výběrové pole (Popup LOV) s ID P6501_EMPLOYEE_ID
    // Skutečné ID zaměstnance je ale schované v inputu typu hidden: P6501_EMPLOYEE_ID_HIDDENVALUE
    // Díky tomu vůbec nemusíme prohledávat Přehled zaměstnanců!
    let empId = "";
    
    const hiddenInputId = `P${pageId}_EMPLOYEE_ID_HIDDENVALUE`;
    let hiddenInput = document.getElementById(hiddenInputId);
    
    if (hiddenInput && hiddenInput.value) {
        empId = hiddenInput.value;
    } else {
        // Fallback pro případ, že by to byl obyčejný select box
        const regularInputId = `P${pageId}_EMPLOYEE_ID`;
        const regularInput = document.getElementById(regularInputId);
        if (regularInput && regularInput.tagName.toLowerCase() === 'select') {
            empId = regularInput.value;
        }
    }

    if (!empId) {
        console.warn("Tampermonkey (Riscon): Nepodařilo se najít ID zaměstnance na stránce.");
        return;
    }

    // 3. Najdeme viditelné pole pro umístění odkazu
    const visibleInputId = `P${pageId}_EMPLOYEE_ID`;
    const visibleInput = document.getElementById(visibleInputId);
    
    if (!visibleInput) return;

    // 4. Vytvoření odkazu
    const link = document.createElement('a');
    link.textContent = "Detail o zaměstnanci";
    link.style.marginLeft = "15px";
    link.style.fontWeight = "bold";
    link.style.color = "#0056b3";
    link.style.textDecoration = "underline";
    link.target = "_blank"; // Otevřít v nové záložce
    
    // Cílová URL pro Údaje o zaměstnanci (Stránka 5101)
    link.href = `f?p=110:5101:${sessionId}::NO::P5101_ID:${empId}`;

    // 5. Připojení odkazu za pole se zaměstnancem
    // Prvek je obalený ve fieldsetu v buňce tabulky (td)
    const fieldset = visibleInput.closest('fieldset');
    if (fieldset && fieldset.parentNode) {
        fieldset.parentNode.appendChild(link);
    } else if (visibleInput.parentNode) {
        visibleInput.parentNode.appendChild(link);
    }

})();
