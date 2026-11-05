# Súlyozott szavazás (IGOV) — oktatási demó

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)


Milton Friedman Egyetem · Gazdasági informatika · blokklánc gyakorlat

Ez a tároló egy **tokensúlyos szavazást** mutat be a **Base** főhálózaton. A diákok MetaMaskkal csatlakoznak; a szavazóerőt az **IGOV** token egyenlege adja egy pillanatképen (snapshot). A cél oktatási: érthető kontraktok, egyszerű webes felület, Remixben is megnyitható forrás.

Élő demó (GitHub Pages): **https://vidisopi.github.io/sulyozott/**

Kapcsolódó, egyszerűbb (1 cím = 1 szavazat) demó: [Vidisopi/vote](https://github.com/Vidisopi/vote) · https://vidisopi.github.io/vote/

---

## Mit tanulunk ezzel?

| Fogalom | Hol jelenik meg |
| --- | --- |
| ERC-20 + szavazóerő (`ERC20Votes`) | `contracts/SzavazoToken.sol` (IGOV, 0 tizedesjegy) |
| Ownable / tanári jogosultság | token mint, szavazás indítás |
| Snapshot / múltbeli szavazóerő | `getPastVotes` a szavazás indításának blokkján |
| MetaMask + Base mainnet | `app.js` hálózatváltás |
| Frontend ↔ kontrakt (ethers.js v6) | `index.html` + `app.js` |

**Szabályok röviden**

1. A tanár kiosztja az IGOV tokeneket (kvízpont → token).
2. A tanár indít szavazást: ekkor **pillanatkép** készül — csak az a token számít, ami *addig* a diáknál volt.
3. Egy szavazáson egyszer szavazhatsz, és **egyszer** módosíthatsz.
4. A leadott súly = a pillanatképen mért szavazóerőd.

---

## Fájlok

```
.
├── index.html          # webes felület (GitHub Pages gyökér)
├── app.js              # ethers.js logika, Base címek
├── contracts/
│   ├── SzavazoToken.sol      # IGOV (ERC20Votes)
│   └── SulyozottSzavazas.sol  # súlyozott szavazás
└── README.md
```

---

## Élő kontraktok (Base mainnet)

| Kontrakt | Cím | Basescan |
| --- | --- | --- |
| **SzavazoToken (IGOV)** | `0x01438AC36474DCCAc97d44F648bDa3c113E32Fbd` | [megnyitás](https://basescan.org/address/0x01438AC36474DCCAc97d44F648bDa3c113E32Fbd) |
| **SulyozottSzavazas** | `0xB5129D4B11e5d687Bb3Ee77271C66E39d622EbD7` | [megnyitás](https://basescan.org/address/0xB5129D4B11e5d687Bb3Ee77271C66E39d622EbD7) |

A frontend ezeket az `app.js` elején lévő `TOKEN_ADDRESS` és `VOTING_ADDRESS` konstansokkal hívja. Ha újra deployolsz, cseréld ki mindkét címet, majd frissítsd a Pages demót.

Hálózat: **Base** · chainId `8453` · RPC `https://mainnet.base.org` · exploreres: https://basescan.org

---

## Diákoknak: MetaMask és a demó

### 1. MetaMask telepítése

1. Nyisd meg a [MetaMask](https://metamask.io/download/) oldalt a **Chrome / Brave / Firefox** böngészőben.
2. Telepítsd a bővítményt, készíts új tárcát (vagy importáld a meglévőt).
3. **Mentés:** a seed phrase / helyreállító mondat csak nálad legyen — soha ne másold be webes űrlapba és ne oszd meg senkivel (tanárral sem).

### 2. Base hálózat

A demó gombja (`MetaMask csatlakoztatása`) megpróbálja átváltani / hozzáadni a Base mainnetet. Ha kézzel szeretnéd:

- Hálózat neve: `Base`
- RPC URL: `https://mainnet.base.org`
- Chain ID: `8453`
- Szimbólum: `ETH`
- Blokkfelfedező: `https://basescan.org`

Tranzakciókhoz kell egy kevés **ETH a Base-en** (gázdíj). Tanári órákon tipikusan a tanár segít ezzel.

### 3. Demó használata

1. Nyisd meg: https://vidisopi.github.io/sulyozott/
2. Kattints: **MetaMask csatlakoztatása** → engedd a kapcsolatot.
3. Ha kaptál IGOV-t, megjelenik a **szavazóerőd**.
4. Nyitott szavazásnál válassz opciót → hagyd jóvá a MetaMaskban.
5. Egyszer még **átszavazhatsz**; utána a választás végleges ahhoz a szavazáshoz.

Ha a szavazás indításakor még nem volt tokened, abban a szavazásban a súlyod 0 — későbbi kiosztás csak a *következő* szavazásokra hat.

---

## Tanároknak: tokenkiosztás és szavazás

A felületen a **tanári panel** akkor jelenik meg, ha a csatlakoztatott cím a token és/vagy a szavazás kontrakt `owner`-e.

1. **Tokenek kiosztása:** másold be a kvíztábla sorait (`cím pontszám`), majd **Kiosztás**.
2. **Új szavazás:** kérdés, 2–8 opció, időtartam → **Szavazás indítása** (ekkor készül a snapshot).
3. Előbb oszd ki a tokeneket, *azután* indíts szavazást.

---

## Remix: kontraktok megnyitása és kipróbálása

[Remix](https://remix.ethereum.org) böngészős Solidity IDE — nem kell helyben telepíteni semmit.

### Forrás betöltése

1. Nyisd meg a Remixet.
2. **File Explorer** → új fájl, vagy másold be:
   - `contracts/SzavazoToken.sol`
   - `contracts/SulyozottSzavazas.sol`
3. A `SzavazoToken` OpenZeppelin importot használ (`@openzeppelin/contracts@5.6.1/...`). Remixben kapcsold be az **Enable optimization** / megfelelő compiler verziót (**0.8.24**), és engedd az URL-importot, vagy telepítsd az OZ csomagot a Remix pluginnal.

### Fordítás

- Compiler: **0.8.24** (vagy kompatibilis 0.8.x)
- Nyisd meg a `.sol` fájlt → **Compile**.

### Deploy MetaMaskkal (Base)

1. Remix → **Deploy & Run**.
2. Environment: **Injected Provider - MetaMask**.
3. MetaMaskban legyen **Base** kiválasztva.
4. Előbb deployold a **SzavazoToken**-t, jegyezd fel a címet.
5. A **SulyozottSzavazas** konstruktorában a token cím be van égetve a demó IGOV címére. Saját demóhoz szerkeszd át a konstruktorban a `IVotes(...)` címet a *te* tokenedre, fordítsd újra, majd deployold.
6. MetaMaskban hagyd jóvá a deploy tranzakciókat (gázdíj kell).

### Interakció Remixből

- Token: `mint` / `mintBatch` (csak owner).
- Szavazás: `createPoll`, `vote`, `changeVote`, `getPoll`, `votingPower`.
- Olvasáshoz a Remix „at address” mezőjébe beírhatod a fenti élő címeket is (ABI a lefordított kontraktból).

**Figyelem:** mainnet deploy valódi ETH-t költ. Gyakorláshoz használhatsz Base Sepolia tesztnetet is — akkor a frontend címeit és a hálózatot is át kell állítani.

---

## Fork és saját Pages demó

1. GitHubon: **Fork** erre a tárolóra.
2. A forkban állítsd a saját kontraktcímeidet az `app.js`-ben.
3. **Settings → Pages →** Source: Deploy from branch → `main` / root (vagy `/docs`, ha oda teszed).
4. Néhány perc múlva: `https://<felhasználó>.github.io/<repo-név>/`

Helyi kipróbálás: nyisd meg az `index.html`-t egy egyszerű HTTP szerverrel (pl. `npx serve .`), ne `file://` útvonalról, ha a böngésző korlátozza a bővítményeket.

---

## Gyakori hibák

| Üzenet / tünet | Mit jelent |
| --- | --- |
| „Nem található MetaMask” | Telepítsd a bővítményt, majd frissítsd az oldalt. |
| elutasítottad a MetaMaskban | A tranzakciót / kapcsolatot visszavontad — próbáld újra. |
| nincs elég ETH | Base-en kell gázdíj. |
| „ezt csak a token tulajdonosa teheti meg” | `mintBatch` / tanári művelet nem a te címedről megy. |
| szavazóerő 0 egy nyitott szavazáson | A snapshotkor még nem volt nálad token. |

---

## Licenc

Ez a tároló **[MIT](./LICENSE)** licenc alatt áll: szabadon másolható, módosítható, terjeszthető és kereskedelmi célra is használható, a copyright és a licencszöveg megtartásával. A szoftver „ahogy van” állapotú, garancia nélkül.

Oktatási demó: ne tárolj rajta jelentős értéket; a MetaMask kulcsaidért te felelsz.
