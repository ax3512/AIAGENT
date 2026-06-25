"use strict";
const CFG = window.VOTE_CONFIG;
const $ = (id) => document.getElementById(id);

const NEED = CFG.pickCount || 3;
const selected = new Set();

// ── 초기 렌더 ────────────────────────────────────────────────────
$("needN").textContent = NEED;
$("needN2").textContent = NEED;

function ghToken() {
  try { return CFG.tokenB64 ? atob(CFG.tokenB64) : ""; } catch (e) { return ""; }
}

function apiBase() {
  return `https://api.github.com/repos/${CFG.owner}/${CFG.repo}`;
}

function ghHeaders() {
  const h = { "Accept": "application/vnd.github+json" };
  const t = ghToken();
  if (t) h["Authorization"] = "Bearer " + t;
  return h;
}

function renderOptions() {
  const box = $("options");
  box.innerHTML = "";
  CFG.titles.forEach((t, i) => {
    const row = document.createElement("label");
    row.className = "opt";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(i);
    cb.addEventListener("change", () => onToggle(cb, t));
    const span = document.createElement("span");
    span.textContent = t;
    row.appendChild(cb);
    row.appendChild(span);
    box.appendChild(row);
  });
}

function onToggle(cb, title) {
  if (cb.checked) selected.add(title);
  else selected.delete(title);

  // NEED 개 다 채우면 나머지 체크박스 비활성화 (최대 NEED 강제)
  const boxes = document.querySelectorAll("#options input[type=checkbox]");
  const full = selected.size >= NEED;
  boxes.forEach((b) => { if (!b.checked) b.disabled = full; });

  $("cnt").textContent = selected.size;
  $("btnSubmit").disabled = !(selected.size === NEED && $("saban").value.trim());
}

$("saban").addEventListener("input", () => {
  $("btnSubmit").disabled = !(selected.size === NEED && $("saban").value.trim());
});

// ── 제출 ─────────────────────────────────────────────────────────
async function submit() {
  const saban = $("saban").value.trim();
  if (!saban) { setStatus("사번을 입력하세요.", "err"); return; }
  if (selected.size !== NEED) { setStatus(`${NEED}개를 선택하세요.`, "err"); return; }
  if (!ghToken()) { setStatus("config.js 에 토큰(tokenB64)이 설정되지 않았습니다.", "err"); return; }

  $("btnSubmit").disabled = true;
  setStatus("제출 중...", "run");

  const key = saban.replace(/[^A-Za-z0-9_-]/g, "_");
  const path = `${CFG.votesDir}/${key}.json`;

  try {
    // 1) 이미 투표했는지 확인
    const check = await fetch(`${apiBase()}/contents/${path}?ref=${CFG.branch}`, {
      headers: ghHeaders(),
    });
    if (check.status === 200) {
      setStatus("이미 투표하셨습니다. (사번당 1회)", "err");
      return;
    }

    // 2) 저장 (votes/<사번>.json 새 파일 생성)
    const payload = {
      saban: saban,
      choices: Array.from(selected),
      ts: new Date().toISOString(),
    };
    const contentB64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
    const res = await fetch(`${apiBase()}/contents/${path}`, {
      method: "PUT",
      headers: ghHeaders(),
      body: JSON.stringify({
        message: `vote: ${key}`,
        content: contentB64,
        branch: CFG.branch,
      }),
    });

    if (res.status === 201) {
      showDone();
    } else if (res.status === 422) {
      setStatus("이미 투표하셨습니다. (사번당 1회)", "err");
    } else {
      const e = await res.json().catch(() => ({}));
      setStatus("제출 실패: " + (e.message || res.status), "err");
      $("btnSubmit").disabled = false;
    }
  } catch (e) {
    setStatus("네트워크 오류: " + e.message, "err");
    $("btnSubmit").disabled = false;
  }
}

function showDone() {
  document.querySelector(".wrap").innerHTML =
    '<div class="done"><div class="check">✓</div>' +
    "<h2>투표가 완료되었습니다.</h2>" +
    '<p class="sub">참여해 주셔서 감사합니다.</p>' +
    '<p class="foot"><a href="results.html">결과 보기</a></p></div>';
}

function setStatus(msg, cls) {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (cls ? " " + cls : "");
}

// ── 시작 ─────────────────────────────────────────────────────────
(function init() {
  if (!CFG || !CFG.titles) { document.body.innerHTML = "config.js 오류"; return; }
  document.title = "투표";
  renderOptions();
  $("btnSubmit").addEventListener("click", submit);
})();
