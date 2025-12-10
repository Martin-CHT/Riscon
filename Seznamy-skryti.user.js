// ==UserScript==
// @name         Riscon – skrytí položek seznamu
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.0.1
// @description  Skrytí vybraných položek v levém seznamu (Save ukládá, změny nejsou auto-permanentní).
// @author       Martin
// @copyright    2025, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @website      https://www.riscon.cz/
// @source       https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Seznamy-skryti.user.js
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Seznamy-skryti.user.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Seznamy-skryti.user.js
// @supportURL   https://github.com/Martin-CHT/Riscon/issues
// @icon         https://www.oracle.com/a/ocom/img/rest.svg
// @icon64       https://www.oracle.com/a/ocom/img/rest.svg
// @match        https://*/ords/*/f?p=110:*
// @match        https://www.riscon.cz/go/f?p=110*
// @noframes
// @run-at       document-end
// @tag          Riscon
// @tag          BOZP
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
    return flow === '110' && step === '3124';
  }

  function mainAttempt(attempt) {
    attempt = attempt || 1;

    if (!isTargetPage()) return;

    try {
      // levý select
      var leftSel = document.getElementById('P3124_AVAILABLE_WORKPLACES_LEFT');
      if (!leftSel) {
        if (attempt < 40) setTimeout(function () { mainAttempt(attempt + 1); }, 250);
        return;
      }

      // řádek shuttle tabulky – sem přidáme třetí „okno“
      var shuttleRow = document.querySelector('#apex_layout_348946862145716333 table.shuttle tr');
      if (!shuttleRow) {
        if (attempt < 40) setTimeout(function () { mainAttempt(attempt + 1); }, 250);
        return;
      }

      // pracoviště z levého selectu
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

      // label + select skrytých pracovišť
      var label = document.createElement('label');
      label.textContent = 'Pracoviště, která se NEMAJÍ nabízet:';
      label.style.display = 'block';
      label.style.marginBottom = '4px';
      label.htmlFor = 'cht-hidden-workplaces';

      var sel = document.createElement('select');
      sel.id = 'cht-hidden-workplaces';
      sel.multiple = true;
      sel.size = Math.min(30, allOptions.length);
      sel.style.width = '350px';
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

      // přepnutí profilu – načíst hodnoty z profilu, ale nepřepisovat ostatní
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

      // složit třetí okno
      wrapper.appendChild(profileRow);
      wrapper.appendChild(label);
      wrapper.appendChild(sel);
      wrapper.appendChild(document.createElement('br'));
      wrapper.appendChild(resetBtn);

      extraTd.appendChild(wrapper);
      shuttleRow.appendChild(extraTd);

      // inicializace UI ze stavu
      rebuildProfileSelect();
      syncSelFromCurrent();
      applyHidden();
      saveStore(); // případně uloží migrovanou strukturu

    } catch (err) {
      console.error('Riscon – skrytí pracovišť (profily): chyba skriptu:', err);
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
