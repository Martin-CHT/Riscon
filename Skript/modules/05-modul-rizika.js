// ==UserScript==
// @name         Riscon: Rizika (barvy a popisky)
// @namespace    https://github.com/Martin-CHT/Riscon
// @version      9.0.1
// @description  Barevné zvýraznění míry rizika, překlad popisků EN->CZ, legenda účinnosti. Součást Riscon Suite – lze nainstalovat samostatně nebo načíst přes @require.
// @author       Martin
// @copyright    2025-2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/Riscon
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/05-modul-rizika.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/Riscon/master/Skript/modules/05-modul-rizika.js
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

    RS.Modules.Risks = {
        update: function (cfg) {
            if (cfg.labels) this.replaceLabels(true); else this.replaceLabels(false);
            if (cfg.colors) this.colorize(); else this.clearColors();
            if (cfg.legend) this.toggleLegend(true); else this.toggleLegend(false);
        },
        replaceLabels: function (enable) {
            const replacements = {
                ' - very rare': ' (méně než 1 x za rok)', ' - unusual': ' (přibližně 1 x za rok)', ' - occasional': ' (přibližně 1 x ročně)',
                ' - frequent': ' (týdně)', ' - very frequent': ' (denně)', ' - continuously': ' (několikrát denně)',
                'practically impossible': 'nemyslitelné', 'almost unthinkable': 'nepředstavitelné',
                ' - possible but far from probable': '', 'combination of unusual circumstances': 'nepravděpodobné, ale z dlouhodobého hlediska možné',
                'low probability': 'neobvyklé', 'very possible': 'dá se očekávat', 'expected': 'očekávané',
                '- no temporary disability': '', ', up to 3 lost days': '', ', serious - more than 3 lost days reversible injury': '',
                ', very serious - accident with irreversible consequences': '', ' - disaster (fatal accident)': '', ' - catastrophe (death of more than one person)': ''
            };
            const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const applyReplacements = (text) => {
                let t = text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').replace(/\s*–\s*/g, ' - ').trim();
                for (const [p, r] of Object.entries(replacements)) t = t.replace(new RegExp(escapeRegex(p), 'gi'), r);
                return t.replace(/\s+\)/g, ')').replace(/\(\s+/g, '(').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
            };
            document.querySelectorAll('label').forEach(label => {
                const textNode = Array.from(label.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
                const target = textNode || (label.childElementCount === 0 ? label : null);
                if (!target) return;
                if (!label.getAttribute('data-orig-text')) {
                    const raw = target.textContent; if (raw.trim()) label.setAttribute('data-orig-text', raw);
                }
                if (enable) {
                    const orig = label.getAttribute('data-orig-text');
                    if (orig) { const newText = applyReplacements(orig); if (target.textContent !== newText) target.textContent = newText; }
                } else {
                    const orig = label.getAttribute('data-orig-text'); if (orig && target.textContent !== orig) target.textContent = orig;
                }
            });
        },
        getColor: function (v) { return v <= 70 ? '#33B03D' : v <= 200 ? '#EBA100' : '#D40C0C'; },
        parseValue: function (t) {
            const cleaned = t.replace(/\u00A0/g, ' ').replace(/\s+/g, '').replace(/,/g, '.').replace(/[^\d.\-]/g, '');
            let normalized = cleaned;
            const dots = (cleaned.match(/\./g) || []).length;
            if (dots > 1) {
                const parts = cleaned.split('.');
                normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
            }
            const n = parseFloat(normalized);
            return isNaN(n) ? null : n;
        },
        colorize: function () {
            document.querySelectorAll('td[headers*="BALANCED_RISK_LEVEL"], td[headers*="RISK_LEVEL"]').forEach(cell => {
                if (cell.dataset.rcColor) return;
                const val = this.parseValue(cell.innerText || cell.textContent || '');
                if (val !== null) { cell.style.backgroundColor = this.getColor(val); cell.style.color = '#fff'; cell.dataset.rcColor = '1'; }
            });
        },
        clearColors: function () {
            document.querySelectorAll('td[data-rc-color]').forEach(c => { c.style.backgroundColor = ''; c.style.color = ''; delete c.dataset.rcColor; });
        },
        toggleLegend: function (show) {
            const LEGEND_ID = 'riscon-eff-legend-sidebar';
            let legend = document.getElementById(LEGEND_ID);
            if (!show) { if (legend) legend.style.display = 'none'; return; }
            if (legend) { legend.style.display = 'block'; return; }
            if (!/f\?p=110:3110:/i.test(location.href)) return;
            const sidebar = document.querySelector('td.tbl-sidebar'); if (!sidebar) return;
            legend = document.createElement('div'); legend.id = LEGEND_ID;
            Object.assign(legend.style, { marginBottom: '10px', border: '1px solid #ccc', background: '#fff', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' });
            const EFF_LEVELS = [
                { pct: 25, label: 'informování / značení', desc: 'Informování, značení, obecná pravidla.' },
                { pct: 50, label: 'organizace / postupy', desc: 'Organizace, postupy, školení, OOPP.' },
                { pct: 75, label: 'technická opatření', desc: 'Bariéry, varování, kontroly.' },
                { pct: 95, label: 'bezpečnostní systémy', desc: 'Automatizace, zamezení vstupu.' }
            ];
            let html = `<div style="padding: 8px 10px; background: #f2f2f2; border-bottom: 1px solid #ccc; font-size: 12px; font-weight: bold; color: #333;">Legenda účinnosti</div><div style="padding: 8px; font-family:Tahoma,Arial,sans-serif; font-size:11px; line-height:1.4;">`;
            EFF_LEVELS.forEach(l => { html += `<div style="margin-bottom:6px;"><span style="font-weight:bold; color:#333;">${l.pct}% – ${l.label}</span><div style="color:#666; margin-top:2px;">${l.desc}</div></div>`; });
            html += '</div>'; legend.innerHTML = html;
            const targets = sidebar.querySelectorAll('.sidebar-region-alt, .sidebar-region');
            if (targets.length > 0) { const last = targets[targets.length - 1]; if (last.nextSibling) sidebar.insertBefore(legend, last.nextSibling); else sidebar.appendChild(legend); }
            else { sidebar.appendChild(legend); }
        }
    };

    // Standalone spuštění
    if (!RS.Config) {
        const cfg = { labels: true, colors: true, legend: true };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => RS.Modules.Risks.update(cfg));
        else RS.Modules.Risks.update(cfg);
    }

})();
