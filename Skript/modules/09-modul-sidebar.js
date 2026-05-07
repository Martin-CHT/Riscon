// ==UserScript==
// @name         Riscon: Postranní panel (Sidebar Toggle)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.3
// @description  Zmenšení / skrytí postranního panelu nenápadným tlačítkem. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/09-modul-sidebar.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/09-modul-sidebar.js
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
    RS.Modules = RS.Modules || {};

    RS.Modules.Sidebar = {
        containerId: 'sleek-toggle',
        toggle: function (enabled) {
            const btn = document.getElementById(this.containerId);
            if (enabled) {
                if (this.disableOnPrintLayout()) return;
                document.body.classList.add('riscon-sidebar-enabled');
                this.init();
                const nextBtn = document.getElementById(this.containerId);
                if (nextBtn) nextBtn.style.display = 'flex';
            } else {
                document.body.classList.remove('riscon-sidebar-enabled');
                document.body.classList.remove('sidebar-collapsed');
                document.body.classList.remove('riscon-print-layout');
                if (btn) btn.style.display = 'none';
            }
        },
        isPrintLayoutPage: function () {
            return !!document.querySelector('table.si_table');
        },
        disableOnPrintLayout: function () {
            if (!this.isPrintLayoutPage()) {
                document.body.classList.remove('riscon-print-layout');
                return false;
            }
            document.body.classList.remove('riscon-sidebar-enabled');
            document.body.classList.remove('sidebar-collapsed');
            document.body.classList.remove('riscon-print-layout');
            const btn = document.getElementById(this.containerId);
            if (btn) btn.style.display = 'none';
            return true;
        },
        init: function () {
            if (document.getElementById(this.containerId)) {
                this.disableOnPrintLayout();
                return;
            }

            // Vyčištění případných starších prvků
            ['pro-sidebar-toggle', 'pro-sidebar-restore', 'sidebar-toggle-handle', 'flex-handle'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.remove();
            });

            const STORAGE_KEY = 'apex_sidebar_collapsed_state';
            const isPrintLayout = this.disableOnPrintLayout();

            if (!isPrintLayout && localStorage.getItem(STORAGE_KEY) === 'true') {
                document.body.classList.add('sidebar-collapsed');
            }

            if (isPrintLayout) return;

            const btn = document.createElement('div');
            btn.id = this.containerId;
            btn.innerHTML = '<span>&#8250;</span>';
            btn.title = 'Zobrazit / Skrýt postranní panel';
            document.body.appendChild(btn);

            btn.addEventListener('click', () => {
                if (this.disableOnPrintLayout()) return;
                const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
                localStorage.setItem(STORAGE_KEY, isCollapsed);
            });
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => RS.Modules.Sidebar.toggle(true));
        } else {
            RS.Modules.Sidebar.toggle(true);
        }
    }

})();
