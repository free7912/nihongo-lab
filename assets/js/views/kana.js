import { KANA_GROUPS, flattenGroup, cellsOf, maxWidth } from "../kana-data.js";
import { kanaStats, getSettings, setSetting } from "../store.js";
import { escapeHtml } from "../util.js";
import { hasJapaneseVoice, speak, speechSupported } from "../speech.js";

export default async function mount(root) {
  const settings = getSettings();
  let script = settings.kanaScript || "kana"; // kana=平假名 kata=片假名
  let showRomaji = settings.showRomaji !== false;

  function paint() {
    const stats = kanaStats();
    const weak = new Set(stats.weak.map((w) => w.kana));
    const label = script === "kana" ? "平假名" : "片假名";

    root.innerHTML = `
      <h1>五十音图</h1>
      <p style="color:var(--muted)">${label}共 104 个音（含浊音、拗音）。点击任意格子听发音。</p>
      ${
        speechSupported() && !hasJapaneseVoice()
          ? `<p class="tag" style="display:inline-block;margin-bottom:10px">提示：系统里没找到日语语音包，发音可能不准。Windows 可在「设置 → 时间和语言 → 语音」添加日语。</p>`
          : ""
      }

      <div class="card tight" style="position:sticky;top:57px;z-index:10;margin:14px 0">
        <div class="row">
          <div class="chips">
            <button class="btn sm ${script === "kana" ? "active" : ""}" data-script="kana">平假名</button>
            <button class="btn sm ${script === "kata" ? "active" : ""}" data-script="kata">片假名</button>
          </div>
          <span class="spacer"></span>
          <label class="check"><input type="checkbox" id="romaji-toggle" ${showRomaji ? "checked" : ""}> 显示罗马字</label>
          <button class="btn sm" id="speak-all" title="只读元音行">▶ 逐个朗读</button>
        </div>
      </div>

      ${KANA_GROUPS.map((group) => {
        const cells = flattenGroup(group, script);
        const kept = [];
        for (const row of group.rows) {
          const chars = cellsOf(row[script]);
          const rowCells = chars.map((ch, i) => {
            const r = row.romaji[i];
            if (!r || !ch.trim()) return `<div class="kana-cell gap"></div>`;
            return `<button class="kana-cell ${weak.has(ch) ? "weak" : ""}" data-kana="${escapeHtml(ch)}" data-romaji="${r}"
                      title="${r}">
                      <span class="k">${escapeHtml(ch)}</span><span class="r">${showRomaji ? r : ""}</span>
                    </button>`;
          });
          kept.push(rowCells.join(""));
        }
        const cols = maxWidth(group, script);
        return `
          <section class="kana-section">
            <h3>${group.label} <span class="tag">${cells.length} 音</span></h3>
            <div class="kana-grid ${showRomaji ? "" : "hide-romaji"}" style="grid-template-columns:repeat(${cols}, minmax(0,1fr));max-width:${cols * 154}px">
              ${kept.join("")}
            </div>
          </section>`;
      }).join("")}

      <div class="card" style="margin-top:18px">
        <div class="card-head"><h3>记忆小结</h3><span class="spacer"></span>
          <a class="btn sm primary" href="#/quiz">去测验</a>
        </div>
        ${
          stats.touched
            ? `<p>练过 <b>${stats.touched}</b> 个假名，正确 <b style="color:var(--green)">${stats.correct}</b> 次，错误 <b style="color:var(--accent)">${stats.wrong}</b> 次（正确率 ${(stats.accuracy * 100).toFixed(0)}%）。</p>
               ${stats.weak.length ? `<p class="meta" style="color:var(--muted)">红框标出的是错误较多的假名。</p>` : ""}`
            : `<p class="meta" style="color:var(--muted)">还没有测验记录。</p>`
        }
      </div>
    `;
  }

  paint();

  root.addEventListener("click", (e) => {
    const scriptBtn = e.target.closest("[data-script]");
    if (scriptBtn) {
      script = scriptBtn.dataset.script;
      setSetting("kanaScript", script);
      paint();
      return;
    }

    const cell = e.target.closest("[data-kana]");
    if (cell) {
      speak(cell.dataset.kana);
      cell.classList.add("speaking");
      setTimeout(() => cell.classList.remove("speaking"), 500);
      return;
    }

    if (e.target.id === "speak-all") {
      const group = KANA_GROUPS[0];
      let delay = 0;
      for (const c of flattenGroup(group, script)) {
        setTimeout(() => speak(c.kana), delay);
        delay += 900;
      }
    }
  });

  root.addEventListener("change", (e) => {
    if (e.target.id === "romaji-toggle") {
      showRomaji = e.target.checked;
      setSetting("showRomaji", showRomaji);
      paint();
    }
  });
}
