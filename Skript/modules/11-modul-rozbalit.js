// ==UserScript==
// @name         Riscon: Rozbalit tabulky
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.1
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
        currentlyUnrolling: new Set(),

        init: function () {
            if (this.initialized) return;
            this.initialized = true;

            this.autoUnroll();

            // Sledujeme refresh reportu (když se tabulka překreslí, znovu zkusíme rozbalit, 
            // pokud by se z nějakého důvodu vrátilo stránkování)
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.apex && unsafeWindow.apex.jQuery) {
                unsafeWindow.apex.jQuery(document).on('apexafterrefresh', () => this.autoUnroll());
            } else if (window.apex && window.apex.jQuery) {
                window.apex.jQuery(document).on('apexafterrefresh', () => this.autoUnroll());
            } else {
                const mo = new MutationObserver(() => this.autoUnroll());
                mo.observe(document.body, { childList: true, subtree: true });
            }
        },

        autoUnroll: function() {
            const toUnroll = new Set();
            
            // Najdeme všechny odkazy na stránkování
            document.querySelectorAll('a[href*="apex.widget.report.paginate"]').forEach(link => {
                const match = link.href.match(/paginate\('([^']+)',\s*\{(.*?)\}/);
                if (match) {
                    const reportId = match[1];
                    const paramsStr = match[2];
                    const maxMatch = paramsStr.match(/max:\s*(\d+)/);
                    
                    if (maxMatch) {
                        const currentMax = parseInt(maxMatch[1], 10);
                        // Pokud je nastaveno méně než 10 000 řádků, chceme report rozbalit
                        if (currentMax < 10000) {
                            toUnroll.add(reportId);
                        }
                    }
                }
            });

            toUnroll.forEach(reportId => {
                // Abychom nespustili rozbalení 5x za sebou (pokud je na stránce 5 odkazů na stránkování)
                if (this.currentlyUnrolling.has(reportId)) return;
                
                this.currentlyUnrolling.add(reportId);
                console.log(`Riscon Unroll: Automaticky rozbaluji report ${reportId}`);
                
                try {
                    // Volání APEX API přímo v kontextu stránky
                    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.apex && unsafeWindow.apex.widget && unsafeWindow.apex.widget.report) {
                        unsafeWindow.apex.widget.report.paginate(reportId, {min: 1, max: 10000});
                    } else if (window.apex && window.apex.widget && window.apex.widget.report) {
                        window.apex.widget.report.paginate(reportId, {min: 1, max: 10000});
                    } else {
                        // Fallback pomocí injectnutí script tagu
                        const code = `if (apex && apex.widget && apex.widget.report) apex.widget.report.paginate('${reportId}', {min: 1, max: 10000});`;
                        const script = document.createElement('script');
                        script.textContent = code;
                        document.body.appendChild(script);
                        script.remove();
                    }
                } catch (err) {
                    console.error("Riscon Unroll Chyba:", err);
                }
                
                // Uvolníme zámek pro další případný budoucí refresh
                setTimeout(() => {
                    this.currentlyUnrolling.delete(reportId);
                }, 2000);
            });
        }
    };

    if (!RS.Config) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Unroll.init());
        else RS.Modules.Unroll.init();
    }
})();
