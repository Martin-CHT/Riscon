// ==UserScript==
// @name         Riscon: JSON nástroje
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.3
// @description  Panel pro vyplňování formulářů z JSON a vytěžování dat. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/04-modul-json.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/04-modul-json.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    RS.Modules.Json = {
        initialized: false,
        toggle: function (enabled) {
            if (enabled && !this.initialized) { this.init(); this.initialized = true; }
            const btn = RS.$('#apex-json-btnwrap');
            const panel = RS.$('#apex-json-panel');
            if (btn) btn.style.setProperty('display', enabled ? 'block' : 'none', 'important');
            if (panel && !enabled) panel.style.display = 'none';
            if (enabled && !btn && this.initialized) this.makeUI();
            if (RS.updateOpacity) RS.updateOpacity();
        },
        init: function () {
            const Config = RS.Config;
            const $ = RS.$;
            const pause = RS.pause;
            const SIZE_KEY = 'apexJsonPanelConfig_v8';

            const normalizeTail = (id, val) => {
                let s = String(val ?? '');
                if (id === 'P6206_IMMEDIATE_ACTION') return s;
                if (id !== 'P6206_DESCRIPTION' && id !== 'P6206_LEGAL_REFERENCES') return s;
                if (!s.trim()) return '';
                s = s.replace(/(?:\s|&nbsp;|<br\s*\/?>|<\/br>)+$/gi, '');
                return (id === 'P6206_DESCRIPTION' && /<\/(ul|ol)>\s*$/i.test(s)) ? s : s + '<br>';
            };
            const fire = (el) => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };
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
                    if (String(r.value).toLowerCase() === targetVal) { ensureChecked(r); return true; }
                }
                return false;
            };

            const setVal = (id, val) => {
                const el = document.getElementById(id); if (!el) return;
                let v = normalizeTail(id, (id === 'P6206_EXACT_PLACE' || id === 'P6206_LEGAL_REFERENCES') ? stripColon(val) : val);
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
            // Pomocná funkce pro získání CKEDITOR objektu:
            // unsafeWindow je přímý odkaz na skutečný window stránky v Tampermonkey sandboxu.
            // window.CKEDITOR může být nedostupné, pokud skript běží v izolovaném kontextu.
            const getCKE = () => {
                if (typeof unsafeWindow !== 'undefined' && unsafeWindow.CKEDITOR) return unsafeWindow.CKEDITOR;
                if (window.CKEDITOR) return window.CKEDITOR;
                return null;
            };

            const setCk = (id, val) => {
                let v = normalizeTail(id, (id === 'P6206_EXACT_PLACE' || id === 'P6206_LEGAL_REFERENCES') ? stripColon(val) : val);
                console.log(`[Riscon JSON] setCk('${id}') spusťěno, délka dat: ${v.length}`);

                // Vrstva 1: CKEditor API přes unsafeWindow nebo window
                const CKE = getCKE();
                console.log(`[Riscon JSON] getCKE() =`, CKE ? 'nalezeno' : 'NULL');
                if (CKE && CKE.instances && CKE.instances[id]) {
                    try {
                        console.log(`[Riscon JSON] Volám setData() pro '${id}'`);
                        CKE.instances[id].setData(v);
                        console.log(`[Riscon JSON] setData() pro '${id}' proběhlo OK`);
                        return;
                    } catch (e) {
                        console.warn(`[Riscon JSON] setData selhalo pro '${id}':`, e);
                    }
                } else {
                    console.log(`[Riscon JSON] CKE instance pro '${id}' nenalezena, zkouším iframe.`);
                }

                // Vrstva 2: Přímý zápis do iframe.contentDocument.body
                const ckeWrapper = document.getElementById('cke_' + id);
                console.log(`[Riscon JSON] div#cke_${id}:`, ckeWrapper ? 'nalezen' : 'CHYBÍ');
                if (ckeWrapper) {
                    const iframe = ckeWrapper.querySelector('iframe.cke_wysiwyg_frame');
                    console.log(`[Riscon JSON] iframe v div#cke_${id}:`, iframe ? 'nalezen' : 'CHYBÍ');
                    if (iframe) {
                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow?.document;
                            console.log(`[Riscon JSON] iframe.contentDocument:`, doc ? 'OK' : 'NULL', '| body:', doc?.body ? 'OK' : 'NULL');
                            if (doc && doc.body) {
                                doc.body.innerHTML = v;
                                const ta = document.getElementById(id);
                                if (ta) ta.value = v;
                                console.log(`[Riscon JSON] Přímý zápis do iframe pro '${id}' OK`);
                                return;
                            }
                        } catch (e) {
                            console.warn(`[Riscon JSON] Přímý zápis do iframe selhal pro '${id}':`, e);
                        }
                    }
                }

                // Vrstva 3: Poslední záchrana
                console.warn(`[Riscon JSON] Fallback setVal() pro '${id}' – CKEditor se nepodařilo aktualizovat.`);
                setVal(id, v);
            };

            async function fillForm(json) {
                let data;
                try { data = JSON.parse(String(json).trim().replace(/^([^{[]+)/, '').replace(/([^}\]]+)$/, '')); } catch {
                    try { data = JSON.parse('{' + json + '}'); } catch (e) { throw new Error('Chybný formát JSON'); }
                }
                for (const [k, v] of Object.entries(data)) {
                    if (v == null) continue;
                    const el = document.getElementById(k);
                    if (el) {
                        const type = (el.type || '').toLowerCase();
                        if (type === 'radio') {
                            if (!setRadioGroup(el.name || k, v)) setRadioGroup(k, v);
                        } else if (type === 'checkbox') {
                            const sv = String(v).toLowerCase();
                            const ev = String(el.value).toLowerCase();
                            if (sv === ev || sv === 'true' || sv === '1' || sv === 'y' || sv === 'on') {
                                ensureChecked(el);
                            } else if (el.checked) { el.click(); }
                        } else {
                            // Detekce CKEditor pole: primárně přes DOM (funguje i v Tampermonkey
                            // sandboxu kde window.CKEDITOR není dostupný), sekundárně přes API.
                            // CKEditor vytváří wrapper div s id="cke_{fieldId}" obsahující iframe.
                            const ckeDiv = document.getElementById('cke_' + k);
                            const isCkField = !!(window.CKEDITOR?.instances?.[k] ||
                                (ckeDiv && ckeDiv.querySelector('iframe.cke_wysiwyg_frame')));
                            if (isCkField) {
                                setCk(k, v);
                            } else {
                                setVal(k, v);
                            }
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
                    const pick = (l, html = true) => {
                        for (const s of t.querySelectorAll('strong')) if (new RegExp(`^${l}`, 'i').test(s.textContent.trim())) {
                            let n = s.nextSibling; let h = '';
                            while (n && n.tagName !== 'STRONG') { h += (html ? (n.outerHTML || n.textContent) : n.textContent); n = n.nextSibling; }
                            return h.trim().replace(/^:\s*/, '');
                        } return '';
                    };
                    const id = t.querySelector('th.si_th')?.textContent.match(/ID:\s*(\d+)/)?.[1] || '';
                    let gravityVal = '';
                    const header = t.querySelector('th.si_th')?.innerText || '';
                    const match = header.match(/-\s*(.+)$/);
                    if (match) {
                        const txt = match[1].trim().toLowerCase();
                        if (txt.includes('silná')) gravityVal = '1';
                        else if (txt.includes('komentář')) gravityVal = '2';
                        else if (txt.includes('slabá')) gravityVal = '3';
                        else if (txt.includes('závažná')) gravityVal = '5';
                        else if (txt.includes('neshoda')) gravityVal = '4';
                    }
                    return {
                        P6206_RANKING: id,
                        P6206_DESCRIPTION: pick('Popis'),
                        P6206_EXAMINED_PERSON: pick('Prověřovaná') || pick('Osoba'),
                        P6206_FOCUSED_ON: pick('Zaměření'),
                        P6206_GRAVITY: gravityVal || pick('Závažnost'),
                        P6206_EXACT_PLACE: stripColon(pick('Místo', false)),
                        P6206_LEGAL_REFERENCES: stripColon(pick('Odkazy', false)),
                        P6206_POSSIBLE_CAUSES: pick('Příčiny') || pick('Možné příčiny'),
                        P6206_IMMEDIATE_ACTION: pick('Okamžité')
                    };
                });
            };

            const extractForm = () => {
                const data = {};
                document.querySelectorAll('input, select, textarea').forEach(el => {
                    const id = el.id;
                    if (!id || !/^P\d+_/.test(id)) return;
                    const type = (el.type || '').toLowerCase();
                    if (type === 'hidden' || type === 'button' || type === 'submit') return;
                    if (type === 'checkbox' || type === 'radio') {
                        if (el.checked) data[id] = el.value;
                    } else {
                        if (window.CKEDITOR?.instances?.[id]) {
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
            this.savePanelConfig = (panel) => {
                const s = window.getComputedStyle(panel);
                GM_setValue(SIZE_KEY, JSON.stringify({ w: panel.offsetWidth, h: panel.offsetHeight, right: parseInt(s.right), bottom: parseInt(s.bottom) }));
            };

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
                    btnWrap.onmouseover = () => btnWrap.style.opacity = '1';
                    btnWrap.onmouseout = () => btnWrap.style.opacity = Config.scriptBtnOpacity;
                    const b = document.createElement('button'); b.id = 'apex-json-toggle'; b.type = 'button'; b.textContent = 'Skript';
                    Object.assign(b.style, { background: '#333', color: '#fff', padding: '5px 10px', borderRadius: '2px', border: '0px solid #aaaaaa', cursor: 'pointer', fontSize: '12px', fontFamily: 'Arial, sans-serif', display: 'block', margin: 0 });
                    btnWrap.appendChild(b); document.body.appendChild(btnWrap);
                }
                let panel = $('#apex-json-panel');
                const stored = this.loadConfig();
                if (!panel) {
                    panel = document.createElement('div'); panel.id = 'apex-json-panel';
                    Object.assign(panel.style, { position: 'fixed', zIndex: '2147483646', background: '#fff', border: '1px solid #999', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'none', borderRadius: '4px', width: (stored?.w || 700) + 'px', height: (stored?.h || 380) + 'px', right: (stored?.right ?? 20) + 'px', bottom: (stored?.bottom ?? 90) + 'px' });
                    panel.innerHTML = `
                        <div class="ajp-head"><span class="ajp-title">Riscon JSON</span><button class="ajp-btn" id="apex-json-close" type="button" style="padding:2px 6px;">✕</button></div>
                        <div class="ajp-body"><div style="font-size:11px; color:#666; margin-bottom:5px;">Vlož JSON data:</div><textarea id="apex-json-text" style="flex:1; width:100%; border:1px solid #ccc; padding:5px; font-family:monospace; resize:none; outline:none;"></textarea></div>
                        <div class="ajp-foot"><button class="ajp-btn" id="apex-json-fill" type="button">Vyplnit</button><button class="ajp-btn" id="apex-json-extract" type="button">Vytěžit</button><button class="ajp-btn" id="apex-json-clear" type="button">Vymazat</button></div>
                    `;
                    document.body.appendChild(panel);
                    this.addResizeHandles(panel);
                }
                $('#apex-json-toggle').onclick = (e) => { e.preventDefault(); panel.style.display = (panel.style.display === 'none' ? 'flex' : 'none'); };
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
                            if (formData.hasOwnProperty('P6201_I_DATE_START') || document.getElementById('P6201_I_DATE_START')) formData['P6201_I_DATE_START'] = today;
                            if (formData.hasOwnProperty('P6201_I_DATE_END') || document.getElementById('P6201_I_DATE_END')) formData['P6201_I_DATE_END'] = today;
                            $('#apex-json-text', panel).value = JSON.stringify(formData, null, 2);
                            btnEl.textContent = 'Vytěženo (Force Date)';
                            setTimeout(() => btnEl.textContent = origText, 2000);
                        } else {
                            $('#apex-json-text', panel).value = '// Nic k vytěžení nenalezeno (žádná tabulka rizik ani formulářová data).';
                        }
                    }
                };
                $('#apex-json-fill', panel).onclick = async () => { try { await fillForm($('#apex-json-text', panel).value); } catch (e) { alert(e.message); } };
            };

            this.addResizeHandles = (panel) => {
                ['tl', 'tr', 'bl', 'br'].forEach(pos => {
                    const h = document.createElement('div');
                    Object.assign(h.style, { position: 'absolute', width: '15px', height: '15px', zIndex: '100', opacity: '0' });
                    if (pos.includes('t')) h.style.top = '0'; else h.style.bottom = '0';
                    if (pos.includes('l')) h.style.left = '0'; else h.style.right = '0';
                    h.style.cursor = (pos === 'tl' || pos === 'br') ? 'nwse-resize' : 'nesw-resize';
                    h.onmousedown = (e) => {
                        e.preventDefault();
                        const sX = e.clientX, sY = e.clientY, sW = panel.offsetWidth, sH = panel.offsetHeight;
                        const mm = (em) => {
                            const dx = em.clientX - sX, dy = em.clientY - sY;
                            if (pos === 'tl') { panel.style.width = Math.max(300, sW - dx) + 'px'; panel.style.height = Math.max(200, sH - dy) + 'px'; }
                            else if (pos === 'tr') { panel.style.width = Math.max(300, sW + dx) + 'px'; panel.style.height = Math.max(200, sH - dy) + 'px'; panel.style.right = (document.documentElement.clientWidth - panel.getBoundingClientRect().right - dx) + 'px'; }
                            else if (pos === 'bl') { panel.style.width = Math.max(300, sW - dx) + 'px'; panel.style.height = Math.max(200, sH + dy) + 'px'; panel.style.bottom = (document.documentElement.clientHeight - panel.getBoundingClientRect().bottom - dy) + 'px'; }
                            else if (pos === 'br') { panel.style.width = Math.max(300, sW + dx) + 'px'; panel.style.height = Math.max(200, sH + dy) + 'px'; panel.style.right = (document.documentElement.clientWidth - panel.getBoundingClientRect().right - dx) + 'px'; panel.style.bottom = (document.documentElement.clientHeight - panel.getBoundingClientRect().bottom - dy) + 'px'; }
                        };
                        const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); this.savePanelConfig(panel); };
                        document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
                    };
                    panel.appendChild(h);
                });
            };

            this.makeUI();
            const bg1 = document.getElementById('P6206_DESCRIPTION');
            if (bg1) bg1.addEventListener('blur', () => { const f = normalizeTail('P6206_DESCRIPTION', bg1.value); if (f !== bg1.value) { bg1.value = f; fire(bg1); } });
            const bg2 = document.getElementById('P6206_LEGAL_REFERENCES');
            if (bg2) bg2.addEventListener('blur', () => { const f = normalizeTail('P6206_LEGAL_REFERENCES', bg2.value); if (f !== bg2.value) { bg2.value = f; fire(bg2); } });
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        console.warn('Riscon JSON: Běží samostatně bez sdíleného Config. Doporučeno spustit přes hlavní skript.');
    }

})();
