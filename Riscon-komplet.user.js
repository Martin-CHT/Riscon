// ==UserScript==
// @name         Riscon: Sdružené skripty
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      8.9.0
// @description  Sdružený balík nástrojů pro Riscon. Optimalizováno pro Edge/Chrome (GM_ API).
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @website      https://www.riscon.cz/
// @source       https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Riscon-komplet.user.js
// @supportURL   https://github.com/Martin-CHT/Riscon/issues
// @icon         https://www.oracle.com/a/ocom/img/rest.svg
// @icon64       https://www.oracle.com/a/ocom/img/rest.svg
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
    'use strict';

    // ========================================================================
    // 1. KONFIGURACE
    // ========================================================================
    const APP_KEY = 'RISCON_SUITE_V1';

    const DEFAULT_CONFIG = {
        json: { enabled: true },
        risks: { labels: true, colors: true, legend: true },
        hiddenItems: { enabled: true },
        rowHighlight: { enabled: true },
        tabHighlight: { enabled: true },
        sidebarToggle: { enabled: true }, // Přidán modul pro zmenšení postranního panelu
        docChecklist: { enabled: true },  // Přidán modul pro checklist dokumentace
        settingsBtnPosition: 'bottom-left',
        settingsBtnOpacity: 0.2,
        scriptBtnOpacity: 0.2
    };

    function deepMergeDefaults(target, defaults) {
        if (target === null || typeof target !== 'object') return JSON.parse(JSON.stringify(defaults));
        const out = Array.isArray(defaults) ? [] : {};
        for (const k of Object.keys(defaults)) {
            const dv = defaults[k];
            const tv = target[k];
            if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
                out[k] = deepMergeDefaults(tv, dv);
            } else {
                out[k] = (typeof tv === 'undefined') ? dv : tv;
            }
        }
        for (const k of Object.keys(target)) {
            if (!(k in out)) out[k] = target[k];
        }
        return out;
    }

    let Config = null;
    try {
        const storedConfig = GM_getValue(APP_KEY, JSON.stringify(DEFAULT_CONFIG));
        const parsed = JSON.parse(storedConfig);
        Config = deepMergeDefaults(parsed, DEFAULT_CONFIG);
    } catch (e) {
        Config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    function saveConfig() { GM_setValue(APP_KEY, JSON.stringify(Config)); }

    const $ = (sel, root = document) => root.querySelector(sel);
    const pause = (ms) => new Promise(r => setTimeout(r, ms));

    // --- GLOBÁLNÍ STYLY ---
    function injectGlobalStyles() {
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

    // ========================================================================
    // 2. UI & OBSERVER (PULSE)
    // ========================================================================

    const Pulse = {
        timer: null,
        observer: null,
        start: function() {
            this.beat();
            this.observer = new MutationObserver((mutations) => {
                let shouldRun = false;
                for (const m of mutations) {
                    if (m.type === 'childList' && m.addedNodes.length > 0) {
                        shouldRun = true;
                        break;
                    }
                }
                if (shouldRun) {
                    clearTimeout(this.timer);
                    this.timer = setTimeout(() => this.beat(), 300);
                }
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        },
        beat: function() {
            Modules.safeRun('Risks', () => Modules.Risks.update(Config.risks));
            Modules.safeRun('Rows', () => Modules.Rows.paintAll());
            Modules.safeRun('Lists', () => Modules.Lists.init());
            Modules.safeRun('Tabs', () => Modules.Tabs.init());
            Modules.safeRun('Checklist', () => Modules.Checklist.init());
        }
    };

    function createSettingsUI() {
        if(document.getElementById('riscon-settings-trigger')) return;

        function applySettingsBtnPosition(btn, pos) {
            btn.style.top = ''; btn.style.bottom = ''; btn.style.left = ''; btn.style.right = '';
            if (pos === 'top-left') { btn.style.top = '11px'; btn.style.left = '9px'; }
            else if (pos === 'top-right') { btn.style.top = '11px'; btn.style.right = '9px'; }
            else { btn.style.bottom = '11px'; btn.style.left = '9px'; } // default bottom-left
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
            </div>
        `;
        const rangeInput = (id, label, value) => `
            <div style="margin-bottom: 8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span style="font-size:12px; color:#333;">${label}</span>
                    <span id="val-${id.replace('.','-')}" style="font-size:11px; color:#666;">${Math.round(value*100)}%</span>
                </div>
                <input type="range" data-id="${id}" min="0" max="1.0" step="0.1" value="${value}" style="width:100%;">
            </div>
        `;

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
                    saveConfig();
                    Modules.applyAll();
                    Pulse.beat();
                });
            });
            panel.querySelectorAll('input[type="range"]').forEach(rn => {
                rn.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value); const id = e.target.dataset.id;
                    Config[id] = val;
                    const label = panel.querySelector(`#val-${id.replace('.','-')}`);
                    if(label) label.textContent = Math.round(val*100) + '%';
                    saveConfig(); updateOpacity();
                });
            });
            panel.querySelectorAll('select[data-id="settingsBtnPosition"]').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    Config.settingsBtnPosition = e.target.value;
                    saveConfig();
                    const btn = document.getElementById('riscon-settings-trigger');
                    if (btn) applySettingsBtnPosition(btn, Config.settingsBtnPosition);
                });
            });
        };
        renderPanel(); document.body.appendChild(panel);
        function toggleSettingsPanel() { if (panel.style.display === 'none') { renderPanel(); panel.style.display = 'block'; } else { panel.style.display = 'none'; } }
    }

    function updateOpacity() {
        const sBtn = document.getElementById('riscon-settings-trigger');
        if (sBtn) { sBtn.style.opacity = Config.settingsBtnOpacity; sBtn.onmouseout = () => sBtn.style.opacity = Config.settingsBtnOpacity; }
        const jBtn = document.getElementById('apex-json-btnwrap');
        if (jBtn) { jBtn.style.opacity = Config.scriptBtnOpacity; jBtn.onmouseout = () => jBtn.style.opacity = Config.scriptBtnOpacity; }
    }

    // ========================================================================
    // 3. DEFINICE MODULŮ
    // ========================================================================

    const Modules = {
        safeRun: function(moduleName, fn) { try { fn(); } catch (e) { console.error(`Riscon Suite: Chyba v modulu ${moduleName}:`, e); } },

        applyAll: function() {
            this.safeRun('JSON', () => this.Json.toggle(Config.json.enabled));
            this.safeRun('Risks', () => this.Risks.update(Config.risks));
            this.safeRun('Lists', () => this.Lists.toggle(Config.hiddenItems.enabled));
            this.safeRun('Rows', () => this.Rows.init());
            this.safeRun('Tabs', () => this.Tabs.toggle(Config.tabHighlight.enabled));
            this.safeRun('Sidebar', () => this.Sidebar.toggle(Config.sidebarToggle.enabled));
            this.safeRun('Checklist', () => this.Checklist.toggle(Config.docChecklist.enabled));
        },

        // --- MODUL 1: JSON ---
        Json: {
            initialized: false,
            toggle: function(enabled) {
                if (enabled && !this.initialized) { this.init(); this.initialized = true; }
                const btn = $('#apex-json-btnwrap'); const panel = $('#apex-json-panel');
                if (btn) btn.style.setProperty('display', enabled ? 'block' : 'none', 'important');
                if (panel && !enabled) panel.style.display = 'none';
                if (enabled && !btn && this.initialized) this.makeUI();
                updateOpacity();
            },
            init: function() {
                const SIZE_KEY = 'apexJsonPanelConfig_v8';
                const normalizeTail = (id, val) => {
                    let s = String(val ?? ''); if (id === 'P6206_IMMEDIATE_ACTION') return s;
                    if (id !== 'P6206_DESCRIPTION' && id !== 'P6206_LEGAL_REFERENCES') return s;
                    if (!s.trim()) return '';
                    s = s.replace(/(?:\s|&nbsp;|<br\s*\/?>|<\/br>)+$/gi, '');
                    return (id === 'P6206_DESCRIPTION' && /<\/(ul|ol)>\s*$/i.test(s)) ? s : s + '<br>';
                };
                const fire = (el) => { el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); };
                const stripColon = (t) => String(t || '').replace(/^[\s\u00A0]*:\s*/, '');

                const ensureChecked = (el) => {
                    if (el.checked) return;
                    el.click();
                    if (!el.checked) {
                        const label = document.querySelector(`label[for="${el.id}"]`);
                        if (label) label.click();
                    }
                    if (!el.checked) { el.checked = true; fire(el); }
                };

                const setRadioGroup = (name, val) => {
                    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"], input[type="radio"][id^="${name}"]`);
                    const targetVal = String(val).toLowerCase();
                    for (const r of radios) {
                        if (String(r.value).toLowerCase() === targetVal) {
                            ensureChecked(r);
                            return true;
                        }
                    }
                    return false;
                };

                const setVal = (id, val) => {
                    const el = document.getElementById(id); if (!el) return;
                    let v = normalizeTail(id, (id==='P6206_EXACT_PLACE'||id==='P6206_LEGAL_REFERENCES') ? stripColon(val) : val);
                    if (el.tagName === 'SELECT') {
                        const sval = String(v ?? '').trim().toLowerCase();
                        const match = Array.from(el.options).find(o =>
                            o.textContent.trim().toLowerCase() === sval ||
                            String(o.value).trim().toLowerCase() === sval
                        );
                        if (match) el.value = match.value;
                    } else el.value = v ?? '';
                    fire(el);
                };
                const setCk = (id, val) => {
                    let v = normalizeTail(id, (id==='P6206_EXACT_PLACE'||id==='P6206_LEGAL_REFERENCES') ? stripColon(val) : val);
                    if (window.CKEDITOR?.instances?.[id]) CKEDITOR.instances[id].setData(v); else setVal(id, v);
                };

                async function fillForm(json) {
                    let data;
                    try { data = JSON.parse(String(json).trim().replace(/^([^{[]+)/,'').replace(/([^}\]]+)$/,'')); } catch {
                          try { data = JSON.parse('{' + json + '}'); } catch(e) { throw new Error('Chybný formát JSON'); }
                    }
                    for (const [k, v] of Object.entries(data)) {
                        if (v == null) continue;
                        const el = document.getElementById(k);
                        if (el) {
                            const type = (el.type || '').toLowerCase();
                            if (type === 'radio') {
                                const groupName = el.name || k;
                                if (!setRadioGroup(groupName, v)) {
                                    setRadioGroup(k, v);
                                }
                            } else if (type === 'checkbox') {
                                const sv = String(v).toLowerCase();
                                const ev = String(el.value).toLowerCase();
                                if (sv === ev || sv === 'true' || sv === '1' || sv === 'y' || sv === 'on') {
                                    ensureChecked(el);
                                } else if (el.checked) {
                                    el.click();
                                }
                            } else if (/<[a-z][\s\S]*>/i.test(String(v)) && !type) {
                                setCk(k, v);
                            } else if (window.CKEDITOR?.instances?.[k]) {
                                setCk(k, v);
                            } else {
                                setVal(k, v);
                            }
                        } else {
                            const radiosByName = document.querySelectorAll(`input[type="radio"][name="${k}"]`);
                            if (radiosByName.length > 0) setRadioGroup(k, v);
                            else if (/<[a-z][\s\S]*>/i.test(String(v))) setCk(k, v);
                        }
                        await pause(20);
                    }
                }

                const extractBlocks = () => {
                    const tables = [...document.querySelectorAll('table.si_table')].filter(t => /#\s*\d+,\s*ID:/i.test(t.textContent));
                    return tables.map(t => {
                        const pick = (l, html=true) => {
                             for(const s of t.querySelectorAll('strong')) if(new RegExp(`^${l}`,'i').test(s.textContent.trim())) {
                                 let n = s.nextSibling; let h = '';
                                 while(n && n.tagName!=='STRONG') { h += (html ? (n.outerHTML||n.textContent) : n.textContent); n=n.nextSibling; }
                                 return h.trim().replace(/^:\s*/,'');
                             } return '';
                        };
                        const id = t.querySelector('th.si_th')?.textContent.match(/ID:\s*(\d+)/)?.[1] || '';
                        let gravityVal = '';
                        const header = t.querySelector('th.si_th')?.innerText || '';
                        const match = header.match(/-\s*(.+)$/);
                        if(match) {
                            const txt = match[1].trim().toLowerCase();
                            if(txt.includes('silná')) gravityVal = '1';
                            else if(txt.includes('komentář')) gravityVal = '2';
                            else if(txt.includes('slabá')) gravityVal = '3';
                            else if(txt.includes('závažná')) gravityVal = '5';
                            else if(txt.includes('neshoda')) gravityVal = '4';
                        }
                        return {
                            P6206_RANKING: id,
                            P6206_DESCRIPTION: pick('Popis'),
                            P6206_EXAMINED_PERSON: pick('Prověřovaná') || pick('Osoba'),
                            P6206_FOCUSED_ON: pick('Zaměření'),
                            P6206_GRAVITY: gravityVal || pick('Závažnost'),
                            P6206_EXACT_PLACE: stripColon(pick('Místo',false)),
                            P6206_LEGAL_REFERENCES: stripColon(pick('Odkazy',false)),
                            P6206_POSSIBLE_CAUSES: pick('Příčiny') || pick('Možné příčiny'),
                            P6206_IMMEDIATE_ACTION: pick('Okamžité')
                        };
                    });
                };

                const extractForm = () => {
                    const data = {};
                    const inputs = document.querySelectorAll('input, select, textarea');
                    inputs.forEach(el => {
                        const id = el.id;
                        if (!id || !/^P\d+_/.test(id)) return;
                        const type = (el.type || '').toLowerCase();
                        if (type === 'hidden' || type === 'button' || type === 'submit') return;

                        if (type === 'checkbox' || type === 'radio') {
                            if (el.checked) data[id] = el.value;
                        } else {
                            if (window.CKEDITOR && CKEDITOR.instances && CKEDITOR.instances[id]) {
                                const editorData = CKEDITOR.instances[id].getData();
                                if (editorData) data[id] = editorData;
                            } else {
                                if (el.value !== '' && el.value != null) data[id] = el.value;
                            }
                        }
                    });
                    return data;
                };

                const format = (arr) => arr.map(o => JSON.stringify(o, null, 2)).join('\n===========================\n');

                this.loadConfig = () => { try { return JSON.parse(GM_getValue(SIZE_KEY)); } catch { return null; } };
                this.savePanelConfig = (panel) => { const s = window.getComputedStyle(panel); GM_setValue(SIZE_KEY, JSON.stringify({ w: panel.offsetWidth, h: panel.offsetHeight, right: parseInt(s.right), bottom: parseInt(s.bottom) })); };

                this.makeUI = () => {
                    GM_addStyle(`
                        #apex-json-panel { display: flex; flex-direction: column; box-sizing: border-box; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.4; }
                        #apex-json-panel * { box-sizing: border-box; }
                        .ajp-head { flex: 0 0 auto; background: #f0f0f0; border-bottom: 1px solid #ccc; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; }
                        .ajp-title { font-weight: bold; font-size: 13px; color: #333; }
                        .ajp-body { flex: 1 1 auto; display: flex; flex-direction: column; padding: 10px; background: #fff; overflow: hidden; }
                        .ajp-foot { flex: 0 0 auto; background: #f9f9f9; border-top: 1px solid #ccc; padding: 8px; display: flex; gap: 8px; }
                        #apex-json-btnwrap { position:fixed; z-index:2147483647; pointer-events:auto; }
                        .ajp-btn { background:#eee; border:1px solid #ccc; border-radius:3px; padding:4px 8px; cursor:pointer; color:#333; font-size:12px; font-family: Arial, sans-serif; margin: 0; }
                        .ajp-btn:hover { background:#ddd; }
                    `);

                    let btnWrap = $('#apex-json-btnwrap');
                    if (!btnWrap) {
                        btnWrap = document.createElement('div'); btnWrap.id = 'apex-json-btnwrap';
                        Object.assign(btnWrap.style, { bottom: '11px', right: '7px', opacity: Config.scriptBtnOpacity, transition: 'opacity 0.5s' });
                        btnWrap.onmouseover = () => btnWrap.style.opacity = '1'; btnWrap.onmouseout = () => btnWrap.style.opacity = Config.scriptBtnOpacity;
                        const btn = document.createElement('button'); btn.id = 'apex-json-toggle'; btn.type = 'button'; btn.textContent = 'Skript';
                        Object.assign(btn.style, { background: '#333', color: '#fff', padding: '5px 10px', borderRadius: '2px', border: '0px solid #aaaaaa', cursor: 'pointer', fontSize: '12px', fontFamily: 'Arial, sans-serif', display: 'block', margin: 0 });
                        btnWrap.appendChild(btn); document.body.appendChild(btnWrap);
                    }
                    let panel = $('#apex-json-panel'); const stored = this.loadConfig();
                    if (!panel) {
                        panel = document.createElement('div'); panel.id = 'apex-json-panel';
                        Object.assign(panel.style, { position: 'fixed', zIndex: '2147483646', background: '#fff', border: '1px solid #999', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'none', borderRadius: '4px', width: (stored?.w || 700) + 'px', height: (stored?.h || 380) + 'px', right: (stored?.right ?? 20) + 'px', bottom: (stored?.bottom ?? 90) + 'px' });
                        panel.innerHTML = `
                            <div class="ajp-head"><span class="ajp-title">Riscon JSON</span><button class="ajp-btn" id="apex-json-close" type="button" style="padding:2px 6px;">✕</button></div>
                            <div class="ajp-body"><div style="font-size:11px; color:#666; margin-bottom:5px;">Vlož JSON data:</div><textarea id="apex-json-text" style="flex:1; width:100%; border:1px solid #ccc; padding:5px; font-family:monospace; resize:none; outline:none;"></textarea></div>
                            <div class="ajp-foot"><button class="ajp-btn" id="apex-json-fill" type="button">Vyplnit</button><button class="ajp-btn" id="apex-json-extract" type="button">Vytěžit</button><button class="ajp-btn" id="apex-json-clear" type="button">Vymazat</button></div>
                        `;
                        document.body.appendChild(panel); this.addResizeHandles(panel);
                    }
                    $('#apex-json-toggle').onclick = (e) => { e.preventDefault(); panel.style.display = (panel.style.display==='none'?'flex':'none'); };
                    $('#apex-json-close', panel).onclick = () => panel.style.display = 'none';
                    $('#apex-json-clear', panel).onclick = () => $('#apex-json-text', panel).value = '';

                    $('#apex-json-extract', panel).onclick = (e) => {
                        const btnEl = e.target;
                        const origText = btnEl.textContent;

                        const d = extractBlocks();
                        if (d.length > 0) {
                             $('#apex-json-text', panel).value = format(d);
                        } else {
                            const formData = extractForm();

                            if (Object.keys(formData).length > 0) {
                                const now = new Date();
                                const today = String(now.getDate()).padStart(2, '0') + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + now.getFullYear();

                                if (formData.hasOwnProperty('P6201_I_DATE_START') || document.getElementById('P6201_I_DATE_START')) {
                                    formData['P6201_I_DATE_START'] = today;
                                }
                                if (formData.hasOwnProperty('P6201_I_DATE_END') || document.getElementById('P6201_I_DATE_END')) {
                                    formData['P6201_I_DATE_END'] = today;
                                }

                                $('#apex-json-text', panel).value = JSON.stringify(formData, null, 2);

                                btnEl.textContent = "Vytěženo (Force Date)";
                                setTimeout(() => btnEl.textContent = origText, 2000);

                            } else {
                                $('#apex-json-text', panel).value = '// Nic k vytěžení nenalezeno (žádná tabulka rizik ani formulářová data).';
                            }
                        }
                    };

                    $('#apex-json-fill', panel).onclick = async () => { try{ await fillForm($('#apex-json-text', panel).value); }catch(e){alert(e.message);} };
                };
                this.addResizeHandles = (panel) => {
                    ['tl','tr','bl','br'].forEach(pos => {
                        const h = document.createElement('div'); Object.assign(h.style, { position:'absolute', width:'15px', height:'15px', zIndex:'100', opacity:'0' });
                        if(pos.includes('t')) h.style.top='0'; else h.style.bottom='0'; if(pos.includes('l')) h.style.left='0'; else h.style.right='0';
                        h.style.cursor = (pos==='tl'||pos==='br') ? 'nwse-resize' : 'nesw-resize';
                        h.onmousedown = (e) => {
                            e.preventDefault(); const sX=e.clientX, sY=e.clientY, sW=panel.offsetWidth, sH=panel.offsetHeight;
                            const mm = (em) => { const dx=em.clientX-sX, dy=em.clientY-sY;
                                if (pos==='tl') { panel.style.width=Math.max(300,sW-dx)+'px'; panel.style.height=Math.max(200,sH-dy)+'px'; }
                                else if (pos==='tr') { panel.style.width=Math.max(300,sW+dx)+'px'; panel.style.height=Math.max(200,sH-dy)+'px'; panel.style.right=(document.documentElement.clientWidth-panel.getBoundingClientRect().right-dx)+'px'; }
                                else if (pos==='bl') { panel.style.width=Math.max(300,sW-dx)+'px'; panel.style.height=Math.max(200,sH+dy)+'px'; panel.style.bottom=(document.documentElement.clientHeight-panel.getBoundingClientRect().bottom-dy)+'px'; }
                                else if (pos==='br') { panel.style.width=Math.max(300,sW+dx)+'px'; panel.style.height=Math.max(200,sH+dy)+'px'; panel.style.right=(document.documentElement.clientWidth-panel.getBoundingClientRect().right-dx)+'px'; panel.style.bottom=(document.documentElement.clientHeight-panel.getBoundingClientRect().bottom-dy)+'px'; }
                            };
                            const mu = () => { document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu); this.savePanelConfig(panel); };
                            document.addEventListener('mousemove',mm); document.addEventListener('mouseup',mu);
                        };
                        panel.appendChild(h);
                    });
                };
                this.makeUI();
                const bg1 = document.getElementById('P6206_DESCRIPTION'); if(bg1) bg1.addEventListener('blur', ()=> { const f=normalizeTail('P6206_DESCRIPTION',bg1.value); if(f!==bg1.value) { bg1.value=f; fire(bg1); }});
                const bg2 = document.getElementById('P6206_LEGAL_REFERENCES'); if(bg2) bg2.addEventListener('blur', ()=> { const f=normalizeTail('P6206_LEGAL_REFERENCES',bg2.value); if(f!==bg2.value) { bg2.value=f; fire(bg2); }});
            }
        },

        // --- MODUL 2: RIZIKA ---
        Risks: {
            update: function(cfg) {
                if (cfg.labels) this.replaceLabels(true); else this.replaceLabels(false);
                if (cfg.colors) this.colorize(); else this.clearColors();
                if (cfg.legend) this.toggleLegend(true); else this.toggleLegend(false);
            },
            replaceLabels: function(enable) {
                const replacements = {
                    " - very rare": " (méně než 1 x za rok)", " - unusual": " (přibližně 1 x za rok)", " - occasional": " (přibližně 1 x ročně)",
                    " - frequent": " (týdně)", " - very frequent": " (denně)", " - continuously": " (několikrát denně)",
                    "practically impossible": "nemyslitelné", "almost unthinkable": "nepředstavitelné",
                    " - possible but far from probable": "", "combination of unusual circumstances": "nepravděpodobné, ale z dlouhodobého hlediska možné",
                    "low probability": "neobvyklé", "very possible": "dá se očekávat", "expected": "očekávané",
                    "- no temporary disability": "", ", up to 3 lost days": "", ", serious - more than 3 lost days reversible injury": "",
                    ", very serious - accident with irreversible consequences": "", " - disaster (fatal accident)": "", " - catastrophe (death of more than one person)": ""
                };
                const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const applyReplacements = (text) => {
                    let t = text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').replace(/\s*–\s*/g, ' - ').trim();
                    for (const [p, r] of Object.entries(replacements)) t = t.replace(new RegExp(escapeRegex(p), 'gi'), r);
                    return t.replace(/\s+\)/g, ')').replace(/\(\s+/g, '(').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
                };
                document.querySelectorAll('label').forEach(label => {
                    const textNode = Array.from(label.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
                    const target = textNode || (label.childElementCount === 0 ? label : null);
                    if (!target) return;
                    if (!label.getAttribute('data-orig-text')) {
                        const raw = target.textContent; if(raw.trim()) label.setAttribute('data-orig-text', raw);
                    }
                    if (enable) {
                        const orig = label.getAttribute('data-orig-text');
                        if (orig) { const newText = applyReplacements(orig); if (target.textContent !== newText) target.textContent = newText; }
                    } else {
                        const orig = label.getAttribute('data-orig-text'); if (orig && target.textContent !== orig) target.textContent = orig;
                    }
                });
            },
            getColor: function(v) { return v <= 70 ? "#33B03D" : v <= 200 ? "#EBA100" : "#D40C0C"; },
            parseValue: function(t) {
                const cleaned = t.replace(/\u00A0/g,' ').replace(/\s+/g, '').replace(/,/g, '.').replace(/[^\d.\-]/g, '');
                let normalized = cleaned;
                const dots = (cleaned.match(/\./g) || []).length;
                if (dots > 1) {
                    const parts = cleaned.split('.');
                    normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length-1];
                }
                const n = parseFloat(normalized);
                return isNaN(n) ? null : n;
            },
            colorize: function() {
                document.querySelectorAll('td[headers*="BALANCED_RISK_LEVEL"], td[headers*="RISK_LEVEL"]').forEach(cell => {
                    if (cell.dataset.rcColor) return;
                    const val = this.parseValue(cell.innerText || cell.textContent || '');
                    if (val !== null) { cell.style.backgroundColor = this.getColor(val); cell.style.color = "#fff"; cell.dataset.rcColor = "1"; }
                });
            },
            clearColors: function() {
                document.querySelectorAll('td[data-rc-color]').forEach(c => { c.style.backgroundColor = ''; c.style.color = ''; delete c.dataset.rcColor; });
            },
            toggleLegend: function(show) {
                const LEGEND_ID = 'riscon-eff-legend-sidebar'; let legend = document.getElementById(LEGEND_ID);
                if (!show) { if (legend) legend.style.display = 'none'; return; }
                if (legend) { legend.style.display = 'block'; return; }
                if (!/f\?p=110:3110:/i.test(location.href)) return;
                const sidebar = document.querySelector('td.tbl-sidebar'); if (!sidebar) return;
                legend = document.createElement('div'); legend.id = LEGEND_ID;
                Object.assign(legend.style, { marginBottom: '10px', border: '1px solid #ccc', background: '#fff', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' });
                const EFF_LEVELS = [ { pct: 25, label: 'informování / značení', desc: 'Informování, značení, obecná pravidla.' }, { pct: 50, label: 'organizace / postupy', desc: 'Organizace, postupy, školení, OOPP.' }, { pct: 75, label: 'technická opatření', desc: 'Bariéry, varování, kontroly.' }, { pct: 95, label: 'bezpečnostní systémy', desc: 'Automatizace, zamezení vstupu.' } ];
                let html = `<div style="padding: 8px 10px; background: #f2f2f2; border-bottom: 1px solid #ccc; font-size: 12px; font-weight: bold; color: #333;">Legenda účinnosti</div><div style="padding: 8px; font-family:Tahoma,Arial,sans-serif; font-size:11px; line-height:1.4;">`;
                EFF_LEVELS.forEach(l => { html += `<div style="margin-bottom:6px;"><span style="font-weight:bold; color:#333;">${l.pct}% – ${l.label}</span><div style="color:#666; margin-top:2px;">${l.desc}</div></div>`; });
                html += '</div>'; legend.innerHTML = html;
                const targets = sidebar.querySelectorAll('.sidebar-region-alt, .sidebar-region');
                if (targets.length > 0) { const last = targets[targets.length - 1]; if (last.nextSibling) sidebar.insertBefore(legend, last.nextSibling); else sidebar.appendChild(legend); }
                else { sidebar.appendChild(legend); }
            }
        },

        // --- MODUL 3: SEZNAMY ---
        Lists: {
            containerId: 'cht-hidden-lists-container',
            toggle: function(enabled) {
                const el = document.getElementById(this.containerId);
                if (enabled) {
                    this.init();
                    if (el) {
                        el.style.display = '';
                        this.reapply();
                    }
                } else {
                    if (el) el.style.display = 'none';
                    this.restoreAllOptions();
                }
            },
            restoreAllOptions: function() {
                const leftSel = document.querySelector('select[id$="_LEFT"]');
                if (!leftSel) return;
                Array.from(leftSel.options).forEach(o => {
                    o.style.display = '';
                    o.disabled = false;
                });
            },
            reapply: function() {
                const leftSel = document.querySelector('select[id$="_LEFT"]');
                if (!leftSel) return;
                const STORAGE_KEY = 'cht_apex_hidden_workplaces_profiles';
                const pFlow = document.getElementById('pFlowId')?.value || '0';
                const pStep = document.getElementById('pFlowStepId')?.value || '0';
                const pageKey = `${pFlow}:${pStep}`;
                let storeAll = {};
                try { storeAll = JSON.parse(GM_getValue(STORAGE_KEY, '{}')); } catch(e){}
                const pageData = storeAll[pageKey];
                if (!pageData || !pageData.profiles) return;
                const hidden = new Set(pageData.profiles[pageData.activeProfile] || []);
                Array.from(leftSel.options).forEach(o => {
                    const h = hidden.has(o.value);
                    o.style.display = h ? 'none' : '';
                    o.disabled = h;
                });
            },
            init: function() {
                if (!Config.hiddenItems.enabled) return;
                const leftSel = document.querySelector('select[id$="_LEFT"]');
                if (!leftSel) return;
                if (document.getElementById(this.containerId)) return;

                const shuttleTable = leftSel.closest('table');
                const shuttleRow = shuttleTable ? shuttleTable.querySelector('tr') : null;
                if (!shuttleRow) return;

                const STORAGE_KEY = 'cht_apex_hidden_workplaces_profiles';
                const pFlow = document.getElementById('pFlowId')?.value || '0'; const pStep = document.getElementById('pFlowStepId')?.value || '0';
                const pageKey = `${pFlow}:${pStep}`;

                let storeAll = {}; try { storeAll = JSON.parse(GM_getValue(STORAGE_KEY, '{}')); } catch(e){}
                let pageData = storeAll[pageKey] || { activeProfile: 'default', profiles: {'default': []}, uiSize: {width: 350, height: 400} };
                if (Array.isArray(pageData)) pageData = { activeProfile: 'default', profiles: { 'default': pageData }, uiSize: {width:350,height:400} };
                let currentHidden = (pageData.profiles[pageData.activeProfile] || []).slice();

                const allOptions = Array.from(leftSel.options).map(o => ({ value: o.value, label: o.textContent, opt: o }));

                const save = () => { storeAll[pageKey] = pageData; GM_setValue(STORAGE_KEY, JSON.stringify(storeAll)); };

                const apply = () => {
                    const map = new Set(currentHidden);
                    allOptions.forEach(i => { const h = map.has(i.value); i.opt.style.display = h ? 'none' : ''; i.opt.disabled = h; i.opt.selected = false; });
                };

                const extraTd = document.createElement('td'); extraTd.className = 'shuttleSelect3'; extraTd.style.verticalAlign = 'top'; extraTd.id = this.containerId;
                const wrapper = document.createElement('div'); Object.assign(wrapper.style, { fontSize:'11px', fontFamily:'Tahoma,Arial', position:'relative', display:'inline-block', padding:'2px' });
                const profRow = document.createElement('div'); profRow.style.marginBottom = '6px';
                profRow.innerHTML = `Profil: <select id="cht-h-prof" style="width:100px;margin-right:4px"></select><input id="cht-h-name" placeholder="název" style="width:80px;margin-right:4px"><button type="button" style="padding:0 4px" id="cht-h-save">Uložit</button><button type="button" style="padding:0 4px" id="cht-h-del">Smazat</button>`;
                const sel = document.createElement('select'); sel.multiple = true;
                sel.style.width = (pageData.uiSize?.width || 350) + 'px'; sel.style.height = (pageData.uiSize?.height || 400) + 'px'; sel.style.fontSize = '10px';
                allOptions.forEach(i => sel.add(new Option(i.label, i.value)));
                const resetBtn = document.createElement('button'); resetBtn.innerHTML = '<span>Reset (zobrazit vše)</span>'; resetBtn.style.marginTop='6px';
                wrapper.append(profRow, document.createTextNode('Položky k NEnabízení:'), document.createElement('br'), sel, document.createElement('br'), resetBtn);
                extraTd.appendChild(wrapper); shuttleRow.appendChild(extraTd);

                const dom = { prof: profRow.querySelector('#cht-h-prof'), name: profRow.querySelector('#cht-h-name'), save: profRow.querySelector('#cht-h-save'), del: profRow.querySelector('#cht-h-del') };
                const rebuildProfs = () => { dom.prof.innerHTML = ''; Object.keys(pageData.profiles).forEach(k => dom.prof.add(new Option(k==='default'?'Výchozí':k, k, false, k===pageData.activeProfile))); };
                const syncSel = () => { const s = new Set(currentHidden); Array.from(sel.options).forEach(o => o.selected = s.has(o.value)); };

                dom.prof.onchange = () => { pageData.activeProfile = dom.prof.value; currentHidden = (pageData.profiles[pageData.activeProfile]||[]).slice(); save(); syncSel(); apply(); };
                sel.onchange = () => { currentHidden = Array.from(sel.selectedOptions).map(o => o.value); apply(); };
                dom.save.onclick = (e) => { e.preventDefault(); const n = dom.name.value.trim() || pageData.activeProfile || 'default'; pageData.profiles[n] = currentHidden.slice(); pageData.activeProfile = n; dom.name.value = ''; rebuildProfs(); save(); };
                dom.del.onclick = (e) => { e.preventDefault(); if(pageData.activeProfile === 'default') return; delete pageData.profiles[pageData.activeProfile]; pageData.activeProfile = 'default'; currentHidden = pageData.profiles.default.slice(); rebuildProfs(); syncSel(); apply(); save(); };
                resetBtn.onclick = (e) => { e.preventDefault(); currentHidden = []; syncSel(); apply(); };

                rebuildProfs(); syncSel(); apply();
            }
        },

        // --- MODUL 4: ŘÁDKY ---
        Rows: {
            initialized: false,
            init: function(){
                if (!Config.rowHighlight.enabled) {
                    document.querySelectorAll('tr.cht-row-highlight').forEach(tr => tr.classList.remove('cht-row-highlight'));
                    document.querySelectorAll('[id^="reset-"]').forEach(b => {
                        if (b.tagName === 'BUTTON' && b.textContent === 'Reset označení') b.remove();
                    });
                    return;
                }

                if (!this.initialized) {
                    this.initialized = true;
                    document.body.addEventListener('click', (e) => {
                        if (!Config.rowHighlight.enabled) return;
                        const tr = e.target.closest('table.a-IRR-table tr, table.t-Report-report tr, table.u-Report-table tr');
                        if (!tr) return;
                        if (e.target.closest('a, button, input, select, textarea')) return;

                        const table = tr.closest('table');
                        if (!table) return;

                        const link = tr.querySelector('a[href*="_ID:"]');
                        let key = link ? link.href.match(/P\d+_ID:([^:&?]+)/)?.[1] : null;
                        if (!key) {
                            const idx = Array.from(table.rows).indexOf(tr);
                            key = 'row_' + idx + '_' + tr.innerText.trim().slice(0,30);
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

            paintAll: function() {
                if (!Config.rowHighlight.enabled) return;
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
                        if (!key) key = 'row_' + rIdx + '_' + tr.innerText.trim().slice(0,30);

                        if (selected.includes(key)) {
                            if(!tr.classList.contains('cht-row-highlight')) tr.classList.add('cht-row-highlight');
                        } else {
                            if(tr.classList.contains('cht-row-highlight')) tr.classList.remove('cht-row-highlight');
                        }
                    });
                });
            },

            addResetButton: function(regionEl, regionKey) {
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
        },

        // --- MODUL 5: ZÁLOŽKY ---
        Tabs: {
            containerId: 'cht_rds_region',
            toggle: function(enabled) {
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
            reapply: function() {
                const tabsUl = document.querySelector('.apex-rds');
                if (!tabsUl) return;
                const STORAGE_KEY = 'cht_apex_rds_favs';
                const pageKey = (document.getElementById('pFlowId')?.value||'app')+':'+(document.getElementById('pFlowStepId')?.value||'page');
                let store = {};
                try { store = JSON.parse(GM_getValue(STORAGE_KEY, '{}')); } catch(e){}
                const selected = store[pageKey]||[];
                const lis = Array.from(tabsUl.querySelectorAll('li.apex-rds-item'));
                const map = lis.map((li,i)=>({li, key:li.id||li.querySelector('a')?.href||'idx_'+i, label:li.textContent.replace('★','').trim()}));
                this.colorTabs(map, selected);
            },
            init: function() {
                if(!Config.tabHighlight.enabled) return;
                if(document.getElementById(this.containerId)) return;

                const tabsUl = document.querySelector('.apex-rds'); const sidebar = document.querySelector('td.tbl-sidebar');
                if (!tabsUl || !sidebar) return;

                const STORAGE_KEY = 'cht_apex_rds_favs';
                const pageKey = (document.getElementById('pFlowId')?.value||'app')+':'+(document.getElementById('pFlowStepId')?.value||'page');
                let store = JSON.parse(GM_getValue(STORAGE_KEY, '{}')); let selected = store[pageKey]||[];

                const lis = Array.from(tabsUl.querySelectorAll('li.apex-rds-item'));
                const map = lis.map((li,i)=>({li, key:li.id||li.querySelector('a')?.href||'idx_'+i, label:li.textContent.replace('★','').trim()}));

                this.colorTabs(map, selected);

                const container = document.createElement('div'); container.id = this.containerId;
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
                map.forEach(m => sel.add(new Option(m.label,m.key,false,selected.includes(m.key))));

                sel.onchange = () => {
                    selected = Array.from(sel.selectedOptions).map(o=>o.value);
                    store[pageKey]=selected;
                    GM_setValue(STORAGE_KEY, JSON.stringify(store));
                    this.colorTabs(map, selected);
                };

                sidebar.insertBefore(container, sidebar.firstChild);
            },
            colorTabs: function(map, selected) {
                map.forEach(m => {
                    const is = selected.includes(m.key);
                    m.li.classList.toggle('cht-rds-highlight',is);
                    const s = m.li.querySelector('span');
                    if(s) {
                        const txt = s.textContent.replace(/^★\s*/, '');
                        s.textContent = (is ? '★ ' : '') + txt;
                    }
                });
            }
        },

        // --- MODUL 6: POSTRANNÍ PANEL (SIDEBAR TOGGLE) ---
        Sidebar: {
            containerId: 'sleek-toggle',
            toggle: function(enabled) {
                const btn = document.getElementById(this.containerId);
                if (enabled) {
                    document.body.classList.add('riscon-sidebar-enabled');
                    this.init();
                    if (btn) btn.style.display = 'flex';
                } else {
                    document.body.classList.remove('riscon-sidebar-enabled');
                    document.body.classList.remove('sidebar-collapsed');
                    if (btn) btn.style.display = 'none';
                }
            },
            init: function() {
                if (document.getElementById(this.containerId)) return;

                // Vyčištění případných starších prvků, pokud přežily
                ['pro-sidebar-toggle', 'pro-sidebar-restore', 'sidebar-toggle-handle', 'flex-handle'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.remove();
                });

                const STORAGE_KEY = 'apex_sidebar_collapsed_state';

                if (localStorage.getItem(STORAGE_KEY) === 'true') {
                    document.body.classList.add('sidebar-collapsed');
                }

                const btn = document.createElement('div');
                btn.id = this.containerId;
                btn.innerHTML = '<span>&#8250;</span>';
                btn.title = "Zobrazit / Skrýt postranní panel";
                document.body.appendChild(btn);

                btn.addEventListener('click', function() {
                    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
                    localStorage.setItem(STORAGE_KEY, isCollapsed);
                });
            }
        },

        // --- MODUL 7: DOKUMENTAČNÍ CHECKLIST ---
        Checklist: {
            toggle: function(enabled) {
                if (enabled) {
                    this.init();
                } else {
                    const tbl = document.querySelector('#report_5452278559883919240_catch table.report-standard');
                    if (tbl) {
                        tbl.querySelectorAll('tr.shadow-row').forEach(tr => tr.remove());
                        delete tbl.dataset.checklistApplied;
                    }
                }
            },
            init: function() {
                if (!Config.docChecklist.enabled) return;

                const reportContainer = document.getElementById('report_5452278559883919240_catch');
                if (!reportContainer) return;

                let table = reportContainer.querySelector('table.report-standard');

                // Pokud je report prázdný, vybudujeme prázdnou kostru tabulky
                if (!table && reportContainer.innerText.toLowerCase().includes('nodatafound')) {
                    reportContainer.innerHTML = `
                        <table cellpadding="0" border="0" cellspacing="0" summary="" class="report-standard" style="width:100%">
                            <tbody>
                                <tr>
                                    <th align="center" id="ID" class="header"></th>
                                    <th align="left" id="DOCUMENT_DESCRIPTION" class="header">Popis</th>
                                    <th align="left" id="DOCUMENT_NOTES" class="header">Poznámka</th>
                                    <th align="center" id="DOCUMENT" class="header">Dokument</th>
                                    <th align="right" id="FILE_SIZE" class="header">Velikost (kB)</th>
                                    <th align="left" id="CREATED_BY" class="header">Vytvořil</th>
                                    <th align="left" id="CREATED_ON" class="header">Vytvořeno</th>
                                    <th align="left" id="LAST_MODIFIED_BY" class="header">Upravil</th>
                                    <th align="left" id="LAST_MODIFIED_ON" class="header">Upraveno</th>
                                    <th align="left" id="DOCUMENT_LAST_UPDATE" class="header">Upload</th>
                                    <th align="center" id="HIDDEN" class="header">Skrytý</th>
                                </tr>
                            </tbody>
                        </table>`;
                    table = reportContainer.querySelector('table.report-standard');
                }

                if (!table || table.dataset.checklistApplied === "true") return;

                // Ochrana proti zacyklení Pulse observeru (report se občas AJAXově načítá)
                table.dataset.checklistApplied = "true";

                // Ujistíme se, že tabulka je připravena pro nové stínové řádky
                table.querySelectorAll('tr.shadow-row').forEach(tr => tr.remove());

                const eventIdElement = document.getElementById('P6501_ID');
                const eventId = eventIdElement ? eventIdElement.value : 'unknown_event';
                const storageKey = 'doc_checklist_' + eventId;

                const requiredDocs = [
                    { name: 'Záznam o úrazu', match: /záznam o úrazu/i },
                    { name: 'Rozhodnutí komise', match: /rozhodnutí komise/i },
                    { name: 'Poučný list', match: /poučný list/i },
                    { name: 'Denní poučení', match: /poučení/i },
                    { name: 'Seznámení s MBP', match: /seznámení s mbp/i },
                    { name: 'Lékařská prohlídka', match: /lékař/i },
                    { name: 'OOPP', match: /OOPP/i },
                    { name: 'Osnova školení', match: /školení/i },
                    { name: 'Rizika', match: /rizika/i }
                ];

                let manualChecks = JSON.parse(localStorage.getItem(storageKey) || '{}');
                const tbody = table.querySelector('tbody');

                const uploadedDocs = Array.from(tbody.querySelectorAll('td[headers="DOCUMENT_DESCRIPTION"]'))
                                          .map(td => td.innerText.trim());

                const unfulfilledDocs = requiredDocs.filter(reqDoc => {
                    const isUploaded = uploadedDocs.some(uploadedDoc => reqDoc.match.test(uploadedDoc));
                    return !isUploaded;
                }).map(reqDoc => reqDoc.name);

                const strictlyMissing = unfulfilledDocs.filter(doc => !manualChecks[doc]);
                const manuallyChecked = unfulfilledDocs.filter(doc => manualChecks[doc]);
                const sortedMissingDocs = [...strictlyMissing, ...manuallyChecked];

                sortedMissingDocs.forEach(doc => {
                    const isManuallyChecked = manualChecks[doc] === true;

                    const tr = document.createElement('tr');
                    tr.className = 'highlight-row shadow-row ' + (isManuallyChecked ? 'shadow-row-manual' : 'shadow-row-missing');

                    const tdCheck = document.createElement('td');
                    tdCheck.align = 'center';
                    tdCheck.className = 'data';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = isManuallyChecked;
                    cb.title = 'Označit jako nevyžadované / splněno jinak';
                    cb.style.cursor = 'pointer';

                    cb.addEventListener('change', function() {
                        manualChecks[doc] = this.checked;
                        localStorage.setItem(storageKey, JSON.stringify(manualChecks));
                        tr.className = 'highlight-row shadow-row ' + (this.checked ? 'shadow-row-manual' : 'shadow-row-missing');
                        tdDesc.style.color = this.checked ? '#666' : '#c62828';
                        tdNote.innerText = this.checked ? 'Nevyžadováno / splněno jinak (ručně)' : 'Chybějící povinný dokument';
                        tdNote.style.color = this.checked ? '#666' : '#c62828';
                    });
                    tdCheck.appendChild(cb);

                    const tdDesc = document.createElement('td');
                    tdDesc.headers = 'DOCUMENT_DESCRIPTION';
                    tdDesc.className = 'data';
                    tdDesc.innerText = doc;
                    tdDesc.style.fontWeight = 'bold';
                    tdDesc.style.color = isManuallyChecked ? '#666' : '#c62828';

                    const tdNote = document.createElement('td');
                    tdNote.headers = 'DOCUMENT_NOTES';
                    tdNote.className = 'data';
                    tdNote.innerText = isManuallyChecked ? 'Nevyžadováno / splněno jinak (ručně)' : 'Chybějící povinný dokument';
                    tdNote.style.fontStyle = 'italic';
                    tdNote.style.color = isManuallyChecked ? '#666' : '#c62828';

                    const emptyColsHtml = `
                        <td align="center" headers="DOCUMENT" class="data">-</td>
                        <td align="right" headers="FILE_SIZE" class="data">-</td>
                        <td headers="CREATED_BY" class="data">-</td>
                        <td headers="CREATED_ON" class="data">-</td>
                        <td headers="LAST_MODIFIED_BY" class="data">-</td>
                        <td headers="LAST_MODIFIED_ON" class="data">-</td>
                        <td headers="DOCUMENT_LAST_UPDATE" class="data">-</td>
                        <td align="center" headers="HIDDEN" class="data">-</td>
                    `;

                    tr.appendChild(tdCheck);
                    tr.appendChild(tdDesc);
                    tr.appendChild(tdNote);
                    tr.insertAdjacentHTML('beforeend', emptyColsHtml);

                    tbody.appendChild(tr);
                });
            }
        }
    };

    function start() { injectGlobalStyles(); createSettingsUI(); Modules.applyAll(); Pulse.start(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
