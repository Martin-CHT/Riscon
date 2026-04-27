// ==UserScript==
// @name         Riscon: Pulse (MutationObserver)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.0
// @description  MutationObserver pro automatické spouštění modulů po změnách DOM. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @source       https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/03-pulse.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;

    RS.Pulse = {
        timer: null,
        observer: null,
        start: function () {
            this.beat();
            this.observer = new MutationObserver((mutations) => {
                let shouldRun = false;
                for (const m of mutations) {
                    if (m.type === 'childList' && m.addedNodes.length > 0) {
                        shouldRun = true;
                        break;
                    }
                }
                if (shouldRun) {
                    clearTimeout(this.timer);
                    this.timer = setTimeout(() => this.beat(), 300);
                }
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        },
        beat: function () {
            const M = RS.Modules;
            if (!M || !M.safeRun) return;
            M.safeRun('Risks', () => M.Risks && M.Risks.update(RS.Config.risks));
            M.safeRun('Rows', () => M.Rows && M.Rows.paintAll());
            M.safeRun('Lists', () => M.Lists && M.Lists.init());
            M.safeRun('Tabs', () => M.Tabs && M.Tabs.init());
            M.safeRun('Checklist', () => M.Checklist && M.Checklist.init());
        }
    };

})();
