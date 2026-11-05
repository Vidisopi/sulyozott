// ── 1. Beállítások ──
const VOTING_ADDRESS = "0xB5129D4B11e5d687Bb3Ee77271C66E39d622EbD7"; // a SulyozottSzavazas contract címe
const TOKEN_ADDRESS = "0x01438AC36474DCCAc97d44F648bDa3c113E32Fbd"; // a SzavazoToken contract címe

const BASE = {
  chainId: 8453,
  chainIdHex: "0x2105",
  name: "Base",
  rpc: "https://mainnet.base.org",
  explorer: "https://basescan.org",
};

// ── 2. ABI: a két contract függvényei ──
const VOTING_ABI = [
  "function owner() view returns (address)",
  "function pollCount() view returns (uint256)",
  "function getPoll(uint256 pollId) view returns (string question, string[] options, uint256[] counts, uint256 snapshot, uint256 deadline, uint256 voterCount)",
  "function ballots(uint256 pollId, address voter) view returns (bool voted, bool changed, uint256 option, uint256 weight)",
  "function votingPower(uint256 pollId, address account) view returns (uint256)",
  "function createPoll(string question, string[] options, uint256 durationMinutes) returns (uint256)",
  "function vote(uint256 pollId, uint256 option)",
  "function changeVote(uint256 pollId, uint256 newOption)",
];

const TOKEN_ABI = [
  "function owner() view returns (address)",
  "function symbol() view returns (string)",
  "function getVotes(address account) view returns (uint256)",
  "function getPastTotalSupply(uint256 timepoint) view returns (uint256)",
  "function mintBatch(address[] to, uint256[] amounts)",
  "error OwnableUnauthorizedAccount(address account)",
];

// ── 3. Kapcsolat a lánccal ──
const publicProvider = new ethers.JsonRpcProvider(BASE.rpc, BASE.chainId, { staticNetwork: true });
let voting = new ethers.Contract(VOTING_ADDRESS, VOTING_ABI, publicProvider); // csak olvasásra
let token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, publicProvider);
let myAddress = null;
let isPollOwner = false;
let isTokenOwner = false;
let symbol = "IGOV";
let polls = [];
let busy = false;

// ── 4. MetaMask csatlakozás ──
async function connectWallet() {
  if (!window.ethereum) {
    showStatus("error", "Nem található MetaMask. Telepítsd a böngésződbe, majd töltsd újra az oldalt.");
    return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await switchToBase();

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    myAddress = await signer.getAddress();
    voting = new ethers.Contract(VOTING_ADDRESS, VOTING_ABI, signer); // olvasás + írás
    token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);

    // Tanár vagy diák? A contractok tulajdonosát hasonlítjuk össze a mi címünkkel.
    isPollOwner = sameAddress(await voting.owner(), myAddress);
    isTokenOwner = sameAddress(await token.owner(), myAddress);

    await refreshAll();
  } catch (err) {
    showStatus("error", readableError(err));
  }
}

function sameAddress(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

// ── 5. Hálózatváltás Base-re ──
async function switchToBase() {
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current === BASE.chainIdHex) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE.chainIdHex }],
    });
  } catch (err) {
    if (err.code !== 4902) throw err; // 4902: a MetaMask még nem ismeri a hálózatot
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: BASE.chainIdHex,
        chainName: BASE.name,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: [BASE.rpc],
        blockExplorerUrls: [BASE.explorer],
      }],
    });
  }
}

// ── 6. Beolvasás: szavazóerő és szavazások ──
async function refreshAll() {
  await Promise.all([loadMyPower(), loadPolls()]);
}

async function loadMyPower() {
  if (!myAddress) return renderSide(null);
  const power = Number(await token.getVotes(myAddress)); // a mostani szavazóerő
  renderSide(power);
}

async function loadPolls() {
  try {
    const count = Number(await voting.pollCount());
    const ids = [];
    for (let id = count - 1; id >= 0; id--) ids.push(id); // a legújabb legyen elöl

    polls = await Promise.all(ids.map(async (id) => {
      const p = await voting.getPoll(id);
      const totalPower = await token.getPastTotalSupply(p.snapshot); // az összes token a pillanatképkor
      const ballot = myAddress ? await voting.ballots(id, myAddress) : null;
      const myPower = myAddress ? await voting.votingPower(id, myAddress) : 0n;
      return {
        id,
        question: p.question,
        options: [...p.options],
        counts: p.counts.map(Number),
        snapshot: Number(p.snapshot),
        deadline: Number(p.deadline),
        voterCount: Number(p.voterCount),
        totalPower: Number(totalPower),
        myPower: Number(myPower),
        voted: ballot ? ballot.voted : false,
        changed: ballot ? ballot.changed : false,
        myOption: ballot ? Number(ballot.option) : null,
      };
    }));
    renderPolls();
  } catch (err) {
    showStatus("error", "Nem sikerült beolvasni a szavazásokat: " + readableError(err));
  }
}

// ── 7. Írás: tranzakciók ──
async function distributeTokens(addresses, amounts) {
  return sendTx("Tokenek kiosztása", () => token.mintBatch(addresses, amounts));
}

async function createPoll(question, options, minutes) {
  return sendTx("Szavazás indítása", () => voting.createPoll(question, options, minutes));
}

async function castVote(pollId, option) {
  return sendTx("Szavazat leadása", () => voting.vote(pollId, option));
}

async function changeVote(pollId, option) {
  return sendTx("Szavazat módosítása", () => voting.changeVote(pollId, option));
}

async function sendTx(label, txFunction) {
  if (!myAddress) {
    showStatus("error", "Előbb csatlakoztasd a MetaMaskot.");
    return false;
  }
  setBusy(true);
  try {
    showStatus("wait", label + ": hagyd jóvá a MetaMaskban…");
    const tx = await txFunction();
    showStatus("wait", label + ": elküldve, a blokkba kerülésre vár…", tx.hash);
    await tx.wait();
    await refreshAll();
    showStatus("ok", label + ": sikeres, bekerült a blokkláncba.", tx.hash);
    return true;
  } catch (err) {
    showStatus("error", label + ": " + readableError(err));
    return false;
  } finally {
    setBusy(false);
  }
}

// ── 8. Érthető hibaüzenetek ──
function readableError(err) {
  if (err.code === "ACTION_REJECTED" || err.code === 4001) return "elutasítottad a MetaMaskban.";
  if (err.code === "INSUFFICIENT_FUNDS") return "nincs elég ETH a tranzakciós díjra.";
  if (err.reason) return "a contract visszautasította: „" + err.reason + "”";
  if (err.revert && err.revert.name === "OwnableUnauthorizedAccount") return "ezt csak a token tulajdonosa teheti meg.";
  return err.shortMessage || err.message || String(err);
}

// ── 9. Tokenlista beolvasása a kvízeredményekből ──
function parseDistribution(text) {
  const addresses = [];
  const amounts = [];
  const errors = [];
  text.split("\n").forEach((line, i) => {
    const clean = line.trim();
    if (!clean) return; // üres sor
    const parts = clean.split(/[\s,;]+/); // vessző, pontosvessző, tab vagy szóköz választhatja el
    const address = parts[0];
    const amount = Number(parts[1]);
    if (!ethers.isAddress(address)) errors.push((i + 1) + ". sor: hibás cím");
    else if (!Number.isInteger(amount) || amount <= 0) errors.push((i + 1) + ". sor: a pontszám pozitív egész legyen");
    else { addresses.push(address); amounts.push(amount); }
  });
  return { addresses, amounts, errors };
}

// ── 10. Megjelenítés ──
function esc(text) {
  // Bármilyen láncról jövő szöveget csak így illesztünk be, sosem nyers HTML-ként.
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function shortAddress(address) {
  return address.slice(0, 6) + "…" + address.slice(-4);
}

function timeLeft(deadline) {
  let s = deadline - Math.floor(Date.now() / 1000);
  if (s <= 0) return null;
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  if (d > 0) return d + " nap " + h + " óra";
  if (h > 0) return h + " óra " + m + " perc";
  return m + ":" + String(s).padStart(2, "0");
}

function renderSide(power) {
  document.getElementById("teacher").hidden = !(isPollOwner || isTokenOwner);
  document.getElementById("distribute-card").hidden = !isTokenOwner;
  document.getElementById("create-card").hidden = !isPollOwner;
  document.getElementById("student").hidden = isPollOwner;
  if (myAddress) {
    document.getElementById("connect").hidden = true;
    document.getElementById("wallet").hidden = false;
    const a = document.getElementById("wallet-addr");
    a.textContent = shortAddress(myAddress);
    a.href = BASE.explorer + "/address/" + myAddress;
    document.getElementById("wallet-power").textContent = power + " " + symbol;
    document.getElementById("my-power").textContent = power + " " + symbol;
  }
}

function renderPolls() {
  const list = document.getElementById("polls");
  document.getElementById("poll-count").textContent = polls.length;
  if (polls.length === 0) {
    list.innerHTML = `<p class="empty">Még nincs szavazás. A tanár indítja őket.</p>`;
    return;
  }
  list.innerHTML = polls.map(pollCard).join("");
  if (busy) list.querySelectorAll("button").forEach((b) => { b.disabled = true; });
}

function pollCard(p) {
  const open = timeLeft(p.deadline) !== null;
  const counted = p.counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...p.counts);
  const turnout = p.totalPower ? Math.round((counted / p.totalPower) * 100) : 0;

  let hint = "";
  if (!open) hint = "A szavazás lezárult.";
  else if (!myAddress) hint = "Csatlakozz a MetaMaskkal a szavazáshoz.";
  else if (p.myPower === 0) hint = "A szavazás indításakor nem volt tokened, ezért itt nem szavazhatsz.";
  else if (!p.voted) hint = "Válassz egy opciót. Mind a " + p.myPower + " tokened erre megy.";
  else if (!p.changed) hint = "Egyszer még átszavazhatsz másik opcióra.";
  else hint = "Már módosítottad a szavazatodat, ez a végleges.";

  const canAct = open && myAddress && p.myPower > 0;
  const rows = p.options.map((opt, i) => {
    const pct = counted ? Math.round((p.counts[i] / counted) * 100) : 0;
    const isMine = p.voted && p.myOption === i;
    const leader = !open && counted > 0 && p.counts[i] === max;
    let action = "";
    if (canAct) {
      if (!p.voted) action = `<button class="opt-btn" data-act="vote" data-poll="${p.id}" data-opt="${i}">Szavazok</button>`;
      else if (!p.changed && !isMine) action = `<button class="opt-btn ghost" data-act="change" data-poll="${p.id}" data-opt="${i}">Átszavazok</button>`;
    }
    return `<li class="opt${isMine ? " mine" : ""}">
      <div class="opt-top">
        <span class="opt-name">${esc(opt)}${isMine ? ` <span class="tag">a te szavazatod</span>` : ""}${leader ? ` <span class="tag win">nyertes</span>` : ""}</span>
        <span class="opt-num">${p.counts[i]} <small>${symbol} · ${pct}%</small></span>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${action}
    </li>`;
  }).join("");

  return `<article class="poll">
    <header class="poll-head">
      <span class="pid">#${p.id}</span>
      <span class="state ${open ? "open" : "closed"}" data-deadline="${p.deadline}">${open ? "Nyitott · " + timeLeft(p.deadline) : "Lezárult"}</span>
    </header>
    <h3>${esc(p.question)}</h3>
    <p class="meta">${p.voterCount} szavazó · leadva ${counted} / ${p.totalPower} ${symbol} (${turnout}%) · pillanatkép: <a href="${BASE.explorer}/block/${p.snapshot}" target="_blank" rel="noopener">#${p.snapshot}. blokk</a></p>
    ${myAddress ? `<p class="power">A szavazóerőd ebben a szavazásban: <b>${p.myPower} ${symbol}</b></p>` : ""}
    <ul class="opts">${rows}</ul>
    <p class="hint">${hint}</p>
  </article>`;
}

function showStatus(kind, message, txHash) {
  const box = document.getElementById("status");
  box.className = "status " + kind;
  box.hidden = false;
  document.getElementById("status-text").innerHTML = esc(message) +
    (txHash ? ` <a href="${BASE.explorer}/tx/${txHash}" target="_blank" rel="noopener">Megnézem a Basescanen ↗</a>` : "");
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("button").forEach((b) => { if (b.id !== "status-close") b.disabled = value; });
  if (!value) updateOptionControls();
}

// ── 11. Űrlapok és gombok ──
function addOptionInput(value = "") {
  const box = document.getElementById("options");
  if (box.children.length >= 8) return;
  const row = document.createElement("div");
  row.className = "opt-input";
  row.innerHTML = `<input type="text" maxlength="64" placeholder="${box.children.length + 1}. opció" required>
    <button type="button" class="remove" aria-label="Opció törlése">×</button>`;
  row.querySelector("input").value = value;
  row.querySelector(".remove").onclick = () => {
    if (box.children.length > 2) row.remove();
    updateOptionControls();
  };
  box.appendChild(row);
  updateOptionControls();
}

function updateOptionControls() {
  const box = document.getElementById("options");
  document.getElementById("add-option").disabled = box.children.length >= 8;
  [...box.querySelectorAll("input")].forEach((inp, i) => { inp.placeholder = (i + 1) + ". opció"; });
}

function byteLength(text) {
  return new TextEncoder().encode(text).length; // az ékezetes betű 2 bájt
}

document.getElementById("dist-list").addEventListener("input", (e) => {
  const { addresses, amounts, errors } = parseDistribution(e.target.value);
  const sum = amounts.reduce((a, b) => a + b, 0);
  document.getElementById("dist-preview").textContent = errors.length
    ? errors.join(" · ")
    : addresses.length + " cím, összesen " + sum + " " + symbol;
  document.getElementById("dist-preview").className = "preview" + (errors.length ? " bad" : "");
});

document.getElementById("distribute-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { addresses, amounts, errors } = parseDistribution(document.getElementById("dist-list").value);
  if (errors.length) return showStatus("error", "Javítsd a listát: " + errors.join(", "));
  if (addresses.length === 0) return showStatus("error", "Adj meg legalább egy címet és pontszámot.");
  const ok = await distributeTokens(addresses, amounts);
  if (ok) {
    e.target.reset();
    document.getElementById("dist-preview").textContent = "";
  }
});

document.getElementById("create-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("question").value.trim();
  const options = [...document.querySelectorAll("#options input")].map((i) => i.value.trim()).filter(Boolean);
  const minutes = Number(document.getElementById("duration").value);

  if (byteLength(question) > 200) return showStatus("error", "A kérdés túl hosszú (legfeljebb 200 bájt).");
  if (options.length < 2) return showStatus("error", "Adj meg legalább 2 opciót.");
  if (options.some((o) => byteLength(o) > 64)) return showStatus("error", "Egy opció legfeljebb 64 bájt lehet.");

  const ok = await createPoll(question, options, minutes);
  if (ok) {
    e.target.reset();
    document.getElementById("options").innerHTML = "";
    addOptionInput(); addOptionInput();
  }
});

document.getElementById("add-option").addEventListener("click", () => addOptionInput());
document.getElementById("connect").addEventListener("click", connectWallet);
document.getElementById("refresh").addEventListener("click", refreshAll);
document.getElementById("status-close").addEventListener("click", () => { document.getElementById("status").hidden = true; });

document.getElementById("polls").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const pollId = Number(btn.dataset.poll);
  const option = Number(btn.dataset.opt);
  if (btn.dataset.act === "vote") castVote(pollId, option);
  else changeVote(pollId, option);
});

// ── 12. Indulás ──
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}

setInterval(() => {
  document.querySelectorAll(".state[data-deadline]").forEach((el) => {
    const left = timeLeft(Number(el.dataset.deadline));
    if (left) el.textContent = "Nyitott · " + left;
    else if (el.classList.contains("open")) renderPolls();
  });
}, 1000);

setInterval(loadPolls, 20000); // 20 másodpercenként új adatok a láncról

addOptionInput(); addOptionInput();
const EMPTY = "0x0000000000000000000000000000000000000000";
if (VOTING_ADDRESS === EMPTY || TOKEN_ADDRESS === EMPTY) {
  showStatus("error", "Az app.js-ben még nincs beállítva mindkét contract címe (VOTING_ADDRESS, TOKEN_ADDRESS).");
} else {
  token.symbol().then((s) => { symbol = s; }).catch(() => {});
  loadPolls();
}
