// ==UserScript==
// @name         Riscon: OOPP Průvodce výdejem
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      1.2.4
// @description  Pracovní prostředí pro výdej osobních ochranných pracovních prostředků (OOPP).
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @website      https://www.riscon.cz/
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/main/Skript/riscon-oopp-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/main/Skript/riscon-oopp-helper.user.js
// @supportURL   https://github.com/Martin-CHT/Riscon/issues
// @icon         https://raw.githubusercontent.com/Martin-CHT/Riscon/refs/heads/main/Skript/logo-OOPP.png
// @icon64       https://raw.githubusercontent.com/Martin-CHT/Riscon/refs/heads/main/Skript/logo-OOPP.png
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
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    //  KONFIGURACE
    // =========================================================================
    const CONFIG = {
        LOGO_URL: 'https://raw.githubusercontent.com/Martin-CHT/Riscon/refs/heads/main/Skript/logo-OOPP.png',
        COLORS: {
            primary:    '#004C66',   // tmavě modrá (Riscon branding)
            success:    '#28a745',   // zelená pro zvýraznění
            successBg:  '#d4edda',   // světle zelená pozadí
            warning:    '#ffc107',   // žlutá pro upozornění
            white:      '#ffffff',
            dark:       '#1a1a2e',
            lightGray:  '#f8f9fa',
            accent:     '#0ea5e9',   // světle modrá accent
        },
        STEP_LABELS: [
            '', // index 0 unused
            'Vyberte akci',
            'Vyberte zaměstnance',
            'Vyhledejte zaměstnance',
            'Vyberte OOPP',
            'Pokračujte dále',
            'Doplňte údaje a uložte',
            'Vytiskněte dokument',
        ],
        STEP_INSTRUCTIONS: [
            '', // index 0 unused
            'V pravém sloupci klikněte na odkaz <strong>„Přidělení/Vrácení OOPP"</strong>',
            'Klikněte na <strong>rozbalovací tlačítko 🔼</strong> vedle pole „Zaměstnanec" pro výběr zaměstnance',
            'V otevřeném okně vyhledejte zaměstnance — napište část jména do pole Hledat a vyberte jej ze seznamu',
            'V <strong>levém seznamu</strong> vyberte OOPP, které chcete přidělit, a <strong>2× na ně klikněte</strong><br>(nebo klikněte 1× a stiskněte tlačítko ▶ uprostřed)',
            'OOPP jsou vybrány. Klikněte na tlačítko <strong>„Pokračovat"</strong>',
            'Zkontrolujte/upravte <strong>množství</strong>, vyplňte <strong>velikost</strong> a poznámku.<br>Poté klikněte na <strong>„Uložit a připravit pro tisk"</strong>',
            'Vytiskněte dokument, nechte jej <strong>podepsat</strong> a založte do kartotéky.<br>Poté můžete tuto stránku zavřít.',
        ],
        STEP_ICONS: ['', '📋', '👤', '🔍', '🛡️', '➡️', '📝', '🖨️'],
        TOTAL_STEPS: 7,
    };

    // =========================================================================
    //  CSS STYLY
    // =========================================================================
    const STYLES = `
        /* ================================================================== */
        /*  NAVIGAČNÍ PANEL                                                    */
        /* ================================================================== */
        #oopp-guide-panel {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 2147483646;
            background: linear-gradient(135deg, ${CONFIG.COLORS.dark} 0%, ${CONFIG.COLORS.primary} 100%);
            color: ${CONFIG.COLORS.white};
            padding: 0;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            user-select: none;
        }

        #oopp-guide-panel * {
            box-sizing: border-box;
        }

        .oopp-panel-top {
            display: flex;
            align-items: center;
            padding: 10px 20px;
            gap: 16px;
        }

        .oopp-panel-logo {
            width: 48px;
            height: 48px;
            border-radius: 10px;
            object-fit: contain;
            background: rgba(255,255,255,0.15);
            padding: 4px;
            flex-shrink: 0;
        }

        .oopp-panel-info {
            flex: 1;
            min-width: 0;
        }

        .oopp-panel-title {
            font-size: 14px;
            font-weight: 600;
            opacity: 0.85;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 2px;
        }

        .oopp-panel-instruction {
            font-size: 18px;
            font-weight: 700;
            line-height: 1.3;
            text-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .oopp-panel-instruction strong {
            font-size: 18px;
            color: ${CONFIG.COLORS.warning};
            font-weight: 800;
        }

        .oopp-panel-step-badge {
            background: ${CONFIG.COLORS.success};
            color: ${CONFIG.COLORS.white};
            font-size: 22px;
            font-weight: 800;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 2px 10px rgba(40,167,69,0.4);
        }

        .oopp-panel-icon {
            font-size: 32px;
            flex-shrink: 0;
            line-height: 1;
        }

        /* Progress bar */
        .oopp-progress-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 20px 12px;
            gap: 0;
            background: rgba(0,0,0,0.15);
        }

        .oopp-progress-step {
            display: flex;
            align-items: center;
            gap: 0;
        }

        .oopp-progress-dot {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            transition: all 0.3s ease;
            border: 2px solid rgba(255,255,255,0.3);
            color: rgba(255,255,255,0.5);
            background: transparent;
            flex-shrink: 0;
        }

        .oopp-progress-dot.is-done {
            background: ${CONFIG.COLORS.success};
            border-color: ${CONFIG.COLORS.success};
            color: ${CONFIG.COLORS.white};
        }

        .oopp-progress-dot.is-active {
            background: ${CONFIG.COLORS.warning};
            border-color: ${CONFIG.COLORS.warning};
            color: ${CONFIG.COLORS.dark};
            transform: scale(1.25);
            box-shadow: 0 0 12px rgba(255,193,7,0.6);
        }

        .oopp-progress-line {
            width: 30px;
            height: 3px;
            background: rgba(255,255,255,0.2);
            flex-shrink: 0;
        }

        .oopp-progress-line.is-done {
            background: ${CONFIG.COLORS.success};
        }

        /* ================================================================== */
        /*  ANIMACE ZVÝRAZNĚNÍ (jemné, nepřehlcující)                          */
        /* ================================================================== */
        @keyframes oopp-pulse-green {
            0%   { box-shadow: 0 0 3px 1px rgba(40, 167, 69, 0.3); }
            50%  { box-shadow: 0 0 10px 4px rgba(40, 167, 69, 0.55); }
            100% { box-shadow: 0 0 3px 1px rgba(40, 167, 69, 0.3); }
        }

        @keyframes oopp-pulse-yellow {
            0%   { box-shadow: 0 0 3px 1px rgba(255, 193, 7, 0.25); }
            50%  { box-shadow: 0 0 8px 3px rgba(255, 193, 7, 0.5); }
            100% { box-shadow: 0 0 3px 1px rgba(255, 193, 7, 0.25); }
        }

        @keyframes oopp-bounce-arrow {
            0%, 100% { transform: translateX(0); }
            50%      { transform: translateX(8px); }
        }

        @keyframes oopp-finger-point {
            0%, 100% { transform: translateX(0) scale(1); }
            50%      { transform: translateX(5px) scale(1.15); }
        }

        .oopp-highlight {
            animation: oopp-pulse-green 2s ease-in-out infinite !important;
            border: 2px solid ${CONFIG.COLORS.success} !important;
            border-radius: 6px !important;
            position: relative;
            z-index: 100;
        }

        .oopp-highlight-button {
            animation: oopp-pulse-green 2s ease-in-out infinite !important;
            border: 2px solid ${CONFIG.COLORS.success} !important;
            border-radius: 6px !important;
            background: ${CONFIG.COLORS.success} !important;
            color: ${CONFIG.COLORS.white} !important;
            font-size: 16px !important;
            font-weight: 700 !important;
            padding: 10px 10px !important;
            cursor: pointer !important;
            position: relative;
            z-index: 100;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        .oopp-highlight-button span {
            color: ${CONFIG.COLORS.white} !important;
            font-size: 16px !important;
            font-weight: 700 !important;
        }

        .oopp-highlight-button:hover {
            background: #218838 !important;
            transform: scale(1.03);
        }

        .oopp-highlight-link {
            animation: oopp-pulse-green 2s ease-in-out infinite !important;
            border: 2px solid ${CONFIG.COLORS.success} !important;
            border-radius: 6px !important;
            padding: 8px 14px !important;
            display: inline-block !important;
            font-size: 18px !important;
            font-weight: 700 !important;
            background: ${CONFIG.COLORS.successBg} !important;
            color: ${CONFIG.COLORS.primary} !important;
            text-decoration: none !important;
            position: relative;
            z-index: 100;
        }

        .oopp-highlight-link:hover {
            background: #c3e6cb !important;
            transform: scale(1.02);
        }

        .oopp-highlight-input {
            animation: oopp-pulse-yellow 2.5s ease-in-out infinite !important;
            border: 2px solid ${CONFIG.COLORS.warning} !important;
            border-radius: 4px !important;
            background: #fff8e1 !important;
            position: relative;
            z-index: 100;
        }

        .oopp-highlight-shuttle {
            animation: oopp-pulse-green 2.5s ease-in-out infinite !important;
            border: 2px solid ${CONFIG.COLORS.success} !important;
            border-radius: 6px !important;
            position: relative;
            z-index: 100;
        }

        /* Ukazovací šipka */
        .oopp-pointer {
            position: absolute;
            font-size: 28px;
            animation: oopp-finger-point 1s ease-in-out infinite;
            z-index: 101;
            pointer-events: none;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        /* ================================================================== */
        /*  ZTLUMENÍ NEAKTIVNÍCH PRVKŮ (místo skrývání)                        */
        /* ================================================================== */
        .oopp-dimmed {
            opacity: 0.35 !important;
            pointer-events: none !important;
            filter: grayscale(40%) !important;
            transition: opacity 0.3s ease, filter 0.3s ease;
        }

        .oopp-dimmed-soft {
            opacity: 0.5 !important;
            filter: grayscale(20%) !important;
            transition: opacity 0.3s ease, filter 0.3s ease;
        }

        /* Odsazení obsahu pod navigační panel */
        body.oopp-guide-active {
            padding-top: 130px !important;
        }

        body.oopp-guide-active #header {
            margin-top: 0;
        }

        /* Krok 6: Poznámka pod textarea - informace o neměnění */
        .oopp-statement-note {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 6px;
            padding: 8px 12px;
            margin-top: 6px;
            font-size: 13px;
            color: #856404;
            font-weight: 600;
        }

        /* Krok 7: Odsazení */
        body.oopp-step-7 {
            padding-top: 110px !important;
        }

        /* ================================================================== */
        /*  INSTRUKČNÍ BUBLINA U PRVKU                                         */
        /* ================================================================== */
        .oopp-tooltip {
            position: absolute;
            background: ${CONFIG.COLORS.success};
            color: ${CONFIG.COLORS.white};
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            white-space: normal;
            max-width: 250px;
            z-index: 200;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            pointer-events: none;
        }

        .oopp-tooltip--right {
            top: 50% !important;
            left: auto !important;
            right: auto !important;
            transform: translateY(-50%);
            min-width: 270px;
            max-width: 450px;
        }

        .oopp-tooltip--right::after {
            content: '';
            position: absolute;
            top: 50%;
            left: -7px;
            bottom: auto;
            transform: translateY(-50%);
            width: 0;
            height: 0;
            border-top: 7px solid transparent;
            border-bottom: 7px solid transparent;
            border-right: 7px solid ${CONFIG.COLORS.success};
            border-left: none;
        }

        .oopp-tooltip::after {
            content: '';
            position: absolute;
            bottom: -7px;
            left: 20px;
            width: 0;
            height: 0;
            border-left: 7px solid transparent;
            border-right: 7px solid transparent;
            border-top: 7px solid ${CONFIG.COLORS.success};
        }

        /* ================================================================== */
        /*  TISK – skrýt veškeré UI průvodce                                   */
        /* ================================================================== */
        @media print {
            #oopp-guide-panel,
            .oopp-tooltip,
            .oopp-pointer,
            .oopp-statement-note {
                display: none !important;
                visibility: hidden !important;
            }

            /* Vrátit ztlumené prvky do normálu pro tisk */
            .oopp-dimmed,
            .oopp-dimmed-soft {
                opacity: 1 !important;
                filter: none !important;
                pointer-events: auto !important;
            }

            /* Zrušit odsazení pro tisk */
            body.oopp-guide-active {
                padding-top: 0 !important;
            }

            /* Zrušit zvýraznění animací pro tisk */
            .oopp-highlight,
            .oopp-highlight-button,
            .oopp-highlight-link,
            .oopp-highlight-input,
            .oopp-highlight-shuttle {
                animation: none !important;
                box-shadow: none !important;
            }
        }
    `;

    // =========================================================================
    //  UTILITY FUNKCE
    // =========================================================================

    /** Vrátí hodnotu hidden inputu na stránce */
    function getPageId() {
        const el = document.getElementById('pFlowStepId');
        return el ? el.value : '';
    }

    /** Zjistí aktuální krok workflow */
    function detectStep() {
        const pageId = getPageId();

        // Stránka 1 = Úvodní stránka
        if (pageId === '1') {
            return 1;
        }

        // Stránka 11223 = Tisk
        if (pageId === '11223') {
            return 7;
        }

        // Stránka 11222 = Přidělení OOPP (kroky 2-6)
        if (pageId === '11222') {
            // Krok 6: Existuje region "Poskytované množství"
            const quantityRegion = document.getElementById('R312109988968061387');
            if (quantityRegion) {
                return 6;
            }

            // Zjistíme stav zaměstnance
            const empHidden = document.getElementById('P11222_EMPLOYEE_ID_HIDDENVALUE');
            const empField = document.getElementById('P11222_EMPLOYEE_ID');
            const employeeSelected = (empHidden && empHidden.value && empHidden.value.trim() !== '') ||
                                      (empField && empField.value && empField.value.trim() !== '' && empField.tagName === 'INPUT' && empField.value !== '');

            // Pokud zaměstnanec není vybrán → Krok 2
            // Kontrola: na stránce 02.htm je empField prázdný
            // Na stránce 04.htm má empField hodnotu "HUFNÁGL Pišta..."
            if (!empHidden || !empHidden.value || empHidden.value.trim() === '') {
                return 2;
            }

            // Zaměstnanec vybrán - zjistíme shuttle stav
            const shuttleRight = document.getElementById('P11222_PPE_IDS_RIGHT');
            if (shuttleRight && shuttleRight.options && shuttleRight.options.length > 0) {
                // Shuttle vpravo má položky → Krok 5
                return 5;
            }

            // Shuttle vpravo prázdný → Krok 4
            return 4;
        }

        return 0; // neznámá stránka
    }

    /** Přidá CSS třídu na body */
    function setBodyStep(step) {
        document.body.classList.add('oopp-guide-active');
        document.body.classList.add('oopp-step-' + step);
    }

    /** Vytvoří a vloží navigační panel */
    function createPanel(step) {
        const panel = document.createElement('div');
        panel.id = 'oopp-guide-panel';

        // Horní část s instrukcí
        const top = document.createElement('div');
        top.className = 'oopp-panel-top';

        // Logo
        const logo = document.createElement('img');
        logo.className = 'oopp-panel-logo';
        logo.src = CONFIG.LOGO_URL;
        logo.alt = 'OOPP';
        logo.onerror = function() { this.style.display = 'none'; };
        top.appendChild(logo);

        // Ikona kroku
        const icon = document.createElement('span');
        icon.className = 'oopp-panel-icon';
        icon.textContent = CONFIG.STEP_ICONS[step] || '📋';
        top.appendChild(icon);

        // Info sekce
        const info = document.createElement('div');
        info.className = 'oopp-panel-info';

        const title = document.createElement('div');
        title.className = 'oopp-panel-title';
        title.textContent = 'Výdej OOPP — Krok ' + step + ' z ' + CONFIG.TOTAL_STEPS + ': ' + CONFIG.STEP_LABELS[step];
        info.appendChild(title);

        const instruction = document.createElement('div');
        instruction.className = 'oopp-panel-instruction';
        instruction.innerHTML = CONFIG.STEP_INSTRUCTIONS[step] || '';
        info.appendChild(instruction);

        top.appendChild(info);

        // Step badge
        const badge = document.createElement('div');
        badge.className = 'oopp-panel-step-badge';
        badge.textContent = step + '/' + CONFIG.TOTAL_STEPS;
        top.appendChild(badge);

        panel.appendChild(top);

        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'oopp-progress-bar';

        for (let i = 1; i <= CONFIG.TOTAL_STEPS; i++) {
            if (i > 1) {
                const line = document.createElement('div');
                line.className = 'oopp-progress-line' + (i <= step ? ' is-done' : '');
                progressBar.appendChild(line);
            }

            const dot = document.createElement('div');
            dot.className = 'oopp-progress-dot';
            if (i < step) {
                dot.classList.add('is-done');
                dot.textContent = '✓';
            } else if (i === step) {
                dot.classList.add('is-active');
                dot.textContent = i;
            } else {
                dot.textContent = i;
            }
            // Tooltip na tečku
            dot.title = 'Krok ' + i + ': ' + CONFIG.STEP_LABELS[i];
            progressBar.appendChild(dot);
        }

        panel.appendChild(progressBar);

        document.body.insertBefore(panel, document.body.firstChild);
    }

    /** Vytvoří ukazovací šipku vedle prvku */
    function addPointer(element, position) {
        const pointer = document.createElement('span');
        pointer.className = 'oopp-pointer';
        pointer.textContent = '👉';

        // Nastavíme pozici
        const pos = position || 'left';
        element.style.position = element.style.position || 'relative';

        if (pos === 'left') {
            pointer.style.left = '-40px';
            pointer.style.top = '50%';
            pointer.style.transform = 'translateY(-50%)';
        } else if (pos === 'top') {
            pointer.style.top = '-35px';
            pointer.style.left = '10px';
            pointer.style.transform = 'rotate(90deg)';
        }

        element.style.position = 'relative';
        element.appendChild(pointer);
    }

    /** Přidá instrukční tooltip nad prvek */
    function addTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'oopp-tooltip';
        tooltip.textContent = text;

        element.style.position = 'relative';
        tooltip.style.top = '-45px';
        tooltip.style.left = '0';

        element.appendChild(tooltip);
    }

    /** Přidá instrukční tooltip napravo od prvku */
    function addTooltipRight(element, text) {
        // Najdi rodičovský řádek (tr) nebo parent
        const row = element.closest('tr') || element.parentElement;
        if (!row) return addTooltip(element, text);

        row.style.position = 'relative';

        const tooltip = document.createElement('div');
        tooltip.className = 'oopp-tooltip oopp-tooltip--right';
        tooltip.textContent = text;

        // Vloz za posledni bunku v radku
        row.appendChild(tooltip);
    }

    // =========================================================================
    //  KROKY – LOGIKA PRO JEDNOTLIVÉ STRÁNKY
    // =========================================================================

    /** Krok 1: Úvodní stránka – zvýrazni "Přidělení/Vrácení OOPP", ztlum zbytek */
    function applyStep1() {
        // Ztlum hlavní obsah (regiony v tbl-main)
        const mainCell = document.querySelector('td.tbl-main');
        if (mainCell) {
            // Ztlum všechny přímé děti tbl-main
            Array.from(mainCell.children).forEach(function(child) {
                child.classList.add('oopp-dimmed');
            });
        }

        // V sidebaru ztlum vše kromě "Rychlá akce"
        const sidebarCell = document.querySelector('td.tbl-sidebar');
        if (sidebarCell) {
            Array.from(sidebarCell.children).forEach(function(child) {
                if (child.id !== 'R3958548357498255344') {
                    child.classList.add('oopp-dimmed');
                }
            });
        }

        // Ztlum header a tabs
        dimElement('#header');
        dimElement('#tabs');

        // Najdi odkaz "Přidělení/Vrácení OOPP" v regionu Rychlá akce
        const quickActionRegion = document.getElementById('R3958548357498255344');
        if (!quickActionRegion) return;

        const links = quickActionRegion.querySelectorAll('a');
        let targetLink = null;

        links.forEach(function(link) {
            if (link.textContent.indexOf('Přidělení/Vrácení OOPP') !== -1) {
                targetLink = link;
            }
        });

        // V seznamu Rychlá akce: přesuň OOPP na první místo, ztlum ostatní
        const list = quickActionRegion.querySelector('.vertical-unordered-list-with-bullets-alt');
        const listItems = list ? list.querySelectorAll('li') : [];
        let targetLi = null;

        listItems.forEach(function(li) {
            const liLink = li.querySelector('a');
            if (liLink && liLink.textContent.indexOf('Přidělení/Vrácení OOPP') !== -1) {
                targetLi = li;
            } else {
                li.classList.add('oopp-dimmed');
            }
        });

        // Přesuň OOPP položku na první místo v seznamu
        if (targetLi && list) {
            list.insertBefore(targetLi, list.firstChild);
        }

        // Zvýrazni odkaz
        if (targetLink) {
            targetLink.classList.add('oopp-highlight-link');

            // Přidej šipku
            if (targetLi) {
                targetLi.style.position = 'relative';
                addPointer(targetLi, 'left');
            }
        }
    }

    /** Krok 2: Výběr zaměstnance – zvýrazni ikonu lupy, ztlum nepotřebné */
    function applyStep2() {
        // Ztlum header, tabs, sidebar
        dimElement('#header');
        dimElement('#tabs');
        dimElement('td.tbl-sidebar');

        // Ztlum nepotřebné řádky formuláře
        const formTable = document.getElementById('apex_layout_147810630934712333');
        if (formTable) {
            const rows = formTable.querySelectorAll('tr');
            rows.forEach(function(row) {
                const label = row.querySelector('#P11222_TRANSACTION_ID_LABEL');
                const radioLabel = row.querySelector('#P11222_SCOPE_TO_ASSIGN_LABEL');
                const shuttleLabel = row.querySelector('#P11222_PPE_IDS_LABEL');
                const washLabel = row.querySelector('#P11222_WORK_WEAR_WASHED_BY_LABEL');

                if (label || radioLabel || shuttleLabel || washLabel) {
                    row.classList.add('oopp-dimmed');
                }
            });
        }

        // Ztlum tlačítko "Zpět"
        const backBtn = document.getElementById('B147810773378712334');
        if (backBtn) backBtn.classList.add('oopp-dimmed');

        // Zvýrazni rozbalovací tlačítko u pole Zaměstnanec
        const empFieldset = document.getElementById('P11222_EMPLOYEE_ID_fieldset');
        if (empFieldset) {
            // Najdi rozbalovací tlačítko (a nebo button vedle inputu)
            const lovIcon = empFieldset.querySelector('a') || empFieldset.querySelector('button');
            if (lovIcon) {
                lovIcon.classList.add('oopp-highlight');
                lovIcon.style.display = 'inline-block';
                lovIcon.style.padding = '6px';

                // Zvětši ikonu
                const img = lovIcon.querySelector('img');
                if (img) {
                    img.style.width = '28px';
                    img.style.height = '28px';
                }

                // Přidej tooltip napravo od pole
                addTooltipRight(empFieldset, '← Klikněte sem pro výběr zaměstnance');
            }

            // Zvýrazni celé pole
            empFieldset.classList.add('oopp-highlight');
        }

        // Zvětši label Zaměstnanec
        const empLabel = document.getElementById('P11222_EMPLOYEE_ID_LABEL');
        if (empLabel) {
            empLabel.style.fontSize = '16px';
            empLabel.style.fontWeight = '700';
        }
    }

    /** Krok 4: Výběr OOPP ze shuttle */
    function applyStep4() {
        // Ztlum header, tabs, sidebar, nepotřebné řádky
        dimElement('#header');
        dimElement('#tabs');
        dimElement('td.tbl-sidebar');
        dimFormRows();

        // Ztlum tlačítko "Zpět"
        const backBtn = document.getElementById('B147810773378712334');
        if (backBtn) backBtn.classList.add('oopp-dimmed');

        // Zvýrazni shuttle levý seznam
        const shuttleLeft = document.getElementById('P11222_PPE_IDS_LEFT');
        if (shuttleLeft) {
            shuttleLeft.classList.add('oopp-highlight-shuttle');
            shuttleLeft.style.fontSize = '14px';
            shuttleLeft.style.minHeight = '300px';
        }

        // Zvýrazni tlačítko Move (šipka >)
        const moveBtn = document.getElementById('P11222_PPE_IDS_MOVE');
        if (moveBtn) {
            moveBtn.classList.add('oopp-highlight-button');
            moveBtn.style.width = '44px';
            moveBtn.style.height = '44px';
            moveBtn.style.borderRadius = '50%';
        }

        // Také zvýrazni move_all
        const moveAllBtn = document.getElementById('P11222_PPE_IDS_MOVE_ALL');
        if (moveAllBtn) {
            moveAllBtn.style.border = '1px solid ' + CONFIG.COLORS.success;
            moveAllBtn.style.borderRadius = '50%';
            moveAllBtn.style.width = '36px';
            moveAllBtn.style.height = '36px';
        }

        // Zvětši shuttle label
        const shuttleLabel = document.getElementById('P11222_PPE_IDS_LABEL');
        if (shuttleLabel) {
            shuttleLabel.style.fontSize = '15px';
            shuttleLabel.style.fontWeight = '700';
        }

        // Zvětšit shuttleSelect2 (pravý seznam - cíl)
        const shuttleRight = document.getElementById('P11222_PPE_IDS_RIGHT');
        if (shuttleRight) {
            shuttleRight.style.minHeight = '300px';
            shuttleRight.style.fontSize = '14px';
            shuttleRight.style.border = '2px dashed ' + CONFIG.COLORS.accent;
        }

        // Zvýrazni label Zaměstnanec (aby bylo vidět komu se přiděluje)
        highlightSelectedEmployee();

        // Region "Zaměstnanec dosud obdržel" - ztlumit
        const historyRegion = document.getElementById('R573662292253189909');
        if (historyRegion) {
            historyRegion.classList.add('oopp-dimmed-soft');
        }
    }

    /** Krok 5: Pokračovat */
    function applyStep5() {
        // Ztlum header, tabs, sidebar, nepotřebné řádky
        dimElement('#header');
        dimElement('#tabs');
        dimElement('td.tbl-sidebar');
        dimFormRows();

        // Ztlum tlačítko "Zpět"
        const backBtn = document.getElementById('B147810773378712334');
        if (backBtn) backBtn.classList.add('oopp-dimmed');

        // Najdi a zvýrazni tlačítko "Pokračovat"
        const continueBtn = document.getElementById('B147811954544712346');
        if (continueBtn) {
            // Ujisti se, že je viditelné
            continueBtn.style.display = 'inline-block !important';
            continueBtn.style.cssText = 'display: inline-block !important;';
            continueBtn.classList.add('oopp-highlight-button');

            // Přidej šipku
            const parent = continueBtn.parentElement;
            if (parent) {
                parent.style.position = 'relative';
                parent.style.textAlign = 'center';
                parent.style.padding = '16px 0';
            }
        }

        // Shuttle - zobraz stav (co je vybráno)
        const shuttleRight = document.getElementById('P11222_PPE_IDS_RIGHT');
        if (shuttleRight) {
            shuttleRight.style.border = '2px solid ' + CONFIG.COLORS.success;
            shuttleRight.style.borderRadius = '6px';
            shuttleRight.style.background = CONFIG.COLORS.successBg;
        }

        // Zvýrazni jméno zaměstnance
        highlightSelectedEmployee();

        // Region "Zaměstnanec dosud obdržel" - ztlumit
        const historyRegion = document.getElementById('R573662292253189909');
        if (historyRegion) {
            historyRegion.classList.add('oopp-dimmed-soft');
        }
    }

    /** Krok 6: Vyplnění množství a uložení */
    function applyStep6() {
        // Ztlum header, tabs, sidebar
        dimElement('#header');
        dimElement('#tabs');
        dimElement('td.tbl-sidebar');

        // Ztlum horní formulář "Přidělované OOPP" (pracovník ho nepotřebuje)
        const topForm = document.getElementById('R147810630934712333');
        if (topForm) topForm.classList.add('oopp-dimmed');

        // Zvýrazni tlačítko "Uložit a připravit pro tisk"
        const saveBtn = document.getElementById('B312116229965061393');
        if (saveBtn) {
            saveBtn.classList.add('oopp-highlight-button');
        }

        // Ztlum tlačítko "Začít znovu" (matoucí pro laika)
        const restartBtn = document.getElementById('B312116146761061393');
        if (restartBtn) {
            restartBtn.classList.add('oopp-dimmed');
        }

        // Zvýrazni vstupní pole pro množství, velikost, poznámku
        const amountInputs = document.querySelectorAll('input[name="f02"]');
        amountInputs.forEach(function(input) {
            input.classList.add('oopp-highlight-input');
            input.style.fontSize = '15px';
            input.style.padding = '5px';
        });

        const returnInputs = document.querySelectorAll('input[name="f03"]');
        returnInputs.forEach(function(input) {
            input.classList.add('oopp-highlight-input');
            input.style.fontSize = '15px';
            input.style.padding = '5px';
        });

        const sizeInputs = document.querySelectorAll('input[name="f05"]');
        sizeInputs.forEach(function(input) {
            input.classList.add('oopp-highlight-input');
            input.style.fontSize = '15px';
            input.style.padding = '5px';
        });

        const noteInputs = document.querySelectorAll('input[name="f06"]');
        noteInputs.forEach(function(input) {
            input.style.fontSize = '14px';
            input.style.padding = '5px';
            input.style.border = '1px solid ' + CONFIG.COLORS.accent;
            input.style.borderRadius = '4px';
        });

        // Poznámka pod textarea "Prohlášení zaměstnance"
        const statementTextarea = document.getElementById('P11222_PPE_STATEMENT');
        if (statementTextarea) {
            const note = document.createElement('div');
            note.className = 'oopp-statement-note';
            note.textContent = '⚠ Toto prohlášení obvykle neměňte. Změny provádějte pouze pokud je to nutné.';
            statementTextarea.parentElement.appendChild(note);
        }

        // Zvýrazni jméno zaměstnance
        const empDisplay = document.getElementById('P11222_EMPLOYEE_ID_DISPLAY');
        if (empDisplay) {
            empDisplay.style.fontSize = '16px';
            empDisplay.style.fontWeight = '700';
            empDisplay.style.color = CONFIG.COLORS.primary;
        }

        // Region "Zaměstnanec dosud obdržel" - ztlumit
        const historyRegion = document.getElementById('R573662292253189909');
        if (historyRegion) {
            historyRegion.classList.add('oopp-dimmed-soft');
        }

        // Zvětšit region "Poskytované množství"
        const qtyTitle = document.querySelector('#R312109988968061387 .rc-title');
        if (qtyTitle) {
            qtyTitle.style.fontSize = '16px';
            qtyTitle.style.fontWeight = '700';
        }
    }

    /** Krok 7: Tisk */
    function applyStep7() {
        // Stránka se automaticky tiskne (onload="Print()")
        // Ztlum header
        dimElement('#header');

        // Zvýrazni tlačítko "Zpět k původní stránce"
        const backBtn = document.querySelector('input[value="Zpět k původní stránce"]');
        if (backBtn) {
            backBtn.classList.add('oopp-highlight-button');
            backBtn.style.width = 'auto';
            backBtn.style.marginTop = '20px';
            backBtn.style.fontSize = '14px';
            backBtn.style.padding = '10px 20px';
        }
    }

    // =========================================================================
    //  POMOCNÉ FUNKCE
    // =========================================================================

    /** Ztlumí nepotřebné řádky formuláře na stránce 11222 */
    function dimFormRows() {
        const formTable = document.getElementById('apex_layout_147810630934712333');
        if (!formTable) return;

        const rows = formTable.querySelectorAll('tr');
        rows.forEach(function(row) {
            // Ztlum "ID transakce"
            if (row.querySelector('#P11222_TRANSACTION_ID_LABEL') ||
                row.querySelector('#P11222_TRANSACTION_ID')) {
                row.classList.add('oopp-dimmed');
            }
        });
    }

    /** Ztlumí element dle CSS selektoru */
    function dimElement(selector) {
        const el = document.querySelector(selector);
        if (el) el.classList.add('oopp-dimmed');
    }

    /** Zvýrazní vybraného zaměstnance */
    function highlightSelectedEmployee() {
        // Na stránkách 04/05 je zaměstnanec v popup LOV inputu
        const empField = document.getElementById('P11222_EMPLOYEE_ID');
        if (empField && empField.value && empField.value.trim() !== '') {
            empField.style.fontSize = '16px';
            empField.style.fontWeight = '700';
            empField.style.color = CONFIG.COLORS.primary;
            empField.style.background = CONFIG.COLORS.successBg;
            empField.style.border = '1px solid ' + CONFIG.COLORS.success;
            empField.style.borderRadius = '4px';
            empField.style.padding = '4px 8px';
            empField.style.width = 'auto';
            empField.style.minWidth = '350px';
        }

        // Label zvětšit
        const empLabel = document.getElementById('P11222_EMPLOYEE_ID_LABEL');
        if (empLabel) {
            empLabel.style.fontSize = '15px';
            empLabel.style.fontWeight = '700';
        }
    }

    // =========================================================================
    //  SLEDOVÁNÍ ZMĚN (pro dynamické přechody kroků 4→5)
    // =========================================================================

    /** Sleduje změny v shuttle pro přepnutí z kroku 4 na 5 */
    function watchShuttleChanges() {
        const shuttleRight = document.getElementById('P11222_PPE_IDS_RIGHT');
        if (!shuttleRight) return;

        // MutationObserver na shuttle pravý seznam
        const observer = new MutationObserver(function(mutations) {
            const hasItems = shuttleRight.options && shuttleRight.options.length > 0;
            const continueBtn = document.getElementById('B147811954544712346');

            if (hasItems && continueBtn) {
                // Přepni na krok 5
                document.body.classList.remove('oopp-step-4');
                document.body.classList.add('oopp-step-5');

                // Aktualizuj panel
                updatePanelStep(5);

                // Zvýrazni Pokračovat
                continueBtn.style.cssText = 'display: inline-block !important;';
                continueBtn.classList.add('oopp-highlight-button');

                const parent = continueBtn.parentElement;
                if (parent) {
                    parent.style.textAlign = 'center';
                    parent.style.padding = '20px 0';
                }
            } else if (!hasItems) {
                // Zpět na krok 4
                document.body.classList.remove('oopp-step-5');
                document.body.classList.add('oopp-step-4');
                updatePanelStep(4);

                if (continueBtn) {
                    continueBtn.classList.remove('oopp-highlight-button');
                }
            }
        });

        observer.observe(shuttleRight, { childList: true, subtree: true });

        // Také sleduj DOMNodeInserted jako fallback pro starší APEX verze
        shuttleRight.addEventListener('DOMNodeInserted', function() {
            setTimeout(function() {
                const hasItems = shuttleRight.options && shuttleRight.options.length > 0;
                if (hasItems) {
                    document.body.classList.remove('oopp-step-4');
                    document.body.classList.add('oopp-step-5');
                    updatePanelStep(5);

                    const continueBtn = document.getElementById('B147811954544712346');
                    if (continueBtn) {
                        continueBtn.style.cssText = 'display: inline-block !important;';
                        continueBtn.classList.add('oopp-highlight-button');
                    }
                }
            }, 100);
        });
    }

    /** Aktualizuje navigační panel na nový krok */
    function updatePanelStep(newStep) {
        const panel = document.getElementById('oopp-guide-panel');
        if (!panel) return;

        // Aktualizuj titulek
        const title = panel.querySelector('.oopp-panel-title');
        if (title) {
            title.textContent = 'Výdej OOPP — Krok ' + newStep + ' z ' + CONFIG.TOTAL_STEPS + ': ' + CONFIG.STEP_LABELS[newStep];
        }

        // Aktualizuj instrukci
        const instruction = panel.querySelector('.oopp-panel-instruction');
        if (instruction) {
            instruction.innerHTML = CONFIG.STEP_INSTRUCTIONS[newStep] || '';
        }

        // Aktualizuj ikonu
        const icon = panel.querySelector('.oopp-panel-icon');
        if (icon) {
            icon.textContent = CONFIG.STEP_ICONS[newStep] || '📋';
        }

        // Aktualizuj badge
        const badge = panel.querySelector('.oopp-panel-step-badge');
        if (badge) {
            badge.textContent = newStep + '/' + CONFIG.TOTAL_STEPS;
        }

        // Aktualizuj progress bar
        const dots = panel.querySelectorAll('.oopp-progress-dot');
        const lines = panel.querySelectorAll('.oopp-progress-line');

        dots.forEach(function(dot, index) {
            const stepNum = index + 1;
            dot.classList.remove('is-done', 'is-active');
            if (stepNum < newStep) {
                dot.classList.add('is-done');
                dot.textContent = '✓';
            } else if (stepNum === newStep) {
                dot.classList.add('is-active');
                dot.textContent = stepNum;
            } else {
                dot.textContent = stepNum;
            }
        });

        lines.forEach(function(line, index) {
            const stepNum = index + 2; // lines start between step 1 and 2
            line.classList.toggle('is-done', stepNum <= newStep);
        });
    }

    // =========================================================================
    //  HLAVNÍ INICIALIZACE
    // =========================================================================
    function init() {
        const step = detectStep();

        // Pokud nerozpoznáme stránku jako součást workflow, skript nic nedělá
        if (step === 0) return;

        // Vlož CSS styly
        GM_addStyle(STYLES);

        // Nastav body třídu
        setBodyStep(step);

        // Vytvoř navigační panel
        createPanel(step);

        // Aplikuj krok-specifickou logiku
        switch (step) {
            case 1: applyStep1(); break;
            case 2: applyStep2(); break;
            case 4:
                applyStep4();
                watchShuttleChanges();
                break;
            case 5:
                applyStep5();
                watchShuttleChanges();
                break;
            case 6: applyStep6(); break;
            case 7: applyStep7(); break;
        }

        console.log('[OOPP Průvodce] Aktivní – Krok ' + step + ': ' + CONFIG.STEP_LABELS[step]);
    }

    // Spuštění
    init();

})();
