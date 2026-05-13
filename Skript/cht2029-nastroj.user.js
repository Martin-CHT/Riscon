// ==UserScript==
// @name         Riscon: Import z CHT 2029
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.2.0
// @description  Načte zaškrtnuté AR profily a CHT dokumenty z formuláře CHT 2029 a automaticky je vybere/označí v Riscon. Stránka 3191: přesouvá profily do výběru a vypíše 2-sloupcovou tabulku. Stránka 10300: zvýrazní příslušné dokumenty.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/cht2029-nastroj.user.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/cht2029-nastroj.user.js
// @match        https://*/ords/*/f?p=110:3191:*
// @match        https://*/ords/*/f?p=110:10300:*
// @match        https://www.riscon.cz/go/f?p=110:3191:*
// @match        https://www.riscon.cz/go/f?p=110:10300:*
// @noframes
// @run-at       document-end
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ── Detekce stránky ────────────────────────────────────────────────────────
<<<<<<< HEAD
    const ON_3191 = /[?&]p=110:3191:/i.test(location.href) || /f\?p=110:3191:/i.test(location.href);
=======
    const ON_3191  = /[?&]p=110:3191:/i.test(location.href)  || /f\?p=110:3191:/i.test(location.href);
>>>>>>> 6b5339cbb2eb8b5473d11da305e2a295067a59aa
    const ON_10300 = /[?&]p=110:10300:/i.test(location.href) || /f\?p=110:10300:/i.test(location.href);
    if (!ON_3191 && !ON_10300) return;

    // ── Konstanty ──────────────────────────────────────────────────────────────
    const CHECKBOX_CHECKED = 'w:default w:val="1"';

    // AR kódy mají různé formáty: AR_4120, AR_43120.01, AR_42120_07.1,
    // AR 42120_03.04 (mezera), AR_2800-14, AR_68320_01 …
    // Pattern zachytí "AR" + oddělovač + číslo + libovolný počet (oddělovač+číslo)
    const AR_RE = /AR[\s_\-]\d+(?:[_\-\.]\d+)*/g;

    // CHT kódy: "CHT 2021", "CHT2003" – hodnoty mohou být rozděleny do více runů
    // takže pattern testujeme až po extrakci textu buňky, ne na raw XML
    const CHT_RE = /CHT\s*(\d{4})/;

    // ── Extrakce textu buněk z XML ─────────────────────────────────────────────
    // DŮLEŽITÉ: testy pattern provádíme vždy na extrahovaném textu, NIKDY na raw XML,
    // protože Word může rozdělit jeden řetězec do více <w:r> runů.

    function cellTexts(rowXml) {
        const cells = [];
        const cellRe = /<w:tc>[\s\S]*?<\/w:tc>/g;
        let cm;
        while ((cm = cellRe.exec(rowXml)) !== null) {
            const tRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
            const parts = [];
            let tm;
            while ((tm = tRe.exec(cm[0])) !== null) parts.push(tm[1]);
            cells.push(parts.join('').replace(/\s+/g, ' ').trim());
        }
        return cells;
    }

    // ── Parsování DOCX ─────────────────────────────────────────────────────────
    async function readDocxXml(file) {
        const buf = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        return zip.file('word/document.xml').async('text');
    }

    // Vrátí pole { code, desc } pro všechny zaškrtnuté AR řádky
    function extractCheckedAR(xml) {
        const items = [];
        const rowRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
        let rm;
        while ((rm = rowRe.exec(xml)) !== null) {
            const row = rm[0];

            // Musí mít zaškrtnutý checkbox
            if (!row.includes(CHECKBOX_CHECKED)) continue;

            // Extrahuj text buněk (teprve pak hledej AR kód)
            const cells = cellTexts(row);

            // Hledej AR kód v textu každé buňky
            let code = null, desc = '';
            for (let i = 0; i < cells.length; i++) {
                AR_RE.lastIndex = 0;
                const m = AR_RE.exec(cells[i]);
                if (m) {
                    code = m[0].trim().replace(/\s+/g, '_'); // normalizuj mezeru → podtržítko
                    // Popis hledáme v DALŠÍ buňce; pokud neexistuje, vezmeme zbytek buňky s kódem
                    desc = (cells[i + 1] !== undefined ? cells[i + 1]
<<<<<<< HEAD
                        : cells[i].replace(m[0], '')).trim();
=======
                           : cells[i].replace(m[0], '')).trim();
>>>>>>> 6b5339cbb2eb8b5473d11da305e2a295067a59aa
                    break;
                }
            }
            if (!code) continue;
            items.push({ code, desc });
        }
        return items;
    }

    // Vrátí pole { code } pro všechny zaškrtnuté CHT řádky
    function extractCheckedCHT(xml) {
        const items = [];
        const rowRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
        let rm;
        while ((rm = rowRe.exec(xml)) !== null) {
            const row = rm[0];
            if (!row.includes(CHECKBOX_CHECKED)) continue;

            // Extrahuj text buněk (run spliting!)
            const cells = cellTexts(row);
            const fullText = cells.join(' ');

            const m = CHT_RE.exec(fullText);
            if (!m) continue;

            items.push({ code: 'CHT ' + m[1], label: fullText.trim() });
        }
        return items;
    }

    // ── Shuttle – přesun profilů na stránce 3191 ──────────────────────────────

    // Normalizace AR kódu: oddělí "AR" prefix a čísla, oddělí veškeré separátory
    // AR_43120.01 → ["43120","01"], AR 42120_03.04 → ["42120","03","04"]
    function arSegments(code) {
        return code.toUpperCase()
<<<<<<< HEAD
            .replace(/^AR[\s_\-]*/i, '')
            .split(/[\s_\-\.]+/)
            .filter(Boolean);
=======
                   .replace(/^AR[\s_\-]*/i, '')
                   .split(/[\s_\-\.]+/)
                   .filter(Boolean);
>>>>>>> 6b5339cbb2eb8b5473d11da305e2a295067a59aa
    }

    // Sestaví regex, který matchuje AR kód v textu option bez ohledu na konkrétní oddělovač
    function makeArRe(code) {
        const segs = arSegments(code);
        const body = segs.join('[\\s_\\-\\.]+');
        return new RegExp('#?AR[\\s_\\-]' + body + '(?=[^\\d]|$)', 'i');
    }

    function moveProfilesToRight(arItems) {
<<<<<<< HEAD
        const leftSel = document.getElementById('P3191_PROFILE_IDS_LEFT');
        const rightSel = document.getElementById('P3191_PROFILE_IDS_RIGHT');
        if (!leftSel || !rightSel) return { moved: [], notFound: arItems.map(i => i.code) };

        const moved = [];
=======
        const leftSel  = document.getElementById('P3191_PROFILE_IDS_LEFT');
        const rightSel = document.getElementById('P3191_PROFILE_IDS_RIGHT');
        if (!leftSel || !rightSel) return { moved: [], notFound: arItems.map(i => i.code) };

        const moved    = [];
>>>>>>> 6b5339cbb2eb8b5473d11da305e2a295067a59aa
        const notFound = [];

        arItems.forEach(item => {
            const re = makeArRe(item.code);
            const toMove = Array.from(leftSel.options).filter(o => re.test(o.text));
            if (toMove.length === 0) {
                notFound.push(item.code);
                return;
            }
            toMove.forEach(opt => rightSel.appendChild(opt)); // přesune DOM uzel
            moved.push(item.code);
        });

        // Notifikuj APEX o změně
        ['change', 'input'].forEach(ev =>
            rightSel.dispatchEvent(new Event(ev, { bubbles: true }))
        );

        return { moved, notFound };
    }

    // ── Tabulka pro Excel (oddělovač = tabulátor) ──────────────────────────────
    // Formát: "Popis AR_KÓD" v každé buňce – 2 buňky na řádek, oddělené tabulátorem
    // Sloupce plní shora dolů (novinové řazení):
    //   28 položek → sloupec 1: řádky 1–14, sloupec 2: řádky 15–28
    function itemLabel(item) {
        return item.desc ? `${item.desc} ${item.code}` : item.code;
    }

    function buildExcelTable(items) {
        const half = Math.ceil(items.length / 2);
        const col1 = items.slice(0, half);
        const col2 = items.slice(half);
        const rows = [];
        for (let i = 0; i < half; i++) {
            const l = col1[i] ? itemLabel(col1[i]) : '';
            const r = col2[i] ? itemLabel(col2[i]) : '';
            rows.push(l + '\t' + r);
        }
        return rows.join('\n');
    }

    // ── Zvýraznění CHT dokumentů na stránce 10300 ─────────────────────────────
    function highlightCHTRows(chtItems) {
        const nums = chtItems.map(i => i.code.replace('CHT ', '').trim());
        const cells = document.querySelectorAll('td[headers="FORM_HID"]');
        let count = 0;
        cells.forEach(cell => {
            const txt = cell.textContent.trim();
            // Základní číslo CHT musí souhlasit; za ním může být suffix (A, B, _A, _B…)
            // ale nesmí pokračovat další číslicí (aby CHT 2003 nechytil CHT 20030)
            const matched = nums.some(n => new RegExp('^CHT\\s*' + n + '(?:[^0-9]|$)', 'i').test(txt));
            if (!matched) return;
            const row = cell.closest('tr');
            if (!row) return;
            // background-color musí jít na <td>, ne na <tr> — APEX má barvy přímo na buňkách
            row.querySelectorAll('td').forEach(td =>
                td.style.setProperty('background-color', '#d4edda', 'important')
            );
            row.style.setProperty('outline', '2px solid #28a745', 'important');
            count++;
        });
        return count;
    }

    // ── UI panel ───────────────────────────────────────────────────────────────
    const PANEL_ID = 'cht2029-panel';

    function buildPanel() {
        if (document.getElementById(PANEL_ID)) return;
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = [
            'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
            'background:#fff', 'border:2px solid #2d6a9f', 'border-radius:7px',
            'padding:14px 16px', 'box-shadow:0 6px 18px rgba(0,0,0,.22)',
            'font-family:Tahoma,Arial,sans-serif', 'font-size:12px',
            'min-width:260px', 'max-width:360px'
        ].join(';');

        panel.innerHTML = `
<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
  <span style="font-size:16px;">📄</span>
  <strong style="color:#2d6a9f;font-size:13px;">Import z CHT 2029</strong>
  <button id="cht2029-close" title="Zavřít"
    style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:18px;line-height:1;color:#999;">×</button>
</div>
<input type="file" id="cht2029-file" accept=".docx" style="display:none;">
<button id="cht2029-open-btn"
  style="width:100%;padding:7px 0;background:#2d6a9f;color:#fff;border:none;
         border-radius:5px;cursor:pointer;font-size:12px;font-family:inherit;">
  Vybrat soubor CHT 2029.docx
</button>
<div id="cht2029-status" style="margin-top:8px;color:#666;font-size:11px;min-height:16px;"></div>
<div id="cht2029-body"  style="display:none;margin-top:10px;"></div>`;

        document.body.appendChild(panel);

<<<<<<< HEAD
        document.getElementById('cht2029-close').onclick = () => panel.remove();
        document.getElementById('cht2029-open-btn').onclick = () =>
            document.getElementById('cht2029-file').click();
        document.getElementById('cht2029-file').onchange = e => {
=======
        document.getElementById('cht2029-close').onclick   = () => panel.remove();
        document.getElementById('cht2029-open-btn').onclick = () =>
            document.getElementById('cht2029-file').click();
        document.getElementById('cht2029-file').onchange   = e => {
>>>>>>> 6b5339cbb2eb8b5473d11da305e2a295067a59aa
            if (e.target.files.length) handleFile(e.target.files[0]);
        };
    }

    function setStatus(msg, color) {
        const el = document.getElementById('cht2029-status');
        if (el) { el.textContent = msg; el.style.color = color || '#555'; }
    }

    async function handleFile(file) {
        setStatus('Zpracovávám soubor…');
        const body = document.getElementById('cht2029-body');
        if (body) { body.style.display = 'none'; body.innerHTML = ''; }

        try {
            const xml = await readDocxXml(file);

<<<<<<< HEAD
            const arItems = extractCheckedAR(xml);
=======
            const arItems  = extractCheckedAR(xml);
>>>>>>> 6b5339cbb2eb8b5473d11da305e2a295067a59aa
            const chtItems = extractCheckedCHT(xml);

            setStatus(`Nalezeno: ${arItems.length} AR profilů, ${chtItems.length} CHT dokumentů`);

<<<<<<< HEAD
            if (ON_3191) showResults3191(arItems, body);
=======
            if (ON_3191)  showResults3191(arItems, body);
>>>>>>> 6b5339cbb2eb8b5473d11da305e2a295067a59aa
            if (ON_10300) showResults10300(chtItems, body);
            if (body) body.style.display = 'block';

        } catch (err) {
            setStatus('Chyba: ' + err.message, '#c00');
            console.error('[CHT2029]', err);
        }
    }

    function showResults3191(arItems, body) {
        if (!body) return;
        const { moved, notFound } = moveProfilesToRight(arItems);
        const tableText = buildExcelTable(arItems);

        let html = '';
        if (moved.length) {
            html += `<div style="color:#28a745;font-weight:bold;margin-bottom:6px;">
                ✓ Přesunuto: ${moved.length} profil${moved.length > 4 ? 'ů' : moved.length > 1 ? 'y' : ''}
            </div>`;
        }
        if (notFound.length) {
            html += `<div style="color:#c62828;margin-bottom:6px;font-size:11px;">
                Nenalezeno v shuttle: ${notFound.join(', ')}
            </div>`;
        }

        html += `<div style="font-weight:bold;margin-bottom:4px;">Tabulka pro Excel:</div>
<textarea id="cht2029-tbl" style="
  width:100%;height:120px;font-family:monospace;font-size:9.5px;
  box-sizing:border-box;resize:vertical;border:1px solid #ccc;
  border-radius:4px;padding:4px;" readonly>${tableText}</textarea>
<button id="cht2029-copy"
  style="width:100%;margin-top:5px;padding:5px 0;background:#28a745;color:#fff;
         border:none;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit;">
  Kopírovat tabulku (Ctrl+C)
</button>`;

        body.innerHTML = html;

        document.getElementById('cht2029-copy').onclick = function () {
            const ta = document.getElementById('cht2029-tbl');
            ta.select();
            try {
                navigator.clipboard.writeText(ta.value).then(() => flash(this));
            } catch (_) {
                document.execCommand('copy');
                flash(this);
            }
        };

        function flash(btn) {
            const orig = btn.textContent;
            btn.textContent = '✓ Zkopírováno!';
            setTimeout(() => { btn.textContent = orig; }, 2000);
        }
    }

    function showResults10300(chtItems, body) {
        if (!body) return;
        const count = highlightCHTRows(chtItems);
        body.innerHTML = `
<div style="color:#28a745;font-weight:bold;margin-bottom:6px;">
  ✓ Zvýrazněno: ${count} ${count === 1 ? 'dokument' : count < 5 ? 'dokumenty' : 'dokumentů'}
</div>
<div style="color:#555;font-size:11px;">${chtItems.map(i => i.code).join(', ') || '—'}</div>`;
    }

    // ── Start ──────────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildPanel);
    } else {
        buildPanel();
    }

<<<<<<< HEAD
})();
=======
})();
>>>>>>> 6b5339cbb2eb8b5473d11da305e2a295067a59aa
