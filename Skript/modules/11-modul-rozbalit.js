// ==UserScript==
// @name         Riscon: Rozbalit tabulky
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.2
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
            const toUnroll = [];
            
            const links = document.querySelectorAll('a[href*="apex.widget.report.paginate"]');
            
            links.forEach(link => {
                const match = link.href.match(/paginate\('([^']+)',\s*\{(.*?)\}/);
                if (match) {
                    const reportId = match[1];
                    const paramsStr = match[2];
                    const maxMatch = paramsStr.match(/max:\s*(\d+)/);
                    
                    if (maxMatch) {
                        const currentMax = parseInt(maxMatch[1], 10);
                        if (currentMax < 10000 && !this.currentlyUnrolling.has(reportId)) {
                            toUnroll.push({ id: reportId, link: link });
                        }
                    }
                }
            });

            if (toUnroll.length > 0) {
                console.log(`Riscon Unroll: Nalezeno ${toUnroll.length} reportů k rozbalení.`);
            }

            toUnroll.forEach(item => {
                if (this.currentlyUnrolling.has(item.id)) return;
                
                this.currentlyUnrolling.add(item.id);
                console.log(`Riscon Unroll: Automaticky rozbaluji report ${item.id}`);
                
                try {
                    // Přečteme původní odkaz a upravíme parametry na max=10000 a min=1
                    const oldHref = item.link.getAttribute('href');
                    const newHref = oldHref.replace(/min:\s*\d+/, 'min:1').replace(/max:\s*\d+/, 'max:10000');
                    
                    // Bezpečně spustíme javascript v kontextu stránky
                    const code = newHref.replace(/^javascript:/i, '');
                    const script = document.createElement('script');
                    script.textContent = code;
                    document.body.appendChild(script);
                    script.remove();
                } catch (err) {
                    console.error("Riscon Unroll Chyba:", err);
                }
                
                // Uvolníme zámek po delší době
                setTimeout(() => {
                    this.currentlyUnrolling.delete(item.id);
                }, 3000);
            });
        }
    };

    if (!RS.Config) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Unroll.init());
        else RS.Modules.Unroll.init();
    }
})();
