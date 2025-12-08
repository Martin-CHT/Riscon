// ==UserScript==
// @name           Riscon: Zvýraznění záložek
// @namespace      https://github.com/Martin-CHT/Riscon
// @version        7.5.0
// @description    Výběr a zvýraznění záložek v RISCON, ukládání oblíbených záložek podle stránky.
// @author         Martin
// @copyright      2025, Martin
// @license        Proprietary - internal use only
// @homepageURL    https://github.com/Martin-CHT/Riscon
// @website        https://www.riscon.cz/
// @source         https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Zalozky.user.js
// @supportURL     https://github.com/Martin-CHT/Riscon/issues
// @icon           https://www.oracle.com/a/ocom/img/rest.svg
// @icon64         https://www.oracle.com/a/ocom/img/rest.svg
// @updateURL      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Zalozky.user.js
// @downloadURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Zalozky.user.js
// @match          https://*/ords/*/f?p=110:*
// @match          https://www.riscon.cz/go/f?p=110*
// @noframes
// @run-at         document-end
// @tag            riscon
// @tag            zalozky
// @tag            bozp
// @compatible     chrome Tampermonkey
// @compatible     firefox Tampermonkey
// @compatible     edge Tampermonkey
// @grant          none
// ==/UserScript==

(function () {
  'use strict';

  var STORAGE_ROOT_KEY = 'cht_apex_rds_favs';

  // --- globální styl pro zvýrazněné záložky ---
  (function injectStyle() {
    if (document.getElementById('cht-rds-style')) return;
    var st = document.createElement('style');
    st.id = 'cht-rds-style';
    st.textContent = `
      .apex-rds-item.cht-rds-highlight > a,
      .apex-rds-item.cht-rds-highlight > a:link,
      .apex-rds-item.cht-rds-highlight > a:visited {
        background-color: #ffd95e !important;
        color: #000 !important;
        font-weight: bold;
      }
    `;
    document.head.appendChild(st);
  })();

  function mainAttempt(attempt) {
    attempt = attempt || 1;

    try {
      // 1) Najít UL se záložkami
      var tabsUl =
        document.getElementById('4225843429548680582_RDS') ||
        document.querySelector('.topbar-body .apex-rds') ||
        document.querySelector('.topbar .apex-rds');

      if (!tabsUl) {
        if (attempt < 40) {
          setTimeout(() => mainAttempt(attempt + 1), 250);
        }
        return;
      }

      var liNodes = Array.prototype.slice.call(
        tabsUl.querySelectorAll('li.apex-rds-item')
      );
      if (!liNodes.length) return;

      // 2) NOVĚ: najít <td class="tbl-sidebar">
      var sidebarRegion = document.querySelector('td.tbl-sidebar');

      if (!sidebarRegion) {
        if (attempt < 40) {
          setTimeout(() => mainAttempt(attempt + 1), 250);
        }
        return;
      }

      // 3) Identifikace stránky
      var flowInput = document.getElementById('pFlowId');
      var pageInput = document.getElementById('pFlowStepId');
      var flowId = flowInput ? flowInput.value : 'app';
      var pageId = pageInput ? pageInput.value : 'page';
      var pageKey = flowId + ':' + pageId;

      var storeAll;
      try {
        storeAll = JSON.parse(localStorage.getItem(STORAGE_ROOT_KEY) || '{}');
      } catch (e) {
        storeAll = {};
      }
      if (!storeAll || typeof storeAll !== 'object') storeAll = {};

      var selectedKeys = Array.isArray(storeAll[pageKey]) ? storeAll[pageKey] : [];

      // 4) Namapovat záložky
      var tabInfos = liNodes.map(function (li, idx) {
        var span = li.querySelector('span');
        var label = (span && span.textContent || li.textContent || '').trim();

        var a = li.querySelector('a');
        var href = a ? a.getAttribute('href') : '';
        var key = li.id || href || label || ('idx_' + idx);

        li.setAttribute('data-cht-key', key);
        return { key: key, label: label, li: li };
      });

      function saveSelection() {
        storeAll[pageKey] = selectedKeys;
        try {
          localStorage.setItem(STORAGE_ROOT_KEY, JSON.stringify(storeAll));
        } catch (e) {}
      }

      function applyHighlights() {
        tabInfos.forEach(function (t) {
          var li = t.li;
          var a = li.querySelector('a');
          var span = li.querySelector('span');

          if (span) {
            span.textContent = span.textContent.replace(/^★\s*/, '');
          }

          li.classList.remove('cht-rds-highlight');
          if (a) a.classList.remove('button-alt1');

          if (selectedKeys.indexOf(t.key) !== -1) {
            li.classList.add('cht-rds-highlight');
            if (a) a.classList.add('button-alt1');
            if (span) span.textContent = '★ ' + span.textContent;
          }
        });
      }

      // 5) Vytvoření UI
      var container = document.createElement('div');
      container.className = 'sidebar-region-alt';
      container.id = 'cht_rds_region';

      var h3 = document.createElement('h3');
      h3.textContent = 'Zvýraznění záložek';

      var box = document.createElement('div');
      box.className = 'box';

      var frame = document.createElement('div');
      frame.className = 'frame';

      var content = document.createElement('div');
      content.className = 'content';

      var inner = document.createElement('div');
      inner.style.fontSize = '11px';
      inner.style.fontFamily = 'Tahoma,Arial,sans-serif';

      var labelEl = document.createElement('label');
      labelEl.textContent = 'Výběr záložek (Ctrl+klik pro více):';
      labelEl.style.display = 'block';
      labelEl.style.marginBottom = '4px';
      labelEl.htmlFor = 'cht-rds-select';

      var selectEl = document.createElement('select');
      selectEl.id = 'cht-rds-select';
      selectEl.multiple = true;
      selectEl.size = Math.min(8, tabInfos.length);
      selectEl.style.width = '100%';

      tabInfos.forEach(function (info) {
        var opt = document.createElement('option');
        opt.value = info.key;
        opt.textContent = info.label;
        if (selectedKeys.indexOf(info.key) !== -1) opt.selected = true;
        selectEl.appendChild(opt);
      });

      selectEl.addEventListener('change', function () {
        var selected = [];
        var opts = selectEl.options;
        for (var i = 0; i < opts.length; i++) {
          if (opts[i].selected) selected.push(opts[i].value);
        }
        selectedKeys = selected;
        saveSelection();
        applyHighlights();
      });

      inner.appendChild(labelEl);
      inner.appendChild(selectEl);
      content.appendChild(inner);
      frame.appendChild(content);
      box.appendChild(frame);

      container.appendChild(h3);
      container.appendChild(box);

      // 6) Nové vložení: přímo do <td class="tbl-sidebar">
      sidebarRegion.insertBefore(container, sidebarRegion.firstChild);

      applyHighlights();

    } catch (err) {
      console.error('Riscon záložky – chyba skriptu:', err);
    }
  }

  function start() {
    setTimeout(() => mainAttempt(1), 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
