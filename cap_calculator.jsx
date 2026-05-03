import { useState, useCallback } from "react";

const COPPER = "#b87333";
const PCB_GREEN = "#1a3a2a";
const ACCENT = "#00ff88";
const WARN = "#ffaa00";
const DANGER = "#ff4444";
const TEXT = "#d4f0e0";
const PANEL = "#0d2018";
const BORDER = "#2a5a3a";

function calcCaps({ vbus, imax, fsw, ripple_pct, phases }) {
  // Ripple voltage allowed
  const v_ripple = vbus * (ripple_pct / 100);

  // Peak ripple current in DC bus for 3-phase inverter
  // At worst case (D=0.5), ripple current ≈ Imax * sqrt(phase_count)/2
  const i_ripple_rms = imax * Math.sqrt(phases) / 2;

  // Bulk cap: C = I * dt / dV, dt = 1/(2*fsw) worst case
  const C_bulk_F = (imax * 0.5) / (2 * fsw * v_ripple);
  const C_bulk_uF = C_bulk_F * 1e6;

  // HF bypass cap (handles switching transients, ~10x fsw)
  // C_hf = I_ripple / (2*pi*f_hf*V_ripple*0.1)
  const f_hf = fsw * 10;
  const C_hf_nF = (imax * 0.1 * 1e9) / (2 * Math.PI * f_hf * v_ripple);

  // ESR requirement: ESR < V_ripple / (2 * I_ripple_rms)
  const ESR_max_mohm = (v_ripple / (2 * i_ripple_rms)) * 1000;

  // Voltage rating: 20% derating minimum, 50% preferred
  const v_rating_min = vbus * 1.2;
  const v_rating_pref = vbus * 1.5;

  // Power dissipated in cap ESR
  const P_esr = Math.pow(i_ripple_rms, 2) * (ESR_max_mohm / 1000);

  // Number of caps in parallel (standard values)
  const stdCaps = [100, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700];
  let chosen = stdCaps.find(c => c >= C_bulk_uF) || stdCaps[stdCaps.length - 1];
  let n_parallel = 1;
  if (C_bulk_uF > 4700) {
    n_parallel = Math.ceil(C_bulk_uF / 4700);
    chosen = 4700;
  } else {
    // find smallest std value that covers it, or split
    const fit = stdCaps.find(c => c >= C_bulk_uF);
    if (fit) { chosen = fit; n_parallel = 1; }
    else { chosen = 4700; n_parallel = Math.ceil(C_bulk_uF / 4700); }
  }

  const hf_std = [10, 22, 47, 100, 220, 470];
  const hf_chosen = hf_std.find(c => c >= C_hf_nF) || 470;

  return {
    C_bulk_uF: C_bulk_uF.toFixed(1),
    C_hf_nF: C_hf_nF.toFixed(1),
    v_ripple: v_ripple.toFixed(2),
    i_ripple_rms: i_ripple_rms.toFixed(2),
    ESR_max_mohm: ESR_max_mohm.toFixed(1),
    v_rating_min: v_rating_min.toFixed(0),
    v_rating_pref: v_rating_pref.toFixed(0),
    P_esr: P_esr.toFixed(2),
    chosen_bulk: chosen,
    n_parallel,
    hf_chosen,
  };
}

function Slider({ label, min, max, step, value, unit, onChange, color }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: TEXT, fontSize: 13, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>{label}</span>
        <span style={{ color: color || ACCENT, fontSize: 15, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}>
          {value} <span style={{ fontSize: 11, opacity: 0.7 }}>{unit}</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 6, background: "#1a3a2a", borderRadius: 3 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${BORDER}, ${color || ACCENT})`, borderRadius: 3, transition: "width 0.1s" }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", top: -6, left: 0, width: "100%", opacity: 0, cursor: "pointer", height: 18 }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ color: "#4a7a5a", fontSize: 10, fontFamily: "monospace" }}>{min}{unit}</span>
        <span style={{ color: "#4a7a5a", fontSize: 10, fontFamily: "monospace" }}>{max}{unit}</span>
      </div>
    </div>
  );
}

function ResultRow({ label, value, unit, sub, highlight, warn }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      padding: "10px 14px", marginBottom: 4,
      background: highlight ? "rgba(0,255,136,0.07)" : warn ? "rgba(255,170,0,0.07)" : "rgba(0,0,0,0.2)",
      borderLeft: `3px solid ${highlight ? ACCENT : warn ? WARN : BORDER}`,
      borderRadius: 4
    }}>
      <div>
        <div style={{ color: TEXT, fontSize: 12, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 0.5 }}>{label}</div>
        {sub && <div style={{ color: "#4a8a6a", fontSize: 10, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <span style={{ color: highlight ? ACCENT : warn ? WARN : "#7adaaa", fontSize: 16, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{value}</span>
        {unit && <span style={{ color: "#4a7a5a", fontSize: 11, marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 3,
      background: `${color}22`, border: `1px solid ${color}55`,
      color, fontSize: 11, fontFamily: "monospace", marginRight: 6
    }}>{text}</span>
  );
}

export default function CapCalculator() {
  const [vbus, setVbus] = useState(24);
  const [imax, setImax] = useState(10);
  const [fsw, setFsw] = useState(20000);
  const [ripple, setRipple] = useState(3);
  const [phases, setPhases] = useState(3);

  const r = calcCaps({ vbus, imax, fsw: fsw, ripple_pct: ripple, phases });

  const fswKhz = (fsw / 1000).toFixed(0);

  return (
    <div style={{
      minHeight: "100vh", background: PCB_GREEN,
      backgroundImage: `
        radial-gradient(circle at 20% 20%, #0a2010 0%, transparent 60%),
        radial-gradient(circle at 80% 80%, #061408 0%, transparent 60%),
        repeating-linear-gradient(0deg, transparent, transparent 39px, #1f4a2a22 39px, #1f4a2a22 40px),
        repeating-linear-gradient(90deg, transparent, transparent 39px, #1f4a2a22 39px, #1f4a2a22 40px)
      `,
      fontFamily: "'Share Tech Mono', monospace",
      padding: "0 0 40px 0"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "rgba(0,0,0,0.5)", borderBottom: `1px solid ${BORDER}`, padding: "18px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ color: ACCENT, fontSize: 9, letterSpacing: 4, fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>3-PHASE INVERTER DESIGN TOOL</div>
          <div style={{ color: TEXT, fontSize: 20, fontFamily: "'Orbitron', monospace", fontWeight: 900, letterSpacing: 2 }}>BULK CAPACITOR CALCULATOR</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Badge text="DC BUS" color={ACCENT} />
          <Badge text="IR2110" color={COPPER} />
          <Badge text="IRFZ44V" color="#88aaff" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 1000, margin: "32px auto 0", padding: "0 24px" }}>

        {/* Inputs */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24 }}>
          <div style={{ color: ACCENT, fontSize: 10, letterSpacing: 3, marginBottom: 20 }}>● SYSTEM PARAMETERS</div>

          <Slider label="BUS VOLTAGE" min={12} max={50} step={1} value={vbus} unit="V" onChange={setVbus} color={ACCENT} />
          <Slider label="PEAK CURRENT" min={1} max={20} step={0.5} value={imax} unit="A" onChange={setImax} color="#66ccff" />
          <Slider label="SWITCHING FREQ" min={5000} max={100000} step={1000} value={fsw} unit="Hz" onChange={setFsw} color={COPPER} />
          <Slider label="RIPPLE BUDGET" min={1} max={10} step={0.5} value={ripple} unit="%" onChange={setRipple} color={WARN} />

          {/* Phase selector */}
          <div style={{ marginTop: 8 }}>
            <div style={{ color: TEXT, fontSize: 13, letterSpacing: 1, marginBottom: 10 }}>PHASES</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3].map(p => (
                <button key={p} onClick={() => setPhases(p)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 4, border: `1px solid ${phases === p ? ACCENT : BORDER}`,
                  background: phases === p ? "rgba(0,255,136,0.15)" : "transparent",
                  color: phases === p ? ACCENT : "#4a7a5a", cursor: "pointer",
                  fontFamily: "'Orbitron', monospace", fontWeight: 700, fontSize: 13,
                  transition: "all 0.2s"
                }}>{p}Φ</button>
              ))}
            </div>
          </div>

          {/* Summary box */}
          <div style={{ marginTop: 24, padding: 14, background: "rgba(0,0,0,0.3)", borderRadius: 6, border: `1px solid #1a4a2a` }}>
            <div style={{ color: "#4a7a5a", fontSize: 10, marginBottom: 8 }}>OPERATING POINT</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                ["V_BUS", `${vbus} V`],
                ["I_PEAK", `${imax} A`],
                ["F_SW", `${fswKhz} kHz`],
                ["ΔV/V", `${ripple}%`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#4a7a5a", fontSize: 11 }}>{k}</span>
                  <span style={{ color: TEXT, fontSize: 11 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, marginBottom: 16 }}>
            <div style={{ color: ACCENT, fontSize: 10, letterSpacing: 3, marginBottom: 16 }}>● CALCULATED REQUIREMENTS</div>

            <ResultRow label="REQUIRED BULK CAP" value={r.C_bulk_uF} unit="µF" sub="Minimum DC bus capacitance" highlight />
            <ResultRow label="HF BYPASS CAP" value={r.C_hf_nF} unit="nF" sub="High-freq decoupling (×10 FSW)" highlight />
            <ResultRow label="RIPPLE VOLTAGE" value={r.v_ripple} unit="V" sub={`${ripple}% of ${vbus}V bus`} />
            <ResultRow label="RMS RIPPLE CURRENT" value={r.i_ripple_rms} unit="A rms" sub="Into bulk capacitor" />
            <ResultRow label="MAX ESR ALLOWED" value={r.ESR_max_mohm} unit="mΩ" sub="ESR budget for cap selection" warn={r.ESR_max_mohm < 50} />
            <ResultRow label="ESR POWER LOSS" value={r.P_esr} unit="W" sub="At max ripple current" warn={r.P_esr > 1} />
          </div>

          {/* Recommended Parts */}
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24 }}>
            <div style={{ color: ACCENT, fontSize: 10, letterSpacing: 3, marginBottom: 16 }}>● RECOMMENDED SELECTION</div>

            {/* Bulk cap */}
            <div style={{ padding: 14, background: "rgba(0,255,136,0.05)", border: `1px solid ${ACCENT}33`, borderRadius: 6, marginBottom: 12 }}>
              <div style={{ color: "#4a7a5a", fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>BULK ELECTROLYTIC (C1)</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: ACCENT, fontSize: 22, fontFamily: "'Orbitron', monospace", fontWeight: 900 }}>
                    {r.n_parallel > 1 ? `${r.n_parallel}×` : ""}{r.chosen_bulk} µF
                  </div>
                  <div style={{ color: "#6aaa8a", fontSize: 11, marginTop: 4 }}>
                    {r.n_parallel > 1 ? `${r.n_parallel} caps in parallel` : "Single capacitor"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: WARN, fontSize: 13, fontFamily: "monospace" }}>{r.v_rating_pref}V rating</div>
                  <div style={{ color: "#4a7a5a", fontSize: 10, marginTop: 4 }}>min {r.v_rating_min}V</div>
                </div>
              </div>
            </div>

            {/* HF bypass */}
            <div style={{ padding: 14, background: "rgba(100,200,255,0.04)", border: `1px solid #66ccff33`, borderRadius: 6, marginBottom: 12 }}>
              <div style={{ color: "#4a7a5a", fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>HF BYPASS CERAMIC (C2)</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "#66ccff", fontSize: 20, fontFamily: "'Orbitron', monospace", fontWeight: 900 }}>
                  {r.hf_chosen} nF
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: WARN, fontSize: 13, fontFamily: "monospace" }}>{r.v_rating_pref}V X7R/C0G</div>
                  <div style={{ color: "#4a7a5a", fontSize: 10, marginTop: 4 }}>Low ESL, SMD 0805+</div>
                </div>
              </div>
            </div>

            {/* Formula note */}
            <div style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 6, border: `1px dashed #2a4a3a` }}>
              <div style={{ color: "#4a7a5a", fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>FORMULA USED</div>
              <div style={{ color: "#5a8a6a", fontSize: 10, lineHeight: 1.8 }}>
                C_bulk = I_peak × 0.5 / (2 × F_sw × ΔV)<br />
                I_ripple_rms = I_max × √{phases} / 2<br />
                ESR_max = ΔV / (2 × I_ripple_rms)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layout Tips */}
      <div style={{ maxWidth: 1000, margin: "24px auto 0", padding: "0 24px" }}>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24 }}>
          <div style={{ color: ACCENT, fontSize: 10, letterSpacing: 3, marginBottom: 16 }}>● PCB LAYOUT GUIDELINES</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              ["PLACEMENT", "Place bulk cap as close to MOSFET drain/source as possible. Minimize DC bus loop area."],
              ["KELVIN SENSE", "Use separate sense traces to cap terminals if measuring ripple. Don't share with power current path."],
              ["CERAMIC BYPASS", `Place ${r.hf_chosen}nF X7R ceramic directly at MOSFET legs. Keep trace < 5mm.`],
            ].map(([title, desc]) => (
              <div key={title} style={{ padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 6, borderTop: `2px solid ${BORDER}` }}>
                <div style={{ color: ACCENT, fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>▸ {title}</div>
                <div style={{ color: "#6a9a7a", fontSize: 11, lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
