window.RisconSuite = window.RisconSuite || {};
window.RisconSuite.Modules = window.RisconSuite.Modules || {};

window.RisconSuite.Modules.UrazyAutofill = {
    init: function () {
        // Spouštíme pouze na straně 6501
        if (window.location.href.indexOf('f?p=110:6501:') === -1) return;

        function fillForm() {
            console.log('Spouštím automatické vyplnění...');

            // --- Pomocné funkce ---
            function setVal(id, val) {
                if (val === '') return; // Nechceme mazat existující data prázdnou hodnotou
                var el = document.getElementById(id);
                if (!el) { console.warn('Nenalezeno: ' + id); return; }

                // Zjistíme aktuální hodnotu
                let currentVal = "";
                if (window.apex && apex.item) {
                    try {
                        let item = apex.item(id);
                        if (item) currentVal = item.getValue();
                    } catch (e) { currentVal = el.value; }
                } else {
                    currentVal = el.value;
                }

                // Pokud už pole nějakou hodnotu má (není prázdné), nebudeme ho přepisovat
                if (currentVal && currentVal.trim() !== '') {
                    return;
                }

                // Nastavení nové hodnoty
                if (window.apex && apex.item) {
                    try { apex.item(id).setValue(val, null, true); return; } catch (e) { }
                }
                el.value = val;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }

            function setChk(id, checked) {
                if (!checked) return; // Nechceme odškrtávat, takže prázdné (false) ignorujeme
                var el = document.getElementById(id);
                if (!el) return;
                // Pokud už je zaškrtnuto, neřešíme
                if (el.checked) return;

                el.checked = true;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }

            function setRadio(name, val) {
                if (val === '') return;
                // Zjistíme, jestli už je nějaké rádio vybrané
                let isSelected = false;
                document.querySelectorAll('input[type=radio][name="' + name + '"]').forEach(function (r) {
                    if (r.checked) isSelected = true;
                });
                if (isSelected) return; // Nějaká hodnota už je vybrána, nepřepisujeme

                document.querySelectorAll('input[type=radio][name="' + name + '"]').forEach(function (r) {
                    r.checked = (r.value === String(val));
                    if (r.checked) r.dispatchEvent(new Event('change', { bubbles: true }));
                });
            }

            function setCKE(id, html) {
                if (html === '') return;
                var currentHtml = "";
                if (window.CKEDITOR && CKEDITOR.instances[id]) {
                    currentHtml = CKEDITOR.instances[id].getData();
                    // Pokud už editor něco obsahuje, nepřepisujeme
                    if (currentHtml && currentHtml.trim() !== '') return;
                    CKEDITOR.instances[id].setData(html);
                } else {
                    var el = document.getElementById(id);
                    if (el) {
                        currentHtml = el.value;
                        if (currentHtml && currentHtml.trim() !== '') return;
                        el.value = html;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }

            // --- Zde jsou jen pole, do kterých se má reálně něco vyplnit ---

            // --- Specifická logika pro Začátek směny ---
            function syncShiftTime() {
                var eventDateEl = document.getElementById('P6501_EVENT_DATE');
                var shiftTimeEl = document.getElementById('P6501_SHIFT_INIT_TIME');
                
                if (eventDateEl && shiftTimeEl) {
                    // Pokusíme se získat hodnotu několika způsoby
                    var eventDateVal = eventDateEl.value; 
                    if (!eventDateVal && window.apex && apex.item) {
                        try { eventDateVal = apex.item('P6501_EVENT_DATE').getValue(); } catch(e){}
                    }
                    
                    var currentShiftVal = shiftTimeEl.value;

                    // Pokud máme Datum události a Začátek směny je zatím prázdný
                    if (eventDateVal && eventDateVal.trim() !== '' && (!currentShiftVal || currentShiftVal.trim() === '')) {
                        var dateOnly = eventDateVal.trim().split(/\s+/)[0]; // Oříznutí času, ponechání jen data
                        var newVal = dateOnly + ' 07:00';
                        console.log("Tlačítko Vyplnit nastavuje Začátek směny na:", newVal, "přečteno z:", eventDateVal);
                        
                        if (window.apex && apex.jQuery) {
                            apex.jQuery('#P6501_SHIFT_INIT_TIME').val(newVal).trigger('change');
                        } else {
                            shiftTimeEl.value = newVal;
                            shiftTimeEl.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
            }

            // Provedeme synchronizaci při kliknutí na tlačítko Vyplnit
            syncShiftTime();

            // --- Textová pole ---
            setVal('P6501_SAFETY_REP', 'Andrea Routnerová');
            setVal('P6501_EMP_REP1', 'Šárka Orthová');
            setVal('P6501_EMP_REP1_POSITION', 'vedoucí personálního oddělení');

            // --- Textareas ---
            setVal('P6501_VIOLATED_REGULATIONS', 'Šetřením příčin a okolností úrazu nebylo zjištěno porušení právních a ostatních předpisů.');
            setVal('P6501_D8_IMMEDIATE_ACTION', '1) Vytvoření poučeného listu a seznámení relevantních zaměstnanců s příčinami a okolnostmi pracovního úrazu.<br>\n2) Přezkoumání vyhodnocených rizik a stanovených opatření.');
            setVal('P6501_DISCLAIMER', 'S výše uvedenými údaji, popisem pracovního úrazu a vyhodnocení zdrojů a příčin pracovního úrazu zcela a bez připomínek souhlasím.');
            setVal('P6501_SAFETY_REP_COMMENT', 'S výše uvedenými údaji, popisem pracovního úrazu a vyhodnocení zdrojů a příčin pracovního úrazu zcela a bez připomínek souhlasím.');
            setVal('P6501_EMP_REP1_COMMENT', 'S výše uvedenými údaji, popisem pracovního úrazu a vyhodnocení zdrojů a příčin pracovního úrazu zcela a bez připomínek souhlasím.');

            // --- Select boxy ---
            setVal('P6501_EVENT_TYPE', '1');
            setVal('P6501_VICTIM_TYPE', '1');
            setVal('P6501_RECORD_STATUS', 'A');

            // --- Přepínač pohlaví (radio) ---
            setRadio('P6501_SEX', '1');

            console.log('✅ Formulář byl automaticky vyplněn, stávající hodnoty zůstaly zachovány.');
        }

        function createAutofillButton() {
            const backButton = document.getElementById('B4037481527526618743');
            if (!backButton) return;

            // Zamezení vícenásobného vložení
            if (document.getElementById('B_CHT_AUTOFILL')) return;

            // Vytvoříme nové tlačítko "Vyplnit"
            const btn = document.createElement('button');
            btn.value = "Vyplnit";
            btn.className = "button-alt1"; // Stejný vizuál jako primární tlačítka
            btn.type = "button";
            btn.id = "B_CHT_AUTOFILL";
            btn.innerHTML = "<span>Vyplnit</span>";
            btn.style.marginRight = "5px";

            btn.addEventListener('click', fillForm);

            // Vložíme ho před tlačítko Zpět
            backButton.parentNode.insertBefore(btn, backButton);

            // --- PŘIDÁNÍ AUTOMATICKÉHO LISTENERU NA ZMĚNU DATA ---
            const eventDateEl = document.getElementById('P6501_EVENT_DATE');
            if (eventDateEl && !eventDateEl.dataset.autofillListenerAttached) {
                eventDateEl.dataset.autofillListenerAttached = 'true';
                eventDateEl.addEventListener('change', function() {
                    var shiftTimeEl = document.getElementById('P6501_SHIFT_INIT_TIME');
                    if (shiftTimeEl && (!shiftTimeEl.value || shiftTimeEl.value.trim() === '')) {
                        var eventDateVal = this.value;
                        if (eventDateVal && eventDateVal.trim() !== '') {
                            var dateOnly = eventDateVal.trim().split(/\s+/)[0]; 
                            var newVal = dateOnly + ' 07:00';
                            console.log("Auto-listener nastavuje Začátek směny na:", newVal, "přečteno z:", eventDateVal);
                            
                            if (window.apex && apex.jQuery) {
                                apex.jQuery('#P6501_SHIFT_INIT_TIME').val(newVal).trigger('change');
                            } else {
                                shiftTimeEl.value = newVal;
                                shiftTimeEl.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }
                });
            }
        }

        // Protože init v komplet skriptu se už volá z DOMContentLoaded (nebo později),
        // můžeme rovnou zkusit vytvořit tlačítko.
        createAutofillButton();

        // Pro jistotu (např. při ajax refresh v APEX) zavěsíme ještě zpožděné vytvoření.
        setTimeout(createAutofillButton, 1000);
        
        // Můžeme pověsit i global listener pro APEX, kdyby se oblast s tlačítky přenačítala
        if (window.apex && apex.jQuery) {
            apex.jQuery(document).on('apexafterrefresh', function() {
                setTimeout(createAutofillButton, 500);
            });
        }
    }
};
