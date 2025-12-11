// ==UserScript==
// @name         Riscon: Skrytí položek seznamu
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.6
// @description  Skrytí vybraných položek v levém seznamu (Save ukládá, změny nejsou auto-permanentní).
// @author       Martin
// @copyright    2025, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @supportURL   https://github.com/Martin-CHT/Riscon/issues
// @source       https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Seznamy-skryti.user.js
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Seznamy-skryti.user.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Seznamy-skryti.user.js
// @icon         https://www.oracle.com/a/ocom/img/rest.svg
// @icon64       https://www.oracle.com/a/ocom/img/rest.svg
// @website      https://www.riscon.cz/
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @noframes
// @run-at       document-end
// @tag          riscon
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var STORAGE_ROOT_KEY = 'cht_apex_hidden_workplaces_profiles';

  function isTargetPage() {
    var flowEl = document.getElementById('pFlowId');
    var stepEl = document.getElementById('pFlowStepId');
    var flow = flowEl ? flowEl.value : null;
    var step = stepEl ? stepEl.value : null;
    // cílová stránka
    return flow === '110' && step === '4408';
  }

  function mainAttempt(attempt) {
    attempt = attempt || 1;

    if (!isTargetPage()) return;

    try {
      // levý select shuttle (P4408_*_LEFT)
      var leftSel =
        document.querySelector('select[id^="P4408_"][id$="_LEFT"]') ||
        document.querySelector('table.shuttle select[id$="_LEFT"]');

      if (!leftSel) {
        if (attempt < 40) {
          setTimeout(function () { mainAttempt(attempt + 1); }, 250);
        }
        return;
      }

      // řádek shuttle tabulky – sem přidáme třetí „okno“
      var shuttleTable = leftSel.closest('table');
      var shuttleRow = shuttleTable ? shuttleTable.querySelector('tr') : null;

      if (!shuttleRow) {
        if (attempt < 40) {
          setTimeout(function () { mainAttempt(attempt + 1); }, 250);
        }
        return;
      }

      // položky z levého selectu
      var allOptions = Array.prototype.slice.call(leftSel.options).map(function (opt) {
        return {
          value: opt.value,
          label: opt.textContent || opt.innerText || '',
          opt: opt
        };
      });

      // identifikace stránky
      var flowIdEl = document.getElementById('pFlowId');
      var pageIdEl = document.getElementById('pFlowStepId');
      var flowId = flowIdEl ? flowIdEl.value : 'app';
      var pageId = pageIdEl ? pageIdEl.value : 'page';
      var pageKey = flowId + ':' + pageId;

      // načtení uložených dat
      var storeAll;
      try {
        storeAll = JSON.parse(localStorage.getItem(STORAGE_ROOT_KEY) || '{}');
      } catch (e) {
        storeAll = {};
      }
      if (!storeAll || typeof storeAll !== 'object') storeAll = {};

      var pageData = storeAll[pageKey];

      // kompatibilita se starou verzí (prosté pole)
      if (Array.isArray(pageData)) {
        pageData = {
          activeProfile: 'default',
          profiles: { 'default': pageData }
        };
      }

      if (!pageData || typeof pageData !== 'object') {
        pageData = {
          activeProfile: 'default',
          profiles: { 'default': [] }
        };
      }
      if (!pageData.profiles || typeof pageData.profiles !== 'object') {
        pageData.profiles = { 'default': [] };
      }
      if (!pageData.profiles['default']) {
        pageData.profiles['default'] = [];
      }
      if (!pageData.activeProfile || !pageData.profiles[pageData.activeProfile]) {
        pageData.activeProfile = 'default';
      }

      // velikost UI (šířka/výška seznamu)
      if (!pageData.uiSize || typeof pageData.uiSize !== 'object') {
        pageData.uiSize = {
          width: 350,
          height: 400
        };
      }

      storeAll[pageKey] = pageData;

      // aktuálně aktivní profil + dočasný stav filtru
      var currentHidden = (pageData.profiles[pageData.activeProfile] || []).slice();

      function saveStore() {
        storeAll[pageKey] = pageData;
        try {
          localStorage.setItem(STORAGE_ROOT_KEY, JSON.stringify(storeAll));
        } catch (e) {
          // ignor
        }
      }

      function applyHidden() {
        var map = {};
        currentHidden.forEach(function (v) { map[v] = true; });

        allOptions.forEach(function (item) {
          var hide = !!map[item.value];
          if (hide) {
            item.opt.disabled = true;
            item.opt.hidden = true;
            item.opt.style.display = 'none';
            item.opt.selected = false;
          } else {
            item.opt.disabled = false;
            item.opt.hidden = false;
            item.opt.style.display = '';
          }
        });
      }

      // --- UI ve třetím "okně" ---

      var extraTd = document.createElement('td');
      extraTd.className = 'shuttleSelect3';
      extraTd.style.verticalAlign = 'top';

      var wrapper = document.createElement('div');
      wrapper.style.fontSize = '11px';
      wrapper.style.fontFamily = 'Tahoma,Arial,sans-serif';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.padding = '2px';

      // řádek profilů
      var profileRow = document.createElement('div');
      profileRow.style.marginBottom = '6px';

      var profileLabel = document.createElement('span');
      profileLabel.textContent = 'Profil: ';
      profileLabel.style.marginRight = '4px';

      var profileSelect = document.createElement('select');
      profileSelect.id = 'cht-hidden-profile';
      profileSelect.style.fontSize = '11px';
      profileSelect.style.maxWidth = '180px';
      profileSelect.style.marginRight = '4px';

      var profileInput = document.createElement('input');
      profileInput.type = 'text';
      profileInput.id = 'cht-hidden-profile-name';
      profileInput.placeholder = 'název profilu (nepovinné)';
      profileInput.style.fontSize = '11px';
      profileInput.style.maxWidth = '140px';
      profileInput.style.marginRight = '4px';

      var saveProfileBtn = document.createElement('button');
      saveProfileBtn.type = 'button';
      saveProfileBtn.className = 'button-gray';
      saveProfileBtn.style.fontSize = '11px';
      saveProfileBtn.style.padding = '0 6px';
      saveProfileBtn.innerHTML = '<span>Uložit profil</span>';

      var deleteProfileBtn = document.createElement('button');
      deleteProfileBtn.type = 'button';
      deleteProfileBtn.className = 'button-gray';
      deleteProfileBtn.style.fontSize = '11px';
      deleteProfileBtn.style.padding = '0 6px';
      deleteProfileBtn.style.marginLeft = '2px';
      deleteProfileBtn.innerHTML = '<span>Smazat profil</span>';

      function rebuildProfileSelect() {
        while (profileSelect.firstChild) profileSelect.removeChild(profileSelect.firstChild);
        var keys = Object.keys(pageData.profiles);
        keys.sort(function (a, b) {
          if (a === 'default') return -1;
          if (b === 'default') return 1;
          return a.localeCompare(b, 'cs');
        });
        keys.forEach(function (key) {
          var opt = document.createElement('option');
          opt.value = key;
          opt.textContent = (key === 'default') ? 'Výchozí' : key;
          if (key === pageData.activeProfile) opt.selected = true;
          profileSelect.appendChild(opt);
        });
      }

      profileRow.appendChild(profileLabel);
      profileRow.appendChild(profileSelect);
      profileRow.appendChild(profileInput);
      profileRow.appendChild(saveProfileBtn);
      profileRow.appendChild(deleteProfileBtn);

      // label + select skrytých položek
      var label = document.createElement('label');
      label.textContent = 'Položky, které se NEMAJÍ nabízet:';
      label.style.display = 'block';
      label.style.marginBottom = '4px';
      label.htmlFor = 'cht-hidden-workplaces';

      var sel = document.createElement('select');
      sel.id = 'cht-hidden-workplaces';
      sel.multiple = true;
      // výška/šířka tažená z uložených hodnot
      var initialWidth = pageData.uiSize.width || 350;
      var initialHeight = pageData.uiSize.height || 400;
      sel.style.width = initialWidth + 'px';
      sel.style.height = initialHeight + 'px';
      // žádný size, necháme to řídit přes CSS výšku
      sel.style.fontSize = '10px';

      allOptions.forEach(function (item) {
        var opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.label;
        sel.appendChild(opt);
      });

      function syncSelFromCurrent() {
        var map = {};
        currentHidden.forEach(function (v) { map[v] = true; });
        var opts = sel.options;
        for (var i = 0; i < opts.length; i++) {
          opts[i].selected = !!map[opts[i].value];
        }
      }

      sel.addEventListener('change', function () {
        // změny jsou jen dočasné – NEukládáme do profilu, dokud nedáš Uložit
        var vals = [];
        var opts = sel.options;
        for (var i = 0; i < opts.length; i++) {
          if (opts[i].selected) vals.push(opts[i].value);
        }
        currentHidden = vals;
        applyHidden();
      });

      var resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'button-gray';
      resetBtn.style.marginTop = '6px';
      resetBtn.innerHTML = '<span>Reset (zobrazit vše)</span>';

      resetBtn.addEventListener('click', function () {
        currentHidden = [];
        syncSelFromCurrent();
        applyHidden();
        // profil se přepíše teprve po "Uložit profil"
      });

      // přepnutí profilu – načíst hodnoty z profilu
      profileSelect.addEventListener('change', function () {
        var newProfile = profileSelect.value;
        if (!pageData.profiles[newProfile]) {
          pageData.profiles[newProfile] = [];
        }
        pageData.activeProfile = newProfile;
        currentHidden = (pageData.profiles[newProfile] || []).slice();
        saveStore();
        syncSelFromCurrent();
        applyHidden();
      });

      // Uložit profil – uloží aktuální stav do profilu
      saveProfileBtn.addEventListener('click', function () {
        var name = (profileInput.value || '').trim();
        var targetName = name || pageData.activeProfile || 'default';

        if (!pageData.profiles[targetName]) {
          pageData.profiles[targetName] = [];
        }
        pageData.profiles[targetName] = currentHidden.slice();
        pageData.activeProfile = targetName;

        profileInput.value = '';
        rebuildProfileSelect();
        saveStore();
      });

      // Smazat profil – jen ne-default
      deleteProfileBtn.addEventListener('click', function () {
        var cur = pageData.activeProfile;
        if (cur === 'default') {
          return; // výchozí nemažeme
        }
        delete pageData.profiles[cur];
        pageData.activeProfile = 'default';
        currentHidden = (pageData.profiles['default'] || []).slice();
        rebuildProfileSelect();
        syncSelFromCurrent();
        saveStore();
        applyHidden();
      });

      // přidáme obsah do wrapperu
      wrapper.appendChild(profileRow);
      wrapper.appendChild(label);
      wrapper.appendChild(sel);
      wrapper.appendChild(document.createElement('br'));
      wrapper.appendChild(resetBtn);

      // resize rohy – tentokrát mění přímo <select>, ne jen obal
      (function attachResizeHandles(container, targetEl) {
        var minWidth = 260;
        var minHeight = 120;
        var isResizing = false;
        var startX, startY, startWidth, startHeight, activePos;

        function createHandle(pos) {
          var h = document.createElement('div');
          h.dataset.pos = pos;
          h.style.position = 'absolute';
          h.style.width = '10px';
          h.style.height = '10px';
          h.style.zIndex = '10';
          h.style.background = 'transparent';
          h.style.border = '1px solid #bbb';

          if (pos === 'tl') {
            h.style.left = '0';
            h.style.top = '0';
            h.style.cursor = 'nw-resize';
          } else if (pos === 'tr') {
            h.style.right = '0';
            h.style.top = '0';
            h.style.cursor = 'ne-resize';
          } else if (pos === 'bl') {
            h.style.left = '0';
            h.style.bottom = '0';
            h.style.cursor = 'sw-resize';
          } else if (pos === 'br') {
            h.style.right = '0';
            h.style.bottom = '0';
            h.style.cursor = 'se-resize';
          }

          h.addEventListener('mousedown', startResize);
          container.appendChild(h);
        }

        function startResize(e) {
          e.preventDefault();
          e.stopPropagation();
          isResizing = true;
          activePos = this.dataset.pos;
          startX = e.clientX;
          startY = e.clientY;
          startWidth = targetEl.offsetWidth;
          startHeight = targetEl.offsetHeight;

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }

        function onMouseMove(e) {
          if (!isResizing) return;

          var dx = e.clientX - startX;
          var dy = e.clientY - startY;

          var newWidth = startWidth;
          var newHeight = startHeight;

          switch (activePos) {
            case 'br':
              newWidth = startWidth + dx;
              newHeight = startHeight + dy;
              break;
            case 'tr':
              newWidth = startWidth + dx;
              newHeight = startHeight - dy;
              break;
            case 'bl':
              newWidth = startWidth - dx;
              newHeight = startHeight + dy;
              break;
            case 'tl':
              newWidth = startWidth - dx;
              newHeight = startHeight - dy;
              break;
          }

          if (newWidth < minWidth) newWidth = minWidth;
          if (newHeight < minHeight) newHeight = minHeight;

          // Tohle je ten podstatný rozdíl: měníme rozměry selectu
          targetEl.style.width = newWidth + 'px';
          targetEl.style.height = newHeight + 'px';
        }

        function onMouseUp() {
          if (!isResizing) return;
          isResizing = false;

          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);

          // uložit aktuální velikost seznamu
          pageData.uiSize.width = targetEl.offsetWidth;
          pageData.uiSize.height = targetEl.offsetHeight;
          saveStore();
        }

        createHandle('tl');
        createHandle('tr');
        createHandle('bl');
        createHandle('br');
      })(wrapper, sel);

      extraTd.appendChild(wrapper);
      shuttleRow.appendChild(extraTd);

      // inicializace UI ze stavu
      rebuildProfileSelect();
      syncSelFromCurrent();
      applyHidden();
      saveStore(); // případně uloží migrovanou strukturu / velikost

    } catch (err) {
      console.error('Riscon – skrytí položek seznamu: chyba skriptu:', err);
    }
  }

  function start() {
    setTimeout(function () { mainAttempt(1); }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
