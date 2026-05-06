// ==UserScript==
// @name         Riscon: Auto ID sekvence
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      5.3.5
// @description  Pri serverove chybe duplicity upravi manualni ID nebo nazev profilu a znovu stiskne stejne tlacitko.
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

    const FIELD_RULES = [
        { id: 'P3140_MANUAL_ID', mode: 'number', retry: true },
        { id: 'P3101_MANUAL_ID', mode: 'number', retry: false },
        { id: 'P3140_PROFILE_NAME', mode: 'space', retry: true },
        { id: 'P3101_PROFILE_NAME', mode: 'space', retry: true }
    ];
    const FIELD_IDS = FIELD_RULES.map(field => field.id);
    const LAST_BUTTON_KEY = 'RisconAutoIdSequence.lastButton.v6';
    const PAUSED_KEY = 'RisconAutoIdSequence.paused.v1';
    const LAST_BUTTON_TTL_MS = 10 * 60 * 1000;
    const RETRY_DELAY_MS = 700;
    const STOP_BUTTON_ID = 'riscon-auto-id-stop';
    const BUTTON_SELECTOR = 'button, input[type="button"], input[type="submit"], input[type="image"], a, [role="button"]';
    const PROFILE_CONTEXT_RE = /\bnazv\w*\b|\bname\b|\bprofile[_ -]?name\b/;
    const NUMBER_CONTEXT_RE = /manual[_ -]?id|\bcislo|\bcisel|\bidentifikacn\w*\b|\brada\b|\bdoklad\b|\bdokument\b|\bid profilu\b|\bidentifikator\b/;
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

    function getNextFieldValue(field) {
        if (field.mode === 'space') return field.value + ' ';
        return incrementNumericSeries(field.value);
    }

    function getChangeLabel(field, nextValue) {
        if (field.mode === 'space') {
            return field.id + ': pridana koncova mezera (' + (nextValue.length - field.value.length) + ')';
        }

        return field.id + ': ' + field.value + ' -> ' + nextValue;
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

    function isPaused() {
        try {
            return sessionStorage.getItem(PAUSED_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setPaused(paused) {
        try {
            if (paused) sessionStorage.setItem(PAUSED_KEY, '1');
            else sessionStorage.removeItem(PAUSED_KEY);
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
            this.createStopButton();
            this.scheduleDuplicateCheck();
        },

        hasTargetField: function () {
            return FIELD_IDS.some(id => !!document.getElementById(id));
        },

        getPresentFields: function () {
            return FIELD_RULES
                .filter(rule => !!document.getElementById(rule.id))
                .map(rule => ({
                    id: rule.id,
                    mode: rule.mode,
                    retry: rule.retry !== false,
                    value: getFieldValue(rule.id),
                    label: getLabelText(rule.id)
                }))
                .filter(field => field.value.trim() !== '');
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

        createStopButton: function () {
            if (document.getElementById(STOP_BUTTON_ID)) {
                this.updateStopButton();
                return;
            }

            const btn = document.createElement('button');
            btn.id = STOP_BUTTON_ID;
            btn.type = 'button';
            Object.assign(btn.style, {
                position: 'fixed',
                right: '12px',
                bottom: '12px',
                zIndex: '999999',
                border: '1px solid #8a4b00',
                borderRadius: '4px',
                padding: '5px 9px',
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            });

            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (isPaused()) this.resumeRetries();
                else this.stopRetries();
            }, true);

            document.body.appendChild(btn);
            this.updateStopButton();
        },

        updateStopButton: function () {
            const btn = document.getElementById(STOP_BUTTON_ID);
            if (!btn) return;

            if (isPaused()) {
                btn.textContent = 'Auto ID zastaveno';
                btn.title = 'Kliknutim znovu povolite automaticke zkouseni dalsi hodnoty.';
                btn.style.background = '#666';
                btn.style.color = '#fff';
                btn.style.borderColor = '#555';
            } else {
                btn.textContent = 'Zastavit Auto ID';
                btn.title = 'Zastavi automaticke opakovani ukladani v teto zalozce.';
                btn.style.background = '#ffd36a';
                btn.style.color = '#222';
                btn.style.borderColor = '#8a4b00';
            }
        },

        stopRetries: function () {
            setPaused(true);
            this.retrying = false;
            this.waitingForResponse = false;
            if (this.responseTimer) {
                window.clearTimeout(this.responseTimer);
                this.responseTimer = null;
            }
            this.updateStopButton();
            console.warn('[Riscon Auto ID] Automaticke opakovani bylo rucne zastaveno.');
        },

        resumeRetries: function () {
            setPaused(false);
            this.lastSignature = '';
            this.updateStopButton();
            this.scheduleDuplicateCheck();
            console.info('[Riscon Auto ID] Automaticke opakovani bylo znovu povoleno.');
        },

        isLikelyPageButton: function (control) {
            if (!control || control.closest('#riscon-suite-settings, #riscon-settings-trigger, #apex-json-btnwrap, #' + STOP_BUTTON_ID)) return false;

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
            if (isPaused() || this.retrying || this.waitingForResponse || !this.hasTargetField()) return;

            const fields = this.getPresentFields();
            if (fields.length === 0) return;

            const error = this.findDuplicateError(fields);
            if (!error) return;

            const record = readLastButton();
            if (!record) {
                console.warn('[Riscon Auto ID] Duplicita zjistena, ale neni ulozene posledni tlacitko uzivatele.');
                return;
            }

            const fieldsToUpdate = this.getFieldsForError(fields, error.text);
            if (fieldsToUpdate.some(field => field.retry === false)) {
                console.error('[Riscon Auto ID] Automaticke resubmitovani pro toto pole je z bezpecnostnich duvodu vypnute. Stranka musi duplicitu zablokovat sama, automatika ji nesmi obchazet.', fieldsToUpdate.map(field => field.id).join(', '));
                return;
            }

            const signature = fieldsToUpdate.map(field => field.id + '=' + field.value).join('|') + '|' + error.text;
            if (signature === this.lastSignature) return;
            this.lastSignature = signature;

            const changes = [];
            for (const field of fieldsToUpdate) {
                const nextValue = getNextFieldValue(field);
                if (!nextValue || nextValue === field.value) continue;
                setFieldValue(field.id, nextValue);
                changes.push(getChangeLabel(field, nextValue));
            }

            if (changes.length === 0) {
                console.warn('[Riscon Auto ID] Nebylo mozne najit dalsi hodnotu pro pole s duplicitou.');
                return;
            }

            record.ts = Date.now();
            record.attempt = (record.attempt || 0) + 1;
            writeLastButton(record);

            console.info('[Riscon Auto ID] Duplicita zjistena, zkousim dalsi hodnotu.', changes.join(', '));
            this.retrying = true;
            window.setTimeout(() => {
                if (isPaused()) {
                    this.retrying = false;
                    this.waitingForResponse = false;
                    return;
                }

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

            const hasDuplicateSignal = /duplik|duplicit|unique|ora-00001|jedinec|existuje|existuji|existujic|already exist|jiz .*pouzit|uz .*pouzit|nelze .*pouzit|pouzit .*dvakrat|stejn\w* .*cislo|pouzite|pouzity|pouzita|pouzito|jiz .*ulozen|uz .*ulozen|databaz/.test(normalized);
            if (!hasDuplicateSignal) return false;

            const fieldMention = fields.some(field => {
                return normalized.indexOf(normalizeText(field.id)) !== -1 ||
                    (field.label && normalized.indexOf(normalizeText(field.label)) !== -1);
            });
            const manualContext = /manual[_ -]?id|cislo|cisel|rada|doklad|dokument|constraint|omezen/.test(normalized);
            const profileContext = PROFILE_CONTEXT_RE.test(normalized);
            const targetFieldError = fields.some(field => this.isFieldMarkedInvalid(field.id));

            return fieldMention || manualContext || profileContext || targetFieldError || /ora-00001|unique|jedinec/.test(normalized);
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
            const exactIdMentioned = fields.filter(field => normalized.indexOf(normalizeText(field.id)) !== -1);
            if (exactIdMentioned.length > 0) return exactIdMentioned;

            const hasProfileContext = PROFILE_CONTEXT_RE.test(normalized);
            const hasNumberContext = NUMBER_CONTEXT_RE.test(normalized);

            if (hasProfileContext && (!hasNumberContext || /stejn\w* nazv\w*/.test(normalized))) {
                const profileFields = fields.filter(field => /_PROFILE_NAME$/.test(field.id));
                if (profileFields.length > 0) return profileFields;
            }

            if (hasNumberContext && !hasProfileContext) {
                const numberFields = fields.filter(field => field.mode === 'number');
                if (numberFields.length > 0) return numberFields;
            }

            const labelMentioned = fields.filter(field => {
                return field.label && normalized.indexOf(normalizeText(field.label)) !== -1;
            });
            if (labelMentioned.length === 1) return labelMentioned;

            const invalid = fields.filter(field => this.isFieldMarkedInvalid(field.id));
            if (invalid.length > 0) return invalid;

            if (labelMentioned.length > 1) return labelMentioned;
            return fields;
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
