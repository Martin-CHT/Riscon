// ==UserScript==
// @name         Riscon: Import z CHT 2029
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      2.6.0
// @description  Načte zaškrtnuté AR profily a CHT dokumenty z formuláře CHT 2029 (.xlsx) a automaticky je vybere/označí v Riscon. Stránka 3191: přesouvá profily do výběru a vypíše 2-sloupcovou tabulku. Stránka 10300: zvýrazní příslušné dokumenty.
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

    // ── Detekce stránky ─────────────────────────────────────────────────────────
    const ON_3191  = /[?&]p=110:3191:/i.test(location.href) || /f\?p=110:3191:/i.test(location.href);
    const ON_10300 = /[?&]p=110:10300:/i.test(location.href) || /f\?p=110:10300:/i.test(location.href);
    if (!ON_3191 && !ON_10300) return;

    // ── Konstanty ───────────────────────────────────────────────────────────────
    // AR kódy: AR_4120, AR_43120.01, AR_42120_07.1, AR 42120_03.04, AR_2800-14 …
    const AR_RE = /AR[\s_\-]\d+(?:[_\-\.]\d+)*/g;

    // CHT kódy: "CHT 2021", "CHT2003", "CHT 2004 A"
    const CHT_RE = /CHT\s*(\d{4})(?:\s*([A-Za-z]))?/;

    // Hranice řádků v XLSX
    const DOC_ROW_MIN  = 36;   // Dokumenty: řádky 36–80 (stránka 10300)
    const DOC_ROW_MAX  = 80;
    const PROF_ROW_MIN = 86;   // Profily: řádky 86–666 (stránka 3191)
    const PROF_ROW_MAX = 666;

    // ── Parsování XLSX ──────────────────────────────────────────────────────────

    /**
     * Parsuje sharedStrings.xml → pole řetězců (indexované od 0).
     * Podporuje jednoduché <t> i rich-text <r><t>…</t></r>.
     */
    function parseSharedStrings(xml) {
        if (!xml) return [];
        const strings = [];
        const siRe = /<si>([\s\S]*?)<\/si>/g;
        let m;
        while ((m = siRe.exec(xml)) !== null) {
            const tRe = /<t[^>]*>([^<]*)<\/t>/g;
            let tm, text = '';
            while ((tm = tRe.exec(m[1])) !== null) {
                text += tm[1];
            }
            strings.push(text);
        }
        return strings;
    }

    /**
     * Parsuje sheet1.xml → Map(rowNumber → { B: '…', C: '…', D: '…', E: '…' }).
     * Čte pouze řádky v rozsahu dokumentů a profilů.
     */
    function parseSheetRows(xml, strings) {
        const rows = new Map();
        const rowRe = /<row\s+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
        let rm;
        while ((rm = rowRe.exec(xml)) !== null) {
            const rowNum = parseInt(rm[1]);
            if ((rowNum < DOC_ROW_MIN || rowNum > DOC_ROW_MAX) &&
                (rowNum < PROF_ROW_MIN || rowNum > PROF_ROW_MAX)) continue;

            const cells = {};
            const content = rm[2];
            let pos = 0;

            while (true) {
                // Najdi další <c element
                const cellStart = content.indexOf('<c ', pos);
                if (cellStart === -1) break;

                // Najdi konec elementu: buď /> (samouzavírací) nebo ></c> (s obsahem)
                const selfClose = content.indexOf('/>', cellStart);
                const tagEnd    = content.indexOf('>', cellStart);
                let cellEnd, inner = '';

                if (tagEnd === -1) break;

                if (selfClose !== -1 && selfClose < tagEnd) {
                    // Samouzavírací: <c ... />
                    cellEnd = selfClose + 2;
                } else {
                    // S obsahem: <c ...>...</c>
                    const contentClose = content.indexOf('</c>', tagEnd);
                    if (contentClose === -1) break;
                    inner = content.substring(tagEnd + 1, contentClose);
                    cellEnd = contentClose + 4;
                }

                const tag = content.substring(cellStart, cellEnd);

                // Extrahuj sloupec z r="X##"
                const rMatch = /r="([A-Z]+)\d+"/.exec(tag);
                if (!rMatch) { pos = cellEnd; continue; }
                const col = rMatch[1];

                // Extrahuj hodnotu
                const vMatch = /<v>([^<]*)<\/v>/.exec(inner);
                if (!vMatch) { pos = cellEnd; continue; }

                if (tag.includes(' t="s"')) {
                    const idx = parseInt(vMatch[1]);
                    cells[col] = (strings[idx] !== undefined) ? strings[idx] : '';
                } else if (tag.includes(' t="inlineStr"')) {
                    const isMatch = /<t[^>]*>([^<]*)<\/t>/.exec(inner);
                    cells[col] = isMatch ? isMatch[1] : '';
                } else {
                    cells[col] = vMatch[1];
                }

                pos = cellEnd;
            }

            rows.set(rowNum, cells);
        }
        return rows;
    }

    /**
     * Parsuje sekci <controls> v sheet1.xml → pole { ctrlPropNum, col, row }.
     * Každý <control> element obsahuje shapeId, r:id (→ ctrlProp číslo)
     * a <anchor> s pozicí (sloupec, řádek).
     *
     * Formát: <control shapeId="1027" r:id="rId4" …>
     *           <controlPr …><anchor …>
     *             <from><xdr:col>7</xdr:col><xdr:row>35</xdr:row>…</from>
     *           </anchor></controlPr>
     *         </control>
     *
     * rId→ctrlProp: rId4→ctrlProp1, rId5→ctrlProp2 (offset = 3)
     * row je 0-indexed → Excel řádek = row + 1
     */
    function parseSheetControls(sheetXml) {
        const controls = [];
        const ctrlRe = /<control\s+shapeId="\d+"\s+r:id="rId(\d+)"[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?<\/control>/g;
        let m;
        while ((m = ctrlRe.exec(sheetXml)) !== null) {
            const rId = parseInt(m[1]);
            controls.push({
                ctrlPropNum: rId - 3,       // rId4→1, rId5→2 …
                col:         parseInt(m[2]), // 1 = sloupec B, 7 = sloupec H
                row:         parseInt(m[3]) + 1  // 0-indexed → 1-indexed
            });
        }
        return controls;
    }

    /**
     * Hlavní funkce: rozbalí XLSX, přečte zaškrtnuté checkboxy a vrátí AR/CHT položky.
     * @returns {{ arItems: {code,desc}[], chtItems: {code,label}[] }}
     */
    async function readXlsxData(file) {
        const buf = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);

        // 1. Tabulka sdílených řetězců
        const ssFile = zip.file('xl/sharedStrings.xml');
        const strings = ssFile ? parseSharedStrings(await ssFile.async('text')) : [];
        console.log('[CHT2029] Sdílených řetězců:', strings.length);

        // 2. Data buněk + kontrolní prvky (obojí ze sheet1.xml)
        const sheetFile = zip.file('xl/worksheets/sheet1.xml');
        if (!sheetFile) throw new Error('Soubor neobsahuje worksheet (xl/worksheets/sheet1.xml).');
        const sheetXml = await sheetFile.async('text');

        const rows = parseSheetRows(sheetXml, strings);
        console.log('[CHT2029] Načtených řádků:', rows.size);

        const allControls = parseSheetControls(sheetXml);
        console.log('[CHT2029] Kontrol celkem:', allControls.length);

        // 3. Filtrujeme: jen sloupec B v cílových rozsazích řádků
        const relevantControls = allControls.filter(c =>
            c.col === 1 &&
            ((c.row >= DOC_ROW_MIN && c.row <= DOC_ROW_MAX) ||
             (c.row >= PROF_ROW_MIN && c.row <= PROF_ROW_MAX))
        );
        console.log('[CHT2029] Relevantních checkboxů (sl. B):', relevantControls.length);

        // 4. Čteme relevantní ctrlProp soubory a hledáme checked="Checked"
        const checkedRows = new Set();
        const checkPromises = relevantControls.map(ctrl => {
            const ctrlFile = zip.file('xl/ctrlProps/ctrlProp' + ctrl.ctrlPropNum + '.xml');
            if (!ctrlFile) return Promise.resolve();
            return ctrlFile.async('text').then(content => {
                if (content.includes('checked="Checked"')) {
                    checkedRows.add(ctrl.row);
                }
            });
        });
        await Promise.all(checkPromises);
        console.log('[CHT2029] Zaškrtnutých řádků:', checkedRows.size, [...checkedRows].sort((a, b) => a - b));

        // 5. Extrakce AR profilů a CHT dokumentů ze zaškrtnutých řádků
        const arItems  = [];
        const chtItems = [];
        const seenArCodes  = new Set(); // Deduplikace AR profilů
        const seenChtCodes = new Set(); // Deduplikace CHT dokumentů

        for (const rowNum of checkedRows) {
            const row = rows.get(rowNum);
            if (!row) continue;

            if (rowNum >= PROF_ROW_MIN && rowNum <= PROF_ROW_MAX) {
                // Profil: čteme sloupec D (AR kód)
                const cellD = (row['D'] || '').trim();
                if (!cellD) continue;
                AR_RE.lastIndex = 0;
                const m = AR_RE.exec(cellD);
                const code = m ? m[0].trim().replace(/\s+/g, '_') : cellD;
                // Deduplikace: stejný kód přeskočíme
                if (seenArCodes.has(code)) continue;
                seenArCodes.add(code);
                const desc = (row['E'] || '').trim();
                arItems.push({ code, desc });
            } else if (rowNum >= DOC_ROW_MIN && rowNum <= DOC_ROW_MAX) {
                // Dokument: čteme sloupec C (název/kód dokumentu)
                const cellC = (row['C'] || '').trim();
                if (!cellC) continue;

                const m = CHT_RE.exec(cellC);
                if (m) {
                    // Máme CHT kód (např. "CHT 2005" nebo "CHT 2004 A")
                    const code = 'CHT ' + m[1] + (m[2] ? ' ' + m[2].toUpperCase() : '');
                    if (seenChtCodes.has(code)) continue;
                    seenChtCodes.add(code);
                    chtItems.push({ code, label: cellC });
                } else {
                    // Fallback: dokument bez CHT kódu (např. "Plán BOZP") → hledáme textově
                    if (seenChtCodes.has(cellC)) continue;
                    seenChtCodes.add(cellC);
                    chtItems.push({ code: cellC, label: cellC });
                }
            }
        }

        console.log('[CHT2029] AR profilů:', arItems.length, arItems.map(i => i.code));
        console.log('[CHT2029] CHT dokumentů:', chtItems.length, chtItems.map(i => i.code));

        return { arItems, chtItems };
    }

    // ── Shuttle – přesun profilů na stránce 3191 ──────────────────────────────

    function arSegments(code) {
        return code.toUpperCase()
            .replace(/^AR[\s_\-]*/i, '')
            .split(/[\s_\-\.]+/)
            .filter(Boolean);
    }

    function makeArRe(code) {
        const segs = arSegments(code);
        const body = segs.join('[\\s_\\-\\.]+');
        return new RegExp('#?AR[\\s_\\-]' + body + '(?=[^\\d]|$)', 'i');
    }

    function moveProfilesToRight(arItems) {
        const leftSel  = document.getElementById('P3191_PROFILE_IDS_LEFT');
        const rightSel = document.getElementById('P3191_PROFILE_IDS_RIGHT');
        if (!leftSel || !rightSel) return { moved: [], notFound: arItems.map(i => i.code) };

        const moved    = [];
        const notFound = [];

        arItems.forEach(item => {
            const re = makeArRe(item.code);
            const toMove = Array.from(leftSel.options).filter(o => re.test(o.text));
            if (toMove.length === 0) {
                notFound.push(item.code);
                return;
            }
            toMove.forEach(opt => rightSel.appendChild(opt));
            moved.push(item.code);
        });

        ['change', 'input'].forEach(ev =>
            rightSel.dispatchEvent(new Event(ev, { bubbles: true }))
        );

        return { moved, notFound };
    }

    // ── Tabulka pro Word (kopírováno jako HTML) ────────────
    function buildWordTableHtml(items) {
        const half = Math.ceil(items.length / 2);
        const col1 = items.slice(0, half);
        const col2 = items.slice(half);
        // Bez ohraničení a paddingu, aby Word zdědil styl z cílové tabulky
        let html = '<table id="cht2029-word-tbl" style="width:100%;border-collapse:collapse;"><tbody>';
        for (let i = 0; i < half; i++) {
            const l_desc = col1[i] ? col1[i].desc || '' : '';
            const l_code = col1[i] ? col1[i].code || '' : '';
            const r_desc = col2[i] ? col2[i].desc || '' : '';
            const r_code = col2[i] ? col2[i].code || '' : '';

            // ☒ = zaškrtnuto (&#9746;), ☐ = prázdné (&#9744;)
            // Vynutíme velikost písma přes <span>, aby ji Word nepřepsal stylem cílové tabulky
            const cbChecked = '<span style="font-family:Arial,sans-serif;font-size:16pt;">&#9746;</span>';
            const cbUnchecked = '<span style="font-family:Arial,sans-serif;font-size:16pt;">&#9744;</span>';

            const l_cell = col1[i] 
                ? `${cbChecked} <span style="font-family:Arial,sans-serif;font-size:11pt;">${l_desc}<br><span style="mso-tab-count:1;white-space:pre;">&#9;</span>${l_code}</span>` 
                : cbUnchecked;
            const r_cell = col2[i] 
                ? `${cbChecked} <span style="font-family:Arial,sans-serif;font-size:11pt;">${r_desc}<br><span style="mso-tab-count:1;white-space:pre;">&#9;</span>${r_code}</span>` 
                : cbUnchecked;

            html += `<tr>
<td style="vertical-align:top;width:50%;">${l_cell}</td>
<td style="vertical-align:top;width:50%;">${r_cell}</td>
</tr>`;
        }
        html += '</tbody></table>';
        return html;
    }

    // ── Zvýraznění CHT dokumentů na stránce 10300 ─────────────────────────────
    function highlightCHTRows(chtItems) {
        let count = 0;

        // Sestavíme matcher pro každou položku
        const matchers = chtItems.map(item => {
            const chtMatch = CHT_RE.exec(item.code);
            if (chtMatch) {
                // CHT kód: matchujeme číslo + volitelný suffix
                // (povolujeme mezery i podtržítka, např. HTML má "CHT 2004_A", Excel má "CHT 2004 A")
                const num    = chtMatch[1];
                const suffix = chtMatch[2];
                if (suffix) {
                    return txt => new RegExp('CHT[\\s_]*' + num + '[\\s_]*' + suffix + '(?:[^A-Za-z0-9]|$)', 'i').test(txt);
                }
                return txt => new RegExp('CHT[\\s_]*' + num + '(?:[^0-9]|$)', 'i').test(txt);
            }
            // Fallback: textová shoda (pro dokumenty bez CHT kódu)
            const needle = item.code.toLowerCase();
            return txt => txt.toLowerCase().includes(needle);
        });

        // Iterujeme přes všechny řádky tabulky, protože potřebujeme prohledávat jak FORM_HID (kód), tak FORM_NAME (název)
        const rows = document.querySelectorAll('tr');
        rows.forEach(row => {
            const hidCell = row.querySelector('td[headers="FORM_HID"]');
            const nameCell = row.querySelector('td[headers="FORM_NAME"]');
            if (!hidCell && !nameCell) return;

            const hidTxt = hidCell ? hidCell.textContent.trim() : '';
            const nameTxt = nameCell ? nameCell.textContent.trim() : '';
            const combinedTxt = hidTxt + ' | ' + nameTxt; // Hledáme v obou najednou

            const matched = matchers.some(fn => fn(combinedTxt));
            if (!matched) return;

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
<input type="file" id="cht2029-file" accept=".xlsx" style="display:none;">
<button id="cht2029-open-btn"
  style="width:100%;padding:7px 0;background:#2d6a9f;color:#fff;border:none;
         border-radius:5px;cursor:pointer;font-size:12px;font-family:inherit;">
  Vybrat soubor CHT 2029 (.xlsx)
</button>
<div id="cht2029-status" style="margin-top:8px;color:#666;font-size:11px;min-height:16px;"></div>
<div id="cht2029-body"  style="display:none;margin-top:10px;"></div>`;

        document.body.appendChild(panel);

        document.getElementById('cht2029-close').onclick   = () => panel.remove();
        document.getElementById('cht2029-open-btn').onclick = () =>
            document.getElementById('cht2029-file').click();
        document.getElementById('cht2029-file').onchange   = e => {
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
            const { arItems, chtItems } = await readXlsxData(file);

            setStatus(`Nalezeno: ${arItems.length} AR profilů, ${chtItems.length} CHT dokumentů`);

            if (ON_3191)  showResults3191(arItems, body);
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
        const tableHtml = buildWordTableHtml(arItems);

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

        html += `<div style="font-weight:bold;margin-bottom:4px;">Tabulka pro Word:</div>
<div id="cht2029-tbl-container" style="
  width:100%;height:140px;overflow-y:auto;background:#f9f9f9;
  border:1px solid #ccc;border-radius:4px;padding:4px;">
  ${tableHtml}
</div>
<button id="cht2029-copy"
  style="width:100%;margin-top:5px;padding:5px 0;background:#28a745;color:#fff;
         border:none;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit;">
  Kopírovat pro Word (HTML)
</button>`;

        body.innerHTML = html;

        document.getElementById('cht2029-copy').onclick = function () {
            const tbl = document.getElementById('cht2029-word-tbl');
            const range = document.createRange();
            range.selectNodeContents(tbl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            try {
                document.execCommand('copy');
                flash(this);
            } catch (err) {
                console.error('Kopírování selhalo', err);
            }
            sel.removeAllRanges();
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

})();
