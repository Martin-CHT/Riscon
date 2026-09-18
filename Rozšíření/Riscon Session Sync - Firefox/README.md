## Riscon Session Sync — Firefox
### **Doplněk slouží v případě odhlášení a opětovného přihlášení do Risconu k automatickému obnovení všech otevřených záložek Riscon.**
##

### Instalace do Firefoxu

1. Otevřete Firefox a do adresního řádku zadejte `about:debugging#/runtime/this-firefox`
2. Klikněte na **Načíst dočasný doplněk...**
3. Vyberte soubor `manifest.json` z této složky
4. Rozšíření bude aktivní do zavření prohlížeče

#### Trvalá instalace (pro podepsané rozšíření)
1. Zabalte složku do `.zip` a přejmenujte na `.xpi`
2. Nainstalujte přes `about:addons` → ozubené kolečko → **Nainstalovat doplněk ze souboru...**

> **Poznámka:** Pro trvalou instalaci bez podpisu je potřeba buď Firefox Developer Edition / Nightly s `xpinstall.signatures.required = false` v `about:config`, nebo podepsání přes [addons.mozilla.org](https://addons.mozilla.org).
