// Upravený regulární výraz, který odděluje i číslo stránky pro lepší kontrolu
// 1: Začátek (?p=110:)
// 2: Číslo stránky (např. 1, 101, 6209)
// 3: Dvojtečka (:)
// 4: Session ID (např. 16912796802666)
// 5: Zbytek URL (např. ::NO::P6209_...)
const apexRegex = /([?&]p=110:)([^:]*)(:)(\d+)(.*)/;

let activeSessionId = null;

chrome.webNavigation.onCompleted.addListener((details) => {
    // Ignorujeme vnořené rámce (iframes)
    if (details.frameId !== 0) return;

    const match = details.url.match(apexRegex);

    if (match) {
        const pageId = match[2];
        const newSessionId = match[4];

        // DŮLEŽITÉ: Ignorujeme přihlašovací stránku (101), chybějící ID nebo nulu
        if (pageId === "101" || !newSessionId || newSessionId === "0") {
            return;
        }

        // Pokud jsme na jakékoliv jiné stránce a máme NOVÉ platné Session ID
        if (newSessionId !== activeSessionId) {
            activeSessionId = newSessionId;
            console.log("Nová relace po přihlášení detekována:", activeSessionId);

            // Najdeme ostatní otevřené záložky
            chrome.tabs.query({ url: "*://www.riscon.cz/go/f?p=110*" }, (tabs) => {
                tabs.forEach((tab) => {
                    if (tab.id !== details.tabId) {
                        const tabMatch = tab.url.match(apexRegex);
                        
                        if (tabMatch) {
                            const oldSessionId = tabMatch[4];
                            
                            if (oldSessionId !== activeSessionId) {
                                // BEZPEČNÉ složení nové URL adresy (oprava problému s 227Kč ($11))
                                const newUrl = tab.url.replace(apexRegex, (m, p1, p2, p3, p4, p5) => {
                                    return p1 + p2 + p3 + activeSessionId + p5;
                                });
                                
                                // Aktualizujeme záložku s novým kódem
                                chrome.tabs.update(tab.id, { url: newUrl });
                            }
                        }
                    }
                });
            });
        }
    }
}, { url: [{ hostContains: 'riscon.cz' }] });
