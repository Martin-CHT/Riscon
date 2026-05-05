// ==UserScript==
// @name         Riscon: Zvýraznění řádků
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.1
// @description  Zvýraznění řádků tabulky kliknutím. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/07-modul-radky.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/07-modul-radky.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    RS.Modules.Rows = {
        initialized: false,
        init: function () {
            const Config = RS.Config;
            if (Config && !Config.rowHighlight.enabled) {
                document.querySelectorAll('tr.cht-row-highlight').forEach(tr => tr.classList.remove('cht-row-highlight'));
                document.querySelectorAll('[id^="reset-"]').forEach(b => {
                    if (b.tagName === 'BUTTON' && b.textContent === 'Reset označení') b.remove();
                });
                return;
            }

            if (!this.initialized) {
                this.initialized = true;
                document.body.addEventListener('click', (e) => {
                    if (Config && !Config.rowHighlight.enabled) return;
                    const tr = e.target.closest('table.a-IRR-table tr, table.t-Report-report tr, table.u-Report-table tr');
                    if (!tr) return;
                    if (e.target.closest('a, button, input, select, textarea')) return;

                    const table = tr.closest('table');
                    if (!table) return;

                    const link = tr.querySelector('a[href*="_ID:"]');
                    let key = link ? link.href.match(/P\d+_ID:([^:&?]+)/)?.[1] : null;
                    if (!key) {
                        const idx = Array.from(table.rows).indexOf(tr);
                        key = 'row_' + idx + '_' + tr.innerText.trim().slice(0, 30);
                    }

                    const STORAGE_KEY = 'cht_apex_row_highlight_v2';
                    const pageKey = (document.getElementById('pFlowId')?.value || 'app') + ':' + (document.getElementById('pFlowStepId')?.value || 'page');
                    const regionEl = table.closest('.t-Region, .a-IRR-region, .u-Region, [id^="R"]');
                    const regionId = regionEl ? regionEl.id.split('_')[0] : 'default';
                    const regionKey = pageKey + '|' + regionId;

                    let store = JSON.parse(GM_getValue(STORAGE_KEY, '{}'));
                    let selected = store[regionKey] || [];

                    const idxArr = selected.indexOf(key);
                    if (idxArr > -1) { selected.splice(idxArr, 1); tr.classList.remove('cht-row-highlight'); }
                    else { selected.push(key); tr.classList.add('cht-row-highlight'); }

                    store[regionKey] = selected;
                    GM_setValue(STORAGE_KEY, JSON.stringify(store));
                    this.addResetButton(regionEl, regionKey);
                });
            }
            this.paintAll();
        },

        paintAll: function () {
            const Config = RS.Config;
            if (Config && !Config.rowHighlight.enabled) return;
            const STORAGE_KEY = 'cht_apex_row_highlight_v2';
            const pageKey = (document.getElementById('pFlowId')?.value || 'app') + ':' + (document.getElementById('pFlowStepId')?.value || 'page');
            let store = JSON.parse(GM_getValue(STORAGE_KEY, '{}'));

            document.querySelectorAll('table.a-IRR-table, table.t-Report-report, table.u-Report-table').forEach((table, i) => {
                const regionEl = table.closest('.t-Region, .a-IRR-region, .u-Region, [id^="R"]');
                const regionId = regionEl ? regionEl.id.split('_')[0] : ('tbl_' + i);
                const regionKey = pageKey + '|' + regionId;
                const selected = store[regionKey] || [];

                if (selected.length > 0) this.addResetButton(regionEl, regionKey);

                table.querySelectorAll('tr').forEach((tr, rIdx) => {
                    if (!tr.querySelector('td')) return;
                    const link = tr.querySelector('a[href*="_ID:"]');
                    let key = link ? link.href.match(/P\d+_ID:([^:&?]+)/)?.[1] : null;
                    if (!key) key = 'row_' + rIdx + '_' + tr.innerText.trim().slice(0, 30);
                    if (selected.includes(key)) {
                        if (!tr.classList.contains('cht-row-highlight')) tr.classList.add('cht-row-highlight');
                    } else {
                        if (tr.classList.contains('cht-row-highlight')) tr.classList.remove('cht-row-highlight');
                    }
                });
            });
        },

        addResetButton: function (regionEl, regionKey) {
            if (!regionEl) return;
            const header = regionEl.querySelector('.t-Region-headerItems, .a-IRR-controls, .rc-buttons');
            if (header && !document.getElementById('reset-' + regionKey)) {
                const rBtn = document.createElement('button');
                rBtn.type = 'button';
                rBtn.className = 't-Button t-Button--small t-Button--simple button-gray';
                rBtn.textContent = 'Reset označení';
                rBtn.style.marginLeft = '8px';
                rBtn.id = 'reset-' + regionKey;
                rBtn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const STORAGE_KEY = 'cht_apex_row_highlight_v2';
                    let store = JSON.parse(GM_getValue(STORAGE_KEY, '{}'));
                    store[regionKey] = [];
                    GM_setValue(STORAGE_KEY, JSON.stringify(store));
                    this.paintAll();
                    rBtn.remove();
                };
                header.appendChild(rBtn);
            }
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Rows.init());
        else RS.Modules.Rows.init();
    }

})();
