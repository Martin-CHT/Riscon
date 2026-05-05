// ==UserScript==
// @name         Riscon: Auto ID sekvence
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      3.0.0
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
            const SS_KEY = 'RisconAutoId_retry';

            const idInput = document.getElementById(MANUAL_ID_FIELD);
            if (!idInput) {
                // Pole na stránce není — vymažeme případný zanechaný retry stav
                sessionStorage.removeItem(SS_KEY);
                return;
            }

            // ---------------------------------------------------------------
            // Pomocné funkce
            // ---------------------------------------------------------------

            function parseId(value) {
                const match = String(value || '').match(/^(.*?)(\d+)([^\d]*)$/);
                if (!match) return null;
                return { prefix: match[1], number: match[2], suffix: match[3] };
            }

            /**
             * Navýší číselnou část ID.
             * setValue() je voláno BEZ suppress session-state flagu (třetí arg),
             * aby APEX správně zahrnul novou hodnotu do form submitu.
             * Vrátí nové ID nebo null pokud ID nemá číselný formát.
             */
            function incrementId(currentValue) {
                const parts = parseId(currentValue);
                if (!parts) return null;
                const nextNum = String(Number(parts.number) + 1).padStart(parts.number.length, '0');
                return `${parts.prefix}${nextNum}${parts.suffix}`;
            }

            function applyIdToField(newId) {
                if (window.apex && apex.item) {
                    try {
                        // KRITICKÉ: BEZ třetího argumentu = session state se aktualizuje
                        apex.item(MANUAL_ID_FIELD).setValue(newId);
                        return;
                    } catch (e) {
                        console.warn(`${LOG_PREFIX} apex.item.setValue selhalo, používám zálohu:`, e);
                    }
                }
                idInput.value = newId;
                idInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

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

            function isDuplicateIdError(text) {
                if (!text || !text.trim()) return false;
                return (
                    text.includes('stejné identifikační číslo') ||
                    text.includes('nelze použít dvakrát') ||
                    (text.includes('identifikační číslo') && text.includes('nelze')) ||
                    (text.includes('duplicate') && text.includes('id'))
                );
            }

            function loadRetryState() {
                try {
                    const raw = sessionStorage.getItem(SS_KEY);
                    return raw ? JSON.parse(raw) : null;
                } catch (e) {
                    return null;
                }
            }

            function saveRetryState(state) {
                try {
                    sessionStorage.setItem(SS_KEY, JSON.stringify(state));
                } catch (e) {
                    console.warn(`${LOG_PREFIX} Nelze uložit retry stav do sessionStorage.`);
                }
            }

            function clearRetryState() {
                sessionStorage.removeItem(SS_KEY);
            }

            function triggerApexSubmit(requestValue) {
                const req = requestValue || 'SAVE';
                console.info(`${LOG_PREFIX} Spouštím APEX submit, REQUEST=${req}`);
                try {
                    if (window.apex && apex.page && typeof apex.page.submit === 'function') {
                        apex.page.submit({ request: req });
                    } else if (window.apex && typeof apex.submit === 'function') {
                        apex.submit(req);
                    } else {
                        console.warn(`${LOG_PREFIX} APEX API nedostupné — záložní form.submit()`);
                        const form = document.getElementById('wwvFlowForm') || document.querySelector('form');
                        if (form) form.submit();
                    }
                } catch (e) {
                    console.error(`${LOG_PREFIX} Chyba při APEX submit:`, e);
                }
            }

            // ---------------------------------------------------------------
            // B) Kontrola stavu PO načtení stránky (po reload z předchozího submitu)
            // ---------------------------------------------------------------

            const retryState = loadRetryState();

            if (retryState) {
                // Jsme v retry cyklu — zkontrolujeme, zda stránka vykazuje chybu
                const errorText = getErrorText();

                if (!isDuplicateIdError(errorText)) {
                    // Žádná chyba duplicity → uložení prošlo (nebo nastala jiná chyba)
                    console.info(`${LOG_PREFIX} Retry cyklus dokončen po ${retryState.attempts} pokus(ech). Uložení prošlo nebo nastala jiná chyba.`);
                    clearRetryState();
                    // Dále nepokračujeme — uložení bylo úspěšné nebo jiný problém
                } else if (retryState.attempts >= MAX_ATTEMPTS) {
                    console.warn(`${LOG_PREFIX} Dosažen maximální počet pokusů (${MAX_ATTEMPTS}). Zastavuji automatické navyšování.`);
                    clearRetryState();
                } else {
                    // Stále chyba duplicity → navýšíme ID a zkusíme znovu
                    const currentId = retryState.lastAttemptedId || idInput.value;
                    const nextId = incrementId(currentId);

                    if (!nextId) {
                        console.warn(`${LOG_PREFIX} ID "${currentId}" nemá číselný formát — nelze navýšit. Zastavuji.`);
                        clearRetryState();
                    } else {
                        const newAttempts = retryState.attempts + 1;
                        console.info(`${LOG_PREFIX} Retry #${newAttempts}: navyšuji ID ${currentId} → ${nextId}`);

                        // Aktualizujeme stav před submitem
                        saveRetryState({
                            attempts: newAttempts,
                            requestValue: retryState.requestValue,
                            lastAttemptedId: nextId
                        });

                        // Zapíšeme novou hodnotu do pole (session state se aktualizuje)
                        applyIdToField(nextId);

                        // Krátká prodleva — APEX potřebuje čas na interní zpracování setValue
                        setTimeout(() => {
                            triggerApexSubmit(retryState.requestValue);
                        }, 350);
                    }
                }
            } else {
                // Nejsme v retry cyklu — normální stav, vymažeme pro jistotu
                clearRetryState();
            }

            // ---------------------------------------------------------------
            // A) Zachycení kliknutí na "Uložit" — uložení retry stavu PŘED submitem
            // ---------------------------------------------------------------

            function isSaveButton(el) {
                if (!el) return false;
                const text = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
                return text.includes('uložit změny') || text.includes('uložit');
            }

            function onSaveButtonClick(event) {
                const btn = event.target.closest('button, input[type="submit"], a.t-Button');
                if (!isSaveButton(btn)) return;

                // Zjistíme REQUEST hodnotu tlačítka
                const requestValue = btn.getAttribute('value') ||
                    btn.getAttribute('data-request') ||
                    btn.id ||
                    'SAVE';

                // Uložíme výchozí stav do sessionStorage — přežije reload stránky
                // attempts = 0 znamená "první pokus uživatele, ne ještě retry"
                saveRetryState({
                    attempts: 0,
                    requestValue: requestValue,
                    lastAttemptedId: idInput.value
                });

                console.info(`${LOG_PREFIX} Uložit kliknuto, REQUEST=${requestValue}, ID=${idInput.value}. Retry stav připraven.`);
                // Neblokujeme event — APEX provede submit standardní cestou
            }

            document.addEventListener('click', onSaveButtonClick, true);

            console.info(`${LOG_PREFIX} Modul v3 inicializován. Pole ${MANUAL_ID_FIELD} nalezeno.`);
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
