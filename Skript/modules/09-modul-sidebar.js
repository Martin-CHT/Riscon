// ==UserScript==
// @name         Riscon: Postranní panel (Sidebar Toggle)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.0
// @description  Zmenšení / skrytí postranního panelu nenápadným tlačítkem. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @source       https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/09-modul-sidebar.js
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
                document.body.classList.add('riscon-sidebar-enabled');
                this.init();
                if (btn) btn.style.display = 'flex';
            } else {
                document.body.classList.remove('riscon-sidebar-enabled');
                document.body.classList.remove('sidebar-collapsed');
                if (btn) btn.style.display = 'none';
            }
        },
        init: function () {
            if (document.getElementById(this.containerId)) return;

            // Vyčištění případných starších prvků
            ['pro-sidebar-toggle', 'pro-sidebar-restore', 'sidebar-toggle-handle', 'flex-handle'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.remove();
            });

            const STORAGE_KEY = 'apex_sidebar_collapsed_state';

            if (localStorage.getItem(STORAGE_KEY) === 'true') {
                document.body.classList.add('sidebar-collapsed');
            }

            const btn = document.createElement('div');
            btn.id = this.containerId;
            btn.innerHTML = '<span>&#8250;</span>';
            btn.title = 'Zobrazit / Skrýt postranní panel';
            document.body.appendChild(btn);

            btn.addEventListener('click', function () {
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
