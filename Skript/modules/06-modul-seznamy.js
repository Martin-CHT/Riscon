// ==UserScript==
// @name         Riscon: Skrývání položek (Seznamy)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.0
// @description  Skrývání položek v shuttle listboxech s podporou profilů. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @source       https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/06-modul-seznamy.js
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
        toggle: function (enabled) {
            const el = document.getElementById(this.containerId);
            if (enabled) {
                this.init();
                if (el) { el.style.display = ''; this.reapply(); }
            } else {
                if (el) el.style.display = 'none';
                this.restoreAllOptions();
            }
        },
        restoreAllOptions: function () {
            const leftSel = document.querySelector('select[id$="_LEFT"]');
            if (!leftSel) return;
            Array.from(leftSel.options).forEach(o => { o.style.display = ''; o.disabled = false; });
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
            const apply = () => {
                const map = new Set(currentHidden);
                allOptions.forEach(i => { const h = map.has(i.value); i.opt.style.display = h ? 'none' : ''; i.opt.disabled = h; i.opt.selected = false; });
            };

            const extraTd = document.createElement('td');
            extraTd.className = 'shuttleSelect3'; extraTd.style.verticalAlign = 'top'; extraTd.id = this.containerId;
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, { fontSize: '11px', fontFamily: 'Tahoma,Arial', position: 'relative', display: 'inline-block', padding: '2px' });
            const profRow = document.createElement('div'); profRow.style.marginBottom = '6px';
            profRow.innerHTML = `Profil: <select id="cht-h-prof" style="width:100px;margin-right:4px"></select><input id="cht-h-name" placeholder="název" style="width:80px;margin-right:4px"><button type="button" style="padding:0 4px" id="cht-h-save">Uložit</button><button type="button" style="padding:0 4px" id="cht-h-del">Smazat</button>`;
            const sel = document.createElement('select'); sel.multiple = true;
            sel.style.width = (pageData.uiSize?.width || 350) + 'px';
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
            const syncSel = () => { const s = new Set(currentHidden); Array.from(sel.options).forEach(o => o.selected = s.has(o.value)); };

            dom.prof.onchange = () => { pageData.activeProfile = dom.prof.value; currentHidden = (pageData.profiles[pageData.activeProfile] || []).slice(); save(); syncSel(); apply(); };
            sel.onchange = () => { currentHidden = Array.from(sel.selectedOptions).map(o => o.value); apply(); };
            dom.save.onclick = (e) => { e.preventDefault(); const n = dom.name.value.trim() || pageData.activeProfile || 'default'; pageData.profiles[n] = currentHidden.slice(); pageData.activeProfile = n; dom.name.value = ''; rebuildProfs(); save(); };
            dom.del.onclick = (e) => { e.preventDefault(); if (pageData.activeProfile === 'default') return; delete pageData.profiles[pageData.activeProfile]; pageData.activeProfile = 'default'; currentHidden = pageData.profiles.default.slice(); rebuildProfs(); syncSel(); apply(); save(); };
            resetBtn.onclick = (e) => { e.preventDefault(); currentHidden = []; syncSel(); apply(); };

            rebuildProfs(); syncSel(); apply();
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Lists.init());
        else RS.Modules.Lists.init();
    }

})();
