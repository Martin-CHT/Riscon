// ==UserScript==
// @name         Riscon: Zvýraznění záložek
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.0
// @description  Zvýraznění oblíbených záložek (RDS) v postranním panelu. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/08-modul-zalozky.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/08-modul-zalozky.js
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

    RS.Modules.Tabs = {
        containerId: 'cht_rds_region',
        toggle: function (enabled) {
            const c = document.getElementById(this.containerId);
            if (c) c.style.display = enabled ? '' : 'none';
            if (enabled && !c) this.init();
            if (!enabled) {
                document.querySelectorAll('.apex-rds-item.cht-rds-highlight').forEach(li => {
                    li.classList.remove('cht-rds-highlight');
                    const s = li.querySelector('span');
                    if (s) s.textContent = s.textContent.replace(/^★\s*/, '');
                });
            } else if (c) {
                this.reapply();
            }
        },
        reapply: function () {
            const tabsUl = document.querySelector('.apex-rds');
            if (!tabsUl) return;
            const STORAGE_KEY = 'cht_apex_rds_favs';
            const pageKey = (document.getElementById('pFlowId')?.value || 'app') + ':' + (document.getElementById('pFlowStepId')?.value || 'page');
            let store = {};
            try { store = JSON.parse(GM_getValue(STORAGE_KEY, '{}')); } catch (e) { }
            const selected = store[pageKey] || [];
            const lis = Array.from(tabsUl.querySelectorAll('li.apex-rds-item'));
            const map = lis.map((li, i) => ({ li, key: li.id || li.querySelector('a')?.href || 'idx_' + i, label: li.textContent.replace('★', '').trim() }));
            this.colorTabs(map, selected);
        },
        init: function () {
            const Config = RS.Config;
            if (Config && !Config.tabHighlight.enabled) return;
            if (document.getElementById(this.containerId)) return;

            const tabsUl = document.querySelector('.apex-rds');
            const sidebar = document.querySelector('td.tbl-sidebar');
            if (!tabsUl || !sidebar) return;

            const STORAGE_KEY = 'cht_apex_rds_favs';
            const pageKey = (document.getElementById('pFlowId')?.value || 'app') + ':' + (document.getElementById('pFlowStepId')?.value || 'page');
            let store = JSON.parse(GM_getValue(STORAGE_KEY, '{}'));
            let selected = store[pageKey] || [];

            const lis = Array.from(tabsUl.querySelectorAll('li.apex-rds-item'));
            const map = lis.map((li, i) => ({ li, key: li.id || li.querySelector('a')?.href || 'idx_' + i, label: li.textContent.replace('★', '').trim() }));

            this.colorTabs(map, selected);

            const container = document.createElement('div');
            container.id = this.containerId;
            Object.assign(container.style, { marginBottom: '10px', border: '1px solid #ccc', background: '#fff', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' });

            container.innerHTML = `
                <div style="padding: 8px 10px; background: #f2f2f2; border-bottom: 1px solid #ccc; font-size: 12px; font-weight: bold; color: #333;">Zvýraznění záložek</div>
                <div style="padding: 5px;">
                    <div style="font-size:11px; font-family:Tahoma,Arial,sans-serif;">
                        <label style="display:block; margin-bottom:4px; color:#444;">Výběr (Ctrl+klik):</label>
                        <select multiple size="8" style="width:100%; border:1px solid #ddd;"></select>
                    </div>
                </div>`;

            const sel = container.querySelector('select');
            map.forEach(m => sel.add(new Option(m.label, m.key, false, selected.includes(m.key))));

            sel.onchange = () => {
                selected = Array.from(sel.selectedOptions).map(o => o.value);
                store[pageKey] = selected;
                GM_setValue(STORAGE_KEY, JSON.stringify(store));
                this.colorTabs(map, selected);
            };

            sidebar.insertBefore(container, sidebar.firstChild);
        },
        colorTabs: function (map, selected) {
            map.forEach(m => {
                const is = selected.includes(m.key);
                m.li.classList.toggle('cht-rds-highlight', is);
                const s = m.li.querySelector('span');
                if (s) {
                    const txt = s.textContent.replace(/^★\s*/, '');
                    s.textContent = (is ? '★ ' : '') + txt;
                }
            });
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Tabs.init());
        else RS.Modules.Tabs.init();
    }

})();
