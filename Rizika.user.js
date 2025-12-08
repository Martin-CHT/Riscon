// ==UserScript==
// @name           Riscon: Rizika (barvy, popisky GKI, legenda účinnosti opatření)
// @namespace      https://github.com/Martin-CHT/Riscon
// @version        7.5.0
// @description    Sjednocený skript pro RISCON: úprava popisků GKI, barevné zvýraznění rizik podle hodnot a legenda účinnosti opatření.
// @author         Martin
// @copyright      2025, Martin
// @license        Proprietary - internal use only
// @homepageURL    https://github.com/Martin-CHT/Riscon
// @website        https://www.riscon.cz/
// @source         https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Rizika.user.js
// @supportURL     https://github.com/Martin-CHT/Riscon/issues
// @icon           https://www.oracle.com/a/ocom/img/rest.svg
// @icon64         https://www.oracle.com/a/ocom/img/rest.svg
// @updateURL      https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Rizika.user.js
// @downloadURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Rizika.user.js
// @match          https://www.riscon.cz/*
// @noframes
// @run-at         document-end
// @tag            riscon
// @tag            rizika
// @tag            bozp
// @compatible     chrome Tampermonkey
// @compatible     firefox Tampermonkey
// @compatible     edge Tampermonkey
// @grant          none
// ==/UserScript==


(function() {
'use strict';

// ==========================================================================
// 1) ÚPRAVA POPISKŮ PŘEPÍNAČŮ (čištění angličtiny)
// ==========================================================================

    // Bezpečné escapování textu pro regex
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Normalizace textu
    function normalizeText(t) {
        return t
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\s*–\s*/g, ' - ')
            .trim();
    }

    // Slovník náhrad
    const replacements = {
        " - very rare": " (méně než 1 x za rok)",
        " - unusual": " (přibližně 1 x za rok)",
        " - occasional": " (přibližně 1 x ročně)",
        " - frequent": " (týdně)",
        " - very frequent": " (denně)",
        " - continuously": " (několikrát denně)",

        "practically impossible": "nemyslitelné",
        "almost unthinkable": "nepředstavitelné",
        " - possible but far from probable": "",
        "combination of unusual circumstances": "nepravděpodobné, ale z dlouhodobého hlediska možné",
        "low probability": "neobvyklé",
        "very possible": "dá se očekávat",
        "expected": "očekávané",

        "- no temporary disability": "",
        ", up to 3 lost days": "",
        ", serious - more than 3 lost days reversible injury": "",
        ", very serious - accident with irreversible consequences": "",
        " - disaster (fatal accident)": "",
        " - catastrophe (death of more than one person)": ""
    };

    function applyReplacementsToText(text) {
        let t = normalizeText(text);

        for (const [pattern, replacement] of Object.entries(replacements)) {
            const rx = new RegExp(escapeRegex(pattern), 'gi');
            t = t.replace(rx, replacement);
        }

        return t
            .replace(/\s+\)/g, ')')
            .replace(/\(\s+/g, '(')
            .replace(/\s+,/g, ',')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    function replaceLabels() {
        const labels = document.querySelectorAll('label');

        labels.forEach(label => {
            if (label.childElementCount === 0) {
                const newText = applyReplacementsToText(label.textContent || '');
                if (newText !== label.textContent) {
                    label.textContent = newText;
                }
            } else {
                label.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const newText = applyReplacementsToText(node.textContent || '');
                        if (newText !== node.textContent) {
                            node.textContent = newText;
                        }
                    }
                });
            }
        });
    }

// ==========================================================================
// 2) BAREVNÉ ZVÝRAZNĚNÍ RIZIK V TABULCE
// ==========================================================================

    // Pravidla barev
    function getColor(value) {
        if (value <= 70) return "#33B03D";   // 0–70
        if (value <= 200) return "#EBA100";  // 71–200
        return "#D40C0C";                    // 200+
    }

    // Parsování hodnoty z textu
    function parseValue(text) {
        const cleaned = text
            .replace(/\s+/g, ' ')
            .replace(',', '.')
            .replace(/[^\d.\-]/g, '')
            .trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    // Aplikace barev
    function colorize() {
        const selector = 'td[headers="BALANCED_RISK_LEVEL"], td[headers="RISK_LEVEL"]';
        const cells = document.querySelectorAll(selector);

        cells.forEach(cell => {
            const val = parseValue(cell.innerText || cell.textContent || '');
            if (val === null) return;

            const color = getColor(val);
            cell.style.backgroundColor = color;
            cell.style.color = "#fff";
        });
    }

// ==========================================================================
// 3) LEGENDA ÚČINNOSTI OPATŘENÍ (stránka 110:3110, blok „Doplňující informace“)
// ==========================================================================

    // Stránka, kde se legenda zobrazuje
    const EFF_PAGE_REGEX = /f\?p=110:3110:/i;

    // Konfigurace textu legendy
    const EFF_LEVELS = [
        {
            pct: 25,
            label: 'informování / značení',
            desc: 'Informování o nebezpečí, značení, obecná pravidla a běžné OOPP.'
        },
        {
            pct: 50,
            label: 'organizace / postupy',
            desc: 'Organizační opatření, pracovní postupy, specifická školení a OOPP pro konkrétní rizika.'
        },
        {
            pct: 75,
            label: 'technická opatření + kontroly',
            desc: 'Technické bariéry, omezení kontaktu s nebezpečím, aktivní varování, pravidelné kontroly a údržba.'
        },
        {
            pct: 95,
            label: 'bezpečnostní systémy / vyloučení expozice',
            desc: 'Bezpečnostní systémy a automatizace, zamezení vstupu osob, kontroly bezpečnostních prvků a dohled vedoucích.'
        }
    ];

    function buildEffLegendHtml() {
        let html = 'Koeficient účinnosti – orientační úrovně:<br>';

        EFF_LEVELS.forEach(level => {
            html += '<div style="margin-bottom:2px;">'
                + '<span style="font-size:9px; color:#555; font-weight:bold;">'
                + level.pct + '&nbsp;% – ' + level.label + ':</span><br>'
                + '<span style="font-size:9px; color:#555; margin-left:31px; display:block;">'
                + level.desc + '</span>'
                + '</div>';
        });

        return html;
    }

    function initEffLegend() {
        // Běhej jen na konkrétní stránce
        if (!EFF_PAGE_REGEX.test(location.href)) return;

        const sel = document.getElementById('P3110_DIRECT_MEASURES_EFF');
        if (!sel) return;

        if (document.getElementById('riscon-eff-legend')) return; // už je vytvořeno

        // Region „Doplňující informace k uvedenému nebezpečí“
        const region = document.getElementById('R3961503035566398367');
        if (!region) return;

        const content = region.querySelector('.rc-content-main') || region;

        // Kotva pro absolutní pozicování
        const cs = getComputedStyle(content);
        if (cs.position === 'static') {
            content.style.position = 'relative';
        }

        const legend = document.createElement('div');
        legend.id = 'riscon-eff-legend';
        legend.style.position = 'absolute';
        legend.style.lineHeight = '1.3';
        legend.style.whiteSpace = 'normal';
        legend.style.zIndex = '10';
        legend.innerHTML = buildEffLegendHtml();

        content.appendChild(legend);

        function recompute() {
            const regionRect = content.getBoundingClientRect();
            const selRect    = sel.getBoundingClientRect();

            // Základní pozice – vedle selectu, o něco výš
            let left = selRect.right - regionRect.left + 12;
            if (left < 0) left = 0;

            let top = selRect.top - regionRect.top - 30; // ty sis ladil cca 30
            if (top < 0) top = 0;

            let availableWidth = regionRect.right - regionRect.left - left - 12;

            // Když je region úzký, shoď legendu pod select
            if (availableWidth < 260) {
                left = selRect.left - regionRect.left;
                top  = selRect.bottom - regionRect.top + 4;
                availableWidth = regionRect.right - regionRect.left - left - 12;
            }

            if (availableWidth < 220) {
                availableWidth = 220;
            }

            legend.style.left  = left + 'px';
            legend.style.top   = top + 'px';
            legend.style.width = availableWidth + 'px';
        }

        recompute();
        window.addEventListener('resize', recompute);
    }

    function startEffLegend() {
        if (!EFF_PAGE_REGEX.test(location.href)) return;

        let attempts = 0;
        const maxAttempts = 20;

        const timer = setInterval(() => {
            attempts++;
            initEffLegend();
            if (document.getElementById('riscon-eff-legend') || attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }, 300);
    }

// ==========================================================================
// 4) SPOUŠTĚNÍ
// ==========================================================================

    window.addEventListener('load', () => {
        replaceLabels();
        colorize();
        startEffLegend();
    });

    const observer = new MutationObserver(() => {
        replaceLabels();
        colorize();
        // pro jistotu zkusíme legendu znovu vytvořit, pokud ještě není
        initEffLegend();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
