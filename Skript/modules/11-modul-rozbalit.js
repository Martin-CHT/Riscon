// ==UserScript==
// @name         Riscon: Rozbalit tabulky
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.0
// @description  Přidává možnost rozbalit všechny stránky APEX reportu na jednu stranu. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/11-modul-rozbalit.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/11-modul-rozbalit.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    RS.Modules.Unroll = {
        initialized: false,
        init: function () {
            if (this.initialized) return;
            this.initialized = true;

            this.addUnrollButtons();

            // APEX po každém AJAX refresh reportu překreslí DOM (včetně stránkování).
            // Musíme tedy tlačítko přidávat znovu po každém refresh.
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.apex && unsafeWindow.apex.jQuery) {
                unsafeWindow.apex.jQuery(document).on('apexafterrefresh', () => this.addUnrollButtons());
            } else if (window.apex && window.apex.jQuery) {
                window.apex.jQuery(document).on('apexafterrefresh', () => this.addUnrollButtons());
            } else {
                // Fallback, pokud není jQuery událost k dispozici (např. sandbox problémy)
                const mo = new MutationObserver(() => this.addUnrollButtons());
                mo.observe(document.body, { childList: true, subtree: true });
            }
        },

        addUnrollButtons: function() {
            // Najde všechny "Další" nebo "Next" odkazy u reportů
            document.querySelectorAll('a.pagination[href*="apex.widget.report.paginate"]').forEach(link => {
                // Přidáváme tlačítko jen pokud tam ještě není
                if (link.parentNode.querySelector('.cht-unroll-btn')) return;
                
                // Můžeme se omezit pouze na prvky obsahující slovo "Další" nebo šipku, aby se tlačítko necpalo ke každému číslu stránky
                if (!link.textContent.includes('Další') && !link.innerHTML.includes('paginate_next')) return;

                // Odchytíme ID reportu (první parametr paginate funkce)
                const match = link.href.match(/paginate\('([^']+)'/);
                if (match) {
                    const reportId = match[1];

                    const btn = document.createElement('a');
                    btn.href = '#';
                    btn.className = 'pagination cht-unroll-btn';
                    btn.style.marginLeft = '12px';
                    btn.style.fontWeight = 'bold';
                    btn.style.color = '#e45c00';
                    btn.style.textDecoration = 'none';
                    btn.innerHTML = 'Rozbalit vše ▼';

                    // Voláme interní APEX funkci, změníme 'max' počet řádků na 10000.
                    // Požadavek na max > než povolený maximum v DB se obvykle ořízne na DB limit (což je žádoucí),
                    // ale tabulka se "rozbalí" na maximální počet položek.
                    btn.setAttribute('onclick', `apex.widget.report.paginate('${reportId}', {min: 1, max: 10000}); return false;`);

                    // Vložíme tlačítko hned za odkaz
                    link.parentNode.insertBefore(btn, link.nextSibling);
                }
            });
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Unroll.init());
        else RS.Modules.Unroll.init();
    }
})();
