// ==UserScript==
// @name         Riscon: Auto ID sekvence
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      5.1.1
// @description  Pri serverove chybe duplicity zvysi P3140_MANUAL_ID nebo P3101_MANUAL_ID a znovu stiskne stejne tlacitko.
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

    const FIELD_IDS = ['P3140_MANUAL_ID', 'P3101_MANUAL_ID'];
    const LAST_BUTTON_KEY = 'RisconAutoIdSequence.lastButton.v6';
    const LAST_BUTTON_TTL_MS = 10 * 60 * 1000;
    const RETRY_DELAY_MS = 700;
    const BUTTON_SELECTOR = 'button, input[type="button"], input[type="submit"], input[type="image"], a, [role="button"]';
    const ERROR_SELECTOR = [
        '.t-Alert--danger',
        '.t-Alert--warning',
        '.t-Body-alert',
        '.apex-page-errors',
        '.a-Notification',
        '.a-Alert',
        '.t-Form-error',
        '.a-Form-error',
        '[role="alert"]',
        '[id*="error"]',
        '[id*="Error"]',
        '[class*="error"]',
        '[class*="Error"]'
    ].join(',');

    function normalizeText(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getElementText(el) {
        return (el && (el.innerText || el.textContent) || '').trim();
    }

    function getFieldValue(id) {
        const el = document.getElementById(id);
        if (!el) return '';

        if (window.apex && apex.item) {
            try {
                const item = apex.item(id);
                if (item) return String(item.getValue() || '');
            } catch (e) { }
        }

        return String(el.value || '');
    }

    function setFieldValue(id, value) {
        const el = document.getElementById(id);
        if (!el) return;

        if (window.apex && apex.item) {
            try {
                const item = apex.item(id);
                if (item) item.setValue(value, null, false);
            } catch (e) { }
        }

        if (el.value !== value) el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function getLabelText(id) {
        const labels = [
            document.querySelector('label[for="' + id + '"]'),
            document.getElementById(id + '_LABEL'),
            document.getElementById(id + '_label')
        ].filter(Boolean);

        return labels.map(getElementText).join(' ');
    }

    function isYearLike(value) {
        if (!/^\d{4}$/.test(value)) return false;
        const year = Number(value);
        return year >= 1900 && year <= 2099;
    }

    function incrementNumericSeries(value) {
        const original = String(value || '');
        const matches = Array.from(original.matchAll(/\d+/g));
        if (matches.length === 0) return null;

        let selected = null;
        for (let i = matches.length - 1; i >= 0; i--) {
            if (matches.length === 1 || !isYearLike(matches[i][0])) {
                selected = matches[i];
                break;
            }
        }
        if (!selected) selected = matches[matches.length - 1];

        const current = selected[0];
        let next;
        try {
            next = (BigInt(current) + 1n).toString();
        } catch (e) {
            next = String(Number(current) + 1);
        }

        if (current.length > next.length) next = next.padStart(current.length, '0');

        const start = selected.index;
        return original.slice(0, start) + next + original.slice(start + current.length);
    }

    function readLastButton() {
        try {
            const record = JSON.parse(sessionStorage.getItem(LAST_BUTTON_KEY) || 'null');
            if (!record || !record.ts || Date.now() - record.ts > LAST_BUTTON_TTL_MS) return null;
            return record;
        } catch (e) {
            return null;
        }
    }

    function writeLastButton(record) {
        try {
            sessionStorage.setItem(LAST_BUTTON_KEY, JSON.stringify(record));
        } catch (e) { }
    }

    function clearOldState() {
        try {
            sessionStorage.removeItem('RisconAutoIdSequence.v4');
            sessionStorage.removeItem('RisconAutoIdSequence.v5');
        } catch (e) { }
    }

    RS.Modules.AutoIdSequence = {
        initialized: false,
        observer: null,
        retrying: false,
        waitingForResponse: false,
        responseTimer: null,
        lastSignature: '',

        init: function () {
            clearOldState();
            if (this.initialized) return;
            if (!this.hasTargetField()) return;

            this.initialized = true;
            this.bindButtonMemory();
            this.bindErrorWatch();
            this.scheduleDuplicateCheck();
        },

        hasTargetField: function () {
            return FIELD_IDS.some(id => !!document.getElementById(id));
        },

        getPresentFields: function () {
            return FIELD_IDS
                .filter(id => !!document.getElementById(id))
                .map(id => ({
                    id: id,
                    value: getFieldValue(id).trim(),
                    label: getLabelText(id)
                }))
                .filter(field => field.value !== '');
        },

        bindButtonMemory: function () {
            document.addEventListener('click', (event) => {
                const control = event.target.closest(BUTTON_SELECTOR);
                if (!control || !this.hasTargetField() || !this.isLikelyPageButton(control)) return;
                this.rememberButton(control);
            }, true);

            document.addEventListener('submit', (event) => {
                const submitter = event.submitter || document.activeElement;
                if (!submitter || !this.hasTargetField() || !this.isLikelyPageButton(submitter)) return;
                this.rememberButton(submitter);
            }, true);
        },

        bindErrorWatch: function () {
            this.observer = new MutationObserver(() => this.scheduleDuplicateCheck());
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'aria-invalid', 'aria-hidden']
            });

            if (window.apex && apex.jQuery) {
                apex.jQuery(document).on('apexafterrefresh', () => this.scheduleDuplicateCheck());
                apex.jQuery(document).ajaxComplete(() => this.releaseAfterResponse());
            }
        },

        scheduleDuplicateCheck: function () {
            window.setTimeout(() => this.handleDuplicateErrorIfNeeded(), 150);
        },

        isLikelyPageButton: function (control) {
            if (!control || control.closest('#riscon-suite-settings, #riscon-settings-trigger, #apex-json-btnwrap')) return false;

            const tag = control.tagName.toLowerCase();
            const type = String(control.getAttribute('type') || '').toLowerCase();
            const raw = [
                control.id,
                control.name,
                control.value,
                control.getAttribute('onclick'),
                control.getAttribute('href'),
                control.getAttribute('data-request'),
                getElementText(control)
            ].join(' ');

            if (tag === 'button' || tag === 'input') return !!control.closest('form') || /submit|save|create|apply|uloz/i.test(raw);
            if (tag === 'a' || control.getAttribute('role') === 'button') return /apex\.submit|doSubmit|submit|save|create|apply|uloz/i.test(raw);
            return type === 'submit';
        },

        rememberButton: function (control) {
            const form = control.closest('form');
            writeLastButton({
                ts: Date.now(),
                id: control.id || '',
                name: control.name || control.getAttribute('name') || '',
                value: control.value || control.getAttribute('value') || '',
                text: normalizeText(getElementText(control) || control.value || ''),
                tag: control.tagName.toLowerCase(),
                formId: form && form.id || '',
                attempt: 0
            });
        },

        handleDuplicateErrorIfNeeded: function () {
            if (this.retrying || this.waitingForResponse || !this.hasTargetField()) return;

            const fields = this.getPresentFields();
            if (fields.length === 0) return;

            const error = this.findDuplicateError(fields);
            if (!error) return;

            const record = readLastButton();
            if (!record) {
                console.warn('[Riscon Auto ID] Duplicita zjistena, ale neni ulozene posledni tlacitko uzivatele.');
                return;
            }

            const fieldsToIncrement = this.getFieldsForError(fields, error.text);
            const signature = fieldsToIncrement.map(field => field.id + '=' + field.value).join('|') + '|' + error.text;
            if (signature === this.lastSignature) return;
            this.lastSignature = signature;

            const changes = [];
            for (const field of fieldsToIncrement) {
                const nextValue = incrementNumericSeries(field.value);
                if (!nextValue || nextValue === field.value) continue;
                setFieldValue(field.id, nextValue);
                changes.push(field.id + ': ' + field.value + ' -> ' + nextValue);
            }

            if (changes.length === 0) {
                console.warn('[Riscon Auto ID] V poli manualniho ID nebyla nalezena ciselna rada.');
                return;
            }

            record.ts = Date.now();
            record.attempt = (record.attempt || 0) + 1;
            writeLastButton(record);

            console.info('[Riscon Auto ID] Duplicita zjistena, zkousim dalsi cislo.', changes.join(', '));
            this.retrying = true;
            window.setTimeout(() => {
                const button = this.findStoredButton(record);
                if (!button) {
                    this.retrying = false;
                    this.waitingForResponse = false;
                    console.warn('[Riscon Auto ID] Ulozene tlacitko nebylo nalezeno.');
                    return;
                }

                this.markWaitingForResponse();
                button.click();
                this.retrying = false;
            }, RETRY_DELAY_MS);
        },

        markWaitingForResponse: function () {
            this.waitingForResponse = true;
            if (this.responseTimer) window.clearTimeout(this.responseTimer);

            this.responseTimer = window.setTimeout(() => {
                this.waitingForResponse = false;
                this.responseTimer = null;
                this.scheduleDuplicateCheck();
            }, 15000);
        },

        releaseAfterResponse: function () {
            if (!this.waitingForResponse) return;

            if (this.responseTimer) {
                window.clearTimeout(this.responseTimer);
                this.responseTimer = null;
            }

            window.setTimeout(() => {
                this.waitingForResponse = false;
                this.scheduleDuplicateCheck();
            }, 300);
        },

        findDuplicateError: function (fields) {
            const nodes = Array.from(document.querySelectorAll(ERROR_SELECTOR))
                .filter(node => this.isVisibleErrorNode(node));

            for (const node of nodes) {
                const text = getElementText(node);
                if (this.isDuplicateErrorText(text, fields)) return { node: node, text: normalizeText(text) };
            }

            return null;
        },

        isVisibleErrorNode: function (node) {
            if (!node || node.getAttribute('aria-hidden') === 'true') return false;
            const text = getElementText(node);
            if (!text) return false;

            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            return true;
        },

        isDuplicateErrorText: function (text, fields) {
            const normalized = normalizeText(text);
            if (!normalized) return false;

            const hasDuplicateSignal = /duplik|duplicit|unique|ora-00001|jedinec|existuje|existuji|existujic|already exist|jiz .*pouzit|uz .*pouzit|pouzite|pouzity|pouzita|pouzito|jiz .*ulozen|uz .*ulozen|databaz/.test(normalized);
            if (!hasDuplicateSignal) return false;

            const fieldMention = fields.some(field => {
                return normalized.indexOf(normalizeText(field.id)) !== -1 ||
                    (field.label && normalized.indexOf(normalizeText(field.label)) !== -1);
            });
            const manualContext = /manual[_ -]?id|cislo|cisel|rada|doklad|dokument|constraint|omezen/.test(normalized);
            const targetFieldError = fields.some(field => this.isFieldMarkedInvalid(field.id));

            return fieldMention || manualContext || targetFieldError || /ora-00001|unique|jedinec/.test(normalized);
        },

        isFieldMarkedInvalid: function (id) {
            const el = document.getElementById(id);
            if (!el) return false;
            if (el.getAttribute('aria-invalid') === 'true') return true;
            if (/\b(error|invalid)\b/i.test(el.className || '')) return true;

            const container = el.closest('.t-Form-fieldContainer--error, .is-invalid, .has-error');
            if (container) return true;

            const placeholders = [
                document.getElementById(id + '_error_placeholder'),
                document.getElementById(id + '_ERROR'),
                document.getElementById(id + '_error')
            ].filter(Boolean);

            return placeholders.some(node => getElementText(node) !== '');
        },

        getFieldsForError: function (fields, errorText) {
            const normalized = normalizeText(errorText);
            const mentioned = fields.filter(field => {
                return normalized.indexOf(normalizeText(field.id)) !== -1 ||
                    (field.label && normalized.indexOf(normalizeText(field.label)) !== -1);
            });
            if (mentioned.length > 0) return mentioned;

            const invalid = fields.filter(field => this.isFieldMarkedInvalid(field.id));
            return invalid.length > 0 ? invalid : fields;
        },

        findStoredButton: function (record) {
            if (record.id) {
                const byId = document.getElementById(record.id);
                if (byId) return byId;
            }

            const controls = Array.from(document.querySelectorAll(BUTTON_SELECTOR))
                .filter(control => this.isLikelyPageButton(control));

            let best = null;
            let bestScore = 0;

            controls.forEach(control => {
                const form = control.closest('form');
                let score = 0;

                if (record.formId && form && form.id === record.formId) score += 2;
                if (record.name && (control.name === record.name || control.getAttribute('name') === record.name)) score += 3;
                if (record.value && (control.value === record.value || control.getAttribute('value') === record.value)) score += 3;
                if (record.text && normalizeText(getElementText(control) || control.value || '') === record.text) score += 2;
                if (record.tag && control.tagName.toLowerCase() === record.tag) score += 1;

                if (score > bestScore) {
                    best = control;
                    bestScore = score;
                }
            });

            return bestScore > 0 ? best : null;
        }
    };

    if (!RS.Config) {
        const start = () => RS.Modules.AutoIdSequence.init();
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else window.setTimeout(start, 250);
    }
})();
