// ==UserScript==
// @name         Riscon: Sdružené skripty
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      8.0.5
// @description  Sdružený balík nástrojů pro Riscon.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @website      https://www.riscon.cz/
// @source       https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Riscon-komplet.user.js
// @supportURL   https://github.com/Martin-CHT/Riscon/issues
// @icon         https://www.oracle.com/a/ocom/img/rest.svg
// @icon64       https://www.oracle.com/a/ocom/img/rest.svg
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Riscon-komplet.user.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Riscon-komplet.user.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        none
// ==/UserScript==


(function () {
    'use strict';

    // ========================================================================
    // 1. JÁDRO SYSTÉMU A KONFIGURACE
    // ========================================================================
    const APP_KEY = 'RISCON_SUITE_V1';

    const DEFAULT_CONFIG = {
        json: { enabled: true },
        risks: { labels: true, colors: true, legend: true },
        hiddenItems: { enabled: true },
        rowHighlight: { enabled: true },
        tabHighlight: { enabled: true },
        // Nová nastavení průhlednosti
        settingsBtnOpacity: 0.2,
        scriptBtnOpacity: 0.2
    };

    let Config = null;
    try {
        Config = JSON.parse(localStorage.getItem(APP_KEY) || JSON.stringify(DEFAULT_CONFIG));
        // Fallback pro starší verze configu
        if (typeof Config.settingsBtnOpacity === 'undefined') Config.settingsBtnOpacity = 0.2;
        if (typeof Config.scriptBtnOpacity === 'undefined') Config.scriptBtnOpacity = 0.2;
    } catch (e) {
        Config = DEFAULT_CONFIG;
    }

    function saveConfig() { localStorage.setItem(APP_KEY, JSON.stringify(Config)); }
    const $ = (sel, root = document) => root.querySelector(sel);
    const pause = (ms) => new Promise(r => setTimeout(r, ms));

    // --- GLOBÁLNÍ STYLY (PRO TISK A UI) ---
    function injectGlobalStyles() {
        const styleId = 'riscon-global-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* SKRÝVÁNÍ PŘI TISKU (Natvrdo pro všechny prvky skriptu) */
            @media print {
                #riscon-settings-trigger,   /* Tlačítko nastavení */
                #riscon-suite-settings,     /* Panel nastavení */
                #apex-json-btnwrap,         /* Tlačítko Skript */
                #apex-json-panel,           /* Panel JSON */
                .ajp-btn,                   /* Tlačítka uvnitř panelů */
                #riscon-eff-legend-sidebar  /* Legenda v sidebaru */
                {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ========================================================================
    // 2. NASTAVENÍ UI
    // ========================================================================
    function createSettingsUI() {
        const btn = document.createElement('div');
        btn.id = 'riscon-settings-trigger';
        Object.assign(btn.style, {
            position: 'fixed', bottom: '11px', left: '9px', zIndex: '999999',
            background: '#333', color: '#fff', padding: '4px 10px', borderRadius: '2px',
            cursor: 'pointer', fontSize: '12px', fontFamily: 'Arial, sans-serif',
            opacity: Config.settingsBtnOpacity, transition: 'opacity 0.5s'
        });
        btn.textContent = '⚙ Riscon';

        // Dynamická změna opacity při hoveru
        btn.onmouseover = () => btn.style.opacity = '1';
        btn.onmouseout = () => btn.style.opacity = Config.settingsBtnOpacity;

        btn.onclick = toggleSettingsPanel;
        document.body.appendChild(btn);

        const panel = document.createElement('div');
        panel.id = 'riscon-suite-settings';
        Object.assign(panel.style, {
            position: 'fixed', bottom: '45px', left: '10px', width: '300px',
            background: '#fff', border: '1px solid #ccc', borderRadius: '6px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: '999999',
            padding: '15px', display: 'none', fontFamily: 'Segoe UI, Tahoma, sans-serif'
        });

        const checkbox = (id, label, checked, parentId = null) => `
            <div style="margin-bottom: 5px; ${parentId ? 'margin-left: 20px;' : ''}">
                <label style="display:flex; align-items:center; cursor:pointer;">
                    <input type="checkbox" data-id="${id}" ${parentId ? `data-parent="${parentId}"` : ''}
                    style="margin-right:8px;" ${checked ? 'checked' : ''}>
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
                <h3 style="margin:0 0 10px 0; font-size:16px; border-bottom:1px solid #eee; padding-bottom:5px;">Nastavení Riscon</h3>

                ${checkbox('json.enabled', 'JSON Nástroje (Panel)', Config.json.enabled)}

                <div style="margin: 8px 0 4px 0; font-weight:bold; font-size:13px; color:#333;">Vylepšení rizik:</div>
                ${checkbox('risks.labels', 'Oprava popisků (EN->CZ)', Config.risks.labels)}
                ${checkbox('risks.colors', 'Barevné zvýraznění rizik', Config.risks.colors)}
                ${checkbox('risks.legend', 'Legenda: Koeficient účinnosti', Config.risks.legend)}

                <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">

                ${checkbox('hiddenItems.enabled', 'Skrývání položek (Seznamy)', Config.hiddenItems.enabled)}
                ${checkbox('rowHighlight.enabled', 'Zvýraznění řádků (Klik)', Config.rowHighlight.enabled)}
                ${checkbox('tabHighlight.enabled', 'Zvýraznění záložek', Config.tabHighlight.enabled)}

                <div style="margin: 12px 0 4px 0; font-weight:bold; font-size:13px; color:#333; border-top:1px solid #eee; padding-top:8px;">Vzhled tlačítek:</div>
                ${rangeInput('settingsBtnOpacity', 'Průhlednost tlačítka ⚙ (vlevo)', Config.settingsBtnOpacity)}
                ${rangeInput('scriptBtnOpacity', 'Průhlednost tlačítka Skript (vpravo)', Config.scriptBtnOpacity)}

                <div style="margin-top:10px; font-size:10px; color:#888; text-align:right;">Změny se aplikují ihned.</div>
                <button id="rs-close-settings" style="position:absolute; top:10px; right:10px; border:none; background:none; cursor:pointer; font-size:16px;">&times;</button>
            `;

            panel.querySelector('#rs-close-settings').onclick = () => panel.style.display = 'none';

            // Listenery pro checkboxy
            panel.querySelectorAll('input[type="checkbox"]').forEach(ch => {
                ch.addEventListener('change', (e) => {
                    const path = e.target.dataset.id.split('.');
                    if (path.length === 2) Config[path[0]][path[1]] = e.target.checked;
                    saveConfig();
                    Modules.applyAll();
                });
            });

            // Listenery pro posuvníky (range)
            panel.querySelectorAll('input[type="range"]').forEach(rn => {
                rn.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    const id = e.target.dataset.id; // 'settingsBtnOpacity' nebo 'scriptBtnOpacity'
                    Config[id] = val;

                    // Aktualizace textu procent
                    const label = panel.querySelector(`#val-${id.replace('.','-')}`);
                    if(label) label.textContent = Math.round(val*100) + '%';

                    saveConfig();
                    updateOpacity(); // Okamžitá aplikace
                });
            });
        };

        renderPanel();
        document.body.appendChild(panel);

        function toggleSettingsPanel() {
            if (panel.style.display === 'none') { renderPanel(); panel.style.display = 'block'; } else { panel.style.display = 'none'; }
        }
    }

    // Funkce pro aktualizaci průhlednosti tlačítek v reálném čase
    function updateOpacity() {
        const settingsBtn = document.getElementById('riscon-settings-trigger');
        if (settingsBtn) {
            settingsBtn.style.opacity = Config.settingsBtnOpacity;
            settingsBtn.onmouseout = () => settingsBtn.style.opacity = Config.settingsBtnOpacity;
        }

        const scriptBtnWrap = document.getElementById('apex-json-btnwrap');
        if (scriptBtnWrap) {
            scriptBtnWrap.style.opacity = Config.scriptBtnOpacity;
            scriptBtnWrap.onmouseout = () => scriptBtnWrap.style.opacity = Config.scriptBtnOpacity;
        }
    }

    // ========================================================================
    // 3. DEFINICE MODULŮ
    // ========================================================================

    const Modules = {
        safeRun: function(moduleName, fn) {
            try { fn(); } catch (e) { console.error(`Riscon Suite: Chyba v modulu ${moduleName}:`, e); }
        },

        applyAll: function() {
            this.safeRun('JSON', () => this.Json.toggle(Config.json.enabled));
            this.safeRun('Risks', () => this.Risks.update(Config.risks));
            this.safeRun('Lists', () => this.Lists.toggle(Config.hiddenItems.enabled));
            this.safeRun('Rows', () => this.Rows.toggle(Config.rowHighlight.enabled));
            this.safeRun('Tabs', () => this.Tabs.toggle(Config.tabHighlight.enabled));
        },

        // --- MODUL 1: JSON ---
        Json: {
            initialized: false,
            toggle: function(enabled) {
                if (enabled && !this.initialized) {
                    this.init();
                    this.initialized = true;
                }
                const btn = $('#apex-json-btnwrap');
                const panel = $('#apex-json-panel');

                if (btn) btn.style.setProperty('display', enabled ? 'block' : 'none', 'important');
                if (panel && !enabled) panel.style.display = 'none';

                if (enabled && !btn && this.initialized) {
                    this.makeUI();
                }
                updateOpacity(); // Aplikovat opacity při inicializaci/toggle
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

                const setVal = (id, val) => {
                    const el = document.getElementById(id); if (!el) return;
                    let v = normalizeTail(id, (id==='P6206_EXACT_PLACE'||id==='P6206_LEGAL_REFERENCES') ? stripColon(val) : val);
                    if (el.tagName === 'SELECT') {
                        const sval = String(v ?? '');
                        Array.from(el.options).forEach(o => { if (o.textContent.trim().toLowerCase() === sval.trim().toLowerCase() || String(o.value).trim().toLowerCase() === sval.trim().toLowerCase()) el.value = o.value; });
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
                        if (['P3110_A4_FREQUENCY', 'P3110_A4_PROBABILITY', 'P3110_A4_CONSEQUENCE'].includes(k)) {
                            const sval = String(v); let radios = document.querySelectorAll(`input[type="radio"][name="${k}"], input[type="radio"][id^="${k}"]`);
                            radios.forEach(r => { if(String(r.value)===sval){ r.checked=true; fire(r); } });
                            await pause(20); continue;
                        }
                        if (/<[a-z][\s\S]*>/i.test(String(v))) setCk(k, v); else setVal(k, v); await pause(20);
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
                        return {
                            P6206_RANKING: id, P6206_DESCRIPTION: pick('Popis'), P6206_GRAVITY: '',
                            P6206_EXACT_PLACE: stripColon(pick('Místo',false)), P6206_LEGAL_REFERENCES: stripColon(pick('Odkazy',false)), P6206_IMMEDIATE_ACTION: pick('Okamžité')
                        };
                    });
                };
                const format = (arr) => arr.map(o => JSON.stringify(o, null, 2)).join('\n===========================\n');

                this.loadConfig = () => { try { return JSON.parse(localStorage.getItem(SIZE_KEY)); } catch { return null; } };
                this.savePanelConfig = (panel) => {
                    const s = window.getComputedStyle(panel);
                    localStorage.setItem(SIZE_KEY, JSON.stringify({ w: panel.offsetWidth, h: panel.offsetHeight, right: parseInt(s.right), bottom: parseInt(s.bottom) }));
                };

                this.makeUI = () => {
                    if (document.getElementById('ajp-style')) return;
                    const style = document.createElement('style');
                    style.id = 'ajp-style';
                    style.textContent = `
                        #apex-json-panel { display: flex; flex-direction: column; box-sizing: border-box; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.4; }
                        #apex-json-panel * { box-sizing: border-box; }
                        .ajp-head { flex: 0 0 auto; background: #f0f0f0; border-bottom: 1px solid #ccc; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; }
                        .ajp-title { font-weight: bold; font-size: 13px; color: #333; }
                        .ajp-body { flex: 1 1 auto; display: flex; flex-direction: column; padding: 10px; background: #fff; overflow: hidden; }
                        .ajp-foot { flex: 0 0 auto; background: #f9f9f9; border-top: 1px solid #ccc; padding: 8px; display: flex; gap: 8px; }
                        #apex-json-btnwrap { position:fixed; z-index:2147483647; pointer-events:auto; }
                        .ajp-btn { background:#eee; border:1px solid #ccc; border-radius:3px; padding:4px 8px; cursor:pointer; color:#333; font-size:12px; font-family: Arial, sans-serif; margin: 0; }
                        .ajp-btn:hover { background:#ddd; }
                    `;
                    document.head.appendChild(style);

                    // --- TLAČÍTKO SKRIPT (VPRAVO DOLE) ---
                    let btnWrap = $('#apex-json-btnwrap');
                    if (!btnWrap) {
                        btnWrap = document.createElement('div');
                        btnWrap.id = 'apex-json-btnwrap';

                        Object.assign(btnWrap.style, {
                            bottom: '11px', right: '7px',
                            opacity: Config.scriptBtnOpacity, transition: 'opacity 0.5s'
                        });

                        btnWrap.onmouseover = () => btnWrap.style.opacity = '1';
                        btnWrap.onmouseout = () => btnWrap.style.opacity = Config.scriptBtnOpacity;

                        const btn = document.createElement('button');
                        btn.id = 'apex-json-toggle';
                        btn.type = 'button';
                        btn.textContent = 'Skript';

                        Object.assign(btn.style, {
                            background: '#333', color: '#fff',
                            padding: '5px 10px', borderRadius: '2px',
                            border: '0px solid #aaaaaa', cursor: 'pointer',
                            fontSize: '12px', fontFamily: 'Arial, sans-serif',
                            display: 'block', margin: 0
                        });

                        btnWrap.appendChild(btn);
                        document.body.appendChild(btnWrap);
                    }

                    let panel = $('#apex-json-panel');
                    const stored = this.loadConfig();
                    if (!panel) {
                        panel = document.createElement('div'); panel.id = 'apex-json-panel';
                        Object.assign(panel.style, {
                            position: 'fixed', zIndex: '2147483646',
                            background: '#fff', border: '1px solid #999', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            display: 'none', borderRadius: '4px',
                            width: (stored?.w || 700) + 'px', height: (stored?.h || 380) + 'px',
                            right: (stored?.right ?? 20) + 'px', bottom: (stored?.bottom ?? 90) + 'px'
                        });

                        panel.innerHTML = `
                            <div class="ajp-head">
                                <span class="ajp-title">Riscon JSON</span>
                                <button class="ajp-btn" id="apex-json-close" type="button" style="padding:2px 6px;">✕</button>
                            </div>
                            <div class="ajp-body">
                                <div style="font-size:11px; color:#666; margin-bottom:5px;">Vlož JSON data:</div>
                                <textarea id="apex-json-text" style="flex:1; width:100%; border:1px solid #ccc; padding:5px; font-family:monospace; resize:none; outline:none;"></textarea>
                            </div>
                            <div class="ajp-foot">
                                <button class="ajp-btn" id="apex-json-fill" type="button">Vyplnit</button>
                                <button class="ajp-btn" id="apex-json-extract" type="button">Vytěžit</button>
                                <button class="ajp-btn" id="apex-json-clear" type="button">Vymazat</button>
                            </div>
                        `;
                        document.body.appendChild(panel);
                        this.addResizeHandles(panel);
                    }
                    $('#apex-json-toggle').onclick = (e) => { e.preventDefault(); panel.style.display = (panel.style.display==='none'?'flex':'none'); };
                    $('#apex-json-close', panel).onclick = () => panel.style.display = 'none';
                    $('#apex-json-clear', panel).onclick = () => $('#apex-json-text', panel).value = '';
                    $('#apex-json-extract', panel).onclick = () => { const d = extractBlocks(); $('#apex-json-text', panel).value = d.length ? format(d) : '// Nic'; };
                    $('#apex-json-fill', panel).onclick = async () => { try{ await fillForm($('#apex-json-text', panel).value); }catch(e){alert(e.message);} };
                };

                this.addResizeHandles = (panel) => {
                    ['tl','tr','bl','br'].forEach(pos => {
                        const h = document.createElement('div');
                        Object.assign(h.style, { position:'absolute', width:'15px', height:'15px', zIndex:'100', opacity:'0' });
                        if(pos.includes('t')) h.style.top='0'; else h.style.bottom='0';
                        if(pos.includes('l')) h.style.left='0'; else h.style.right='0';
                        h.style.cursor = (pos==='tl'||pos==='br') ? 'nwse-resize' : 'nesw-resize';
                        h.onmousedown = (e) => {
                            e.preventDefault();
                            const sX=e.clientX, sY=e.clientY, sW=panel.offsetWidth, sH=panel.offsetHeight;
                            const rect=panel.getBoundingClientRect(); const sR=document.documentElement.clientWidth-rect.right; const sB=document.documentElement.clientHeight-rect.bottom;
                            const mm = (em) => {
                                const dx=em.clientX-sX, dy=em.clientY-sY;
                                if (pos==='tl') { panel.style.width=Math.max(300,sW-dx)+'px'; panel.style.height=Math.max(200,sH-dy)+'px'; }
                                else if (pos==='tr') { panel.style.width=Math.max(300,sW+dx)+'px'; panel.style.height=Math.max(200,sH-dy)+'px'; panel.style.right=(sR-dx)+'px'; }
                                else if (pos==='bl') { panel.style.width=Math.max(300,sW-dx)+'px'; panel.style.height=Math.max(200,sH+dy)+'px'; panel.style.bottom=(sB-dy)+'px'; }
                                else if (pos==='br') { panel.style.width=Math.max(300,sW+dx)+'px'; panel.style.height=Math.max(200,sH+dy)+'px'; panel.style.right=(sR-dx)+'px'; panel.style.bottom=(sB-dy)+'px'; }
                            };
                            const mu = () => { document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu); this.savePanelConfig(panel); };
                            document.addEventListener('mousemove',mm); document.addEventListener('mouseup',mu);
                        };
                        panel.appendChild(h);
                    });
                };

                this.makeUI();
                // Attach guards
                const bg1 = document.getElementById('P6206_DESCRIPTION'); if(bg1) bg1.addEventListener('blur', ()=> { const f=normalizeTail('P6206_DESCRIPTION',bg1.value); if(f!==bg1.value) { bg1.value=f; fire(bg1); }});
                const bg2 = document.getElementById('P6206_LEGAL_REFERENCES'); if(bg2) bg2.addEventListener('blur', ()=> { const f=normalizeTail('P6206_LEGAL_REFERENCES',bg2.value); if(f!==bg2.value) { bg2.value=f; fire(bg2); }});
            }
        },

        // --- MODUL 2: RIZIKA ---
        Risks: {
            init: function() {
                this.update(Config.risks);
                new MutationObserver(() => this.update(Config.risks)).observe(document.body, {childList: true, subtree: true});
            },
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
                const normalizeText = (t) => t.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').replace(/\s*–\s*/g, ' - ').trim();
                const applyReplacements = (text) => {
                    let t = normalizeText(text);
                    for (const [p, r] of Object.entries(replacements)) t = t.replace(new RegExp(escapeRegex(p), 'gi'), r);
                    return t.replace(/\s+\)/g, ')').replace(/\(\s+/g, '(').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
                };
                document.querySelectorAll('label').forEach(label => {
                    const textNode = Array.from(label.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
                    const target = textNode || (label.childElementCount === 0 ? label : null);
                    if (!target) return;
                    if (!target.dataset) target.dataset = {};
                    if (!label.getAttribute('data-orig-text')) {
                        const raw = target.textContent;
                        if(raw.trim()) label.setAttribute('data-orig-text', raw);
                    }
                    if (enable) {
                        const orig = label.getAttribute('data-orig-text');
                        if (orig) {
                            const newText = applyReplacements(orig);
                            if (target.textContent !== newText) target.textContent = newText;
                        }
                    } else {
                        const orig = label.getAttribute('data-orig-text');
                        if (orig && target.textContent !== orig) target.textContent = orig;
                    }
                });
            },
            getColor: function(v) { return v <= 70 ? "#33B03D" : v <= 200 ? "#EBA100" : "#D40C0C"; },
            parseValue: function(t) {
                const n = parseFloat(t.replace(/\s+/g, ' ').replace(',', '.').replace(/[^\d.\-]/g, '').trim());
                return isNaN(n) ? null : n;
            },
            colorize: function() {
                document.querySelectorAll('td[headers="BALANCED_RISK_LEVEL"], td[headers="RISK_LEVEL"]').forEach(cell => {
                    const val = this.parseValue(cell.innerText || cell.textContent || '');
                    if (val !== null) {
                        cell.style.backgroundColor = this.getColor(val);
                        cell.style.color = "#fff";
                        cell.dataset.rc = "1";
                    }
                });
            },
            clearColors: function() {
                document.querySelectorAll('td[data-rc="1"]').forEach(c => {
                    c.style.backgroundColor = ''; c.style.color = ''; delete c.dataset.rc;
                });
            },
            toggleLegend: function(show) {
                const LEGEND_ID = 'riscon-eff-legend-sidebar';
                let legend = document.getElementById(LEGEND_ID);
                if (!show) { if (legend) legend.style.display = 'none'; return; }
                if (legend) { legend.style.display = 'block'; return; }

                if (!/f\?p=110:3110:/i.test(location.href)) return;
                const sidebar = document.querySelector('td.tbl-sidebar');
                if (!sidebar) return;

                legend = document.createElement('div');
                legend.id = LEGEND_ID;
                Object.assign(legend.style, {
                    marginBottom: '10px',
                    border: '1px solid #ccc',
                    background: '#fff',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                });

                const EFF_LEVELS = [
                    { pct: 25, label: 'informování / značení', desc: 'Informování, značení, obecná pravidla.' },
                    { pct: 50, label: 'organizace / postupy', desc: 'Organizace, postupy, školení, OOPP.' },
                    { pct: 75, label: 'technická opatření', desc: 'Bariéry, varování, kontroly.' },
                    { pct: 95, label: 'bezpečnostní systémy', desc: 'Automatizace, zamezení vstupu.' }
                ];

                let html = `
                    <div style="padding: 8px 10px; background: #f2f2f2; border-bottom: 1px solid #ccc; font-size: 12px; font-weight: bold; color: #333;">Legenda účinnosti</div>
                    <div style="padding: 8px; font-family:Tahoma,Arial,sans-serif; font-size:11px; line-height:1.4;">
                `;
                EFF_LEVELS.forEach(l => {
                    html += `<div style="margin-bottom:6px;">
                        <span style="font-weight:bold; color:#333;">${l.pct}% – ${l.label}</span>
                        <div style="color:#666; margin-top:2px;">${l.desc}</div>
                    </div>`;
                });
                html += '</div>';
                legend.innerHTML = html;

                const targets = sidebar.querySelectorAll('.sidebar-region-alt, .sidebar-region');
                if (targets.length > 0) {
                    const last = targets[targets.length - 1];
                    if (last.nextSibling) sidebar.insertBefore(legend, last.nextSibling);
                    else sidebar.appendChild(legend);
                } else {
                    sidebar.appendChild(legend);
                }
            }
        },

        // --- MODUL 3: SEZNAMY ---
        Lists: {
            containerId: 'cht-hidden-lists-container',
            toggle: function(enabled) {
                if (enabled) {
                    this.init();
                    const el = document.getElementById(this.containerId);
                    if (el) el.style.display = '';
                } else {
                    const el = document.getElementById(this.containerId);
                    if (el) el.style.display = 'none';
                }
            },
            init: function() {
                const attemptRun = (attempt = 1) => {
                   const leftSel = document.querySelector('select[id$="_LEFT"]');
                   if (!leftSel) { if(attempt < 10) setTimeout(() => attemptRun(attempt+1), 500); return; }
                   if (leftSel.closest('table').querySelector('.shuttleSelect3')) return;
                   this.buildUI(leftSel);
                };
                attemptRun();
            },
            buildUI: function(leftSel) {
                const STORAGE_KEY = 'cht_apex_hidden_workplaces_profiles';
                const shuttleTable = leftSel.closest('table');
                const shuttleRow = shuttleTable ? shuttleTable.querySelector('tr') : null;
                if (!shuttleRow) return;

                const allOptions = Array.from(leftSel.options).map(o => ({ value: o.value, label: o.textContent, opt: o }));
                const pFlow = document.getElementById('pFlowId')?.value || '0';
                const pStep = document.getElementById('pFlowStepId')?.value || '0';
                const pageKey = `${pFlow}:${pStep}`;

                let storeAll = {};
                try { storeAll = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e){}
                let pageData = storeAll[pageKey] || { activeProfile: 'default', profiles: {'default': []}, uiSize: {width: 350, height: 400} };
                if (Array.isArray(pageData)) pageData = { activeProfile: 'default', profiles: { 'default': pageData }, uiSize: {width:350,height:400} };
                let currentHidden = (pageData.profiles[pageData.activeProfile] || []).slice();

                const save = () => { storeAll[pageKey] = pageData; localStorage.setItem(STORAGE_KEY, JSON.stringify(storeAll)); };
                const apply = () => {
                    const map = new Set(currentHidden);
                    allOptions.forEach(i => {
                        const h = map.has(i.value);
                        i.opt.disabled = h; i.opt.hidden = h; i.opt.style.display = h ? 'none' : ''; i.opt.selected = false;
                    });
                };

                const extraTd = document.createElement('td');
                extraTd.className = 'shuttleSelect3'; extraTd.style.verticalAlign = 'top';
                extraTd.id = this.containerId;
                if (!Config.hiddenItems.enabled) extraTd.style.display = 'none';

                const wrapper = document.createElement('div');
                Object.assign(wrapper.style, { fontSize:'11px', fontFamily:'Tahoma,Arial', position:'relative', display:'inline-block', padding:'2px' });
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
            toggle: function(enabled){
                if(enabled) {
                    if (!document.getElementById('cht-row-highlight-style')) {
                        const s = document.createElement('style'); s.id = 'cht-row-highlight-style';
                        s.textContent = `tr.cht-row-highlight > td { background-color: #ffd95e !important; }`;
                        document.head.appendChild(s);
                    }
                    this.init();
                } else {
                    const s = document.getElementById('cht-row-highlight-style'); if(s) s.remove();
                    document.querySelectorAll('.cht-row-highlight').forEach(tr => tr.classList.remove('cht-row-highlight'));
                }
            },
            init: function(){
                if (window.apex && window.apex.jQuery) window.apex.jQuery(document).on('apexafterrefresh', () => this.process());
                this.process();
            },
            process: function() {
                if (!Config.rowHighlight.enabled) return;
                const STORAGE_KEY = 'cht_apex_row_highlight_v2';
                const pageKey = (document.getElementById('pFlowId')?.value || 'app') + ':' + (document.getElementById('pFlowStepId')?.value || 'page');
                let store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

                const selectors = 'table.a-IRR-table, table.t-Report-report, table.u-Report-table, table.highlight-rows';

                document.querySelectorAll(selectors).forEach((table, idx) => {
                    if (table.dataset.chtEnhanced) return;
                    table.dataset.chtEnhanced = '1';
                    const regionId = table.closest('[id^="R"]')?.id?.split('_')[0] || ('tbl_' + idx);
                    const regionKey = pageKey + '|' + regionId;
                    let selected = store[regionKey] || [];
                    let rows = [];

                    const apply = () => rows.forEach(r => r.tr.classList.toggle('cht-row-highlight', selected.includes(r.key)));
                    const save = () => { store[regionKey] = selected; localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); };

                    table.querySelectorAll('tr').forEach(tr => {
                        if (!tr.querySelector('td')) return;
                        const link = tr.querySelector('a[href*="_ID:"]');
                        const key = link ? (link.href.match(/P\d+_ID:([^:&?]+)/)?.[1]) : ('row_' + rows.length + '_' + tr.innerText.trim().slice(0,50));
                        if(!key) return;
                        rows.push({ tr, key });

                        tr.addEventListener('click', (e) => {
                            if (!Config.rowHighlight.enabled) return;
                            if (e.target.closest('a, button, input')) return;
                            const ctrl = e.ctrlKey || e.metaKey;
                            if (ctrl) { const i = selected.indexOf(key); if (i > -1) selected.splice(i, 1); else selected.push(key); }
                            else { if (selected.length === 1 && selected[0] === key) selected = [key]; else selected = [key]; }
                            apply(); save();
                        });
                    });
                    apply();
                    const container = table.closest('.t-Region, .a-IRR-region, .u-Region');
                    if (container && !document.getElementById('reset-'+regionKey)) {
                         const header = container.querySelector('.t-Region-headerItems, .a-IRR-controls');
                         if(header) {
                            const rBtn = document.createElement('button');
                            rBtn.type='button'; rBtn.className = 't-Button t-Button--small t-Button--simple';
                            rBtn.textContent = 'Reset označení'; rBtn.style.marginLeft = '8px'; rBtn.id = 'reset-'+regionKey;
                            rBtn.onclick = (e) => { e.preventDefault(); selected = []; apply(); save(); };
                            header.appendChild(rBtn);
                         }
                    }
                });
            }
        },

        // --- MODUL 5: ZÁLOŽKY ---
        Tabs: {
            containerId: 'cht_rds_region',
            toggle: function(enabled) {
                const c = document.getElementById(this.containerId);
                if (c) c.style.display = enabled ? '' : 'none';
                if (!document.getElementById('cht-rds-style') && enabled) {
                     const s = document.createElement('style'); s.id = 'cht-rds-style';
                     s.textContent = `.apex-rds-item.cht-rds-highlight > a { background-color: #ffd95e !important; color: #000 !important; font-weight: bold; }`;
                     document.head.appendChild(s);
                }
                if (enabled && !c) this.init();
            },
            init: function() { setTimeout(() => this.run(1), 300); },
            run: function(attempt) {
                const tabsUl = document.querySelector('.apex-rds'); const sidebar = document.querySelector('td.tbl-sidebar');
                if ((!tabsUl || !sidebar) && attempt < 10) return setTimeout(() => this.run(attempt + 1), 300);
                if (!tabsUl || !sidebar) return;

                const STORAGE_KEY = 'cht_apex_rds_favs';
                const pageKey = (document.getElementById('pFlowId')?.value||'app')+':'+(document.getElementById('pFlowStepId')?.value||'page');
                let store = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); let selected = store[pageKey]||[];

                const lis = Array.from(tabsUl.querySelectorAll('li.apex-rds-item'));
                const map = lis.map((li,i)=>({li, key:li.id||li.querySelector('a')?.href||'idx_'+i, label:li.textContent.replace('★','').trim()}));
                const apply = () => map.forEach(m => {
                    const is = selected.includes(m.key); m.li.classList.toggle('cht-rds-highlight',is);
                    const s = m.li.querySelector('span'); if(s) s.textContent=(is?'★ ':'')+m.label;
                });

                if(document.getElementById(this.containerId)) return;

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
                sel.onchange = () => { selected = Array.from(sel.selectedOptions).map(o=>o.value); store[pageKey]=selected; localStorage.setItem(STORAGE_KEY,JSON.stringify(store)); apply(); };

                sidebar.insertBefore(container, sidebar.firstChild);
                apply();
            }
        }
    };

    function start() { injectGlobalStyles(); createSettingsUI(); Modules.applyAll(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
