// ==UserScript==
// @name         Riscon: Auto ID sekvence
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.0
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
            const idInput = document.getElementById(MANUAL_ID_FIELD);
            if (!idInput) return;

            let lastSaveButton = null;
            let autoSubmitInProgress = false;
            let attemptCount = 0;
            const MAX_ATTEMPTS = 100;

            function isSaveButton(el) {
                if (!el) return false;
                const text = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
                return text.includes('uložit změny');
            }

            function rememberSaveButton(event) {
                const btn = event.target.closest('button, input[type="submit"], a.t-Button');
                if (!isSaveButton(btn)) return;
                lastSaveButton = btn;
                attemptCount = 0;
            }

            function parseId(value) {
                const match = String(value || '').match(/^(.*?)(\d+)([^\d]*)$/);
                if (!match) return null;
                return {
                    prefix: match[1],
                    number: match[2],
                    suffix: match[3]
                };
            }

            function incrementId() {
                const parts = parseId(idInput.value);
                if (!parts) return null;
                const nextNum = String(Number(parts.number) + 1).padStart(parts.number.length, '0');
                const nextId = `${parts.prefix}${nextNum}${parts.suffix}`;
                if (window.apex && apex.item) {
                    try {
                        apex.item(MANUAL_ID_FIELD).setValue(nextId, null, true);
                    } catch (e) {
                        idInput.value = nextId;
                    }
                } else {
                    idInput.value = nextId;
                }
                idInput.dispatchEvent(new Event('change', { bubbles: true }));
                return nextId;
            }

            function getErrorText() {
                const selectors = [
                    '.t-Alert--danger',
                    '#APEX_ERROR_MESSAGE',
                    '.a-Notification-item--error',
                    '.a-AlertMessage-text'
                ];
                return selectors
                    .map(sel => Array.from(document.querySelectorAll(sel)).map(el => el.innerText || el.textContent || '').join(' '))
                    .join(' ')
                    .toLowerCase();
            }

            function isDuplicateIdError(text) {
                if (!text) return false;
                return (
                    text.includes('stejné identifikační číslo') ||
                    text.includes('nelze použít dvakrát') ||
                    text.includes('identifikační číslo') ||
                    (text.includes('duplicate') && text.includes('id'))
                );
            }

            function triggerSameSave() {
                if (!lastSaveButton) return;
                autoSubmitInProgress = true;
                setTimeout(() => {
                    lastSaveButton.click();
                    autoSubmitInProgress = false;
                }, 120);
            }

            function maybeRetrySave() {
                if (!lastSaveButton || autoSubmitInProgress) return;
                const errorText = getErrorText();
                if (!isDuplicateIdError(errorText)) return;
                if (attemptCount >= MAX_ATTEMPTS) {
                    console.warn('Riscon Auto ID: Dosažen maximální počet pokusů o navýšení ID.');
                    return;
                }
                const nextId = incrementId();
                if (!nextId) {
                    console.warn('Riscon Auto ID: ID nemá číselný formát, nelze navýšit.');
                    return;
                }
                attemptCount += 1;
                console.log(`Riscon Auto ID: zkouším uložit s novým ID ${nextId} (pokus ${attemptCount}).`);
                triggerSameSave();
            }

            document.addEventListener('click', rememberSaveButton, true);

            const observer = new MutationObserver(() => {
                maybeRetrySave();
            });
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
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
