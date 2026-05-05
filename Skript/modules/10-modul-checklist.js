// ==UserScript==
// @name         Riscon: Dokumentační checklist (Úrazy)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.2
// @description  Kontrolní seznam povinné dokumentace u pracovních úrazů. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/10-modul-checklist.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/10-modul-checklist.js
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

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    RS.Modules.Checklist = {
        toggle: function (enabled) {
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
        init: function () {
            const Config = RS.Config;
            if (Config && !Config.docChecklist.enabled) return;

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

            if (!table || table.dataset.checklistApplied === 'true') return;

            // Ochrana proti zacyklení Pulse observeru
            table.dataset.checklistApplied = 'true';
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
                { name: 'Rizika', match: /rizika/i },
                { name: 'Check list', match: /check/i }
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
                tdCheck.align = 'center'; tdCheck.className = 'data';
                const cb = document.createElement('input');
                cb.type = 'checkbox'; cb.checked = isManuallyChecked;
                cb.title = 'Označit jako nevyžadované / splněno jinak';
                cb.style.cursor = 'pointer';

                cb.addEventListener('change', function () {
                    manualChecks[doc] = this.checked;
                    localStorage.setItem(storageKey, JSON.stringify(manualChecks));
                    tr.className = 'highlight-row shadow-row ' + (this.checked ? 'shadow-row-manual' : 'shadow-row-missing');
                    tdDesc.style.color = this.checked ? '#666' : '#c62828';
                    tdNote.innerText = this.checked ? 'Nevyžadováno / splněno jinak (ručně)' : 'Chybějící povinný dokument';
                    tdNote.style.color = this.checked ? '#666' : '#c62828';
                });
                tdCheck.appendChild(cb);

                const tdDesc = document.createElement('td');
                tdDesc.headers = 'DOCUMENT_DESCRIPTION'; tdDesc.className = 'data';
                tdDesc.innerText = doc; tdDesc.style.fontWeight = 'bold';
                tdDesc.style.color = isManuallyChecked ? '#666' : '#c62828';

                const tdNote = document.createElement('td');
                tdNote.headers = 'DOCUMENT_NOTES'; tdNote.className = 'data';
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
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Checklist.init());
        else RS.Modules.Checklist.init();
    }

})();
