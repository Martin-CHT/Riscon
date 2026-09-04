// ==UserScript==
// @name         Riscon: Odkaz na Portál SÚIP
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.0
// @description  Zobrazí odkaz na Portál SÚIP pod kategorií úrazu, pokud je vybrána kategorie s pracovní neschopností.
// @author       Martin
// @copyright    2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/17-modul-suip-portal.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/17-modul-suip-portal.js
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

    const LINK_CONTAINER_ID = 'cht-suip-portal-container';
    const SUIP_URL = 'https://mpsv.gov.cz/app/suip-portal/';

    // ID kategorií, které obsahují „pracovní neschopností"
    const PN_CATEGORY_IDS = ['325', '326'];

    function shouldShowLink(categoryValue) {
        return PN_CATEGORY_IDS.includes(categoryValue);
    }

    function updateVisibility(selectEl) {
        let container = document.getElementById(LINK_CONTAINER_ID);

        if (shouldShowLink(selectEl.value)) {
            if (!container) {
                container = document.createElement('div');
                container.id = LINK_CONTAINER_ID;
                container.style.marginTop = '6px';
                container.style.marginBottom = '4px';

                const icon = document.createElement('span');
                icon.textContent = '🔗 ';
                icon.style.fontSize = '13px';

                const link = document.createElement('a');
                link.href = SUIP_URL;
                link.textContent = 'Portál SÚIP';
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.style.fontWeight = 'bold';
                link.style.color = '#0056b3';
                link.style.textDecoration = 'underline';
                link.style.fontSize = '13px';

                container.appendChild(icon);
                container.appendChild(link);

                // Vložíme pod select kategorií (za jeho rodičovský element)
                const parentCell = selectEl.closest('td') || selectEl.parentNode;
                if (parentCell) {
                    parentCell.appendChild(container);
                }
            }
            container.style.display = 'block';
        } else {
            if (container) {
                container.style.display = 'none';
            }
        }
    }

    RS.Modules.SuipPortal = {
        init: function () {
            // Kontrola stránky 6501
            const isUrazyPage = window.location.href.indexOf('6501') !== -1;
            if (!isUrazyPage) return;

            const selectEl = document.getElementById('P6501_CATEGORY_ID');
            if (!selectEl) return;

            // Zamezení vícenásobné inicializaci
            if (selectEl.dataset.suipListenerAttached) return;
            selectEl.dataset.suipListenerAttached = 'true';

            // Počáteční stav
            updateVisibility(selectEl);

            // Listener na změnu kategorie
            selectEl.addEventListener('change', function () {
                updateVisibility(selectEl);
            });
        }
    };

    // APEX event listener pro případ přenačtení regionu
    if (window.apex && apex.jQuery) {
        apex.jQuery(document).on('apexafterrefresh', function () {
            setTimeout(() => RS.Modules.SuipPortal.init(), 200);
        });
    }

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => RS.Modules.SuipPortal.init());
        } else {
            setTimeout(() => RS.Modules.SuipPortal.init(), 300);
            setTimeout(() => RS.Modules.SuipPortal.init(), 1000);
        }
    }

})();
