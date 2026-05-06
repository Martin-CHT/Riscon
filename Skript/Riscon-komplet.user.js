// ==UserScript==
// @name         Riscon: Sdružené skripty
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.32
// @description  Sdružený balík nástrojů pro Riscon. Modulární verze – každý modul je samostatný soubor načítaný přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @website      https://www.riscon.cz/
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/Riscon-komplet.user.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/Riscon-komplet.user.js
// @supportURL   https://github.com/Martin-CHT/Riscon/issues
// @icon         https://www.oracle.com/a/ocom/img/rest.svg
// @icon64       https://www.oracle.com/a/ocom/img/rest.svg
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/00-core.js?v=9.0.2
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/01-styles.js?v=9.0.1
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/02-settings-ui.js?v=9.0.2
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/03-pulse.js?v=9.0.2
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/04-modul-json.js?v=9.0.3
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/05-modul-rizika.js?v=9.0.1
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/06-modul-seznamy.js?v=9.0.4
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/07-modul-radky.js?v=9.0.1
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/08-modul-zalozky.js?v=9.0.1
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/09-modul-sidebar.js?v=9.0.1
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/10-modul-checklist.js?v=9.0.2
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/11-modul-rozbalit.js?v=9.0.3
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/12-modul-checklist-urazy.js?v=1.0.1
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/13-modul-autofill-urazy.js?v=9.0.1
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/14-modul-pripnute-zahlavi.js?v=9.0.3
// @require      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/15-modul-auto-id-sekvence.js?v=5.3.3
// ==/UserScript==

(function () {
    'use strict';

    // Všechny moduly jsou načteny přes @require a registrovány v window.RisconSuite.
    // Tento soubor slouží jako orchestrátor – definuje Modules.safeRun a Modules.applyAll,
    // propojí moduly dohromady a spustí aplikaci.

    const RS = window.RisconSuite;

    // --- Ochranná kontrola ---
    if (!RS || !RS.Config) {
        console.error('Riscon Suite: Core modul nebyl načten! Zkontrolujte @require direktivy.');
        return;
    }

    // --- Jádro modulového systému ---
    RS.Modules.safeRun = function (moduleName, fn) {
        try { fn(); } catch (e) { console.error(`Riscon Suite: Chyba v modulu ${moduleName}:`, e); }
    };

    RS.Modules.applyAll = function () {
        const M = RS.Modules;
        const C = RS.Config;
        RS.Modules.safeRun('JSON', () => M.Json && M.Json.toggle(C.json.enabled));
        RS.Modules.safeRun('Risks', () => M.Risks && M.Risks.update(C.risks));
        RS.Modules.safeRun('Lists', () => M.Lists && M.Lists.toggle(C.hiddenItems.enabled));
        RS.Modules.safeRun('Rows', () => M.Rows && M.Rows.init());
        RS.Modules.safeRun('StickyHeaders', () => M.StickyHeaders && M.StickyHeaders.toggle(C.stickyHeaders.enabled));
        RS.Modules.safeRun('Tabs', () => M.Tabs && M.Tabs.toggle(C.tabHighlight.enabled));
        RS.Modules.safeRun('Sidebar', () => M.Sidebar && M.Sidebar.toggle(C.sidebarToggle.enabled));
        RS.Modules.safeRun('Checklist', () => M.Checklist && M.Checklist.toggle(C.docChecklist.enabled));
        RS.Modules.safeRun('Unroll', () => M.Unroll && M.Unroll.init());
        RS.Modules.safeRun('UrazyChecklist', () => M.UrazyChecklist && M.UrazyChecklist.init());
        RS.Modules.safeRun('UrazyAutofill', () => M.UrazyAutofill && M.UrazyAutofill.init());
        RS.Modules.safeRun('AutoIdSequence', () => M.AutoIdSequence && M.AutoIdSequence.init());
    };

    // --- Spuštění ---
    function start() {
        RS.Styles.inject();
        RS.SettingsUI.create();
        RS.Modules.applyAll();
        RS.Pulse.start();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

})();
