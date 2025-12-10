// ==UserScript==
// @name           Riscon – univerzální zvýraznění řádků
// @namespace      https://github.com/Martin-CHT/Riscon
// @version        2.1.1
// @description    Klikací zvýraznění řádků v interaktivních reportech  v celém RISCONu.
// @author         Martin
// @copyright      2025, Martin
// @license        Proprietary - internal use only
// @homepageURL    https://github.com/Martin-CHT/Riscon
// @website        https://www.riscon.cz/
// @source         https://raw.githubusercontent.com/Martin-CHT/Riscon/master/IRR-RowsHighlight.user.js
// @supportURL     https://github.com/Martin-CHT/Riscon/issues
// @icon           https://www.oracle.com/a/ocom/img/rest.svg
// @icon64         https://www.oracle.com/a/ocom/img/rest.svg
// @updateURL      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/IRR-RowsHighlight.user.js
// @downloadURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/IRR-RowsHighlight.user.js
// @match          https://*/ords/*/f?p=110:*
// @match          https://www.riscon.cz/go/f?p=110*
// @noframes
// @run-at         document-end
// @tag            riscon
// @tag            irr
// @tag            bozp
// @compatible     chrome Tampermonkey
// @compatible     firefox Tampermonkey
// @compatible     edge Tampermonkey
// @grant          none
// ==/UserScript==

(function () {
  'use strict';

  var STORAGE_ROOT_KEY = 'cht_apex_row_highlight_v2';
  var storeAll = null; // lazy load

  // --- CSS pro zvýraznění řádků ---
  function injectStyle() {
    if (document.getElementById('cht-row-highlight-style')) return;
    var st = document.createElement('style');
    st.id = 'cht-row-highlight-style';
    st.textContent = `
      .a-IRR-table tr.cht-row-highlight > td {
        background-color: #ffd95e !important;
      }
    `;
    document.head.appendChild(st);
  }

  // --- localStorage helpery ---

  function loadStoreAll() {
    if (storeAll !== null) return storeAll;
    try {
      storeAll = JSON.parse(localStorage.getItem(STORAGE_ROOT_KEY) || '{}');
    } catch (e) {
      storeAll = {};
    }
    if (!storeAll || typeof storeAll !== 'object') storeAll = {};
    return storeAll;
  }

  function saveStoreAll() {
    if (!storeAll || typeof storeAll !== 'object') return;
    try {
      localStorage.setItem(STORAGE_ROOT_KEY, JSON.stringify(storeAll));
    } catch (e) {
      // localStorage plný / zakázaný
    }
  }

  function getSelectedForRegion(regionKey) {
    var all = loadStoreAll();
    var arr = all[regionKey];
    return Array.isArray(arr) ? arr.slice() : [];
  }

  function setSelectedForRegion(regionKey, arr) {
    var all = loadStoreAll();
    all[regionKey] = arr;
    storeAll = all;
    saveStoreAll();
  }

  function resetRegion(regionKey) {
    var all = loadStoreAll();
    all[regionKey] = [];
    storeAll = all;
    saveStoreAll();

    var tables = document.querySelectorAll(
      'table.a-IRR-table[data-cht-region-key="' + regionKey + '"]'
    );
    tables.forEach(function (table) {
      table
        .querySelectorAll('tr.cht-row-highlight')
        .forEach(function (tr) {
          tr.classList.remove('cht-row-highlight');
        });
    });
  }

  // --- identifikace stránky ---

  function getPageKey() {
    var flowInput = document.getElementById('pFlowId');
    var pageInput = document.getElementById('pFlowStepId');
    var flowId = flowInput ? flowInput.value : 'app';
    var pageId = pageInput ? pageInput.value : 'page';
    return flowId + ':' + pageId;
  }

  // --- hlavní logika pro jednu tabulku ---

  function enhanceTable(table, regionId, regionKey) {
    if (!table || table.getAttribute('data-cht-rows-enhanced') === '1') {
      return;
    }
    table.setAttribute('data-cht-rows-enhanced', '1');
    table.setAttribute('data-cht-region-id', regionId);
    table.setAttribute('data-cht-region-key', regionKey);

    var selectedKeys = getSelectedForRegion(regionKey);
    var rowInfos = [];
    var lastClickedIndex = null;

    function applySelectionStyles() {
      rowInfos.forEach(function (info) {
        if (!info.tr) return;
        if (selectedKeys.indexOf(info.key) !== -1) {
          info.tr.classList.add('cht-row-highlight');
        } else {
          info.tr.classList.remove('cht-row-highlight');
        }
      });
    }

    function saveSelection() {
      setSelectedForRegion(regionKey, selectedKeys);
    }

    function handleRowClick(evt, idx, key) {
      // neblokovat klik na odkazy / tlačítka / formuláře
      if (evt.target.closest('a, button, input, select, textarea')) {
        return;
      }

      var useCtrl = evt.ctrlKey || evt.metaKey;
      var useShift = evt.shiftKey;

      if (useShift && lastClickedIndex != null && rowInfos[lastClickedIndex]) {
        // Shift: souvislý blok
        var from = Math.min(lastClickedIndex, idx);
        var to = Math.max(lastClickedIndex, idx);
        selectedKeys = [];
        for (var i = from; i <= to; i++) {
          var k = rowInfos[i].key;
          if (selectedKeys.indexOf(k) === -1) {
            selectedKeys.push(k);
          }
        }
      } else if (useCtrl) {
        // Ctrl: čistý single výběr (přepíše skupinu)
        selectedKeys = [key];
      } else {
        // Bez modifieru: toggle řádku (multivýběr jako default)
        var pos = selectedKeys.indexOf(key);
        if (pos === -1) {
          selectedKeys.push(key);
        } else {
          selectedKeys.splice(pos, 1);
        }
      }

      lastClickedIndex = idx;
      applySelectionStyles();
      saveSelection();
    }

    var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));

    rows.forEach(function (tr) {
      if (!tr.querySelector('td')) return; // header pryč

      var key = null;

      // 1) pokus o ID z odkazu typu Pxxxx_ID:nnn
      var idLink =
        tr.querySelector('a[href*="_ID:"]') ||
        tr.querySelector('a[href*="P"]');
      if (idLink) {
        var href = idLink.getAttribute('href') || '';
        var m = href.match(/P\d+_ID:([^:&?]+)/);
        if (m) {
          key = m[1];
        }
      }

      // 2) fallback: text řádku + index
      if (!key) {
        var text = (tr.innerText || tr.textContent || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80);
        key = 'row_' + rowInfos.length + '_' + text;
      }

      var idx = rowInfos.length;
      rowInfos.push({ key: key, tr: tr, index: idx });

      tr.setAttribute('data-cht-row-key', key);

      tr.addEventListener('click', function (evt) {
        handleRowClick(evt, idx, key);
      });
    });

    applySelectionStyles();
    injectResetButtonForRegion(regionId, regionKey, table);
  }

  // --- tlačítko Reset pro daný IRR region ---

  function findControlButtonForTable(table) {
    var container =
      table.closest('.a-IRR-region, .a-IRR, .t-IRR-region, .t-Region') ||
      table.closest('[id^="R"]') ||
      document;

    var buttons = container.querySelectorAll('button.a-IRR-button--controls');
    if (!buttons.length) {
      buttons = document.querySelectorAll('button.a-IRR-button--controls');
    }
    if (!buttons.length) return null;

    var tableRect = table.getBoundingClientRect();
    var bestBtn = buttons[0];
    var bestDelta = Infinity;

    Array.prototype.forEach.call(buttons, function (btn) {
      var rect = btn.getBoundingClientRect();
      var delta = tableRect.top - rect.top;
      if (delta >= 0 && delta < bestDelta) {
        bestDelta = delta;
        bestBtn = btn;
      }
    });

    return bestBtn;
  }

  function injectResetButtonForRegion(regionId, regionKey, table) {
    if (!regionId || !regionKey || !table) return;

    var btnId = 'cht-row-reset-btn-' + regionId;
    if (document.getElementById(btnId)) return;

    var baseBtn = findControlButtonForTable(table);
    if (!baseBtn || !baseBtn.parentNode) return;

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = btnId;
    resetBtn.className = 'a-Button a-IRR-button a-IRR-button--controls';
    resetBtn.textContent = 'Reset označení';
    resetBtn.style.marginLeft = '4px';

    baseBtn.parentNode.appendChild(resetBtn);

    resetBtn.addEventListener('click', function () {
      resetRegion(regionKey);
    });
  }

  // --- enhancement všech IRR tabulek na stránce ---

  function enhanceAllIRRTables() {
    var pageKey = getPageKey();
    if (!pageKey) pageKey = 'app:page';

    var tables = document.querySelectorAll('table.a-IRR-table');
    if (!tables.length) return;

    Array.prototype.forEach.call(tables, function (table, idx) {
      if (table.getAttribute('data-cht-rows-enhanced') === '1') return;

      var regionId = null;
      var panel = table.closest('[id^="R"][id*="_data_panel"]');
      if (panel && panel.id) {
        regionId = panel.id.split('_')[0];
      } else {
        var anyRegion = table.closest('[id^="R"]');
        if (anyRegion && anyRegion.id) {
          regionId = anyRegion.id.split('_')[0];
        } else {
          regionId = 'tbl_' + idx;
        }
      }

      var regionKey = pageKey + '|' + regionId;
      enhanceTable(table, regionId, regionKey);
    });
  }

  // --- hook na APEX refresh ---

  function hookApexRefresh() {
    if (!window.apex || !window.apex.jQuery) return;
    try {
      window.apex.jQuery(document).on('apexafterrefresh', function () {
        setTimeout(enhanceAllIRRTables, 0);
      });
    } catch (e) {
      // apex trucuje, ale initial load žije
    }
  }

  // --- start ---

  function start() {
    injectStyle();
    enhanceAllIRRTables();
    hookApexRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
