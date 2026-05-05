// ==UserScript==
// @name         Riscon: Auto ID sekvence
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      4.0.0
// @description  Při validační chybě duplicitního ID navýší číselnou část pole P3101_MANUAL_ID a zopakuje stejné standardní uložení.
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

    const FIELD_ID = 'P3101_MANUAL_ID';
    const STATE_KEY = 'RisconAutoIdSequence.v4';
    const LOG_PREFIX = '[Riscon Auto ID]';
    const MAX_ATTEMPTS = 100;
    const STATE_TTL_MS = 10 * 60 * 1000;
    const RETRY_CLICK_DELAY_MS = 250;
    const MUTATION_SETTLE_MS = 120;
    const RELOAD_CHECK_DELAY_MS = 300;
    const NO_ERROR_CLEAR_DELAY_MS = 6000;
    const SAVE_SELECTOR = [
        'button',
        'input[type="submit"]',
        'input[type="button"]',
        'a.t-Button',
        'a[role="button"]'
    ].join(',');
    const GLOBAL_ERROR_SELECTORS = [
        '#APEX_ERROR_MESSAGE',
        '.t-Alert--danger',
        '.a-Notification-item--error',
        '.a-AlertMessage-text',
        '.a-AlertMessage',
        '.apex-page-error',
        '.a-Form-error',
        '.t-Form-error',
        '[role="alert"]'
    ];
    const FIELD_ERROR_SELECTORS = [
        `#${FIELD_ID}_error`,
        `#${FIELD_ID}_error_placeholder`,
        `[data-for="${FIELD_ID}"]`,
        `[data-item="${FIELD_ID}"]`
    ];
    const ERROR_RELATED_SELECTOR = GLOBAL_ERROR_SELECTORS.concat(FIELD_ERROR_SELECTORS).join(',');

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function hasWord(text, word) {
        return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, 'i').test(text);
    }

    function isVisible(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
        const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function collectTextFromElements(elements) {
        const seen = new Set();
        return elements
            .filter(el => el && !seen.has(el) && seen.add(el) && isVisible(el))
            .map(el => el.innerText || el.textContent || '')
            .filter(Boolean)
            .join(' ');
    }

    function getField() {
        return document.getElementById(FIELD_ID);
    }

    function getApexItem() {
        if (!window.apex || typeof window.apex.item !== 'function') return null;
        try {
            return window.apex.item(FIELD_ID);
        } catch (e) {
            return null;
        }
    }

    function readFieldValue() {
        const item = getApexItem();
        if (item && typeof item.getValue === 'function') {
            try {
                return String(item.getValue() || '');
            } catch (e) {
                // Fallback na DOM hodnotu níže.
            }
        }

        const field = getField();
        return field ? String(field.value || '') : '';
    }

    function writeFieldValue(value) {
        const field = getField();
        if (!field) return false;

        const item = getApexItem();
        if (item && typeof item.setValue === 'function') {
            try {
                item.setValue(value);
            } catch (e) {
                console.warn(`${LOG_PREFIX} apex.item.setValue selhalo, nastavuji DOM hodnotu.`, e);
            }
        }

        if (field.value !== value) field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));

        return readFieldValue() === value || field.value === value;
    }

    function parseSequencedId(value) {
        const match = String(value || '').match(/^(.*?)(\d+)(\D*)$/);
        if (!match) return null;

        return {
            prefix: match[1],
            number: match[2],
            suffix: match[3]
        };
    }

    function nextSequencedId(value) {
        const parts = parseSequencedId(value);
        if (!parts) return null;

        const nextNumber = (BigInt(parts.number) + 1n)
            .toString()
            .padStart(parts.number.length, '0');

        return `${parts.prefix}${nextNumber}${parts.suffix}`;
    }

    function getControlText(control) {
        if (!control) return '';

        return normalizeText([
            control.innerText,
            control.textContent,
            control.value,
            control.getAttribute('aria-label'),
            control.getAttribute('title')
        ].filter(Boolean).join(' '));
    }

    function isSaveControl(control) {
        return !!control && getControlText(control).includes('ulozit zmeny');
    }

    function getSaveControls() {
        return Array.from(document.querySelectorAll(SAVE_SELECTOR)).filter(isSaveControl);
    }

    function getControlDescriptor(control) {
        const controls = getSaveControls();
        return {
            id: control.id || '',
            name: control.getAttribute('name') || '',
            value: control.getAttribute('value') || '',
            dataRequest: control.getAttribute('data-request') || '',
            href: control.getAttribute('href') || '',
            text: getControlText(control),
            index: controls.indexOf(control)
        };
    }

    function matchesDescriptor(control, descriptor) {
        if (!control || !descriptor) return false;
        if (descriptor.id && control.id === descriptor.id) return true;
        if (descriptor.dataRequest && control.getAttribute('data-request') === descriptor.dataRequest) return true;
        if (descriptor.name && control.getAttribute('name') === descriptor.name) {
            return !descriptor.value || control.getAttribute('value') === descriptor.value;
        }
        if (descriptor.value && control.getAttribute('value') === descriptor.value) return true;
        if (descriptor.href && control.getAttribute('href') === descriptor.href) return true;
        return false;
    }

    function findSaveControl(descriptor) {
        const controls = getSaveControls();
        if (!controls.length) return null;

        if (descriptor && descriptor.id) {
            const byId = document.getElementById(descriptor.id);
            if (isSaveControl(byId)) return byId;
        }

        const byAttributes = controls.find(control => matchesDescriptor(control, descriptor));
        if (byAttributes) return byAttributes;

        if (descriptor && descriptor.text) {
            const byText = controls.filter(control => getControlText(control) === descriptor.text);
            if (byText.length === 1) return byText[0];
        }

        if (descriptor && Number.isInteger(descriptor.index) && controls[descriptor.index]) {
            return controls[descriptor.index];
        }

        return controls.length === 1 ? controls[0] : null;
    }

    function getFieldErrorText() {
        const field = getField();
        const elements = [];

        FIELD_ERROR_SELECTORS.forEach(selector => {
            elements.push(...document.querySelectorAll(selector));
        });

        if (field) {
            const describedBy = String(field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
            describedBy.forEach(id => {
                const described = document.getElementById(id);
                if (described) elements.push(described);
            });

            const container = field.closest('.t-Form-fieldContainer, .t-Form-inputContainer, .a-Form-fieldContainer, .apex-item-wrapper');
            if (container) {
                elements.push(...container.querySelectorAll('.t-Form-error, .a-Form-error, .apex-item-error, [role="alert"]'));
            }
        }

        return collectTextFromElements(elements);
    }

    function getGlobalErrorText() {
        const elements = GLOBAL_ERROR_SELECTORS.flatMap(selector => Array.from(document.querySelectorAll(selector)));
        return collectTextFromElements(elements);
    }

    function getDuplicateError() {
        const fieldText = normalizeText(getFieldErrorText());
        const globalText = normalizeText(getGlobalErrorText());
        const combined = normalizeText(`${fieldText} ${globalText}`);

        if (!combined) return null;

        const fieldScoped = !!fieldText;
        const hasIdSignal = fieldScoped ||
            combined.includes('identifikacni cislo') ||
            combined.includes('manual_id') ||
            combined.includes('p3101_manual_id') ||
            hasWord(combined, 'id');
        const hasExistSignal =
            combined.includes('jiz exist') ||
            combined.includes('uz exist') ||
            combined.includes('already exist') ||
            (combined.includes('existuje') && !combined.includes('neexistuje'));
        const hasDuplicateSignal =
            combined.includes('stejne') ||
            combined.includes('duplicit') ||
            combined.includes('duplicate') ||
            combined.includes('unique') ||
            combined.includes('jedinecn') ||
            combined.includes('dvakrat') ||
            hasExistSignal;
        const hasRejectSignal =
            combined.includes('nelze') ||
            combined.includes('pouzit') ||
            combined.includes('zvolte') ||
            combined.includes('jine') ||
            combined.includes('obsazen');

        if (!hasIdSignal || !hasDuplicateSignal) return null;
        if (!fieldScoped && !hasRejectSignal && !combined.includes('duplicate') && !combined.includes('unique')) return null;

        return {
            text: combined,
            signature: combined
        };
    }

    function loadState() {
        try {
            const raw = sessionStorage.getItem(STATE_KEY);
            if (!raw) return null;

            const state = JSON.parse(raw);
            if (!state || Date.now() - Number(state.updatedAt || state.createdAt || 0) > STATE_TTL_MS) {
                sessionStorage.removeItem(STATE_KEY);
                return null;
            }

            return state;
        } catch (e) {
            sessionStorage.removeItem(STATE_KEY);
            return null;
        }
    }

    function saveState(state) {
        const nextState = Object.assign({}, state, { updatedAt: Date.now() });
        try {
            sessionStorage.setItem(STATE_KEY, JSON.stringify(nextState));
        } catch (e) {
            console.warn(`${LOG_PREFIX} Nelze uložit retry stav do sessionStorage.`, e);
        }
        return nextState;
    }

    function clearState() {
        try {
            sessionStorage.removeItem(STATE_KEY);
        } catch (e) {
            // Bez sessionStorage jen doběhne aktuální stránka; není potřeba zasahovat do UI.
        }
    }

    function mutationTouchesError(records) {
        return records.some(record => {
            const target = record.target && record.target.nodeType === 1 ? record.target : record.target.parentElement;
            if (target && target.closest && target.closest(ERROR_RELATED_SELECTOR)) return true;

            const nodes = Array.from(record.addedNodes || []).concat(Array.from(record.removedNodes || []));
            return nodes.some(node => {
                if (node.nodeType !== 1) return false;
                return (node.matches && node.matches(ERROR_RELATED_SELECTOR)) ||
                    (node.querySelector && node.querySelector(ERROR_RELATED_SELECTOR));
            });
        });
    }

    RS.Modules.AutoIdSequence = {
        initialized: false,
        activeState: null,
        observer: null,
        retryTimer: null,
        clearTimer: null,
        internalClick: false,

        init: function () {
            if (this.initialized) return;

            const field = getField();
            if (!field) {
                clearState();
                return;
            }

            this.initialized = true;
            this.resumePendingState();
            document.addEventListener('click', this.onDocumentClick.bind(this), true);
            console.info(`${LOG_PREFIX} Modul v4.0 inicializován pro pole ${FIELD_ID}.`);
        },

        onDocumentClick: function (event) {
            const control = event.target.closest ? event.target.closest(SAVE_SELECTOR) : null;
            if (!isSaveControl(control)) return;

            if (this.internalClick) return;

            const currentId = readFieldValue();
            if (!parseSequencedId(currentId)) {
                this.stopWatching();
                clearState();
                return;
            }

            const state = saveState({
                version: 4,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                attempts: 0,
                originalId: currentId,
                lastAttemptedId: currentId,
                button: getControlDescriptor(control)
            });

            this.watchForAjaxResult(state);
            console.info(`${LOG_PREFIX} Uživatel spustil standardní uložení s ID ${currentId}.`);
        },

        resumePendingState: function () {
            const state = loadState();
            if (!state) return;

            this.activeState = state;
            window.setTimeout(() => this.evaluateCurrentPageResult('reload'), RELOAD_CHECK_DELAY_MS);
            this.scheduleClearIfNoError('Uložení prošlo nebo stránka vrátila jinou chybu.');
        },

        watchForAjaxResult: function (state) {
            this.activeState = state;
            this.stopObserver();

            this.observer = new MutationObserver(records => {
                if (!this.activeState || !mutationTouchesError(records)) return;
                this.queueEvaluate(MUTATION_SETTLE_MS, 'mutation');
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        },

        queueEvaluate: function (delay, source) {
            if (this.retryTimer) window.clearTimeout(this.retryTimer);
            this.retryTimer = window.setTimeout(() => {
                this.retryTimer = null;
                this.evaluateCurrentPageResult(source);
            }, delay);
        },

        evaluateCurrentPageResult: function (source) {
            const state = this.activeState || loadState();
            if (!state) return;

            const duplicateError = getDuplicateError();
            if (!duplicateError) {
                if (source === 'mutation' || source === 'reload') {
                    this.scheduleClearIfNoError('Duplicitní chyba po odpovědi stránky není přítomná.');
                }
                return;
            }

            if (this.clearTimer) {
                window.clearTimeout(this.clearTimer);
                this.clearTimer = null;
            }
            this.retryWithNextId(state, duplicateError);
        },

        retryWithNextId: function (state, duplicateError) {
            if (this.clearTimer) {
                window.clearTimeout(this.clearTimer);
                this.clearTimer = null;
            }

            if (Number(state.attempts || 0) >= MAX_ATTEMPTS) {
                console.warn(`${LOG_PREFIX} Dosažen limit ${MAX_ATTEMPTS} pokusů. Automatické navyšování zastaveno.`);
                this.finishCycle('Limit pokusů dosažen.');
                return;
            }

            const currentId = state.lastAttemptedId || readFieldValue();
            const nextId = nextSequencedId(currentId);
            if (!nextId) {
                console.warn(`${LOG_PREFIX} ID "${currentId}" nemá číselnou část, kterou lze navýšit.`);
                this.finishCycle('ID nelze navýšit.');
                return;
            }

            const nextState = saveState(Object.assign({}, state, {
                attempts: Number(state.attempts || 0) + 1,
                lastAttemptedId: nextId,
                lastErrorSignature: duplicateError.signature
            }));

            this.stopObserver();

            if (!writeFieldValue(nextId)) {
                console.error(`${LOG_PREFIX} Nepodařilo se zapsat nové ID "${nextId}" do pole ${FIELD_ID}.`);
                this.finishCycle('Zápis ID selhal.');
                return;
            }

            const control = findSaveControl(nextState.button);
            if (!control) {
                console.error(`${LOG_PREFIX} Nepodařilo se najít původní tlačítko pro uložení. Retry zastaven.`);
                this.finishCycle('Původní tlačítko nenalezeno.');
                return;
            }

            this.activeState = nextState;
            this.watchForAjaxResult(nextState);

            window.setTimeout(() => {
                this.internalClick = true;
                console.info(`${LOG_PREFIX} Pokus ${nextState.attempts}: zkouším standardně uložit ID ${nextId}.`);
                control.click();
                window.setTimeout(() => {
                    this.internalClick = false;
                }, 0);
            }, RETRY_CLICK_DELAY_MS);
        },

        stopObserver: function () {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        },

        stopWatching: function () {
            this.stopObserver();
            if (this.retryTimer) {
                window.clearTimeout(this.retryTimer);
                this.retryTimer = null;
            }
            if (this.clearTimer) {
                window.clearTimeout(this.clearTimer);
                this.clearTimer = null;
            }
            this.activeState = null;
        },

        scheduleClearIfNoError: function (reason) {
            if (this.clearTimer) window.clearTimeout(this.clearTimer);
            this.clearTimer = window.setTimeout(() => {
                this.clearTimer = null;
                if (!getDuplicateError()) this.finishCycle(reason);
            }, NO_ERROR_CLEAR_DELAY_MS);
        },

        finishCycle: function (reason) {
            this.stopWatching();
            clearState();
            console.info(`${LOG_PREFIX} Retry cyklus ukončen. ${reason}`);
        }
    };

    if (!RS.Config) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => RS.Modules.AutoIdSequence.init());
        } else {
            window.setTimeout(() => RS.Modules.AutoIdSequence.init(), 250);
        }
    }
})();
