// ==UserScript==
// @name         Riscon: Pripnute zahlavi tabulek
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.1
// @description  Pripnuti zahlavi reportovych tabulek pri scrollovani strankou. Soucast Riscon Suite - lze nainstalovat samostatne nebo nacist pres @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/14-modul-pripnute-zahlavi.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/14-modul-pripnute-zahlavi.js
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @match        https://www.riscon.cz/*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    window.RisconSuite = window.RisconSuite || {};
    const RS = window.RisconSuite;
    RS.Modules = RS.Modules || {};

    const TABLE_SELECTOR = 'table.a-IRR-table, table.t-Report-report, table.u-Report-table';
    const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, label, [role="button"], [onclick]';

    RS.Modules.StickyHeaders = {
        enabled: false,
        initialized: false,
        overlay: null,
        activeTable: null,
        raf: null,
        tables: [],
        headerTargets: [],
        boundUpdate: null,

        toggle: function (enabled) {
            this.enabled = !!enabled;
            if (this.enabled) {
                document.body.classList.add('riscon-sticky-headers-enabled');
                this.init();
                this.refresh();
            } else {
                document.body.classList.remove('riscon-sticky-headers-enabled');
                this.hide();
                this.tables.forEach(table => table.classList.remove('riscon-sticky-source-table'));
                this.tables = [];
            }
        },

        init: function () {
            if (this.initialized) return;

            this.initialized = true;
            this.injectStyles();
            this.overlay = document.createElement('div');
            this.overlay.id = 'riscon-sticky-table-header';
            this.overlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(this.overlay);

            this.overlay.addEventListener('click', (e) => this.forwardHeaderClick(e), true);
            this.boundUpdate = () => this.scheduleUpdate();
            window.addEventListener('scroll', this.boundUpdate, { passive: true });
            window.addEventListener('resize', this.boundUpdate, { passive: true });
            document.addEventListener('scroll', this.boundUpdate, true);
        },

        injectStyles: function () {
            if (document.getElementById('riscon-sticky-header-styles')) return;

            const css = `
                #riscon-sticky-table-header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    display: none;
                    overflow: hidden;
                    z-index: 999998;
                    box-sizing: border-box;
                    pointer-events: auto;
                    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.12));
                }
                #riscon-sticky-table-header .riscon-sticky-inner {
                    position: relative;
                    margin: 0;
                    padding: 0;
                }
                #riscon-sticky-table-header table {
                    margin: 0 !important;
                    border-collapse: separate !important;
                    border-spacing: 0 !important;
                    table-layout: fixed !important;
                }
                #riscon-sticky-table-header thead th,
                #riscon-sticky-table-header thead td {
                    background-clip: padding-box !important;
                    box-sizing: border-box !important;
                }
                @media print {
                    #riscon-sticky-table-header { display: none !important; }
                }
            `;

            if (typeof GM_addStyle === 'function') {
                const node = GM_addStyle(css);
                if (node) node.id = 'riscon-sticky-header-styles';
                return;
            }

            const style = document.createElement('style');
            style.id = 'riscon-sticky-header-styles';
            style.textContent = css;
            document.head.appendChild(style);
        },

        refresh: function () {
            if (!this.enabled) return;

            this.tables = Array.from(document.querySelectorAll(TABLE_SELECTOR)).filter(table => {
                if (table.closest('#riscon-sticky-table-header')) return false;
                if (!table.tHead || !table.tBodies || table.tBodies.length === 0) return false;
                if (table.tHead.querySelectorAll('th, td').length === 0) return false;
                return this.isVisible(table);
            });

            this.tables.forEach(table => table.classList.add('riscon-sticky-source-table'));
            this.scheduleUpdate();
        },

        scheduleUpdate: function () {
            if (!this.enabled || !this.initialized) return;
            if (this.raf) return;

            this.raf = requestAnimationFrame(() => {
                this.raf = null;
                this.update();
            });
        },

        update: function () {
            if (!this.enabled || !this.overlay) return;

            const top = this.getTopOffset();
            const active = this.findActiveTable(top);
            if (!active) {
                this.hide();
                return;
            }

            if (active !== this.activeTable) {
                this.activeTable = active;
                this.renderClone(active);
            }

            this.positionOverlay(active, top);
        },

        findActiveTable: function (top) {
            for (const table of this.tables) {
                if (!this.isVisible(table)) continue;

                const tbody = table.tBodies[0];
                const tableRect = table.getBoundingClientRect();
                const bodyRect = tbody.getBoundingClientRect();
                const headerHeight = Math.max(1, table.tHead.getBoundingClientRect().height);

                if (bodyRect.top <= top + 1 && tableRect.bottom > top + headerHeight) {
                    return table;
                }
            }

            return null;
        },

        positionOverlay: function (table, top) {
            const tableRect = table.getBoundingClientRect();
            const clipRect = this.getClipRect(table, tableRect);
            const left = Math.max(0, Math.max(tableRect.left, clipRect.left));
            const right = Math.min(window.innerWidth, Math.min(tableRect.right, clipRect.right));
            const width = Math.max(0, right - left);
            const headerHeight = Math.ceil(table.tHead.getBoundingClientRect().height);

            if (width <= 0 || headerHeight <= 0) {
                this.hide();
                return;
            }

            this.overlay.style.display = 'block';
            this.overlay.style.top = top + 'px';
            this.overlay.style.left = left + 'px';
            this.overlay.style.width = width + 'px';
            this.overlay.style.height = headerHeight + 'px';

            const inner = this.overlay.querySelector('.riscon-sticky-inner');
            const cloneTable = this.overlay.querySelector('table');
            if (inner) inner.style.transform = 'translateX(' + (tableRect.left - left) + 'px)';
            if (cloneTable) cloneTable.style.width = tableRect.width + 'px';

            this.syncCellWidths(table);
        },

        renderClone: function (table) {
            const cloneTable = table.cloneNode(false);
            cloneTable.removeAttribute('id');
            cloneTable.className = (table.className || '') + ' riscon-sticky-clone-table';
            cloneTable.style.width = table.getBoundingClientRect().width + 'px';

            const thead = table.tHead.cloneNode(true);
            cloneTable.appendChild(thead);
            cloneTable.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

            const inner = document.createElement('div');
            inner.className = 'riscon-sticky-inner';
            inner.appendChild(cloneTable);

            this.overlay.innerHTML = '';
            this.overlay.appendChild(inner);
            this.mapInteractiveElements(table, thead);
            this.syncCellWidths(table);
        },

        syncCellWidths: function (table) {
            if (!this.overlay || table !== this.activeTable) return;

            const sourceCells = table.tHead.querySelectorAll('tr > th, tr > td');
            const cloneCells = this.overlay.querySelectorAll('thead tr > th, thead tr > td');
            sourceCells.forEach((source, index) => {
                const clone = cloneCells[index];
                if (!clone) return;

                const rect = source.getBoundingClientRect();
                clone.style.width = rect.width + 'px';
                clone.style.minWidth = rect.width + 'px';
                clone.style.maxWidth = rect.width + 'px';
                clone.style.height = rect.height + 'px';
                this.copyCellStyles(source, clone);
            });
        },

        copyCellStyles: function (source, clone) {
            const computed = window.getComputedStyle(source);
            [
                'backgroundColor',
                'borderBottomColor',
                'borderBottomStyle',
                'borderBottomWidth',
                'borderLeftColor',
                'borderLeftStyle',
                'borderLeftWidth',
                'borderRightColor',
                'borderRightStyle',
                'borderRightWidth',
                'borderTopColor',
                'borderTopStyle',
                'borderTopWidth',
                'color',
                'fontFamily',
                'fontSize',
                'fontWeight',
                'lineHeight',
                'paddingBottom',
                'paddingLeft',
                'paddingRight',
                'paddingTop',
                'textAlign',
                'verticalAlign',
                'whiteSpace'
            ].forEach(prop => {
                clone.style[prop] = computed[prop];
            });
        },

        mapInteractiveElements: function (table, clonedThead) {
            const originals = Array.from(table.tHead.querySelectorAll(INTERACTIVE_SELECTOR));
            const clones = Array.from(clonedThead.querySelectorAll(INTERACTIVE_SELECTOR));

            clones.forEach((clone, index) => {
                clone.dataset.risconStickyTarget = index;
                clone.removeAttribute('id');
                clone.removeAttribute('name');
            });

            this.headerTargets = originals;
        },

        forwardHeaderClick: function (event) {
            const trigger = event.target.closest(INTERACTIVE_SELECTOR);
            if (!trigger || !this.headerTargets) return;

            const index = Number(trigger.dataset.risconStickyTarget);
            const original = this.headerTargets[index];
            if (!original) return;

            event.preventDefault();
            event.stopPropagation();

            if (typeof original.click === 'function') {
                original.click();
                return;
            }

            original.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        },

        getTopOffset: function () {
            return 0;
        },

        getClipRect: function (table, tableRect) {
            const scroller = this.findHorizontalScroller(table);
            if (!scroller) return tableRect;

            const rect = scroller.getBoundingClientRect();
            return {
                top: Math.max(tableRect.top, rect.top),
                right: Math.min(tableRect.right, rect.right),
                bottom: Math.min(tableRect.bottom, rect.bottom),
                left: Math.max(tableRect.left, rect.left)
            };
        },

        findHorizontalScroller: function (table) {
            let node = table.parentElement;
            while (node && node !== document.body) {
                const style = window.getComputedStyle(node);
                const canScrollX = /(auto|scroll|hidden)/.test(style.overflowX);
                if (canScrollX && node.scrollWidth > node.clientWidth + 1) return node;
                node = node.parentElement;
            }
            return null;
        },

        isVisible: function (el) {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        },

        hide: function () {
            this.activeTable = null;
            this.headerTargets = [];
            if (this.overlay) {
                this.overlay.style.display = 'none';
                this.overlay.innerHTML = '';
            }
        }
    };

    if (!RS.Config) {
        const start = () => RS.Modules.StickyHeaders.toggle(true);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    }

})();
