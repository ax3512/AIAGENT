"use strict";
const CFG = window.VOTE_CONFIG;
const $ = (id) => document.getElementById(id);

const NEED = CFG.pickCount || 3;
const selected = new Set();

$("needN").textContent = NEED;
$("needN2").textContent = NEED;

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
  const boxes = document.querySelectorAll("#options input[type=checkbox]");
  const full = selected.size >= NEED;
  boxes.forEach((b) => { if (!b.checked) b.disabled = full; });
  $("cnt").textContent = selected.size;
  refreshSubmit();
}

function refreshSubmit() {
  $("btnSubmit").disabled = !(selected.size === NEED && $("saban").value.trim());
}
$("saban").addEventListener("input", refreshSubmit);

async function submit() {
  const saban = $("saban").value.trim();
  if (!saban) { setStatus("사번을 입력하세요.", "err"); return; }
  if (selected.size !== NEED) { setStatus(`${NEED}개를 선택하세요.`, "err"); return; }

  // 같은 브라우저 중복 제출 방지(소프트)
  if (localStorage.getItem("voted_" + saban)) {
    setStatus("이미 이 기기에서 투표하셨습니다.", "err"); return;
  }

  $("btnSubmit").disabled = true;
  setStatus("제출 중...", "run");

  const choices = Array.from(selected);
  const payload = {
    access_key: CFG.web3key,
    subject: "[투표] " + saban,
    from_name: "AIAGENT 투표",
    "사번": saban,
    "선택1": choices[0],
    "선택2": choices[1],
    "선택3": choices[2],
  };

  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      localStorage.setItem("voted_" + saban, "1");
      showDone();
    } else {
      setStatus("제출 실패: " + (data.message || res.status), "err");
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
    '<p class="sub">참여해 주셔서 감사합니다.</p></div>';
}

function setStatus(msg, cls) {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (cls ? " " + cls : "");
}

(function init() {
  if (!CFG || !CFG.titles) { document.body.innerHTML = "config.js 오류"; return; }
  renderOptions();
  $("btnSubmit").addEventListener("click", submit);
})();
