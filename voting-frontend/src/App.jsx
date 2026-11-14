import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import VotingABI from "./abi/Voting.json";
import { CONTRACT_ADDRESS, DEPLOYMENT_BLOCK } from "./config";
import "./App.css";

const EXPECTED_CHAIN_ID = 31337;
const LOCAL_RPC_URL = "http://127.0.0.1:8545";

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
}

function formatDate(timestamp) {
  return timestamp ? new Date(Number(timestamp) * 1000).toLocaleString() : "Memuat…";
}

function errorMessage(error) {
  if (error?.code === 4001) return "Transaksi dibatalkan di MetaMask.";
  return error?.error?.message || error?.reason || error?.data?.message || error?.message || "Terjadi kesalahan.";
}

function VoterChart({ events }) {
  const data = useMemo(() => {
    const byDay = new Map();
    events.forEach((event) => {
      const date = new Date(event.timestamp * 1000);
      const key = date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
      byDay.set(key, (byDay.get(key) || 0) + 1);
    });
    return [...byDay.entries()].map(([label, count]) => ({ label, count }));
  }, [events]);

  const width = 640;
  const height = 240;
  const left = 42;
  const right = 14;
  const top = 18;
  const bottom = 42;
  const chartHeight = height - top - bottom;
  const max = Math.max(1, ...data.map((item) => item.count));
  const slotWidth = data.length ? (width - left - right) / data.length : 0;

  return (
    <div className="chart-wrap">
      {data.length ? (
        <svg className="voter-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Jumlah voter per hari">
          {[0, 0.5, 1].map((fraction) => {
            const y = top + chartHeight * fraction;
            return <g key={fraction}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="chart-gridline" />
              <text x={left - 12} y={y + 4} textAnchor="end" className="chart-axis-label">{Math.ceil(max * (1 - fraction))}</text>
            </g>;
          })}
          {data.map((item, index) => {
            const barWidth = Math.min(34, slotWidth * 0.48);
            const barHeight = Math.max(4, (item.count / max) * chartHeight);
            const x = left + index * slotWidth + (slotWidth - barWidth) / 2;
            const y = top + chartHeight - barHeight;
            return <g key={item.label}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="5" className="chart-bar" />
              <text x={x + barWidth / 2} y={y - 7} textAnchor="middle" className="chart-value">{item.count}</text>
              <text x={x + barWidth / 2} y={height - 17} textAnchor="middle" className="chart-axis-label">{item.label}</text>
            </g>;
          })}
        </svg>
      ) : (
        <div className="chart-empty"><span className="chart-empty-mark">↗</span><strong>Grafik menunggu suara pertama</strong><span>Jumlah voter per hari akan muncul di sini.</span></div>
      )}
      <div className="chart-legend"><span className="chart-legend-dot" />Voter baru per hari</div>
    </div>
  );
}

function App() {
  const [candidates, setCandidates] = useState([]);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [owner, setOwner] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [totalVotes, setTotalVotes] = useState("0");
  const [history, setHistory] = useState([]);
  const [candidateName, setCandidateName] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState("user");

  const votingState = useMemo(() => {
    if (!startTime || !endTime) return "Memuat status voting…";
    if (now < startTime) return `Dimulai ${formatDate(startTime)}`;
    if (now >= endTime) return "Voting telah berakhir";
    return `Berakhir ${formatDate(endTime)}`;
  }, [endTime, now, startTime]);
  const votingOpen = startTime > 0 && now >= startTime && now < endTime;
  const totalVotesNumber = Number(totalVotes);
  const isOwner = Boolean(account && owner && account.toLowerCase() === owner.toLowerCase());
  const candidatesLocked = totalVotesNumber > 0 || now >= endTime;
  const otherVoters = Math.max(0, totalVotesNumber - (hasVoted ? 1 : 0));

  const refreshData = useCallback(async (provider, activeAccount) => {
    const readContract = new ethers.Contract(CONTRACT_ADDRESS, VotingABI.abi, provider);
    const [candidateRows, contractOwner, start, end, votes] = await Promise.all([
      readContract.getCandidates(),
      readContract.owner(),
      readContract.votingStartTime(),
      readContract.votingEndTime(),
      readContract.totalVotes(),
    ]);

    setCandidates(candidateRows.map((candidate, index) => ({
      id: index,
      name: candidate.name,
      voteCount: candidate.voteCount.toString(),
    })));
    setOwner(contractOwner);
    setStartTime(start.toNumber());
    setEndTime(end.toNumber());
    setTotalVotes(votes.toString());
    setHasVoted(activeAccount ? await readContract.hasVoted(activeAccount) : false);

    const latestBlock = await provider.getBlockNumber();
    const events = await readContract.queryFilter(
      readContract.filters.VoteCast(),
      Number(DEPLOYMENT_BLOCK || 0),
      latestBlock
    );
    setHistory(events.map((event) => ({
      voter: event.args.voter,
      candidateIndex: event.args.candidateIndex.toNumber(),
      timestamp: event.args.timestamp.toNumber(),
      transactionHash: event.transactionHash,
    })));
  }, []);

  const initialize = useCallback(async (requestAccess = false) => {
    try {
      let provider;
      let accounts = [];
      if (window.ethereum) {
        const walletProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
        accounts = await walletProvider.send(requestAccess ? "eth_requestAccounts" : "eth_accounts", []);
        const network = await walletProvider.getNetwork();
        setChainId(network.chainId);
        provider = new ethers.providers.JsonRpcProvider(LOCAL_RPC_URL);
      } else {
        provider = new ethers.providers.JsonRpcProvider(LOCAL_RPC_URL);
        const network = await provider.getNetwork();
        setChainId(network.chainId);
      }

      const activeAccount = accounts[0] || null;
      setAccount(activeAccount);
      setConnected(Boolean(activeAccount));
      await refreshData(provider, activeAccount);
      setNotice(null);
    } catch (error) {
      setNotice({ type: "error", message: errorMessage(error) });
    }
  }, [refreshData]);

  useEffect(() => {
    initialize();
    const clockTimer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    const refreshTimer = window.setInterval(() => initialize(), 6000);
    if (!window.ethereum?.on) return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
    };

    const handleAccountsChanged = () => initialize();
    const handleChainChanged = () => initialize();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [initialize]);

  const submitTransaction = async (action, successMessage) => {
    if (!window.ethereum || !account) {
      setNotice({ type: "error", message: "Hubungkan MetaMask terlebih dahulu." });
      return false;
    }
    if (chainId !== EXPECTED_CHAIN_ID) {
      setNotice({ type: "error", message: "Pilih jaringan Hardhat Local (Chain ID 31337) di MetaMask." });
      return false;
    }

    try {
      setBusy(true);
      setNotice({ type: "pending", message: "Menunggu konfirmasi transaksi di MetaMask…" });
      const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      const writeContract = new ethers.Contract(CONTRACT_ADDRESS, VotingABI.abi, provider.getSigner());
      const transaction = await action(writeContract);
      setNotice({ type: "pending", message: "Transaksi dikirim. Menunggu konfirmasi blockchain…" });
      await transaction.wait();
      await initialize();
      setNotice({ type: "success", message: successMessage });
      return true;
    } catch (error) {
      setNotice({ type: "error", message: errorMessage(error) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleVote = async (candidateId) => {
    const displayedCandidate = candidates.find((candidate) => candidate.id === candidateId);
    if (!displayedCandidate) return;
    if (!connected || !account) {
      setNotice({ type: "error", message: "Hubungkan MetaMask terlebih dahulu." });
      return;
    }
    if (chainId !== EXPECTED_CHAIN_ID) {
      setNotice({ type: "error", message: "Pilih jaringan Hardhat Local (Chain ID 31337) di MetaMask." });
      return;
    }

    try {
      const walletProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
      const localProvider = new ethers.providers.JsonRpcProvider(LOCAL_RPC_URL);
      const walletContract = new ethers.Contract(CONTRACT_ADDRESS, VotingABI.abi, walletProvider);
      const localContract = new ethers.Contract(CONTRACT_ADDRESS, VotingABI.abi, localProvider);
      const [walletCandidate, localCandidate, walletOwner, localOwner, walletStart, localStart] = await Promise.all([
        walletContract.candidates(candidateId),
        localContract.candidates(candidateId),
        walletContract.owner(),
        localContract.owner(),
        walletContract.votingStartTime(),
        localContract.votingStartTime(),
      ]);
      if (
        localCandidate.name !== displayedCandidate.name ||
        walletCandidate.name !== localCandidate.name ||
        walletOwner.toLowerCase() !== localOwner.toLowerCase() ||
        !walletStart.eq(localStart)
      ) {
        await initialize();
        setNotice({ type: "error", message: "Jaringan MetaMask berbeda dari Hardhat Node yang dipakai aplikasi. Periksa RPC URL MetaMask harus http://127.0.0.1:8545, lalu muat ulang halaman." });
        return;
      }

      const confirmed = window.confirm(`Kamu akan memilih: ${localCandidate.name}\n\nPastikan nama ini benar sebelum menyetujui transaksi di MetaMask.`);
      if (!confirmed) return;

      await submitTransaction(
        (contract) => contract.vote(candidateId),
        `Suara untuk ${localCandidate.name} berhasil dicatat di blockchain.`
      );
    } catch (error) {
      setNotice({ type: "error", message: errorMessage(error) });
    }
  };

  const handleAddCandidate = async (event) => {
    event.preventDefault();
    const name = candidateName.trim();
    if (!name) {
      setNotice({ type: "error", message: "Masukkan nama kandidat terlebih dahulu." });
      return;
    }
    const added = await submitTransaction((contract) => contract.addCandidate(name), "Kandidat berhasil ditambahkan.");
    if (added) setCandidateName("");
  };

  const displayedMode = mode;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Voting Chain beranda">
          <span className="brand-mark">V</span><span>Voting Chain</span>
        </a>
        <div className="topbar-actions">
          {account && <span className="wallet-address" title={account}>{shortAddress(account)}</span>}
          <button className="button button-dark" onClick={() => initialize(true)} disabled={busy}>
            {connected ? "Perbarui wallet" : "Hubungkan MetaMask"}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">VOTING TERDESENTRALISASI</p>
          <h1>Satu suara.<br /><span>Terbuka dan tercatat.</span></h1>
          <p className="hero-description">Pilih kandidat pilihanmu. Setiap suara tersimpan di blockchain lokal dan dapat diverifikasi.</p>
          <div className="hero-meta"><span className={`status-dot ${votingOpen ? "is-live" : ""}`} /><span>{votingState}</span></div>
        </div>
        <div className="hero-card">
          <span className="hero-card-label">TOTAL VOTER</span>
          <strong>{totalVotes}</strong>
          <span className="hero-card-foot">wallet telah memberikan suara</span>
          <span className="hero-card-check" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-9" /></svg></span>
        </div>
      </section>

      <section className="connection-strip">
        <div><span className="strip-label">JARINGAN</span><strong>{chainId === EXPECTED_CHAIN_ID ? "Hardhat Local · 31337" : chainId ? `Chain ID ${chainId} · tidak sesuai` : "Belum terdeteksi"}</strong></div>
        <div className="contract-address"><span className="strip-label">KONTRAK</span><code title={CONTRACT_ADDRESS}>{shortAddress(CONTRACT_ADDRESS)}</code></div>
        <span className={`connection-state ${connected && chainId === EXPECTED_CHAIN_ID ? "connected" : ""}`}><i />{connected ? "Wallet terhubung" : "Mode baca"}</span>
      </section>

      {notice && <div className={`notice notice-${notice.type}`} role="status">{notice.message}</div>}

      <nav className="mode-switch" aria-label="Mode aplikasi">
        <button className={displayedMode === "user" ? "active" : ""} onClick={() => setMode("user")}>Mode User</button>
        <button className={displayedMode === "admin" ? "active" : ""} onClick={() => setMode("admin")}>Mode Admin <span className="admin-pill">OWNER</span></button>
      </nav>

      {displayedMode === "user" ? (
        <section className="user-view">
          <div className="user-summary">
            <article className="summary-card"><span className="summary-icon summary-icon-green">◎</span><div><span>Total voter</span><strong>{totalVotes}</strong></div></article>
            <article className="summary-card"><span className="summary-icon summary-icon-sand">↗</span><div><span>Voter lain</span><strong>{otherVoters}</strong></div></article>
            <article className="summary-card summary-status"><span className={`status-dot ${hasVoted ? "is-live" : ""}`} /><div><span>Status wallet ini</span><strong>{hasVoted ? "Sudah voting" : connected ? "Belum voting" : "Belum terhubung"}</strong></div></article>
          </div>
          <div className="section-heading"><div><p className="eyebrow">PEMILIHAN</p><h2>Pilih kandidat</h2></div><span className="candidate-count">{candidates.length} kandidat</span></div>
          <div className="candidate-list">
            {candidates.map((candidate, index) => {
              const count = Number(candidate.voteCount);
              const percent = totalVotesNumber ? (count / totalVotesNumber) * 100 : 0;
              const disabled = !connected || chainId !== EXPECTED_CHAIN_ID || !votingOpen || hasVoted || busy;
              return <article className="candidate-card" key={candidate.id}>
                <div className="candidate-topline"><span className="candidate-number">{String(index + 1).padStart(2, "0")}</span><div className="candidate-identity"><h3>{candidate.name}</h3><span>{count} suara · {percent.toFixed(1)}%</span></div>
                  <button className="button button-vote" disabled={disabled} onClick={() => handleVote(candidate.id)}>{hasVoted ? "Sudah memilih" : !connected ? "Hubungkan wallet" : "Pilih kandidat"}<span className="vote-arrow" aria-hidden="true">↗</span></button>
                </div><div className="result-track"><span style={{ width: `${percent}%` }} /></div>
              </article>;
            })}
            {!candidates.length && <p className="empty-state">Memuat kandidat dari kontrak…</p>}
          </div>
          <p className="user-footnote">Jumlah voter lain tidak menampilkan identitas wallet mereka.</p>
        </section>
      ) : (
        <section className="admin-view">
          {!isOwner ? (
            <div className="admin-access-card">
              <span className="access-lock" aria-hidden="true">⌑</span>
              <p className="eyebrow">AKSES ADMIN</p>
              <h2>Hubungkan wallet owner</h2>
              <p>Menu admin hanya dapat digunakan oleh wallet yang membuat kontrak. Wallet owner kontrak ini:</p>
              <code>{owner || "Belum tersedia"}</code>
              <button className="button button-dark" onClick={() => initialize(true)} disabled={busy}>Pilih / hubungkan wallet</button>
              <p className="access-note">Kamu tetap dapat melihat hasil voting di Mode User.</p>
            </div>
          ) : <>
          <div className="admin-heading"><div><p className="eyebrow">RUANG KENDALI OWNER</p><h2>Dashboard admin</h2><p>Pantau partisipasi dan kelola kandidat pemilihan.</p></div><span className="admin-owner-badge"><span className="owner-check">✓</span>Owner terverifikasi</span></div>
          <div className="admin-toolbar"><div><strong>Hasil pemilihan</strong><span>Siap dicetak atau disimpan sebagai PDF.</span></div><button className="button button-print" onClick={() => window.print()}><span aria-hidden="true">▤</span> Cetak hasil</button></div>
          <div className="print-heading"><p>HASIL PEMILIHAN</p><h1>Voting Blockchain</h1><span>Kontrak {CONTRACT_ADDRESS}</span></div>
          <div className="admin-stats">
            <article className="admin-stat-card"><span>Total voter</span><strong>{totalVotes}</strong><small>alamat wallet sudah memilih</small></article>
            <article className="admin-stat-card"><span>Kandidat</span><strong>{candidates.length}</strong><small>terdaftar pada kontrak</small></article>
            <article className="admin-stat-card"><span>Status voting</span><strong className="admin-stat-status">{votingOpen ? "Berlangsung" : now >= endTime ? "Selesai" : "Akan dimulai"}</strong><small>{votingState}</small></article>
          </div>
          <div className="admin-dashboard-grid">
            <section className="admin-card chart-card"><div className="admin-card-heading"><div><p className="eyebrow">PARTISIPASI</p><h3>Grafik voter</h3></div><span className="chart-total"><strong>{totalVotes}</strong> total</span></div><VoterChart events={history} /></section>
            <section className="admin-card candidate-admin-card"><div className="admin-card-heading"><div><p className="eyebrow">PENGELOLAAN</p><h3>Kandidat</h3></div><span className="candidate-count">{candidates.length} terdaftar</span></div>
              <div className="admin-candidate-list">{candidates.map((candidate, index) => <div className="admin-candidate-row" key={candidate.id}><span className="candidate-number">{String(index + 1).padStart(2, "0")}</span><strong>{candidate.name}</strong><span>{candidate.voteCount} suara</span></div>)}</div>
              <form className="admin-add-form" onSubmit={handleAddCandidate}><label htmlFor="candidate-name">Tambah nama kandidat</label><div className="admin-form-row"><input id="candidate-name" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="Masukkan nama" maxLength={80} disabled={busy || candidatesLocked} /><button className="button button-dark" disabled={busy || candidatesLocked}>Tambah nama</button></div><small>{candidatesLocked ? "Penambahan terkunci setelah suara pertama masuk atau voting berakhir." : "Kandidat dapat ditambahkan sampai suara pertama masuk."}</small></form>
            </section>
          </div>
          <section className="admin-card voter-table-card"><div className="admin-card-heading"><div><p className="eyebrow">AKTIVITAS ON-CHAIN</p><h3>Voter terbaru</h3></div><span className="live-label"><i /> diperbarui otomatis</span></div>
            {history.length ? <div className="voter-table-wrap"><table className="voter-table"><thead><tr><th>Wallet</th><th>Kandidat</th><th>Waktu</th><th>Transaksi</th></tr></thead><tbody>{history.slice(-8).reverse().map((item) => <tr key={item.transactionHash}><td><span className="table-check">✓</span><code>{shortAddress(item.voter)}</code></td><td>{candidates[item.candidateIndex]?.name || `Kandidat ${item.candidateIndex + 1}`}</td><td>{formatDate(item.timestamp)}</td><td><code title={item.transactionHash}>{item.transactionHash.slice(0, 10)}…</code></td></tr>)}</tbody></table></div> : <div className="table-empty">Belum ada voter. Aktivitas akan muncul setelah transaksi pertama.</div>}
          </section>
          </>}
        </section>
      )}

      <footer className="footer"><span>Voting Chain · Demo blockchain lokal</span><span>Smart contract · Hardhat Local</span></footer>
    </main>
  );
}

export default App;
