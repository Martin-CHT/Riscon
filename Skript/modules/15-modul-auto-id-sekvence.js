// ==UserScript==
// @name         Riscon: Auto ID sekvence
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      5.0.1
// @description  Bezpečně vypnutý modul. Neupravuje P3101_MANUAL_ID a nespouští žádné ukládání.
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
            try {
                sessionStorage.removeItem('RisconAutoIdSequence.v4');
                sessionStorage.removeItem('RisconAutoIdSequence.v5');
            } catch (e) {
                // Session storage neni pro vypnuti modulu nutny.
            }

            console.warn('[Riscon Auto ID] Modul je vypnuty: neupravuje P3101_MANUAL_ID a nespousti ukladani.');
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
