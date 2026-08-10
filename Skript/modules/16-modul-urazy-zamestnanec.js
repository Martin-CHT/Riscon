// ==UserScript==
// @name         Riscon: Detail a karta zaměstnance v úrazu
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.2.1
// @description  Přidá odkaz na detail a kartu zaměstnance přímo ze stránky Úraz.
// @author       Martin
// @copyright    2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/16-modul-urazy-zamestnanec.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/16-modul-urazy-zamestnanec.js
// @match        https://*/ords/*/f?p=110:6501:*
// @match        https://www.riscon.cz/go/f?p=110:6501:*
// @match        https://www.riscon.cz/go/f?p=110:6501*
// @match        https://*/ords/*/f?p=110:6501*
// @noframes
// @run-at       document-end
// @tag          Riscon
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    const CONTAINER_ID = 'cht-urazy-zamestnanec-links-container';
    const LINK_DETAIL_ID = 'cht-link-detail-zamestnanec';
    const LINK_KARTA_ID = 'cht-link-karta-zamestnanec';

    function getSessionInfo() {
        let appId = "110";
        let pageId = "6501";
        let sessionId = "";

        const urlParams = new URLSearchParams(window.location.search);
        const pParam = urlParams.get('p');
        if (pParam) {
            const pParts = pParam.split(':');
            if (pParts.length >= 1 && pParts[0]) appId = pParts[0];
            if (pParts.length >= 2 && pParts[1]) pageId = pParts[1];
            if (pParts.length >= 3 && pParts[2]) sessionId = pParts[2];
        }

        if (!sessionId) {
            const match = window.location.href.match(/f\?p=(\d+):(\d+):([^:&#]+)/);
            if (match) {
                appId = match[1] || appId;
                pageId = match[2] || pageId;
                sessionId = match[3];
            }
        }

        if (!sessionId && typeof window.$v === 'function') {
            try { sessionId = window.$v('pInstance') || ''; } catch (e) { }
        }

        if (!sessionId) {
            const pInst = document.getElementById('pInstance');
            if (pInst && pInst.value) sessionId = pInst.value;
        }

        if (!sessionId && window.apex && apex.env && apex.env.APP_SESSION) {
            sessionId = apex.env.APP_SESSION;
        }

        return { appId, pageId, sessionId };
    }

    function getEmployeeId(pageId) {
        let empId = "";

        // 1. Skryté pole (pro Popup LOV)
        const hiddenInput = document.getElementById(`P${pageId}_EMPLOYEE_ID_HIDDENVALUE`) ||
            document.getElementById('P6501_EMPLOYEE_ID_HIDDENVALUE');
        if (hiddenInput && hiddenInput.value && hiddenInput.value.trim() !== '') {
            empId = hiddenInput.value.trim();
        }

        // 2. APEX item API
        if (!empId && window.apex && apex.item) {
            try {
                const item = apex.item(`P${pageId}_EMPLOYEE_ID`) || apex.item('P6501_EMPLOYEE_ID');
                if (item) {
                    const val = item.getValue();
                    if (val && typeof val === 'string' && val.trim() !== '') {
                        empId = val.trim();
                    } else if (Array.isArray(val) && val.length > 0 && val[0]) {
                        empId = String(val[0]).trim();
                    }
                }
            } catch (e) { }
        }

        // 3. Viditelný input/select (pokud obsahuje přímo ID zaměstnance)
        if (!empId) {
            const regularInput = document.getElementById(`P${pageId}_EMPLOYEE_ID`) ||
                document.getElementById('P6501_EMPLOYEE_ID');
            if (regularInput && regularInput.value && regularInput.value.trim() !== '') {
                const val = regularInput.value.trim();
                if (/^\d+$/.test(val)) {
                    empId = val;
                }
            }
        }

        return empId;
    }

    RS.Modules.UrazyZamestnanec = {
        init: function () {
            // Kontrola stránky 6501
            const isUrazyPage = window.location.href.indexOf('6501') !== -1 ||
                !!document.getElementById('P6501_EMPLOYEE_ID') ||
                !!document.getElementById('P6501_EVENT_DESCRIPTION_DISPLAY');
            if (!isUrazyPage) return;

            const sessionInfo = getSessionInfo();
            const pageId = sessionInfo.pageId || "6501";
            const appId = sessionInfo.appId || "110";
            const sessionId = sessionInfo.sessionId || "";

            const visibleInput = document.getElementById(`P${pageId}_EMPLOYEE_ID`) ||
                document.getElementById('P6501_EMPLOYEE_ID');
            if (!visibleInput) return;

            const empId = getEmployeeId(pageId);

            // Najdeme nebo vytvoříme kontejner s odkazy
            let container = document.getElementById(CONTAINER_ID);
            let linkDetail = document.getElementById(LINK_DETAIL_ID);
            let linkKarta = document.getElementById(LINK_KARTA_ID);

            if (!container) {
                container = document.createElement('span');
                container.id = CONTAINER_ID;
                container.style.display = 'inline-flex';
                container.style.alignItems = 'center';
                container.style.gap = '15px';
                container.style.marginLeft = '15px';
                container.style.verticalAlign = 'middle';

                // Odkaz 1: Detail o zaměstnanci (Stránka 5101)
                linkDetail = document.createElement('a');
                linkDetail.id = LINK_DETAIL_ID;
                linkDetail.textContent = 'Detail o zaměstnanci';
                linkDetail.style.fontWeight = 'bold';
                linkDetail.style.color = '#0056b3';
                linkDetail.style.textDecoration = 'underline';
                linkDetail.target = '_blank';
                linkDetail.rel = 'noopener noreferrer';

                // Odkaz 2: Karta zaměstnance (Stránka 5105)
                linkKarta = document.createElement('a');
                linkKarta.id = LINK_KARTA_ID;
                linkKarta.textContent = 'Karta zaměstnance';
                linkKarta.style.fontWeight = 'bold';
                linkKarta.style.color = '#0056b3';
                linkKarta.style.textDecoration = 'underline';
                linkKarta.target = '_blank';
                linkKarta.rel = 'noopener noreferrer';

                container.appendChild(linkDetail);
                container.appendChild(linkKarta);

                // Připojení kontejneru za prvek
                const fieldset = visibleInput.closest('fieldset');
                if (fieldset && fieldset.parentNode) {
                    fieldset.parentNode.appendChild(container);
                } else if (visibleInput.parentNode) {
                    visibleInput.parentNode.appendChild(container);
                }

                // Události pro aktualizaci odkazů při změně výběru
                const handleUpdate = () => {
                    setTimeout(() => {
                        RS.Modules.UrazyZamestnanec.init();
                    }, 100);
                };

                visibleInput.addEventListener('change', handleUpdate);
                visibleInput.addEventListener('blur', handleUpdate);

                const hiddenInput = document.getElementById(`P${pageId}_EMPLOYEE_ID_HIDDENVALUE`) ||
                    document.getElementById('P6501_EMPLOYEE_ID_HIDDENVALUE');
                if (hiddenInput) {
                    hiddenInput.addEventListener('change', handleUpdate);
                }
            }

            // Aktualizace URL odkazů podle aktuálního empId a sessionId
            if (empId) {
                linkDetail.href = `f?p=${appId}:5101:${sessionId}::NO::P5101_ID:${empId}`;
                linkKarta.href = `f?p=${appId}:5105:${sessionId}::NO::P5105_ID:${empId}`;
                container.style.display = 'inline-flex';
            } else {
                // Pokud ještě není vybrán zaměstnanec, odkazy skryjeme
                container.style.display = 'none';
            }
        }
    };

    // APEX event listener pro případ přenačtení regionu
    if (window.apex && apex.jQuery) {
        apex.jQuery(document).on('apexafterrefresh', function () {
            setTimeout(() => RS.Modules.UrazyZamestnanec.init(), 200);
        });
    }

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => RS.Modules.UrazyZamestnanec.init());
        } else {
            setTimeout(() => RS.Modules.UrazyZamestnanec.init(), 300);
            setTimeout(() => RS.Modules.UrazyZamestnanec.init(), 1000);
        }
    }

})();
