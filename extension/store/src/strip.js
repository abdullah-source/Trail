// The provenance strip from the replay: green = typed, orange = pasted, one cell per line.
const pattern = "tttttpptttttptttttttpttt";
const s = document.getElementById("s");
for (const c of pattern) { const i = document.createElement("i"); i.style.flex = "1"; i.style.background = c === "t" ? "var(--typed)" : "var(--paste)"; s.appendChild(i); }
