# Návod na pokročilé filtrování – Řádkový filtr (Row Filter)

## Stránka: Přehled zaměstnanců

Tento manuál popisuje, jak používat pokročilé „Řádkové filtrování" v Interaktivním reportu na stránce **Přehled zaměstnanců** v systému RISCON (Oracle APEX 5.1). Vysvětluje všechny dostupné operátory a funkce, uvádí skutečné kódy sloupců a reálné příklady s hodnotami, které se v tabulce vyskytují.

> [!IMPORTANT]
> **Řádkový filtr ≠ Sloupcový filtr.** Tento návod se týká výhradně filtru typu **„Řádek"** (Row), který najdete po kliknutí na tlačítko **Akce → Filtr → (přepnout na) Řádek**. Řádkový filtr píšete jako SQL podmínku do textového pole „Filtrovací výraz", kde místo názvů sloupců používáte **písmenné kódy** (viz tabulka níže).

> [!CAUTION]
> **Textové hodnoty vždy obalujte jednoduchými uvozovkami** `'...'`.
> Dvojité uvozovky `"..."` ani text bez uvozovek **nefungují** a vedou k chybě `Invalid filter expression`.
> Sloupce se píšou jako dvoupísmenné kódy **bez** uvozovek. Čísla se píšou přímo bez uvozovek.

---

## 1. Jak funguje Řádkový filtr

Řádkový filtr (Row Filter) funguje na principu zjednodušeného jazyka SQL.

Systém vezme každý sloupec z vaší aktuální sestavy a přiřadí mu **písmenný kód** (E, F, G, ... Z, AA, AB, ...). Tento seznam vidíte v levém dolním rámečku „Sloupce" v dialogu filtru.

Do pole **Filtrovací výraz** pak píšete logickou podmínku, kde místo názvů sloupců používáte tato písmena. Systém projde každý řádek tabulky — pokud váš výraz pro daný řádek platí (je pravdivý), řádek se zobrazí.

**Jednoduchý příklad:**
Chceme zobrazit jen zaměstnance se zařazením „Vedení (management)":

```
AQ = 'Vedení (management)'
```

---

## 2. Přehled skutečných sloupců (kódů)

Níže je kompletní tabulka kódů sloupců tak, jak je zobrazuje dialog Řádkového filtru na stránce „Přehled zaměstnanců". Kódy závisí na aktuální sestavě — pokud přidáte/odeberete sloupce, kódy se mohou změnit.

| Kód   | Název sloupce                        | Typ dat  |
|-------|--------------------------------------|----------|
| `E`   | Příjmení                             | TEXT     |
| `F`   | Jméno                                | TEXT     |
| `G`   | Titul                                | TEXT     |
| `H`   | Os. číslo                            | TEXT     |
| `I`   | Narození                             | DATUM    |
| `J`   | Nástup                               | DATUM    |
| `K`   | Ukončení PP                          | DATUM    |
| `L`   | E-mail                               | TEXT     |
| `M`   | Telefon 1                            | TEXT     |
| `N`   | Telefon 2                            | TEXT     |
| `O`   | Adresa 1                             | TEXT     |
| `P`   | Obec 1                               | TEXT     |
| `Q`   | PSČ 1                                | TEXT     |
| `S`   | Adresa 2                             | TEXT     |
| `T`   | Obec 2                               | TEXT     |
| `U`   | PSČ 2                                | TEXT     |
| `W`   | Občanství                            | TEXT     |
| `X`   | Národnost                            | TEXT     |
| `Y`   | Poslední změna                       | DATUM    |
| `Z`   | Oddělení                             | TEXT     |
| `AA`  | Skupina                              | TEXT     |
| `AC`  | Země/Stát 1                          | TEXT     |
| `AD`  | Země/Stát 2                          | TEXT     |
| `AE`  | Mimo stav                            | TEXT     |
| `AF`  | Propuštěn                            | TEXT     |
| `AH`  | Plán. LPP                            | ČÍSLO    |
| `AI`  | Plán. školení                        | ČÍSLO    |
| `AJ`  | LPP po termínu                       | ČÍSLO    |
| `AK`  | Školení po termínu                   | ČÍSLO    |
| `AL`  | Rychlá informace                     | TEXT     |
| `AM`  | Zdrav. omezení                       | TEXT     |
| `AN`  | Rodné příjmení                       | TEXT     |
| `AO`  | Propojené pozice                     | ČÍSLO    |
| `AP`  | Nákl. středisko                      | TEXT     |
| `AQ`  | Zařazení                             | TEXT     |
| `AR`  | Mimo stav od                         | DATUM    |
| `AS`  | Vytvořil(a)                          | TEXT     |
| `AT`  | Vytvořeno                            | DATUM    |
| `AU`  | Upravil(a)                           | TEXT     |
| `AV`  | Upraveno                             | DATUM    |
| `AW`  | Režim práce                          | TEXT     |
| `AX`  | Vlastní účet RISCON                  | TEXT     |
| `BB`  | Označení směny                       | TEXT     |
| `BC`  | Počet propojených pracovišť          | ČÍSLO    |
| `BD`  | Poslední změna pozice                | DATUM    |
| `BE`  | SAP ID                               | TEXT     |
| `BF`  | Poslední biol. test                  | DATUM    |
| `BG`  | Rodné číslo                          | TEXT     |
| `BH`  | Zdravotní pojišťovna                 | TEXT     |
| `BI`  | Výjimka z testu v platnosti          | TEXT     |
| `BJ`  | Příští biol. test nejpozději         | DATUM    |
| `BK`  | Výjimka v platnosti                  | TEXT     |
| `BM`  | Přímý nadřízený                      | TEXT     |
| `BN`  | Je ze skupiny agenturních zamců      | TEXT     |
| `BP`  | Přidělené RISCON role                | TEXT     |
| `BQ`  | Pohlaví                              | TEXT     |
| `BR`  | Poznámka                             | TEXT     |
| `BS`  | ISCO klasifikace                     | TEXT     |
| `BT`  | Termín hodnocení adapt. procesu      | DATUM    |
| `BU`  | Praní prac. oděvů zajistí            | TEXT     |
| `BV`  | Schopnost rozumět místnímu jazyku    | TEXT     |
| `BW`  | Druh prac. poměru                    | TEXT     |
| `BX`  | Druh práce                           | TEXT     |
| `BY`  | Týdenní úvazek (hod.)               | ČÍSLO    |
| `BZ`  | Délka směny                          | TEXT     |
| `CA`  | Agentura práce                       | TEXT     |
| `CB`  | Důvody k upuštění od PLP             | TEXT     |
| `CC`  | Počet přidělených karet              | ČÍSLO    |

> [!NOTE]
> Kódy `AB`, `BA`, `BL`, `BO` atd. v tabulce chybí — to je normální, systém je nepřiřazuje souvisle.

---

## 3. Skutečné hodnoty ve sloupci „Zařazení" (AQ)

Sloupec **AQ** (Zařazení / `EMP_TYPE`) obsahuje v praxi tyto tři hodnoty:

| Hodnota ve sloupci                 | Popis                   |
|------------------------------------|-------------------------|
| `Dělníci (blue collars)`           | Dělnické profese        |
| `Technici/THP (white collars)`     | Technicko-hosp. prac.   |
| `Vedení (management)`              | Vedoucí pracovníci      |

> [!WARNING]
> **Hodnoty obsahují závorky `( )`!** Závorky jsou v SQL speciální znaky. Při použití v Řádkovém filtru je musíte správně zapsat. Viz kapitola 5 o řešení problémů.

---

## 4. Slovník operátorů a funkcí

Všechny funkce a operátory, které jsou k dispozici v pravém panelu dialogu Řádkového filtru, jsou rozděleny do logických skupin.

### A. Základní porovnávání

| Operátor        | Význam                           | Příklad                                                  |
|-----------------|----------------------------------|----------------------------------------------------------|
| `=`             | Rovná se (přesná shoda)          | `AQ = 'Vedení (management)'`                            |
| `!=`            | Nerovná se                       | `AQ != 'Dělníci (blue collars)'`                        |
| `<`             | Menší než                        | `AH < 5`                                                |
| `<=`            | Menší nebo rovno                 | `AH <= 10`                                              |
| `>`             | Větší než                        | `AJ > 0`                                                |
| `>=`            | Větší nebo rovno                 | `AI >= 3`                                                |

**Příklady s reálnými daty:**

```
E = 'NOVÁK'
```
Zobrazí zaměstnance s příjmením přesně NOVÁK.

```
AH > 0
```
Zobrazí zaměstnance, kteří mají alespoň 1 plánovanou lékařskou prohlídku (LPP).

---

### B. Rozsah hodnot: BETWEEN / NOT BETWEEN

Hledá hodnoty, které spadají (nebo nespadají) do rozsahu od–do.

**Syntaxe:**
```
sloupec BETWEEN hodnota1 AND hodnota2
sloupec NOT BETWEEN hodnota1 AND hodnota2
```

**Příklady:**

```
AH BETWEEN 1 AND 5
```
Počet plán. LPP je mezi 1 a 5 (včetně obou krajních hodnot).

```
J BETWEEN TO_DATE('01.01.2024', 'DD.MM.YYYY') AND TO_DATE('31.12.2024', 'DD.MM.YYYY')
```
Zaměstnanci, kteří nastoupili v roce 2024.

---

### C. Seznam hodnot: IN / NOT IN

Vyhledá řádky, kde se hodnota sloupce nachází (nebo nenachází) v zadaném seznamu.

**Syntaxe:**
```
sloupec IN ('hodnota1', 'hodnota2', ...)
sloupec NOT IN ('hodnota1', 'hodnota2', ...)
```

> [!CAUTION]
> **Klíčové pravidlo:** Za `IN` nebo `NOT IN` musí **vždy** následovat **kulaté závorky** obsahující seznam hodnot. Každá textová hodnota musí být v **jednoduchých uvozovkách** a oddělená **čárkami**.
>
> **Nelze psát:**
> - `AQ NOT IN = 'Dělníci (blue collars)'` ❌ (operátor `=` je navíc)
> - `AQ NOT IN 'Dělníci (blue collars)'` ❌ (chybí kulaté závorky seznamu)
>
> **Správný zápis:**
> - `AQ NOT IN ('Dělníci (blue collars)')` ✅

**Příklady:**

```
AQ IN ('Dělníci (blue collars)', 'Vedení (management)')
```
Zobrazí jen dělníky a vedení (vyloučí THP).

```
AQ NOT IN ('Dělníci (blue collars)')
```
Zobrazí všechny **kromě** dělníků — tedy zobrazí THP a vedení.

```
Z IN ('S 09 - Ředitelství', 'S 10 - Středisko svařování')
```
Zobrazí zaměstnance ze dvou konkrétních oddělení.

> [!TIP]
> Pokud hodnota v seznamu sama obsahuje závorky (jako `Dělníci (blue collars)`), nemusíte tyto závorky nijak speciálně escapovat — stačí celou hodnotu obalit jednoduchými uvozovkami `'...'`. Závorky uvnitř uvozovek se berou jako součást textu.

---

### D. Vyhledávání textu: LIKE / NOT LIKE

Vyhledává částečnou shodu pomocí zástupných znaků:
- `%` = libovolný počet libovolných znaků (i 0)
- `_` = přesně jeden libovolný znak

**Syntaxe:**
```
sloupec LIKE 'vzor'
sloupec NOT LIKE 'vzor'
```

**Příklady:**

```
E LIKE 'NOV%'
```
Příjmení začínající na „NOV" (NOVÁK, NOVOTNÝ, NOVOBILSKÝ...).

```
Z LIKE '%svařování%'
```
Oddělení obsahující slovo „svařování".

```
L LIKE '%@cht.cz'
```
E-mail končící na @cht.cz.

```
AQ LIKE '%blue%'
```
Zařazení obsahující text „blue" — najde `Dělníci (blue collars)`.

```
AQ NOT LIKE '%management%'
```
Vyloučí vedení (management).

---

### E. Prázdné / neprázdné hodnoty: IS NULL / IS NOT NULL

Slouží k vyhledání řádků, kde je (nebo není) buňka prázdná. Slova `IS` a `NULL` se vždy používají společně.

**Syntaxe:**
```
sloupec IS NULL
sloupec IS NOT NULL
```

**Příklady:**

```
K IS NULL
```
Zaměstnanci, u nichž není vyplněno datum ukončení PP (= stále aktivní).

```
K IS NOT NULL
```
Zaměstnanci s vyplněným datem ukončení PP (= propuštění / odchozí).

```
BR IS NOT NULL
```
Zaměstnanci, kteří mají vyplněnou poznámku.

```
BM IS NULL
```
Zaměstnanci bez vyplněného přímého nadřízeného.

---

### F. Logické spojky: AND, OR, NOT

Propojují více podmínek do jednoho složeného výrazu.

| Spojka | Význam                                    |
|--------|-------------------------------------------|
| `AND`  | Všechny spojené podmínky musí platit      |
| `OR`   | Stačí, aby platila alespoň jedna         |
| `NOT`  | Obrátí (zneguje) význam podmínky          |

**Příklady:**

```
AQ = 'Technici/THP (white collars)' AND Z LIKE '%Ředitelství%'
```
THP zaměstnanci na ředitelství.

```
AQ = 'Dělníci (blue collars)' OR AQ = 'Vedení (management)'
```
Jen dělníci nebo vedení.

```
NOT (AQ = 'Dělníci (blue collars)')
```
Všichni kromě dělníků (totéž jako `AQ != 'Dělníci (blue collars)'`).

```
K IS NULL AND AQ = 'Technici/THP (white collars)' AND Z LIKE '%mostních%'
```
Aktivní THP zaměstnanci na závodě mostních a inženýrských staveb.

> [!TIP]
> U složitých výrazů s `OR` je vhodné použít závorky pro seskupení:
> ```
> (AQ = 'Dělníci (blue collars)' OR AQ = 'Vedení (management)') AND K IS NULL
> ```
> Tím zajistíte správné vyhodnocení — nejdřív se vyhodnotí `OR` uvnitř závorky, pak `AND`.

---

### G. Zpracování textu (řetězcové funkce)

Tyto funkce upravují text před porovnáním — hodí se, když nevíte přesný tvar textu (velká/malá písmena apod.).

#### UPPER / LOWER / INITCAP
Převedou text na velká / malá / první velká písmena.

```
UPPER(E) = 'NOVÁK'
```
Najde „Novák", „NOVÁK", „novák" — porovnává vždy jako velká písmena.

```
LOWER(L) LIKE '%cht.cz%'
```
E-mail obsahující „cht.cz" bez ohledu na velká/malá.

#### LENGTH
Zjistí počet znaků v textu.

```
LENGTH(BR) > 10
```
Poznámka je delší než 10 znaků.

#### SUBSTR
Vrátí část textu — `SUBSTR(sloupec, odkud, kolik)`.

```
SUBSTR(H, 1, 2) = '16'
```
Osobní číslo začíná na „16".

#### REPLACE
Nahradí část textu jinou — `REPLACE(sloupec, 'co', 'čím')`.

```
REPLACE(E, 'Á', 'A') = 'NOVAK'
```

#### TRIM / LTRIM / RTRIM
Odstraní mezery — TRIM obě strany, LTRIM zleva, RTRIM zprava.

```
TRIM(E) = 'NOVÁK'
```
Najde příjmení i pokud bylo zadáno s přebytečnými mezerami.

#### LPAD / RPAD
Doplní text zleva (LPAD) nebo zprava (RPAD) na zadanou délku.

```
LPAD(H, 5, '0') = '01643'
```
Doplní os. číslo nulami zleva na 5 znaků.

#### INSTR
Vrátí pozici (číslo) výskytu textu v textu — `INSTR(sloupec, 'hledaný_text')`. Vrací 0, pokud nenajde.

```
INSTR(BM, 'NERUDA') > 0
```
Přímý nadřízený obsahuje jméno NERUDA.

#### CHR
Vrátí znak podle kódu ASCII — `CHR(kód)`.

```
INSTR(BR, CHR(10)) > 0
```
Poznámka obsahuje zalomení řádku (nový řádek = CHR(10)).

#### TRANSLATE
Hromadná náhrada jednotlivých znaků — `TRANSLATE(sloupec, 'odkud', 'kam')`.

```
TRANSLATE(E, 'ÁÉÍÓÚŮÝČĎŇŘŠŤŽáéíóúůýčďňřšťž', 'AEIOUUYCDNRSTZaeiouurcdnrstz') LIKE '%NOVAK%'
```
Hledání bez diakritiky.

#### REGEXP_LIKE / REGEXP_INSTR / REGEXP_REPLACE / REGEXP_SUBSTR
Pokročilé funkce pro práci s regulárními výrazy.

```
REGEXP_LIKE(BG, '^\d{6}/\d{3,4}$')
```
Rodné číslo odpovídá vzoru 6 číslic / 3–4 číslice.

```
REGEXP_LIKE(E, '^(NOV|KOV)')
```
Příjmení začíná na NOV nebo KOV.

---

### H. Práce s datem a časem

Funkce pro porovnání a výpočty s datumovými sloupci (Narození, Nástup, Ukončení PP atd.).

#### SYSDATE / CURRENT_DATE
Vrací aktuální datum a čas serveru.

```
J > SYSDATE - 90
```
Zaměstnanci, kteří nastoupili v posledních 90 dnech.

```
I < ADD_MONTHS(SYSDATE, -50*12)
```
Zaměstnanci starší 50 let (narození dříve než 50 let zpět).

#### SYSTIMESTAMP / CURRENT_TIMESTAMP
Přesný čas serveru včetně zlomků vteřin a časové zóny.

#### ADD_MONTHS
Přičte (nebo odečte) měsíce k datu — `ADD_MONTHS(datum, počet_měsíců)`.

```
BF < ADD_MONTHS(SYSDATE, -12)
```
Poslední biologický test je starší než 12 měsíců.

```
J < ADD_MONTHS(SYSDATE, -60)
```
Zaměstnanci, kteří nastoupili před více než 5 lety.

#### MONTHS_BETWEEN
Vypočítá počet měsíců mezi dvěma daty — `MONTHS_BETWEEN(datum1, datum2)`.

```
MONTHS_BETWEEN(SYSDATE, J) > 12
```
Zaměstnanci zaměstnaní déle než 12 měsíců.

#### NEXT_DAY / LAST_DAY
- `NEXT_DAY(datum, 'den')` — další zadaný den v týdnu
- `LAST_DAY(datum)` — poslední den v měsíci

```
BJ <= LAST_DAY(SYSDATE)
```
Příští biologický test nejpozději do konce aktuálního měsíce.

#### TO_DATE
Převede text na datum — `TO_DATE('text', 'formát')`.

```
J > TO_DATE('01.01.2025', 'DD.MM.YYYY')
```
Nástup po 1. lednu 2025.

```
I BETWEEN TO_DATE('01.06.1975', 'DD.MM.YYYY') AND TO_DATE('31.12.1985', 'DD.MM.YYYY')
```
Zaměstnanci narození mezi lety 1975–1985.

#### TO_CHAR
Převede datum (nebo číslo) na text s určitým formátem — `TO_CHAR(datum, 'formát')`.

```
TO_CHAR(J, 'YYYY') = '2025'
```
Zaměstnanci, kteří nastoupili v roce 2025.

```
TO_CHAR(I, 'MM') = '06'
```
Zaměstnanci narození v červnu.

#### TO_TIMESTAMP
Převede text na přesný datum+čas.

```
AV > TO_TIMESTAMP('01.06.2026 00:00:00', 'DD.MM.YYYY HH24:MI:SS')
```

---

### I. Matematika a čísla

Funkce pro práci s číselnými sloupci (Plán. LPP, Plán. školení, Propojené pozice apod.).

| Funkce                          | Popis                                           | Příklad                                    |
|---------------------------------|-------------------------------------------------|--------------------------------------------|
| `ROUND(sloupec)`                | Zaokrouhlí na celé číslo                        | `ROUND(BY) = 40`                           |
| `ROUND(sloupec, n)`             | Zaokrouhlí na *n* desetinných míst              | `ROUND(BY, 1) >= 37.5`                     |
| `TRUNC(sloupec)`                | Ořízne desetinná místa (neokrouhluje)           | `TRUNC(BY) = 37`                           |
| `CEIL(sloupec)`                 | Zaokrouhlí vždy nahoru                          | `CEIL(BY) >= 38`                           |
| `ABS(sloupec)`                  | Absolutní hodnota                               | `ABS(AJ) > 0`                              |
| `MOD(sloupec, dělitel)`         | Zbytek po celočíselném dělení                   | `MOD(H, 2) = 0` (sudé os. číslo)          |
| `POWER(základ, exponent)`       | Mocnina                                         | `POWER(AH, 2) > 25`                       |
| `SQRT(sloupec)`                 | Odmocnina                                       | `SQRT(AH) > 2`                             |
| `EXP(sloupec)`                  | Exponenciální funkce (e^x)                      | —                                          |
| `LOG(základ, číslo)`            | Logaritmus                                      | —                                          |
| `SIGN(sloupec)`                 | Znaménko: 1 (kladné), 0, -1 (záporné)          | `SIGN(AJ) = 1` (LPP po termínu existuje)  |
| `SIN(sloupec)`, `COS(sloupec)`  | Goniometrie (sinus, kosinus)                    | —                                          |
| `GREATEST(a, b, ...)`           | Vrátí největší z uvedených hodnot               | `GREATEST(AH, AI) > 5`                    |
| `LEAST(a, b, ...)`              | Vrátí nejmenší z uvedených hodnot               | `LEAST(AH, AI) = 0`                       |

---

### J. Ošetření chybějících hodnot a logika IF-THEN

#### NVL
Nahradí prázdnou (NULL) hodnotu náhradní hodnotou — `NVL(sloupec, náhrada)`.

```
NVL(AJ, 0) > 0
```
Pokud sloupec LPP po termínu není vyplněn, ber to jako 0. Zobrazí jen ty, kde je skutečně hodnota > 0.

```
NVL(AF, 'Ne') = 'Ne'
```
Zaměstnanci, kteří nejsou propuštěni (prázdné pole = „Ne").

#### COALESCE
Jako NVL, ale přijímá více argumentů — vrátí první neprázdnou hodnotu.

```
COALESCE(M, N, 'bez telefonu') != 'bez telefonu'
```
Zaměstnanci, kteří mají vyplněn alespoň Telefon 1 nebo Telefon 2.

#### DECODE
Jednoduchý překladník — `DECODE(sloupec, když_hodnota1, pak1, když_hodnota2, pak2, ..., jinak)`.

```
DECODE(BQ, 'M', 'Muž', 'F', 'Žena', 'Neznámo') = 'Žena'
```

#### CASE ... WHEN ... THEN ... ELSE ... END
Složitá podmínková logika.

```
CASE WHEN AH > 5 THEN 'Hodně LPP' WHEN AH > 0 THEN 'Nějaké LPP' ELSE 'Žádné' END = 'Hodně LPP'
```

---

## 5. Řešení problémů — chyba „Invalid filter expression"

### Problém: Hodnoty se závorkami

Hodnota `Dělníci (blue collars)` obsahuje kulaté závorky, které jsou v SQL také syntaktickými prvky (např. za `IN` / `NOT IN` se očekává seznam v závorkách). To způsobuje problémy při nesprávné syntaxi.

#### Co NEFUNGUJE a proč:

| Zápis | Chyba | Důvod |
|-------|-------|-------|
| `AQ NOT IN = Dělníci (blue collars)` | `Invalid filter expression. Dělníci` | Chybí uvozovky kolem hodnoty, navíc je přebytečný operátor `=` |
| `AQ NOT IN = "Dělníci (blue collars)"` | `Invalid filter expression. "Dělníci` | Dvojité uvozovky nejsou platné pro textové hodnoty v Oracle SQL |
| `AQ NOT IN = 'Dělníci (blue collars)'` | `ORA-00936: chybí výraz` | Operátor `=` je přebytečný — `NOT IN` nepotřebuje `=` |
| `AQ NOT IN 'Dělníci (blue collars)'` | Chyba | Za `NOT IN` chybí závorky seznamu |

#### Co FUNGUJE správně:

```
AQ NOT IN ('Dělníci (blue collars)')
```
✅ Jedna hodnota v závorce seznamu, obalená jednoduchými uvozovkami.

```
AQ != 'Dělníci (blue collars)'
```
✅ Jednodušší alternativa — pokud vyřazujete jedinou hodnotu, nemusíte `NOT IN` vůbec používat.

```
AQ NOT IN ('Dělníci (blue collars)', 'Vedení (management)')
```
✅ Vyřadí dělníky i vedení — zobrazí jen THP.

```
AQ LIKE '%blue%'
```
✅ Alternativa přes LIKE — hledá hodnotu obsahující „blue" (vyhne se problémům se závorkami).

> [!IMPORTANT]
> **Zlaté pravidlo pro `IN` / `NOT IN`:**
> 1. Za `IN` / `NOT IN` **nikdy** nepište `=`
> 2. Za `IN` / `NOT IN` **vždy** pište závorky `( ... )`
> 3. Textové hodnoty uvnitř závorek **vždy** obalte jednoduchými uvozovkami `'...'`
> 4. Více hodnot oddělte čárkou: `('hodnota1', 'hodnota2')`

---

## 6. Praktické příklady (recepty)

### Aktivní zaměstnanci (nepropuštění)
```
K IS NULL
```

### Jen dělníci
```
AQ = 'Dělníci (blue collars)'
```

### Všichni kromě dělníků
```
AQ != 'Dělníci (blue collars)'
```
nebo ekvivalentně:
```
AQ NOT IN ('Dělníci (blue collars)')
```

### Jen THP a vedení
```
AQ IN ('Technici/THP (white collars)', 'Vedení (management)')
```

### Aktivní THP na ředitelství
```
K IS NULL AND AQ = 'Technici/THP (white collars)' AND Z LIKE '%Ředitelství%'
```

### Nástup v roce 2025
```
TO_CHAR(J, 'YYYY') = '2025'
```
nebo:
```
J BETWEEN TO_DATE('01.01.2025', 'DD.MM.YYYY') AND TO_DATE('31.12.2025', 'DD.MM.YYYY')
```

### Zaměstnanci s prošlým biologickým testem (starším než rok)
```
BF < ADD_MONTHS(SYSDATE, -12) AND BF IS NOT NULL
```

### Zaměstnanci starší 50 let
```
I < ADD_MONTHS(SYSDATE, -600)
```
(600 měsíců = 50 let)

### Příjmení začínající na „K" bez ohledu na diakritiku
```
UPPER(E) LIKE 'K%'
```

### Zaměstnanci z oddělení svařování nebo elektrostaveb
```
Z IN ('S 10 - Středisko svařování', 'S 11 - Středisko elektrostaveb')
```

### Zaměstnanci, kteří nastoupili v posledních 30 dnech
```
J >= SYSDATE - 30
```

### Zaměstnanci se školením po termínu
```
AK > 0
```

### Zaměstnanci bez e-mailu nebo s e-mailem „n.a."
```
L IS NULL OR L = 'n.a.'
```

### Hledání podle rodného čísla (formát XXXXXX/XXXX)
```
REGEXP_LIKE(BG, '^\d{6}/\d{3,4}$')
```

### Kombinace více podmínek s prioritou
```
K IS NULL AND (AQ = 'Dělníci (blue collars)' OR AQ = 'Vedení (management)') AND J >= TO_DATE('01.01.2024', 'DD.MM.YYYY')
```
Aktivní dělníci nebo vedení, kteří nastoupili od roku 2024.

---

## 7. Rychlý přehled syntaxe

```
sloupec = 'text'                        ... přesná shoda
sloupec != 'text'                       ... nerovná se
sloupec > číslo                         ... větší než
sloupec < číslo                         ... menší než
sloupec >= číslo                        ... větší nebo rovno
sloupec <= číslo                        ... menší nebo rovno
sloupec BETWEEN a AND b                 ... je v rozsahu od a do b
sloupec NOT BETWEEN a AND b             ... není v rozsahu
sloupec IN ('a', 'b', 'c')             ... je v seznamu
sloupec NOT IN ('a', 'b')              ... není v seznamu
sloupec LIKE '%vzor%'                   ... obsahuje text
sloupec NOT LIKE '%vzor%'               ... neobsahuje text
sloupec IS NULL                         ... je prázdné
sloupec IS NOT NULL                     ... není prázdné
podmínka1 AND podmínka2                 ... obě musí platit
podmínka1 OR podmínka2                  ... alespoň jedna musí platit
NOT (podmínka)                          ... negace podmínky
```

---

> [!TIP]
> **Tipy pro každodenní práci:**
> - Vždy si nejdříve ověřte **kódy sloupců** v levém panelu dialogu filtru — kódy se mohou lišit podle toho, které sloupce máte v sestavě zobrazené.
> - Pro jednoduché filtrování (jeden sloupec, jeden operátor) je rychlejší použít **Sloupcový filtr** (záložka „Sloupec") — tam stačí vybrat sloupec, operátor a zadat hodnotu, systém se o syntaxi postará sám.
> - **Řádkový filtr** používejte, když potřebujete kombinovat podmínky přes více sloupců (např. `AQ = '...' AND Z LIKE '...' AND K IS NULL`).
