"use strict";
const CFG = window.VOTE_CONFIG;
const $ = (id) => document.getElementById(id);

let lastVotes = [];

function ghToken() {
  try { return CFG.tokenB64 ? atob(CFG.tokenB64) : ""; } catch (e) { return ""; }
}
function ghHeaders() {
  const h = { "Accept": "application/vnd.github+json" };
  const t = ghToken();
  if (t) h["Authorization"] = "Bearer " + t;
  return h;
}
function apiBase() {
  return `https://api.github.com/repos/${CFG.owner}/${CFG.repo}`;
}

async function load() {
  setStatus("불러오는 중...", "run");
  try {
    // votes 폴더 목록
    const listRes = await fetch(`${apiBase()}/contents/${CFG.votesDir}?ref=${CFG.branch}`, {
      headers: ghHeaders(),
    });
    if (listRes.status === 404) {
      setStatus("아직 투표가 없습니다.", "");
      render([], {});
      return;
    }
    if (!listRes.ok) {
      const e = await listRes.json().catch(() => ({}));
      setStatus("불러오기 실패: " + (e.message || listRes.status), "err");
      return;
    }
    const files = (await listRes.json()).filter(
      (f) => f.type === "file" && f.name.endsWith(".json")
    );

    // 각 파일 내용 읽기 (병렬)
    const votes = await Promise.all(files.map(async (f) => {
      try {
        const r = await fetch(f.url, { headers: ghHeaders() });
        const j = await r.json();
        const txt = decodeURIComponent(escape(atob(j.content || "")));
        return JSON.parse(txt);
      } catch (e) { return null; }
    }));

    const valid = votes.filter(Boolean);
    lastVotes = valid;

    // 집계
    const tally = {};
    CFG.titles.forEach((t) => (tally[t] = 0));
    valid.forEach((v) => (v.choices || []).forEach((c) => {
      tally[c] = (tally[c] || 0) + 1;
    }));

    render(valid, tally);
    setStatus("최신 상태", "");
  } catch (e) {
    setStatus("오류: " + e.message, "err");
  }
}

function render(votes, tally) {
  $("total").textContent = votes.length;
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  const box = $("bars");
  box.innerHTML = "";
  entries.forEach(([title, cnt], i) => {
    const row = document.createElement("div");
    row.className = "barrow";
    const label = document.createElement("div");
    label.className = "barlabel";
    label.textContent = `${i + 1}. ${title}`;
    const track = document.createElement("div");
    track.className = "bartrack";
    const fill = document.createElement("div");
    fill.className = "barfill";
    fill.style.width = (cnt / max * 100) + "%";
    fill.textContent = cnt;
    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(track);
    box.appendChild(row);
  });
}

function downloadCsv() {
  if (!lastVotes.length) return;
  let csv = "﻿사번,선택1,선택2,선택3,시간\n";
  lastVotes.forEach((v) => {
    const c = v.choices || [];
    const cell = (x) => '"' + String(x || "").replace(/"/g, '""') + '"';
    csv += [cell(v.saban), cell(c[0]), cell(c[1]), cell(c[2]), cell(v.ts)].join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vote-results.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function setStatus(msg, cls) {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (cls ? " " + cls : "");
}

$("btnReload").addEventListener("click", load);
$("btnCsv").addEventListener("click", downloadCsv);
load();
