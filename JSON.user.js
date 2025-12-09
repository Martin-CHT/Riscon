// ==UserScript==
// @name           Riscon: JSON
// @namespace      https://github.com/Martin-CHT/Riscon
// @version        7.5.0
// @description    Vyplní formulář z JSONu a vytěží tisk zpět do JSONu.
// @author         Martin
// @copyright      2025, Martin
// @license        Proprietary - internal use only
// @homepageURL    https://github.com/Martin-CHT/Riscon
// @website        https://www.riscon.cz/
// @source         https://raw.githubusercontent.com/Martin-CHT/Riscon/master/JSON.user.js
// @supportURL     https://github.com/Martin-CHT/Riscon/issues
// @icon           https://www.oracle.com/a/ocom/img/rest.svg
// @icon64         https://www.oracle.com/a/ocom/img/rest.svg
// @updateURL      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/JSON.user.js
// @downloadURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/JSON.user.js
// @match          https://*/ords/*/f?p=110:*
// @match          https://www.riscon.cz/go/f?p=110*
// @noframes
// @run-at         document-end
// @tag            Riscon
// @tag            BOZP
// @grant          none
// ==/UserScript==

(function () {
  'use strict';
  // ========== VÝCHOZÍ ŠABLONA JSONU ==========
  // Základní struktura: pole s jedním záznamem P6206_*
  const DEFAULT_JSON_TEMPLATE = `  `;

  // ---------- helpers ----------
  const pause = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (sel, root = document) => root.querySelector(sel);
  const stripColon = (t) => String(t || '').replace(/^[\s\u00A0]*:\s*/, '');
  const endsWithList = (html) => /<\/(ul|ol)>\s*$/i.test(String(html || '').trim());

  // Normalizace konce textu dle pole:
  // - P6206_DESCRIPTION: max 1 <br> (pokud končí </ul>/<ol>, nepřidávat)
  // - P6206_LEGAL_REFERENCES: vždy právě 1 <br>
  // - P6206_IMMEDIATE_ACTION: nikdy <br> nepřidávat
  const normalizeTail = (id, val) => {
    const guard = (id === 'P6206_DESCRIPTION' || id === 'P6206_LEGAL_REFERENCES');
    let s = String(val ?? '');
    if (id === 'P6206_IMMEDIATE_ACTION') return s;
    if (!guard) return s;
    if (!s.trim()) return '';
    // odstraň trailing whitespace/&nbsp;/<br>
    s = s.replace(/(?:\s|&nbsp;|<br\s*\/?>|<\/br>)+$/gi, '');
    if (id === 'P6206_DESCRIPTION') {
      if (endsWithList(s)) return s; // po </ul>/<ol> nic nepřidávat
      return s + '<br>';
    }
    // LEGAL_REFERENCES: vždy 1x <br>
    return s + '<br>';
  };

  const fire = (el) => {
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // ---------- radio helper ----------
  const setRadio = (nameOrId, val) => {
    const sval = String(val);

    // 1) pokus podle name
    let radios = document.querySelectorAll(`input[type="radio"][name="${nameOrId}"]`);

    // 2) fallback: id s daným prefixem (P3110_A4_FREQUENCY_0, _1, …)
    if (!radios.length) {
      radios = document.querySelectorAll(`input[type="radio"][id^="${nameOrId}"]`);
    }
    if (!radios.length) return;

    let target = null;
    radios.forEach(r => {
      if (String(r.value) === sval) target = r;
    });
    if (!target) return;

    target.checked = true;
    fire(target);
  };

  // ---------- set values ----------
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    let v = val;
    if (id === 'P6206_EXACT_PLACE' || id === 'P6206_LEGAL_REFERENCES') v = stripColon(v);
    v = normalizeTail(id, v);
    if (el.tagName === 'SELECT') {
      const sval = String(v ?? '');
      Array.from(el.options).forEach(o => {
        if (
          o.textContent.trim().toLowerCase() === sval.trim().toLowerCase() ||
          String(o.value).trim().toLowerCase() === sval.trim().toLowerCase()
        ) el.value = o.value;
      });
    } else {
      el.value = v ?? '';
    }
    fire(el);
  };

  const setCk = (id, val) => {
    let v = val;
    if (id === 'P6206_EXACT_PLACE' || id === 'P6206_LEGAL_REFERENCES') v = stripColon(v);
    v = normalizeTail(id, v);
    if (window.CKEDITOR?.instances?.[id]) { CKEDITOR.instances[id].setData(v); return; }
    setVal(id, v);
  };

  const htmlToText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return stripColon(div.textContent || '');
  };

  // ---------- tolerant JSON parser with auto-wrapping ----------
  function parseMaybeRelaxedJSON(text) {
    let input = String(text ?? '').trim();

    // Pokud je vstup prázdný
    if (!input) {
      throw new Error('Prázdný JSON.');
    }

    // Automatické doplnění závorek, pokud chybí
    const startsWithBrace = input.startsWith('{') || input.startsWith('[');
    const endsWithBrace = input.endsWith('}') || input.endsWith(']');

    if (!startsWithBrace && !endsWithBrace) {
      // Žádné závorky - obalíme {}
      input = '{' + input + '}';
    } else if (startsWithBrace && !endsWithBrace) {
      // Pouze počáteční závorka - doplníme koncovou
      input = input + (input.startsWith('{') ? '}' : ']');
    } else if (!startsWithBrace && endsWithBrace) {
      // Pouze koncová závorka - doplníme počáteční
      input = (input.endsWith('}') ? '{' : '[') + input;
    }
    // Jinak má obě závorky nebo je to pole - necháme beze změny

    // Zkusíme standardní JSON parse
    try {
      return JSON.parse(input);
    } catch {}

    // Pokud selže, použijeme relaxed parsing
    try {
      let t = input.replace(/\r\n/g, '\n');
      // escape syrové \n uvnitř stringů
      let out = '', inStr = false, esc = false;
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (!inStr) {
          if (ch === '"') inStr = true, out += ch;
          else out += ch;
        } else {
          if (esc) {
            out += ch;
            esc = false;
          } else if (ch === '\\') {
            out += ch;
            esc = true;
          } else if (ch === '"') {
            out += ch;
            inStr = false;
          } else if (ch === '\n') {
            out += '\\n';
          } else {
            out += ch;
          }
        }
      }
      t = out
        .replace(/([{,\s])'([^']*)'\s*:/g, '$1"$2":')           // 'key':
        .replace(/:\s*'([^']*)'(\s*[,\}\]])/g, ':"$1"$2')        // :'value'
        .replace(/,\s*([}\]])/g, '$1');                          // trailing comma
      return JSON.parse(t);
    } catch (e) {
      throw new Error('Chybný JSON – zkontroluj formát: "P0000_DESCRIPTION": "text",');
    }
  }

  // ---------- GK radio položky (F / P / C) ----------
  const GK_RADIOS = new Set([
    'P3110_A4_FREQUENCY',
    'P3110_A4_PROBABILITY',
    'P3110_A4_CONSEQUENCE'
  ]);

  // ---------- fill ----------
  async function fillForm(json) {
    const data = typeof json === 'string' ? parseMaybeRelaxedJSON(json) : json;

    for (const [k, v] of Object.entries(data)) {
      if (v == null) continue;

      // GK F / P / C → rádio podle name/id a value
      if (GK_RADIOS.has(k)) {
        setRadio(k, v);
        await pause(20);
        continue;
      }

      // ostatní položky
      if (/<[a-z][\s\S]*>/i.test(String(v))) setCk(k, v);
      else setVal(k, v);
      await pause(20);
    }
  }

  // ---------- extract ----------
  const extractBlocks = () => {
    const tables = [...document.querySelectorAll('table.si_table')].filter(t => /#\s*\d+,\s*ID:/i.test(t.textContent));
    const out = [];
    for (const t of tables) {
      const th = t.querySelector('th.si_th');
      const td = t.querySelector('td.si_td');
      const header = th?.textContent || '';
      const id = header.match(/ID:\s*(\d+)/)?.[1] || '';
      const gravity = ['Silná stránka', 'Slabá stránka', 'Komentář', 'Neshoda', 'Závažná neshoda']
        .find(g => header.toLowerCase().includes(g.toLowerCase())) || '';
      const pick = (label) => {
        const strongs = td.querySelectorAll('strong');
        for (const s of strongs) {
          if (new RegExp(`^${label}`, 'i').test(s.textContent.trim())) {
            let n = s.nextSibling;
            while (n && ((n.nodeType === 3 && /^\s*$/.test(n.textContent)) || n.tagName === 'BR')) n = n.nextSibling;
            if (!n) return '';
            if (n.textContent?.startsWith(':')) n.textContent = stripColon(n.textContent);
            let html = '';
            while (n && (!n.tagName || n.tagName !== 'STRONG')) {
              html += n.outerHTML ?? n.textContent;
              n = n.nextSibling;
            }
            return html.trim();
          }
        }
        return '';
      };
      const desc  = pick('Popis');
      const place = htmlToText(pick('Místo'));
      const refs  = htmlToText(pick('Odkazy'));
      const act   = pick('Okamžité');
      out.push({
        P6206_RANKING: id,
        P6206_DESCRIPTION: desc,
        P6206_GRAVITY: gravity,
        P6206_EXACT_PLACE: place,
        P6206_LEGAL_REFERENCES: refs,
        P6206_IMMEDIATE_ACTION: act
      });
    }
    return out;
  };

  const format = (arr) =>
    arr.map(o =>
`{
  "P6206_RANKING": ${JSON.stringify(String(o.P6206_RANKING || ''))},
  "P6206_DESCRIPTION": ${JSON.stringify(o.P6206_DESCRIPTION || '')},
  "P6206_GRAVITY": ${JSON.stringify(o.P6206_GRAVITY || '')},
  "P6206_EXACT_PLACE": ${JSON.stringify(o.P6206_EXACT_PLACE || '')},
  "P6206_LEGAL_REFERENCES": ${JSON.stringify(o.P6206_LEGAL_REFERENCES || '')},
  "P6206_IMMEDIATE_ACTION": ${JSON.stringify(o.P6206_IMMEDIATE_ACTION || '')}
}`).join('\n===========================\n');

  // ---------- UI (no scroll jump, tidy buttons, remember size) ----------
  const SIZE_KEY = 'apexJsonPanelSize_v49';

  function loadSize() {
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      if (!raw) return null;
      const { w, h } = JSON.parse(raw);
      if (!w || !h) return null;
      return { w: Math.max(520, w), h: Math.max(280, h) };
    } catch { return null; }
  }

  function saveSize(panel) {
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify({
        w: panel.offsetWidth,
        h: panel.offsetHeight
      }));
    } catch {}
  }

  function clampPanel(panel) {
    const vw = Math.max(300, window.innerWidth);
    const vh = Math.max(300, window.innerHeight);
    const minW = 520, minH = 280;
    const maxW = vw - 40;
    const maxH = vh - 120;
    panel.style.width  = Math.min(Math.max(panel.offsetWidth,  minW), maxW) + 'px';
    panel.style.height = Math.min(Math.max(panel.offsetHeight, minH), maxH) + 'px';
  }

  function makeUI() {
    // styl včetně skrytí při tisku
    const style = document.createElement('style');
    style.textContent = `
      #apex-json-panel, #apex-json-panel * { box-sizing: border-box; }
      #apex-json-panel .rc-buttons button { margin:0 !important; }
      #apex-json-toolbar { display:flex; gap:8px; padding:6px 8px; border-top:1px solid #ddd; }
      #apex-json-toolbar .button-gray { flex:0 0 auto; white-space:nowrap; }
      #apex-json-btnwrap { position:fixed; bottom:20px; right:20px; z-index:2147483647; pointer-events:auto; }
      #apex-json-btnwrap .button-gray span { pointer-events:none; }
      @media print { #apex-json-btnwrap, #apex-json-panel { display:none !important; } }
    `;
    document.head.appendChild(style);

    // plovoucí tlačítko
    let btnWrap = $('#apex-json-btnwrap');
    if (!btnWrap) {
      btnWrap = document.createElement('div');
      btnWrap.id = 'apex-json-btnwrap';
      btnWrap.className = 'rc-buttons';
      const btn = document.createElement('button');
      btn.id = 'apex-json-toggle';
      btn.className = 'button-gray';
      btn.type = 'button';
      btn.innerHTML = '<span>Skript</span>';
      btnWrap.appendChild(btn);
      document.body.appendChild(btnWrap);
    }

    // panel
    let panel = $('#apex-json-panel');
    const stored = loadSize();
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'apex-json-panel';
      panel.className = 'rounded-corner-region';
      Object.assign(panel.style, {
        position: 'fixed',
        bottom: '90px', right: '20px',
        width:  stored?.w ? stored.w + 'px' : '700px',
        height: stored?.h ? stored.h + 'px' : '380px',
        display: 'none',
        zIndex: '2147483646',
        background: '#fff',
        overflow: 'hidden',
        resize: 'both',
        transition: 'none'
      });
      panel.innerHTML = `
        <div class="rc-blue-top"><div class="rc-blue-top-r">
          <div class="rc-title">Riscon JSON</div>
          <div class="rc-buttons"><button class="button-gray" id="apex-json-close" type="button"><span>Zavřít</span></button></div>
        </div></div>
        <div class="rc-body" style="height:calc(100% - 50px); display:flex; flex-direction:column;">
          <div class="rc-body-r" style="flex:1 1 auto; display:flex; flex-direction:column;">
            <div class="rc-content-main" style="flex:1 1 auto; padding:8px; display:flex; flex-direction:column; gap:8px;">
              <div style="font-size:12px;opacity:.85;">Vlož JSON data (závorky { } jsou volitelné). Při chybě se provede automatická oprava.</div>
              <div style="flex:1 1 auto; min-height:140px; display:flex;">
                <textarea id="apex-json-text" style="flex:1 1 auto; width:100%; height:100%; font-family:monospace; border:1px solid #ccc; border-radius:4px; padding:6px; resize:none;"></textarea>
              </div>
            </div>
          </div>
          <div id="apex-json-toolbar" class="rc-buttons">
            <button class="button-gray" id="apex-json-fill"    type="button"><span>Vyplnit formulář</span></button>
            <button class="button-gray" id="apex-json-extract" type="button"><span>Vytěžit tisk</span></button>
            <button class="button-gray" id="apex-json-clear"   type="button"><span>Vymazat</span></button>
          </div>
        </div>
        <div class="rc-bottom"><div class="rc-bottom-r"></div></div>
      `;
      document.body.appendChild(panel);
    }

    // bez rolování (okamžitě)
    const noJump = (fn) => (e) => {
      const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      e?.preventDefault?.();
      e?.stopPropagation?.();
      fn?.();
      window.scrollTo(0, y);
    };

    // ---------- OTEVŘENÍ HUD + PŘEDVYPLNĚNÍ ŠABLONY ----------
    $('#apex-json-toggle').addEventListener('click', noJump(() => {
      const wasHidden = (panel.style.display === 'none' || !panel.style.display);
      panel.style.display = wasHidden ? 'block' : 'none';
      if (wasHidden) {
        const ta = $('#apex-json-text', panel);
        if (ta && !ta.value.trim()) {
          ta.value = DEFAULT_JSON_TEMPLATE;
        }
      }
    }));

    $('#apex-json-close', panel).addEventListener('click', noJump(() => panel.style.display = 'none'));
    $('#apex-json-clear', panel).addEventListener('click', noJump(() => { $('#apex-json-text', panel).value = ''; }));

    $('#apex-json-extract', panel).addEventListener('click', noJump(() => {
      const data = extractBlocks();
      $('#apex-json-text', panel).value = data.length ? format(data) : '// Nic nenalezeno.';
    }));

    $('#apex-json-fill', panel).addEventListener('click', noJump(async () => {
      try {
        await fillForm($('#apex-json-text', panel).value);
      } catch (e) {
        alert('Chybný JSON.\n' + (e?.message || ''));
      }
    }));

    // uložení velikosti + limity
    const ro = new ResizeObserver(() => { clampPanel(panel); saveSize(panel); });
    ro.observe(panel);
    window.addEventListener('resize', () => clampPanel(panel));

    // pojistka pro tisk (skryj i při old-events)
    const hideForPrint = () => { btnWrap.style.display = 'none'; panel.style.display = 'none'; };
    const showAfterPrint = () => { btnWrap.style.display = ''; };
    window.addEventListener('beforeprint', hideForPrint);
    window.addEventListener('afterprint',  showAfterPrint);
  }

  // ---------- BR guardy při ruční editaci ----------
  function attachBrGuardToTextarea(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      const fixed = normalizeTail(id, el.value);
      if (fixed !== el.value) { el.value = fixed; fire(el); }
    });
  }

  function attachBrGuardToCKE(id) {
    if (!window.CKEDITOR?.instances?.[id]) return;
    const inst = CKEDITOR.instances[id];
    inst.on('blur', () => {
      const fixed = normalizeTail(id, inst.getData() || '');
      if (fixed !== inst.getData()) inst.setData(fixed);
    });
  }

  function bootstrapBrGuards() {
    attachBrGuardToTextarea('P6206_DESCRIPTION');
    attachBrGuardToTextarea('P6206_LEGAL_REFERENCES');
    if (window.CKEDITOR?.instances) {
      attachBrGuardToCKE('P6206_DESCRIPTION');
      attachBrGuardToCKE('P6206_LEGAL_REFERENCES');
    }
  }

  // ---------- start ----------
  const start = () => { makeUI(); bootstrapBrGuards(); };
  if (document.readyState === 'complete' || document.readyState === 'interactive') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
