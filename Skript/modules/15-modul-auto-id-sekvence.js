// ==UserScript==
// @name         Riscon: Auto ID sekvence
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      2.0.0
// @description  Při chybě s duplicitním ID automaticky navýší číselnou část pole P3101_MANUAL_ID a zopakuje stejné uložení.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/15-modul-auto-id-sekvence.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/15-modul-auto-id-sekvence.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    RS.Modules.AutoIdSequence = {
        init: function () {
            const MANUAL_ID_FIELD = 'P3101_MANUAL_ID';
            const MAX_ATTEMPTS = 20;
            const LOG_PREFIX = '[Riscon Auto ID]';

            const idInput = document.getElementById(MANUAL_ID_FIELD);
            if (!idInput) return;

            let attemptCount = 0;
            let retryPending = false;
            let lastRequestId = null;

            // ---------------------------------------------------------------
            // Pomocné funkce
            // ---------------------------------------------------------------

            function parseId(value) {
                const match = String(value || '').match(/^(.*?)(\d+)([^\d]*)$/);
                if (!match) return null;
                return { prefix: match[1], number: match[2], suffix: match[3] };
            }

            /**
             * Navýší číselnou část ID a zapíše ji přes APEX API
             * BEZ suppress session-state flagu — server tak obdrží správnou hodnotu.
             * Vrátí nové ID nebo null pokud ID nemá číselný formát.
             */
            function incrementId() {
                const parts = parseId(idInput.value);
                if (!parts) return null;

                const nextNum = String(Number(parts.number) + 1).padStart(parts.number.length, '0');
                const nextId = `${parts.prefix}${nextNum}${parts.suffix}`;

                if (window.apex && apex.item) {
                    try {
                        // KRITICKÉ: setValue BEZ třetího argumentu (nebo false),
                        // aby APEX správně aktualizoval session state před submitem.
                        apex.item(MANUAL_ID_FIELD).setValue(nextId);
                    } catch (e) {
                        // Záloha: přímé nastavení hodnoty + change event
                        idInput.value = nextId;
                        idInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    idInput.value = nextId;
                    idInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                console.info(`${LOG_PREFIX} ID navýšeno na: ${nextId} (pokus ${attemptCount + 1})`);
                return nextId;
            }

            /**
             * Zjistí aktuální text chybových hlášení na stránce.
             */
            function getErrorText() {
                const selectors = [
                    '.t-Alert--danger',
                    '#APEX_ERROR_MESSAGE',
                    '.a-Notification-item--error',
                    '.a-AlertMessage-text'
                ];
                return selectors
                    .flatMap(sel => Array.from(document.querySelectorAll(sel)))
                    .map(el => el.innerText || el.textContent || '')
                    .join(' ')
                    .toLowerCase();
            }

            /**
             * Rozhodne, zda chybový text odpovídá chybě duplicitního ID.
             * Vrací false pokud text je prázdný nebo neodpovídá.
             */
            function isDuplicateIdError(text) {
                if (!text || !text.trim()) return false;
                return (
                    text.includes('stejné identifikační číslo') ||
                    text.includes('nelze použít dvakrát') ||
                    (text.includes('identifikační číslo') && text.includes('nelze')) ||
                    (text.includes('duplicate') && text.includes('id'))
                );
            }

            /**
             * Spustí APEX page submit (uložení) pomocí officiálního APEX API.
             * Tato cesta zaručuje, že session state je správně aktualizován
             * před odesláním na server — APEX submit pipeline je plně respektován.
             *
             * Hledá REQUEST hodnotu z posledního zachyceného tlačítka Uložit.
             */
            function triggerApexSave() {
                const requestValue = lastRequestId || 'SAVE';
                console.info(`${LOG_PREFIX} Spouštím retry APEX submit s REQUEST=${requestValue}`);

                try {
                    if (window.apex && apex.page && typeof apex.page.submit === 'function') {
                        apex.page.submit({ request: requestValue });
                    } else if (window.apex && typeof apex.submit === 'function') {
                        apex.submit(requestValue);
                    } else {
                        // Záloha — standardní form submit (neprojde přes APEX pipeline)
                        console.warn(`${LOG_PREFIX} APEX submit API není dostupné, používám zálohu.`);
                        const form = document.getElementById('wwvFlowForm') || document.querySelector('form');
                        if (form) form.submit();
                    }
                } catch (e) {
                    console.error(`${LOG_PREFIX} Chyba při spouštění retry submitu:`, e);
                }
            }

            // ---------------------------------------------------------------
            // Zachycení REQUEST hodnoty tlačítka Uložit
            // ---------------------------------------------------------------

            function isSaveButton(el) {
                if (!el) return false;
                const text = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
                return text.includes('uložit změny') || text.includes('uložit');
            }

            /**
             * Zachytí kliknutí na tlačítko Uložit a uloží REQUEST hodnotu,
             * aby ji bylo možné použít při retry.
             * NEPROVÁDÍ žádný retry ani neplánuje žádný timeout.
             */
            function onSaveButtonClick(event) {
                // Pokud jde o retry submit spuštěný naším modulem, ignorujeme
                if (retryPending) return;

                const btn = event.target.closest('button, input[type="submit"], a.t-Button');
                if (!isSaveButton(btn)) return;

                // Resetujeme čítač pokusů pouze při skutečném uložení uživatelem
                attemptCount = 0;

                // Zjistíme REQUEST hodnotu tlačítka (APEX ji ukládá jako atribut nebo value)
                lastRequestId = btn.getAttribute('value') ||
                                btn.getAttribute('data-request') ||
                                btn.id ||
                                'SAVE';
            }

            document.addEventListener('click', onSaveButtonClick, true);

            // ---------------------------------------------------------------
            // Detekce odpovědi serveru přes APEX eventy
            // ---------------------------------------------------------------

            /**
             * APEX volá apexajaxcomplete na dokumentu po každém AJAX requestu.
             * Tento event je spolehlivější než setTimeout a reaguje na skutečnou
             * odpověď serveru.
             *
             * Alternativně lze naslouchat apexafterrefresh nebo apexpagesubmit events.
             */
            function onApexAjaxComplete() {
                if (retryPending) return; // Zabraňujeme rekurzi

                const errorText = getErrorText();
                if (!isDuplicateIdError(errorText)) return;

                if (attemptCount >= MAX_ATTEMPTS) {
                    console.warn(`${LOG_PREFIX} Dosažen maximální počet pokusů (${MAX_ATTEMPTS}). Zastavuji.`);
                    return;
                }

                const nextId = incrementId();
                if (!nextId) {
                    console.warn(`${LOG_PREFIX} ID "${idInput.value}" nemá číselný formát — nelze navýšit.`);
                    return;
                }

                attemptCount++;
                retryPending = true;

                // Krátká prodleva, aby APEX dokončil aktualizaci DOM po chybě,
                // a aby se nová hodnota správně zapsala do interního stavu.
                setTimeout(() => {
                    retryPending = false;
                    triggerApexSave();
                }, 300);
            }

            // Nasloucháme na APEX AJAX complete event
            document.addEventListener('apexajaxcomplete', onApexAjaxComplete);

            // Záloha: apexafterrefresh (starší verze APEX)
            document.addEventListener('apexafterrefresh', onApexAjaxComplete);

            // Záloha: apexpagesubmitready (APEX 20+) - po dokončení page submitu
            // Tento event nese výsledek submitu, použijeme ho pro detekci chyby
            // po page refresh způsobeném submitem.
            // Po page submitu se stránka typicky refreshuje, takže hledáme
            // chybový stav po DOMContentLoaded (init se znovu zavolá).
            // Proto je zachycení po DOMContentLoaded dostatečné.

            console.info(`${LOG_PREFIX} Modul inicializován. Pole ${MANUAL_ID_FIELD} nalezeno.`);
        }
    };

    if (!RS.Config) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => RS.Modules.AutoIdSequence.init());
        } else {
            setTimeout(() => RS.Modules.AutoIdSequence.init(), 250);
        }
    }
})();
