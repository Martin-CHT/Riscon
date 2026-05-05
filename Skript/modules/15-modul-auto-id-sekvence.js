// ==UserScript==
// @name         Riscon: Auto ID sekvence
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      3.1.0
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
        initialized: false,

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

            if (this.initialized) return;
            this.initialized = true;

            let retryClickInProgress = false;

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
                    } catch (e) {
                        console.warn(`${LOG_PREFIX} apex.item.setValue selhalo, používám zálohu:`, e);
                    }
                }
                if (idInput.value !== newId) idInput.value = newId;
                idInput.dispatchEvent(new Event('input', { bubbles: true }));
                idInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            function readIdFromField() {
                if (window.apex && apex.item) {
                    try {
                        return String(apex.item(MANUAL_ID_FIELD).getValue() || '');
                    } catch (e) {
                        // Spadneme na DOM hodnotu níže.
                    }
                }
                return String(idInput.value || '');
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

            function isSaveButton(el) {
                if (!el) return false;
                const text = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
                return text.includes('uložit změny') || text.includes('uložit');
            }

            function getSaveButtons() {
                return Array.from(document.querySelectorAll('button, input[type="submit"], a.t-Button'))
                    .filter(isSaveButton);
            }

            function getButtonText(btn) {
                return (btn.innerText || btn.textContent || btn.value || '').trim();
            }

            function getRequestValue(btn) {
                return btn.getAttribute('value') ||
                    btn.getAttribute('data-request') ||
                    btn.id ||
                    'SAVE';
            }

            function getButtonLocator(btn) {
                const saveButtons = getSaveButtons();
                return {
                    id: btn.id || '',
                    name: btn.getAttribute('name') || '',
                    value: btn.getAttribute('value') || '',
                    dataRequest: btn.getAttribute('data-request') || '',
                    text: getButtonText(btn),
                    index: saveButtons.indexOf(btn)
                };
            }

            function matchesStoredButton(btn, locator) {
                if (!locator) return false;
                if (locator.id && btn.id === locator.id) return true;
                if (locator.dataRequest && btn.getAttribute('data-request') === locator.dataRequest) return true;
                if (locator.name && btn.getAttribute('name') === locator.name) {
                    return !locator.value || btn.getAttribute('value') === locator.value;
                }
                if (locator.value && btn.getAttribute('value') === locator.value) return true;
                return false;
            }

            function findOriginalSaveButton(locator, requestValue) {
                const saveButtons = getSaveButtons();
                if (!saveButtons.length) return null;

                if (locator && locator.id) {
                    const byId = document.getElementById(locator.id);
                    if (isSaveButton(byId)) return byId;
                }

                const byLocator = saveButtons.find(btn => matchesStoredButton(btn, locator));
                if (byLocator) return byLocator;

                if (requestValue) {
                    const byRequest = saveButtons.find(btn =>
                        btn.getAttribute('value') === requestValue ||
                        btn.getAttribute('data-request') === requestValue ||
                        btn.id === requestValue
                    );
                    if (byRequest) return byRequest;
                }

                if (locator && Number.isInteger(locator.index) && saveButtons[locator.index]) {
                    return saveButtons[locator.index];
                }

                if (locator && locator.text) {
                    const byText = saveButtons.filter(btn => getButtonText(btn) === locator.text);
                    if (byText.length === 1) return byText[0];
                }

                return saveButtons.length === 1 ? saveButtons[0] : null;
            }

            function triggerOriginalSaveButton(locator, requestValue) {
                const btn = findOriginalSaveButton(locator, requestValue);
                if (!btn) {
                    console.error(`${LOG_PREFIX} Původní tlačítko Uložit se nepodařilo spolehlivě najít. Retry zastaven, aby nedošlo k obejití APEX validací.`);
                    return false;
                }

                retryClickInProgress = true;
                console.info(`${LOG_PREFIX} Spouštím původní tlačítko Uložit přes click(), REQUEST=${getRequestValue(btn)}.`);
                btn.click();
                setTimeout(() => {
                    retryClickInProgress = false;
                }, 0);
                return true;
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
                    // Stále chyba duplicity → navýšíme ID a zkusíme znovu stejným tlačítkem
                    const currentId = retryState.lastAttemptedId || readIdFromField();
                    const nextId = incrementId(currentId);

                    if (!nextId) {
                        console.warn(`${LOG_PREFIX} ID "${currentId}" nemá číselný formát — nelze navýšit. Zastavuji.`);
                        clearRetryState();
                    } else {
                        const newAttempts = retryState.attempts + 1;
                        console.info(`${LOG_PREFIX} Retry #${newAttempts}: navyšuji ID ${currentId} → ${nextId}`);

                        // Aktualizujeme stav před submitem, ale kliknutí řízené modulem nesmí resetovat čítač.
                        saveRetryState({
                            attempts: newAttempts,
                            requestValue: retryState.requestValue,
                            buttonLocator: retryState.buttonLocator || null,
                            lastAttemptedId: nextId
                        });

                        // Zapíšeme novou hodnotu do pole a ověříme, že se opravdu dostala do APEX/DOM stavu.
                        applyIdToField(nextId);
                        if (readIdFromField() !== nextId) {
                            console.error(`${LOG_PREFIX} Nové ID "${nextId}" není po zápisu v poli ${MANUAL_ID_FIELD}. Retry zastaven.`);
                            clearRetryState();
                        } else {
                            // Krátká prodleva — APEX potřebuje čas na interní zpracování setValue/change
                            setTimeout(() => {
                                if (!triggerOriginalSaveButton(retryState.buttonLocator, retryState.requestValue)) {
                                    clearRetryState();
                                }
                            }, 350);
                        }
                    }
                }
            } else {
                // Nejsme v retry cyklu — normální stav, vymažeme pro jistotu
                clearRetryState();
            }

            // ---------------------------------------------------------------
            // A) Zachycení kliknutí na "Uložit" — uložení retry stavu PŘED submitem
            // ---------------------------------------------------------------

            function onSaveButtonClick(event) {
                if (retryClickInProgress) return;

                const btn = event.target.closest('button, input[type="submit"], a.t-Button');
                if (!isSaveButton(btn)) return;

                // Zjistíme REQUEST hodnotu tlačítka
                const requestValue = getRequestValue(btn);

                // Uložíme výchozí stav do sessionStorage — přežije reload stránky
                // attempts = 0 znamená "první pokus uživatele, ne ještě retry"
                saveRetryState({
                    attempts: 0,
                    requestValue: requestValue,
                    buttonLocator: getButtonLocator(btn),
                    lastAttemptedId: idInput.value
                });

                console.info(`${LOG_PREFIX} Uložit kliknuto, REQUEST=${requestValue}, ID=${idInput.value}. Retry stav připraven.`);
                // Neblokujeme event — APEX provede submit standardní cestou
            }

            document.addEventListener('click', onSaveButtonClick, true);

            console.info(`${LOG_PREFIX} Modul v3.1 inicializován. Pole ${MANUAL_ID_FIELD} nalezeno.`);
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
