// ==UserScript==
// @name         Riscon: Úrazy Checklist u popisu
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.0
// @description  Univerzální checklist zobrazený vedle pole "Popis události", položky po odškrtnutí zešednou a přeškrtnou se.
// @author       Martin
// @match        https://*/ords/*/f?p=110:6501:*
// @match        https://www.riscon.cz/go/f?p=110:6501:*
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

    RS.Modules.UrazyChecklist = {
        init: function () {
            // Nalezení obalovacího divu pro pole popisu události
            const displayDiv = document.getElementById('P6501_EVENT_DESCRIPTION_DISPLAY');
            if (!displayDiv) return;

            // Zamezení vícenásobnému přidání
            if (document.getElementById('cht-urazy-checklist-container')) return;

            // Upravíme zobrazení obalovacího divu na flex, aby se checklist zobrazil vedle editoru
            displayDiv.style.display = 'flex';
            displayDiv.style.gap = '20px';
            displayDiv.style.alignItems = 'flex-start';

            // Univerzální položky checklistu - zde si můžeš přidávat/upravovat položky
            const checklistItems = [
                { id: 'chk_1', label: 'V kolik hodin se stal úraz?' },
                { id: 'chk_2', label: 'Jméno poškozeného?' },
                { id: 'chk_3', label: 'Co se stalo?' },
                { id: 'chk_4', label: 'Kde ke úrazu došlo?' },
                { id: 'chk_5', label: 'Jaký úraz utrpěl zaměstnanec?' },
                { id: 'chk_6', label: 'Které části těla jsou poraněny?' },
                { id: 'chk_7', label: 'Jak vážné bylo zranění?' },
                { id: 'chk_8', label: 'Kdo práci přidělil?' },
                { id: 'chk_9', label: 'Test na alkohol/drogy?' },
                { id: 'chk_10', label: 'OOPP?' },
                { id: 'chk_11', label: 'Fotodokumentace?' },
                { id: 'chk_12', label: 'Zápis do knihy úrazů stavby?' }
            ];

            // Klíč pro LocalStorage podle ID události (aby se stav pamatoval pro každý záznam zvlášť)
            const eventIdElement = document.getElementById('P6501_ID');
            const eventId = eventIdElement && eventIdElement.value ? eventIdElement.value : 'new_event';
            const storageKey = 'urazy_desc_checklist_' + eventId;

            // Načtení uloženého stavu
            let savedState = JSON.parse(localStorage.getItem(storageKey) || '{}');

            // Vytvoření hlavního kontejneru checklistu
            const container = document.createElement('div');
            container.id = 'cht-urazy-checklist-container';
            container.style.border = '1px solid #ccc';
            container.style.padding = '15px';
            container.style.borderRadius = '4px';
            container.style.backgroundColor = '#f9f9f9';
            container.style.minWidth = '250px';
            container.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            // Aby se nám panel nedeformoval, pokud bude editor příliš široký
            container.style.flexShrink = '0';

            const title = document.createElement('h3');
            title.innerText = 'Kontrolní seznam';
            title.style.marginTop = '0';
            title.style.marginBottom = '15px';
            title.style.fontSize = '14px';
            title.style.color = '#004C66';
            title.style.fontWeight = 'bold';
            container.appendChild(title);

            const list = document.createElement('ul');
            list.style.listStyleType = 'none';
            list.style.padding = '0';
            list.style.margin = '0';
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '10px';

            checklistItems.forEach(item => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.alignItems = 'flex-start';
                li.style.gap = '8px';

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.id = 'cht-chk-' + item.id;
                cb.checked = !!savedState[item.id];
                cb.style.marginTop = '2px';
                cb.style.cursor = 'pointer';

                const label = document.createElement('label');
                label.htmlFor = cb.id;
                label.innerText = item.label;
                label.style.cursor = 'pointer';
                label.style.transition = 'color 0.2s, text-decoration 0.2s';
                label.style.fontSize = '13px';
                label.style.userSelect = 'none';

                // Nastavení počátečního stylu podle stavu
                if (cb.checked) {
                    label.style.color = '#999';
                    label.style.textDecoration = 'line-through';
                } else {
                    label.style.color = '#000';
                    label.style.textDecoration = 'none';
                }

                // Posluchač změny stavu checkboxu
                cb.addEventListener('change', function () {
                    savedState[item.id] = this.checked;
                    localStorage.setItem(storageKey, JSON.stringify(savedState));

                    if (this.checked) {
                        label.style.color = '#999';
                        label.style.textDecoration = 'line-through';
                    } else {
                        label.style.color = '#000';
                        label.style.textDecoration = 'none';
                    }
                });

                li.appendChild(cb);
                li.appendChild(label);
                list.appendChild(li);
            });

            container.appendChild(list);

            // Připojení checklistu za editor v rámci display divu
            displayDiv.appendChild(container);
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => RS.Modules.UrazyChecklist.init());
        } else {
            // Timeout pro jistotu, kdyby se editor inicializoval později
            setTimeout(() => RS.Modules.UrazyChecklist.init(), 500);
        }
    }

})();
