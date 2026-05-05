// ==UserScript==
// @name         Riscon: Nastavení (Settings UI)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.2
// @description  Panel nastavení modulů Riscon Suite. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/02-settings-ui.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/02-settings-ui.js
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

    RS.SettingsUI = {
        create: function () {
            if (document.getElementById('riscon-settings-trigger')) return;

            const Config = RS.Config;

            function applySettingsBtnPosition(btn, pos) {
                btn.style.top = ''; btn.style.bottom = ''; btn.style.left = ''; btn.style.right = '';
                if (pos === 'top-left') { btn.style.top = '11px'; btn.style.left = '9px'; }
                else if (pos === 'top-right') { btn.style.top = '11px'; btn.style.right = '9px'; }
                else { btn.style.bottom = '11px'; btn.style.left = '9px'; }
            }

            const btn = document.createElement('div');
            btn.id = 'riscon-settings-trigger';
            Object.assign(btn.style, {
                position: 'fixed', zIndex: '999999',
                background: '#333', color: '#fff', padding: '4px 10px', borderRadius: '2px',
                cursor: 'pointer', fontSize: '12px', fontFamily: 'Arial, sans-serif',
                opacity: Config.settingsBtnOpacity, transition: 'opacity 0.5s'
            });
            applySettingsBtnPosition(btn, Config.settingsBtnPosition);
            btn.textContent = '⚙ Nastavení';
            btn.onmouseover = () => btn.style.opacity = '1';
            btn.onmouseout = () => btn.style.opacity = Config.settingsBtnOpacity;
            btn.onclick = toggleSettingsPanel;
            document.body.appendChild(btn);

            const panel = document.createElement('div');
            panel.id = 'riscon-suite-settings';
            Object.assign(panel.style, {
                position: 'fixed', bottom: '45px', left: '10px', width: '320px',
                background: '#fff', border: '1px solid #ccc', borderRadius: '6px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: '999999',
                padding: '15px', display: 'none', fontFamily: 'Segoe UI, Tahoma, sans-serif'
            });

            const checkbox = (id, label, checked) => `
                <div style="margin-bottom: 5px;">
                    <label style="display:flex; align-items:center; cursor:pointer;">
                        <input type="checkbox" data-id="${id}" style="margin-right:8px;" ${checked ? 'checked' : ''}>
                        <span style="font-size:13px; color:#333;">${label}</span>
                    </label>
                </div>`;
            const rangeInput = (id, label, value) => `
                <div style="margin-bottom: 8px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span style="font-size:12px; color:#333;">${label}</span>
                        <span id="val-${id.replace('.', '-')}" style="font-size:11px; color:#666;">${Math.round(value * 100)}%</span>
                    </div>
                    <input type="range" data-id="${id}" min="0" max="1.0" step="0.1" value="${value}" style="width:100%;">
                </div>`;

            const renderPanel = () => {
                panel.innerHTML = `
                    <h3 style="margin:0 0 10px 0; font-size:16px; border-bottom:1px solid #eee; padding-bottom:5px;">Nastavení přídavných modulů</h3>
                    ${checkbox('json.enabled', 'JSON Nástroje (Pravé spodní tlačítko)', Config.json.enabled)}
                    <div style="margin: 8px 0 4px 0; font-weight:bold; font-size:13px; color:#333;">Vyhodnocení rizik:</div>
                    ${checkbox('risks.labels', 'Oprava popisků (EN->CZ)', Config.risks.labels)}
                    ${checkbox('risks.colors', 'Barevné zvýraznění míry rizika', Config.risks.colors)}
                    ${checkbox('risks.legend', 'Legenda: Koeficient účinnosti', Config.risks.legend)}
                    <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                    ${checkbox('hiddenItems.enabled', 'Skrývání položek (Seznamy)', Config.hiddenItems.enabled)}
                    ${checkbox('rowHighlight.enabled', 'Zvýraznění řádků tabulky (Klik)', Config.rowHighlight.enabled)}
                    ${checkbox('stickyHeaders.enabled', 'Připnutí záhlaví tabulek', Config.stickyHeaders.enabled)}
                    ${checkbox('tabHighlight.enabled', 'Zvýraznění záložek', Config.tabHighlight.enabled)}
                    ${checkbox('sidebarToggle.enabled', 'Pravý panel: Zmenšení do stránky', Config.sidebarToggle.enabled)}
                    ${checkbox('docChecklist.enabled', 'Úrazy: checklist dokumentace', Config.docChecklist.enabled)}
                    <div style="margin: 12px 0 4px 0; font-weight:bold; font-size:13px; color:#333; border-top:1px solid #eee; padding-top:8px;">Vzhled tlačítek:</div>
                    <div style="margin-bottom: 8px;">
                        <label style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#333;">
                            Umístění tlačítka ⚙:
                            <select data-id="settingsBtnPosition" style="width:130px; font-size:11px; padding:2px;">
                                <option value="bottom-left" ${Config.settingsBtnPosition === 'bottom-left' ? 'selected' : ''}>Vlevo dole</option>
                                <option value="top-left" ${Config.settingsBtnPosition === 'top-left' ? 'selected' : ''}>Vlevo nahoře</option>
                                <option value="top-right" ${Config.settingsBtnPosition === 'top-right' ? 'selected' : ''}>Vpravo nahoře</option>
                            </select>
                        </label>
                    </div>
                    ${rangeInput('settingsBtnOpacity', 'Průhlednost tlačítka ⚙', Config.settingsBtnOpacity)}
                    ${rangeInput('scriptBtnOpacity', 'Průhlednost tlačítka Skript', Config.scriptBtnOpacity)}
                    <button id="rs-close-settings" style="position:absolute; top:10px; right:10px; border:none; background:none; cursor:pointer; font-size:16px;">&times;</button>
                `;
                panel.querySelector('#rs-close-settings').onclick = () => panel.style.display = 'none';
                panel.querySelectorAll('input[type="checkbox"]').forEach(ch => {
                    ch.addEventListener('change', (e) => {
                        const path = e.target.dataset.id.split('.');
                        if (path.length === 2) Config[path[0]][path[1]] = e.target.checked;
                        RS.saveConfig();
                        if (RS.Modules && RS.Modules.applyAll) RS.Modules.applyAll();
                        if (RS.Pulse && RS.Pulse.beat) RS.Pulse.beat();
                    });
                });
                panel.querySelectorAll('input[type="range"]').forEach(rn => {
                    rn.addEventListener('input', (e) => {
                        const val = parseFloat(e.target.value);
                        const id = e.target.dataset.id;
                        Config[id] = val;
                        const lbl = panel.querySelector(`#val-${id.replace('.', '-')}`);
                        if (lbl) lbl.textContent = Math.round(val * 100) + '%';
                        RS.saveConfig();
                        if (RS.updateOpacity) RS.updateOpacity();
                    });
                });
                panel.querySelectorAll('select[data-id="settingsBtnPosition"]').forEach(sel => {
                    sel.addEventListener('change', (e) => {
                        Config.settingsBtnPosition = e.target.value;
                        RS.saveConfig();
                        const b = document.getElementById('riscon-settings-trigger');
                        if (b) applySettingsBtnPosition(b, Config.settingsBtnPosition);
                    });
                });
            };

            renderPanel();
            document.body.appendChild(panel);

            function toggleSettingsPanel() {
                if (panel.style.display === 'none') { renderPanel(); panel.style.display = 'block'; }
                else { panel.style.display = 'none'; }
            }
        }
    };

})();
