// ==UserScript==
// @name         Riscon: Core (sdílené jádro)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.2
// @description  Sdílená konfigurace, pomocné funkce a globální namespace RisconSuite. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/00-core.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/00-core.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;

    // --- KONFIGURACE ---
    const APP_KEY = 'RISCON_SUITE_V1';

    const DEFAULT_CONFIG = {
        json: { enabled: true },
        risks: { labels: true, colors: true, legend: true },
        hiddenItems: { enabled: true },
        rowHighlight: { enabled: true },
        stickyHeaders: { enabled: true },
        tabHighlight: { enabled: true },
        sidebarToggle: { enabled: true },
        docChecklist: { enabled: true },
        settingsBtnPosition: 'bottom-left',
        settingsBtnOpacity: 0.2,
        scriptBtnOpacity: 0.2
    };

    function deepMergeDefaults(target, defaults) {
        if (target === null || typeof target !== 'object') return JSON.parse(JSON.stringify(defaults));
        const out = Array.isArray(defaults) ? [] : {};
        for (const k of Object.keys(defaults)) {
            const dv = defaults[k];
            const tv = target[k];
            if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
                out[k] = deepMergeDefaults(tv, dv);
            } else {
                out[k] = (typeof tv === 'undefined') ? dv : tv;
            }
        }
        for (const k of Object.keys(target)) {
            if (!(k in out)) out[k] = target[k];
        }
        return out;
    }

    let Config = null;
    try {
        const storedConfig = GM_getValue(APP_KEY, JSON.stringify(DEFAULT_CONFIG));
        const parsed = JSON.parse(storedConfig);
        Config = deepMergeDefaults(parsed, DEFAULT_CONFIG);
    } catch (e) {
        Config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    function saveConfig() { GM_setValue(APP_KEY, JSON.stringify(Config)); }

    const $ = (sel, root = document) => root.querySelector(sel);
    const pause = (ms) => new Promise(r => setTimeout(r, ms));

    function updateOpacity() {
        const sBtn = document.getElementById('riscon-settings-trigger');
        if (sBtn) {
            sBtn.style.opacity = Config.settingsBtnOpacity;
            sBtn.onmouseout = () => sBtn.style.opacity = Config.settingsBtnOpacity;
        }
        const jBtn = document.getElementById('apex-json-btnwrap');
        if (jBtn) {
            jBtn.style.opacity = Config.scriptBtnOpacity;
            jBtn.onmouseout = () => jBtn.style.opacity = Config.scriptBtnOpacity;
        }
    }

    // --- EXPORT do globálního namespace ---
    RS.Config = Config;
    RS.saveConfig = saveConfig;
    RS.$ = $;
    RS.pause = pause;
    RS.updateOpacity = updateOpacity;
    RS.Modules = RS.Modules || {};

})();
