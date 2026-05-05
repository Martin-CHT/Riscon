// ==UserScript==
// @name         Riscon: Skrývání položek (Seznamy)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.3
// @description  Skrývání položek v shuttle listboxech s podporou profilů. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/06-modul-seznamy.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/06-modul-seznamy.js
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

    RS.Modules.Lists = {
        containerId: 'cht-hidden-lists-container',
        minSelectWidth: 320,
        minCompressedWidth: 160,
        selectTextPadding: 52,
        minMeasuredCharWidth: 6.2,
        viewportPadding: 16,
        measureCanvas: null,
        toggle: function (enabled) {
            const el = document.getElementById(this.containerId);
            if (enabled) {
                this.init();
                if (el) { el.style.display = ''; this.reapply(); this.resizeExisting(); }
            } else {
                if (el) el.style.display = 'none';
                this.restoreAllOptions();
            }
        },
        restoreAllOptions: function () {
            const leftSel = document.querySelector('select[id$="_LEFT"]');
            if (!leftSel) return;
            Array.from(leftSel.options).forEach(o => { o.style.display = ''; o.disabled = false; });
            this.resizeExisting();
        },
        reapply: function () {
            const leftSel = document.querySelector('select[id$="_LEFT"]');
            if (!leftSel) return;
            const STORAGE_KEY = 'cht_apex_hidden_workplaces_profiles';
            const pFlow = document.getElementById('pFlowId')?.value || '0';
            const pStep = document.getElementById('pFlowStepId')?.value || '0';
            const pageKey = `${pFlow}:${pStep}`;
            let storeAll = {};
            try { storeAll = JSON.parse(GM_getValue(STORAGE_KEY, '{}')); } catch (e) { }
            const pageData = storeAll[pageKey];
            if (!pageData || !pageData.profiles) return;
            const hidden = new Set(pageData.profiles[pageData.activeProfile] || []);
            Array.from(leftSel.options).forEach(o => {
                const h = hidden.has(o.value);
                o.style.display = h ? 'none' : '';
                o.disabled = h;
            });
            this.resizeExisting();
        },
        resizeExisting: function () {
            const leftSel = document.querySelector('select[id$="_LEFT"]');
            if (!leftSel) return;

            const shuttleTable = leftSel.closest('table');
            if (!shuttleTable) return;

            this.fitShuttleWidths({
                shuttleTable: shuttleTable,
                selects: [
                    leftSel,
                    shuttleTable.querySelector('select[id$="_RIGHT"]'),
                    document.querySelector('#' + this.containerId + ' select[multiple]')
                ].filter(Boolean)
            });
        },
        fitShuttleWidths: function ({ shuttleTable, selects }) {
            if (!shuttleTable || !selects || selects.length === 0) return;

            const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 1024;
            const tableLeft = Math.max(0, shuttleTable.getBoundingClientRect().left);
            const availableWidth = Math.max(
                this.minCompressedWidth * selects.length,
                viewportWidth - tableLeft - this.viewportPadding
            );
            const fixedWidth = this.getFixedShuttleWidth(shuttleTable, selects);
            const maxSelectsWidth = Math.max(
                this.minCompressedWidth * selects.length,
                availableWidth - fixedWidth
            );
            const desired = selects.map(sel => {
                return Math.max(this.minCompressedWidth, this.measureSelectWidth(sel));
            });
            const preferredMinimums = desired.map(width => {
                return Math.min(this.minSelectWidth, Math.max(this.minCompressedWidth, width));
            });
            const desiredTotal = desired.reduce((sum, width) => sum + width, 0);
            const preferredMinTotal = preferredMinimums.reduce((sum, width) => sum + width, 0);
            const widths = desiredTotal <= maxSelectsWidth
                ? desired
                : preferredMinTotal <= maxSelectsWidth
                    ? this.distributeWidths(desired, preferredMinimums, maxSelectsWidth)
                    : this.distributeWidths(preferredMinimums, selects.map(() => this.minCompressedWidth), maxSelectsWidth);

            selects.forEach((sel, index) => {
                const width = Math.max(this.minCompressedWidth, Math.floor(widths[index]));
                sel.style.width = width + 'px';
                sel.style.maxWidth = width + 'px';
                sel.style.boxSizing = 'border-box';
                if (sel.parentElement) sel.parentElement.style.width = width + 'px';
            });

            const hiddenWrapper = document.querySelector('#' + this.containerId + ' > div');
            const hiddenSel = document.querySelector('#' + this.containerId + ' select[multiple]');
            if (hiddenWrapper && hiddenSel) {
                hiddenWrapper.style.width = hiddenSel.style.width;
                hiddenWrapper.style.maxWidth = hiddenSel.style.width;
            }
        },
        getFixedShuttleWidth: function (shuttleTable, selects) {
            const selectCells = new Set(selects.map(sel => sel.closest('td')).filter(Boolean));
            return Array.from(shuttleTable.rows[0]?.cells || []).reduce((sum, cell) => {
                if (selectCells.has(cell)) return sum;
                return sum + cell.getBoundingClientRect().width;
            }, 24);
        },
        distributeWidths: function (desired, minimums, maxTotal) {
            const minTotal = minimums.reduce((sum, width) => sum + width, 0);
            if (maxTotal <= minTotal) {
                return minimums.map(width => width * maxTotal / minTotal);
            }

            const extras = desired.map((width, index) => Math.max(0, width - minimums[index]));
            const extraTotal = extras.reduce((sum, width) => sum + width, 0);
            const availableExtra = maxTotal - minTotal;
            if (extraTotal <= 0) {
                return minimums.slice();
            }

            return desired.map((width, index) => minimums[index] + (availableExtra * extras[index] / extraTotal));
        },
        measureSelectWidth: function (select) {
            const options = Array.from(select.options).filter(o => {
                return o.style.display !== 'none' && !o.hidden;
            });
            const longest = options.reduce((max, option) => {
                const text = option.textContent || '';
                const measured = Math.max(
                    this.measureText(text, select),
                    text.length * this.minMeasuredCharWidth
                );
                return Math.max(max, measured);
            }, 0);

            return Math.ceil(longest + this.selectTextPadding);
        },
        measureText: function (text, sourceEl) {
            if (!this.measureCanvas) this.measureCanvas = document.createElement('canvas');
            const ctx = this.measureCanvas.getContext && this.measureCanvas.getContext('2d');
            if (!ctx) return text.length * 7;

            const style = window.getComputedStyle(sourceEl);
            ctx.font = [
                style.fontStyle,
                style.fontVariant,
                style.fontWeight,
                style.fontSize,
                style.fontFamily
            ].join(' ');
            return ctx.measureText(text).width;
        },
        init: function () {
            const Config = RS.Config;
            if (Config && !Config.hiddenItems.enabled) return;
            const leftSel = document.querySelector('select[id$="_LEFT"]');
            if (!leftSel) return;
            if (document.getElementById(this.containerId)) return;

            const shuttleTable = leftSel.closest('table');
            const shuttleRow = shuttleTable ? shuttleTable.querySelector('tr') : null;
            if (!shuttleRow) return;
            const rightSel = shuttleTable.querySelector('select[id$="_RIGHT"]');

            const STORAGE_KEY = 'cht_apex_hidden_workplaces_profiles';
            const pFlow = document.getElementById('pFlowId')?.value || '0';
            const pStep = document.getElementById('pFlowStepId')?.value || '0';
            const pageKey = `${pFlow}:${pStep}`;

            let storeAll = {};
            try { storeAll = JSON.parse(GM_getValue(STORAGE_KEY, '{}')); } catch (e) { }
            let pageData = storeAll[pageKey] || { activeProfile: 'default', profiles: { 'default': [] }, uiSize: { width: 350, height: 400 } };
            if (Array.isArray(pageData)) pageData = { activeProfile: 'default', profiles: { 'default': pageData }, uiSize: { width: 350, height: 400 } };
            let currentHidden = (pageData.profiles[pageData.activeProfile] || []).slice();

            const allOptions = Array.from(leftSel.options).map(o => ({ value: o.value, label: o.textContent, opt: o }));
            const save = () => { storeAll[pageKey] = pageData; GM_setValue(STORAGE_KEY, JSON.stringify(storeAll)); };
            let syncWidths = () => {};
            const apply = () => {
                const map = new Set(currentHidden);
                allOptions.forEach(i => { const h = map.has(i.value); i.opt.style.display = h ? 'none' : ''; i.opt.disabled = h; i.opt.selected = false; });
                syncWidths();
            };

            const extraTd = document.createElement('td');
            extraTd.className = 'shuttleSelect3'; extraTd.style.verticalAlign = 'top'; extraTd.id = this.containerId;
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, { fontSize: '11px', fontFamily: 'Tahoma,Arial', position: 'relative', display: 'inline-block', padding: '2px' });
            const profRow = document.createElement('div'); profRow.style.marginBottom = '6px'; profRow.style.whiteSpace = 'normal';
            profRow.innerHTML = `Profil: <select id="cht-h-prof" style="width:100px;margin-right:4px"></select><input id="cht-h-name" placeholder="název" style="width:80px;margin-right:4px"><button type="button" style="padding:0 4px" id="cht-h-save">Uložit</button><button type="button" style="padding:0 4px" id="cht-h-del">Smazat</button>`;
            const sel = document.createElement('select'); sel.multiple = true;
            sel.style.width = this.minSelectWidth + 'px';
            sel.style.height = (pageData.uiSize?.height || 400) + 'px';
            sel.style.fontSize = '10px';
            allOptions.forEach(i => sel.add(new Option(i.label, i.value)));
            const resetBtn = document.createElement('button');
            resetBtn.innerHTML = '<span>Reset (zobrazit vše)</span>'; resetBtn.style.marginTop = '6px';
            wrapper.append(profRow, document.createTextNode('Položky k NEnabízení:'), document.createElement('br'), sel, document.createElement('br'), resetBtn);
            extraTd.appendChild(wrapper); shuttleRow.appendChild(extraTd);

            const dom = {
                prof: profRow.querySelector('#cht-h-prof'),
                name: profRow.querySelector('#cht-h-name'),
                save: profRow.querySelector('#cht-h-save'),
                del: profRow.querySelector('#cht-h-del')
            };
            const rebuildProfs = () => { dom.prof.innerHTML = ''; Object.keys(pageData.profiles).forEach(k => dom.prof.add(new Option(k === 'default' ? 'Výchozí' : k, k, false, k === pageData.activeProfile))); };
            let resizeQueued = false;
            const queueWidthSync = () => {
                if (resizeQueued) return;
                resizeQueued = true;
                requestAnimationFrame(() => {
                    resizeQueued = false;
                    syncWidths();
                });
            };
            syncWidths = () => this.fitShuttleWidths({
                shuttleTable: shuttleTable,
                selects: [leftSel, rightSel, sel].filter(Boolean)
            });
            [leftSel, rightSel, sel].filter(Boolean).forEach(s => {
                new MutationObserver(queueWidthSync).observe(s, {
                    childList: true,
                    attributes: true,
                    attributeFilter: ['style', 'hidden', 'disabled']
                });
                s.addEventListener('change', queueWidthSync);
            });
            shuttleTable.addEventListener('click', () => setTimeout(queueWidthSync, 0), true);
            window.addEventListener('resize', queueWidthSync);

            const syncSel = () => { const s = new Set(currentHidden); Array.from(sel.options).forEach(o => o.selected = s.has(o.value)); };

            dom.prof.onchange = () => { pageData.activeProfile = dom.prof.value; currentHidden = (pageData.profiles[pageData.activeProfile] || []).slice(); save(); syncSel(); apply(); };
            sel.onchange = () => { currentHidden = Array.from(sel.selectedOptions).map(o => o.value); apply(); };
            dom.save.onclick = (e) => { e.preventDefault(); const n = dom.name.value.trim() || pageData.activeProfile || 'default'; pageData.profiles[n] = currentHidden.slice(); pageData.activeProfile = n; dom.name.value = ''; rebuildProfs(); save(); };
            dom.del.onclick = (e) => { e.preventDefault(); if (pageData.activeProfile === 'default') return; delete pageData.profiles[pageData.activeProfile]; pageData.activeProfile = 'default'; currentHidden = pageData.profiles.default.slice(); rebuildProfs(); syncSel(); apply(); save(); };
            resetBtn.onclick = (e) => { e.preventDefault(); currentHidden = []; syncSel(); apply(); };

            rebuildProfs(); syncSel(); apply(); queueWidthSync();
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Lists.init());
        else RS.Modules.Lists.init();
    }

})();
