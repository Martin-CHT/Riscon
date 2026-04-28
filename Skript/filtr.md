# Návod na pokročilé filtrování (Řádkový filtr)

Tento manuál popisuje, jak používat pokročilé „Řádkové filtrování“ v datových tabulkách (tzv. Interaktivních reportech) a vysvětluje všechny dostupné funkce a operátory.

> [!TIP]
> Veškeré textové hodnoty v příkladech (např. jména, stavy) je vždy nutné obalit **jednoduchými uvozovkami** (např. `'Schváleno'`). Sloupce se naopak zapisují pomocí dvoupísmenných kódů (např. `AA`, `AB`) zcela bez uvozovek. Čísla se píšou přímo.

---

## 1. Jak funguje Řádkový filtr

Filtrování typu **Řádek** funguje na principu zjednodušeného jazyka SQL. 
Tabulka na pozadí vezme každý sloupec z vaší aktuální sestavy a přiřadí mu **písmenný kód** (A, B, C... Z, AA, AB, atd.). Tento seznam vidíte v levém dolním rámečku „Sloupce“.

Do pole **Filtrovací výraz** pak píšete logickou podmínku, kde místo názvů sloupců používáte tato písmena. Systém následně projde každý řádek tabulky, a pokud pro něj váš výraz platí (je pravdivý), daný řádek se v tabulce zobrazí. Pomocí tohoto nástroje tak můžete velmi snadno propojovat pravidla pro více sloupců naráz.

**Příklad:** Chceme zobrazit záznamy, kde „Probíhá revize“ (např. sloupec `AA`) je 'Ano' a „Stav schválení“ (`AE`) je 'Schváleno'.
**Výraz:** `AA = 'Ano' AND AE = 'Schváleno'`

---

## 2. Slovník operátorů a funkcí

Níže jsou vysvětleny všechny funkce z pravého sloupce z vašeho prostředí. Jsou pro přehlednost rozděleny do logických skupin.

### A. Základní porovnávání
Těmito operátory porovnáváte, jestli se hodnota ve sloupci rovná, nebo je větší/menší než hledaná hodnota.

*   `=` **(Rovná se)**: Zkontroluje přesnou shodu.
    *   *Příklad:* `AE = 'Schváleno'` (Zobrazí jen schválené).
*   `!=` **(Nerovná se)**: Zobrazí vše kromě hledané hodnoty.
    *   *Příklad:* `AE != 'Zamítnuto'` (Zobrazí všechno kromě zamítnutých).
*   `<`, `<=`, `>`, `>=` **(Menší, Menší rovno, Větší, Větší rovno)**: Ideální pro čísla nebo data.
    *   *Příklad:* `AF > 5` (Počet dní je větší než 5).
*   `BETWEEN` a `NOT BETWEEN` **(Je v rozsahu / Není v rozsahu)**: Hledá hodnoty od-do.
    *   *Příklad:* `C BETWEEN 10 AND 20` (Hodnota je mezi 10 a 20 včetně).
*   `IN` a `NOT IN` **(Je v seznamu / Není v seznamu)**: Skvělé pro hledání více možností.
    *   *Příklad:* `AE IN ('Schváleno', 'V přípravě')` (Stav je buď schválen, nebo se připravuje).
*   `LIKE` a `NOT LIKE` **(Podobá se / Obsahuje)**: Vyhledávání částečného textu pomocí zástupného znaku `%` (procento = libovolný text).
    *   *Příklad:* `AB LIKE '%stavby%'` (Sloupec AB obsahuje slovo "stavby").
*   `IS` a `NULL` **(Je / Prázdný)**: Slouží k vyhledání nevyplněných buněk. Vždy se používají dohromady jako `IS NULL` nebo `IS NOT NULL`.
    *   *Příklad:* `AD IS NULL` (Buňka AD není vůbec vyplněná).

### B. Logické spojky
Propojují několik podmínek do jedné složité.

*   `AND` **(A zároveň)**: Všechny spojené podmínky musí platit.
    *   *Příklad:* `AA = 'Ano' AND AD = 'Ne'`
*   `OR` **(Nebo)**: Stačí, aby platila alespoň jedna podmínka.
    *   *Příklad:* `AA = 'Ano' OR AB = 'Výroba'`
*   `NOT` **(Negace)**: Obrátí význam.
    *   *Příklad:* `NOT (AE = 'Schváleno')` (Totéž co `AE != 'Schváleno'`).

### C. Zpracování textu (Řetězce)
Tyto funkce upravují text předtím, než ho porovnají. To se hodí, když nevíte, jestli to někdo napsal velkými nebo malými písmeny.

*   `UPPER`, `LOWER` **(Vše velkým, Vše malým)**: Převede text.
    *   *Příklad:* `UPPER(D) = 'NEHODA'` (Najde "Nehoda", "NEHODA" i "nehoda").
*   `INITCAP` **(První velká)**: Převede první písmena slov na velká.
*   `LENGTH` **(Délka)**: Zjistí počet znaků v buňce.
    *   *Příklad:* `LENGTH(H) > 50` (Popis H je delší než 50 znaků).
*   `SUBSTR` **(Část textu)**: Vezme jen prvních X znaků.
    *   *Příklad:* `SUBSTR(C, 1, 3) = 'AR_'` (Zkontroluje, jestli číslo začíná na "AR_").
*   `REPLACE` **(Nahradit)**: Zkusmo nahradí část textu jinou.
*   `TRIM`, `LTRIM`, `RTRIM` **(Oříznout mezery)**: Odstraní mezery na začátku a konci (L=vlevo, R=vpravo).
    *   *Příklad:* `TRIM(D) = 'Něco'` (Najde text i když ho uživatel zapsal omylem jako " Něco ").
*   `LPAD`, `RPAD` **(Doplnění znaků)**: Zleva nebo zprava doplní text např. nulami do požadované délky.
*   `INSTR` **(Najít text v textu)**: Podobné jako LIKE, vrací číselnou pozici slova.
    *   *Příklad:* `INSTR(H, 'problém') > 0` (Najde slovo problém kdekoli v textu H).
*   `CHR` **(Znak z kódu)**: Vrací speciální znak ze systémové tabulky znaků (např. CHR(10) je nový řádek).
*   `TRANSLATE` **(Hromadná náhrada písmen)**: Umí například nahradit "ř" za "r".
*   `REGEXP_...` (REGEXP_LIKE, REGEXP_INSTR, REGEXP_REPLACE, REGEXP_SUBSTR): Funkce pro takzvané "Regulární výrazy" – naprostý nástroj pro profesionály (např. vyhledání formátu rodného čísla).

### D. Práce s časem a datem
Funkce pro práci se sloupci typu Datum (např. Platnost do).

*   `SYSDATE`, `CURRENT_DATE` **(Dnešek)**: Vrací aktuální datum a čas.
    *   *Příklad:* `AG < SYSDATE` (Datum posledního přezkoumání už uplynulo včera a dřív).
*   `SYSTIMESTAMP`, `CURRENT_TIMESTAMP` **(Přesný čas)**: Stejné jako SYSDATE, ale přesné na zlomky vteřin.
*   `ADD_MONTHS` **(Přidat měsíce)**: K nějakému datu přičte měsíce.
    *   *Příklad:* `AG < ADD_MONTHS(SYSDATE, -6)` (Od data přezkoumání uteklo víc než 6 měsíců).
*   `MONTHS_BETWEEN` **(Rozdíl v měsících)**: Vypočítá počet měsíců mezi dvěma daty.
*   `NEXT_DAY`, `LAST_DAY` **(Další den, Poslední den v měsíci)**: Posune datum na konkrétní nejbližší den.

### E. Matematika a Čísla
*   `ROUND`, `TRUNC` **(Zaokrouhlit, Oříznout)**: Pracuje s desetinnými čísly nebo i s daty (např. ořízne čas z data a nechá jen půlnoc).
    *   *Příklad:* `ROUND(AF) = 10`
*   `CEIL` **(Zaokrouhlit vždy nahoru)**.
*   `ABS` **(Absolutní hodnota)**: Udělá ze záporného čísla kladné.
*   `MOD` **(Zbytek po dělení)**: Zjistí např. jestli je číslo sudé/liché.
*   `POWER` (Mocnina), `SQRT` (Odmocnina), `EXP`, `LOG` (Logaritmy).
*   `SIGN` **(Znaménko)**: Zjistí jestli je číslo kladné, záporné nebo nula.
*   `SIN`, `COS` **(Goniometrie - sinus a kosinus)**.

### F. Převody typu dat
Pokud tabulka bere číslo jako text nebo naopak, těmito funkcemi to opravíte.
*   `TO_CHAR` **(Na text)**: Vynutí, že číslo nebo datum se bere jako text (dá se určit přesný formát např. "DD.MM.YYYY").
*   `TO_DATE` **(Na datum)**: Převede text s datem zpět na formát data (abyste ho mohli porovnávat pomocí < a >).
*   `TO_TIMESTAMP` **(Na detailní datum a čas)**.

### G. Ošetření chybějících hodnot a logika IF-THEN
Tyto funkce se hodí, když narazíte na poloprázdná data, nebo chcete aplikovat pokročilá pravidla "Když ... tak ...".

*   `NVL`, `COALESCE` **(Nahraď prázdné)**: Pokud je buňka prázdná (NULL), dosaďte místo ní dočasně jinou hodnotu, aby filtr nezhavaroval.
    *   *Příklad:* `NVL(AF, 0) < 5` (Pokud ve sloupci AF není nic vyplněno, ber to jako "0" a zkontroluj, jestli je to menší než 5).
*   `GREATEST`, `LEAST` **(Největší, Nejmenší z několika sloupců)**: Porovná více buněk ve stejném řádku mezi sebou a vezme tu největší/nejmenší (často se hodí na porovnání více dat).
*   `CASE ... WHEN ... THEN ... ELSE ... END` **(Složitá podmínka)**: Dovoluje tvořit vlastní vyhodnocovací logiku (Pokud platí X, přeměň si buňku na Y). Pro filtraci se ale používá málokdy.
*   `DECODE` **(Starší varianta CASE)**: Jednodušší překladník (Když hodnota je X, udělej z ní Y).
