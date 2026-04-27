// ==UserScript==
// @name         Riscon: Styly (globální CSS)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.0
// @description  Globální CSS styly pro Riscon Suite. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @source       https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/01-styles.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;

    RS.Styles = {
        inject: function () {
            GM_addStyle(`
                @media print {
                    #riscon-settings-trigger, #riscon-suite-settings, #apex-json-btnwrap,
                    #apex-json-panel, .ajp-btn, #riscon-eff-legend-sidebar, #sleek-toggle
                    { display: none !important; visibility: hidden !important; opacity: 0 !important; }
                }
                /* Styl pro zvýrazněný řádek */
                tr.cht-row-highlight > td { background-color: #ffd95e !important; }
                /* Styl pro zvýrazněnou záložku */
                .apex-rds-item.cht-rds-highlight > a { background-color: #ffd95e !important; color: #000 !important; font-weight: bold; }

                /* --- Postranní panel (Flexbox layout) --- */
                body.riscon-sidebar-enabled table.tbl-body,
                body.riscon-sidebar-enabled table.tbl-body > tbody {
                    display: block !important; width: 100% !important; max-width: 100vw !important;
                    box-sizing: border-box; margin: 0; padding: 0; overflow-x: hidden;
                }
                body.riscon-sidebar-enabled table.tbl-body > tbody > tr {
                    display: flex !important; flex-wrap: nowrap; width: 100% !important; box-sizing: border-box;
                }
                body.riscon-sidebar-enabled td.tbl-main {
                    display: block !important; flex: 1 1 auto; min-width: 0; padding-right: 15px;
                }
                body.riscon-sidebar-enabled .a-IRR-tableContainer { overflow-x: auto !important; width: 100%; display: block; }
                body.riscon-sidebar-enabled .a-IRR-table { width: 100% !important; min-width: 800px; }
                body.riscon-sidebar-enabled td.tbl-sidebar {
                    display: block !important; flex: 0 0 200px; width: 200px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; opacity: 1;
                }
                body.riscon-sidebar-enabled.sidebar-collapsed td.tbl-sidebar {
                    flex: 0 0 0px; width: 0px; opacity: 0; padding: 0 !important; margin: 0 !important; border: none !important;
                }
                /* NENÁPADNÉ TLAČÍTKO PRO SIDEBAR */
                #sleek-toggle {
                    position: fixed; top: 50%; right: 0; transform: translateY(-50%); width: 14px; height: 50px;
                    background-color: #f8f9fa; border: 1px solid #c8c8c8; border-right: none; border-radius: 4px 0 0 4px;
                    box-shadow: -1px 1px 4px rgba(0,0,0,0.06); z-index: 9999; cursor: pointer; display: flex;
                    align-items: center; justify-content: center; color: #777; font-size: 20px; line-height: 1;
                    transition: background-color 0.2s, color 0.2s, width 0.2s; user-select: none;
                }
                #sleek-toggle:hover { background-color: #e2e6e9; color: #004C66; width: 18px; }
                #sleek-toggle span { display: inline-block; transition: transform 0.3s ease; }
                body.sidebar-collapsed #sleek-toggle span { transform: rotate(180deg); }

                /* --- Dokumentace Checklist Styly --- */
                tr.shadow-row-missing td { background-color: #ffcccc !important; }
                tr.shadow-row-manual td { background-color: #f5f5f5 !important; }
            `);
        }
    };

    // Při samostatném spuštění (bez main skriptu) injektujeme styly okamžitě
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => RS.Styles.inject());
    } else {
        RS.Styles.inject();
    }

})();
