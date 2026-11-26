//#region src/rt.ts
var e, t;
function n(n) {
	t = n, e = n.react;
}
//#endregion
//#region src/gmic/gui.ts
var r = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'",
	nbsp: " "
};
function i(e) {
	return e.replace(/<[^>]*>/g, "").replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (e, t) => {
		if (t[0] === "#") {
			let n = t[1] === "x" || t[1] === "X" ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10);
			return Number.isFinite(n) ? String.fromCodePoint(n) : e;
		}
		return r[t.toLowerCase()] ?? e;
	}).replace(/\s+/g, " ").trim();
}
function a(e) {
	return e.replace(/\\\r?\n#\s?/g, "").split(/\r?\n/);
}
function o(e) {
	return a(e).map((e) => /^#@gui\s*:(.*)$/.exec(e)?.[1]).filter((e) => e !== void 0);
}
var s = {
	"(": ")",
	"[": "]",
	"{": "}"
};
function c(e, t, n) {
	let r = !1;
	for (let i = t; i < e.length; i++) {
		let t = e[i];
		if (t === "\\") i++;
		else if (t === "\"") r = !r;
		else if (!r && t === n) return i;
	}
	let i = e.lastIndexOf(n);
	return i >= t ? i : -1;
}
function l(e) {
	let t = [], n = "", r = !1;
	for (let i = 0; i < e.length; i++) {
		let a = e[i];
		a === "\\" && i + 1 < e.length ? n += e[++i] : a === "\"" ? r = !r : a === "," && !r ? (t.push(n.trim()), n = "") : n += a;
	}
	return (n.trim() !== "" || t.length > 0) && t.push(n.trim()), t;
}
var u = (e, t) => {
	let n = Number(e);
	return e !== void 0 && e.trim() !== "" && Number.isFinite(n) ? n : t;
};
function d(e) {
	let t = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(e[0] ?? "");
	if (t) return t[1].match(/../g).map((e) => parseInt(e, 16));
	let n = e.map((e) => u(e, 0));
	return n.length >= 3 ? n.slice(0, 4) : [
		0,
		0,
		0
	];
}
var f = (e) => e.length >= 2 && e.startsWith("\"") && e.endsWith("\"") ? e.slice(1, -1) : e;
function p(e, t, n, r, a) {
	switch (t) {
		case "float":
		case "int": return {
			param: {
				kind: t,
				name: e,
				pos: r,
				default: u(n[0], 0),
				min: u(n[1], 0),
				max: u(n[2], 1)
			},
			slots: 1
		};
		case "bool": {
			let t = (n[0] ?? "").toLowerCase();
			return {
				param: {
					kind: "bool",
					name: e,
					pos: r,
					default: t === "1" || t === "true"
				},
				slots: 1
			};
		}
		case "choice": {
			let t = n.length > 0 && /^\d+$/.test(n[0]), a = (t ? n.slice(1) : n).map(i);
			return {
				param: {
					kind: "choice",
					name: e,
					pos: r,
					default: t ? Number(n[0]) : 0,
					choices: a
				},
				slots: 1
			};
		}
		case "color": {
			let t = d(n);
			return {
				param: {
					kind: "color",
					name: e,
					pos: r,
					default: t
				},
				slots: t.length
			};
		}
		case "point": return {
			param: {
				kind: "point",
				name: e,
				pos: r,
				default: [u(n[0], 50), u(n[1], 50)]
			},
			slots: 2
		};
		case "text": return {
			param: {
				kind: "text",
				name: e,
				pos: r,
				default: n.length >= 2 && /^[01]$/.test(n[0]) ? n[1] : n[0] ?? ""
			},
			slots: 1
		};
		case "file":
		case "filein":
		case "fileout":
		case "folder": return {
			param: {
				kind: "fixed",
				name: e,
				pos: r,
				value: `"${(n[0] ?? "").replace(/"/g, "\\\"")}"`
			},
			slots: 1
		};
		case "button": return {
			param: {
				kind: "fixed",
				name: e,
				pos: r,
				value: "0"
			},
			slots: 1
		};
		case "value": return {
			param: {
				kind: "fixed",
				name: e,
				pos: r,
				value: `"${f(a.trim()).replace(/(^|[^\\])"/g, "$1\\\"")}"`
			},
			slots: 1
		};
		default: return null;
	}
}
var m = /\s*,?\s*([^=,]+?)\s*=\s*[_~]*([A-Za-z]+)\s*([([{])/y;
function h(e) {
	let t = [], n = 1;
	for (let r of e) {
		let e = 0;
		for (; e < r.length;) {
			m.lastIndex = e;
			let a = m.exec(r);
			if (!a) break;
			let [, o, u, d] = a, f = c(r, m.lastIndex, s[d]);
			if (f < 0) break;
			let h = r.slice(m.lastIndex, f), g = l(h), _ = i(o);
			if (e = f + 1, u === "separator") t.push({ kind: "separator" });
			else if (u === "note") t.push({
				kind: "note",
				text: i(g.join(","))
			});
			else if (u === "link") t.push({
				kind: "link",
				name: g.length > 1 ? i(g[g.length - 2]) : _,
				url: g[g.length - 1] ?? ""
			});
			else {
				let e = p(_, u, g, n, h);
				if (!e) continue;
				t.push(e.param), n += e.slots;
			}
		}
	}
	return t;
}
//#endregion
//#region src/gmic/catalogue.ts
function g(e) {
	let t = /\(\s*([\d.]+)\s*\)\s*([+*]?)\s*$/.exec((e ?? "").split(":")[0]);
	return !t || t[2] ? "any" : Number(t[1]) === 0 ? "actual" : "whole";
}
var _ = /* @__PURE__ */ new Set([
	"",
	"_none_",
	"gui_no_preview"
]);
function ee(e, t) {
	if (e === void 0) return t;
	let n = e.split(":")[0].replace(/\(.*$/, "").trim();
	return _.has(n) ? null : n;
}
function te(e) {
	return new Set([...e.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*:[^\n]*\bgui_check_x11_gdi32\s+0\b/gm)].map((e) => e[1]));
}
function ne(e) {
	let t = /for version (\d+(?:\.\d+)*)/.exec(e.slice(0, 2e3))?.[1] ?? "", n = /* @__PURE__ */ new Map(), r = [], o = te(e), s = null, c = () => {
		if (!s) return;
		let { name: e, category: t, command: r, preview: i, previewScale: a, lines: c } = s;
		if (s = null, !r || r === "_none_" || !t) return;
		let l = n.get(t) ?? [];
		l.push({
			name: e,
			category: t,
			command: r,
			params: h(c),
			previewScale: a,
			preview: i,
			interactive: o.has(r)
		}), n.set(t, l);
	};
	for (let t of a(e)) {
		let e = /^#@gui (.*)$/.exec(t);
		if (!e) continue;
		let n = e[1];
		if (/^\s*:/.test(n)) {
			s?.lines.push(n.replace(/^\s*:/, ""));
			continue;
		}
		c();
		let a = n.indexOf(":");
		if (a < 0) {
			let e = /^_*/.exec(n)[0].length;
			r.length = Math.max(0, r.length - e);
			let t = i(n.slice(e));
			t && r.push(t);
			continue;
		}
		let o = n.slice(a + 1).split(","), l = o[0].split(":")[0].trim();
		s = {
			name: i(n.slice(0, a)),
			category: r.join(" › "),
			command: l,
			preview: ee(o[1], l),
			previewScale: g(o[1]),
			lines: []
		};
	}
	return c(), {
		version: t,
		categories: [...n].map(([e, t]) => ({
			name: e,
			filters: t
		}))
	};
}
function re(e) {
	return e.categories.flatMap((e) => e.filters);
}
function ie(e, t) {
	let n = t.trim().toLowerCase(), r = re(e);
	return r.find((e) => e.name.toLowerCase() === n) ?? r.find((e) => e.command.toLowerCase() === n) ?? null;
}
function ae(e, t) {
	return re(e).find((e) => e.command === t) ?? null;
}
function oe(e, t) {
	let n = t.toLowerCase().split(/\s+/).filter(Boolean);
	return re(e).filter((e) => {
		let t = `${e.name} ${e.category} ${e.command}`.toLowerCase();
		return n.every((e) => t.includes(e));
	});
}
//#endregion
//#region src/gmic/cimg.ts
var v = {
	bool: {
		bytes: 1,
		read: (e, t) => e.getUint8(t)
	},
	uchar: {
		bytes: 1,
		read: (e, t) => e.getUint8(t)
	},
	"unsigned char": {
		bytes: 1,
		read: (e, t) => e.getUint8(t)
	},
	char: {
		bytes: 1,
		read: (e, t) => e.getInt8(t)
	},
	ushort: {
		bytes: 2,
		read: (e, t, n) => e.getUint16(t, n)
	},
	short: {
		bytes: 2,
		read: (e, t, n) => e.getInt16(t, n)
	},
	uint: {
		bytes: 4,
		read: (e, t, n) => e.getUint32(t, n)
	},
	int: {
		bytes: 4,
		read: (e, t, n) => e.getInt32(t, n)
	},
	uint64: {
		bytes: 8,
		read: (e, t, n) => Number(e.getBigUint64(t, n))
	},
	ulong: {
		bytes: 8,
		read: (e, t, n) => Number(e.getBigUint64(t, n))
	},
	int64: {
		bytes: 8,
		read: (e, t, n) => Number(e.getBigInt64(t, n))
	},
	long: {
		bytes: 8,
		read: (e, t, n) => Number(e.getBigInt64(t, n))
	},
	float: {
		bytes: 4,
		read: (e, t, n) => e.getFloat32(t, n)
	},
	double: {
		bytes: 8,
		read: (e, t, n) => e.getFloat64(t, n)
	}
};
v.uint8 = v.uchar, v.int8 = v.char, v.uint16 = v.ushort, v.int16 = v.short, v.uint32 = v.uint, v.int32 = v.int, v.float32 = v.float, v.float64 = v.double;
var se = 10;
function ce(e, t) {
	let n = e.indexOf(se, t);
	if (n < 0) throw Error("G'MIC's image file ends early.");
	return {
		text: new TextDecoder().decode(e.subarray(t, n)).trim(),
		next: n + 1
	};
}
function le(e) {
	let t = new TextEncoder().encode(`1 float little_endian\n${e.width} ${e.height} 1 ${e.channels}\n`), n = new Uint8Array(t.length + e.data.length * 4);
	n.set(t, 0);
	let r = new DataView(n.buffer, t.length);
	for (let t = 0; t < e.data.length; t++) r.setFloat32(t * 4, e.data[t], !0);
	return n;
}
function ue(e) {
	let t = ce(e, 0), n = /^(\d+)\s+(unsigned char|[a-z0-9_]+)\s+(little_endian|big_endian)/.exec(t.text);
	if (!n) throw Error("G'MIC's result isn't an image file Safelight can read.");
	let r = Number(n[1]), i = v[n[2]];
	if (!i) throw Error(`G'MIC's result holds ${n[2]} values, which Safelight can't read.`);
	let a = n[3] === "little_endian", o = new DataView(e.buffer, e.byteOffset, e.byteLength), s = [], c = t.next;
	for (let t = 0; t < r; t++) {
		let t = ce(e, c);
		if (t.text.includes("#")) throw Error("G'MIC's result is compressed, which Safelight can't read.");
		let [n, r, l, u] = t.text.split(/\s+/).map(Number);
		c = t.next;
		let d = n * r * l * u;
		if (!(d >= 0) || c + d * i.bytes > e.length) throw Error("G'MIC's image file ends early.");
		let f = new Float32Array(n * r * u), p = n * r * l, m = n * r;
		for (let e = 0; e < u; e++) for (let t = 0; t < m; t++) f[e * m + t] = i.read(o, c + (e * p + t) * i.bytes, a);
		c += d * i.bytes, s.push({
			width: n,
			height: r,
			channels: u,
			data: f
		});
	}
	return s;
}
function de(e, t, n, r) {
	let i = t * n, a = new Float32Array(i * 3);
	for (let t = 0; t < i; t++) a[t] = e[t * 4] * r, a[i + t] = e[t * 4 + 1] * r, a[2 * i + t] = e[t * 4 + 2] * r;
	return {
		width: t,
		height: n,
		channels: 3,
		data: a
	};
}
function fe(e, t) {
	let n = e.width * e.height, r = new Float32Array(n * 4), i = e.channels, a = i >= 3 ? [
		0,
		1,
		2
	] : [
		0,
		0,
		0
	], o = i === 2 ? 1 : i >= 4 ? 3 : -1;
	for (let i = 0; i < n; i++) r[i * 4] = e.data[a[0] * n + i] * t, r[i * 4 + 1] = e.data[a[1] * n + i] * t, r[i * 4 + 2] = e.data[a[2] * n + i] * t, r[i * 4 + 3] = o < 0 ? 1 : e.data[o * n + i] * t;
	return r;
}
//#endregion
//#region src/gmic/script.ts
var pe = "_safelight_run", me = "_safelight_job", he = /^[A-Za-z_][A-Za-z0-9_]*\s*:/m;
function ge(e) {
	return he.test(e);
}
var y = (e, t) => t ? `${e} ${t}` : e, b = (e) => e.split(/\r?\n/).map((e) => e.trim() === "" ? "" : `  ${e}`).join("\n");
function _e(e, t) {
	return [
		`${pe} :`,
		...t === 16 ? ["  div 257"] : [],
		`  ${e}`,
		"  foreach { cut 0,255 mul 257 }",
		""
	].join("\n");
}
function ve(e, t = 16) {
	let n = (e) => _e(e, t);
	if (e.kind === "line") return `${n(me)}\n${me} :\n${b(e.line)}\n`;
	if (ge(e.source)) {
		if (!/^main\s*:/m.test(e.source)) throw Error("This script defines commands, so it needs one called main: that's where it starts.");
		return `${n(y("main", e.args))}\n${e.source}\n`;
	}
	let r = `${me}_body`;
	return `${n(y(r, e.args))}\n${r} :\n${b(e.source)}\n`;
}
var ye = "_safelight_stack", be = /^main(\s*:)/m;
function xe(e, t = {}) {
	let n = [], r = [];
	e.forEach((e, t) => {
		let i = e.kind === "script" ? {
			...e,
			source: e.source.replace(/\r\n?/g, "\n")
		} : e, a = `_sl_step_${t + 1}`;
		if (i.kind === "line") n.push(a), r.push(`${a} :\n${b(i.line)}\n`);
		else if (ge(i.source)) {
			if (!be.test(i.source)) throw Error("A script that defines commands needs one called main: that's where it starts.");
			let e = `_sl_main_${t + 1}`;
			n.push(y(e, i.args)), r.push(`${i.source.replace(be, `${e}$1`).replace(/\s*$/, "")}\n`);
		} else n.push(y(a, i.args)), r.push(`${a} :\n${b(i.source)}\n`);
	});
	let i = Object.entries(t).map(([e, t]) => `  ${e}=${t}`);
	return [[
		`${ye} :`,
		...i,
		...n.flatMap((e) => [`  ${e}`, "  k[0]"]),
		"  cut 0,255",
		""
	].join("\n"), ...r].join("\n");
}
function Se() {
	return [
		"-v",
		"0",
		"-m",
		"job.gmic",
		"input.cimg",
		ye,
		"-o",
		"out.cimg,float32"
	];
}
function Ce(e, t, n = !1) {
	let r = {
		_host: "safelight",
		_input_layers: 1,
		_output_mode: 0,
		_output_messages: 0,
		_preview_x0: 0,
		_preview_y0: 0,
		_preview_x1: e - 1,
		_preview_y1: t - 1,
		_preview_width: e,
		_preview_height: t
	};
	return n && Object.assign(r, {
		_preview_area_width: e,
		_preview_area_height: t,
		_preview_enabled: 1
	}), r;
}
var we = "_safelight_catalogue";
function Te() {
	return [
		`${we} :`,
		"  l[] { i cimgz:${_path_rc}update$_version.gmic onfail l[] { it ${_path_rc}update$_version.gmic onfail } }",
		"  if $! o[-1] raw:filters.gmic,uint8 fi",
		""
	].join("\n");
}
function Ee() {
	return [
		"-v",
		"0",
		"-m",
		"job.gmic",
		"input.png",
		pe,
		"-o",
		"out.png,16"
	];
}
function x(e) {
	return h(o(e));
}
//#endregion
//#region src/gmic/engine.ts
var De = class extends Error {
	constructor() {
		super("G'MIC isn't set up. Set it up in Preferences ▸ G'MIC, or from the G'MIC store."), this.name = "NotSetUpError";
	}
}, Oe = class extends Error {
	constructor() {
		super("G'MIC has no filter list yet: it comes with G'MIC's update. Run gmic update, or choose Download filters in the G'MIC store."), this.name = "NeedsUpdateError";
	}
}, ke = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
], Ae = 36e5, S = 3e5;
function je(e) {
	if (!(e.length > 24 && ke.every((t, n) => e[n] === t))) throw Error("Safelight's render isn't a PNG.");
	return e[24];
}
var Me = /\u001b\[[0-9;]*[A-Za-z]/g, Ne = (e) => e.replace(Me, "").replace(/\r/g, "");
function Pe(e) {
	if (e.killed === "timeout") return "G'MIC took too long and was stopped.";
	if (e.killed === "cancelled") return "Stopped.";
	let t = Ne(e.stderr).split("\n").map((e) => e.replace(/^\s*\[gmic\]\s?/, "").trim()).filter(Boolean), n = t.filter((e) => e.includes("***")), r = n.length > 0 ? n : t.slice(-6);
	return r.length > 0 ? `G'MIC: ${r.join("\n")}` : `G'MIC stopped with exit code ${e.exitCode ?? "unknown"}.`;
}
var Fe = (e) => new TextEncoder().encode(e);
function Ie(e) {
	return Object.keys(e).filter((e) => /^out(_\d+)?\.png$/.test(e)).sort().map((t) => e[t]);
}
function Le(e) {
	let t = null;
	async function n() {
		let [t] = await e.list();
		return t ?? null;
	}
	async function r() {
		let e = await n();
		if (!e) throw new De();
		return e.token;
	}
	async function i(t, n) {
		let i = await e.run(await r(), t, n);
		if (i.killed === "cancelled") throw new DOMException("Stopped.", "AbortError");
		if (i.exitCode !== 0 || i.killed) throw Error(Pe(i));
		return i;
	}
	async function a(e) {
		let t = (await i([
			"-v",
			"0",
			"-m",
			"catalogue.gmic",
			we
		], {
			files: { "catalogue.gmic": Fe(Te()) },
			outputs: ["filters.gmic"],
			timeoutMs: S,
			signal: e.signal
		})).files["filters.gmic"], n = t ? ne(new TextDecoder().decode(t)) : null;
		if (!n || n.categories.length === 0) throw new Oe();
		return n;
	}
	async function o(e = {}) {
		let n = await r();
		if (t?.token !== n) {
			let r = a(e);
			t = {
				token: n,
				catalogue: r
			}, r.catch(() => {
				t?.catalogue === r && (t = null);
			});
		}
		return t.catalogue;
	}
	return {
		program: n,
		async run(e, t, n = {}) {
			let r = je(e) === 16 ? 16 : 8, a = Ie((await i(Ee(), {
				files: {
					"input.png": e,
					"job.gmic": Fe(ve(t, r))
				},
				outputs: ["out.png", "out_*"],
				timeoutMs: Ae,
				signal: n.signal,
				onOutput: n.onOutput
			})).files);
			if (a.length === 0) throw Error("G'MIC left no image to save.");
			return a;
		},
		async runStack(e, t, n = {}) {
			let r = (await i(Se(), {
				files: {
					"input.cimg": le(e),
					"job.gmic": Fe(xe(t, n.vars))
				},
				outputs: ["out.cimg"],
				timeoutMs: Ae,
				signal: n.signal,
				onOutput: n.onOutput
			})).files["out.cimg"], [a] = r ? ue(r) : [];
			if (!a) throw Error("G'MIC left no image.");
			return a;
		},
		catalogue: o,
		async update(e = {}) {
			return await i([
				"-v",
				"0",
				"update"
			], {
				timeoutMs: S,
				signal: e.signal,
				onOutput: e.onOutput
			}), t = null, o(e);
		},
		async version() {
			let e = await i(["version"], { timeoutMs: S });
			return /(\d+\.\d+\.\d+)/.exec(Ne(e.stdout + e.stderr))?.[1] ?? "unknown";
		},
		async help(e) {
			let t = await i(["help", e], { timeoutMs: S });
			return Ne(t.stdout || t.stderr).replace(/^\n+|\s+$/g, "");
		},
		reset() {
			t = null;
		}
	};
}
//#endregion
//#region src/gmic/params.ts
function C(e) {
	return e.kind !== "fixed" && e.kind !== "note" && e.kind !== "link" && e.kind !== "separator";
}
function Re(e) {
	let t = {};
	for (let n of e) C(n) && (t[n.name] = Array.isArray(n.default) ? [...n.default] : n.default);
	return t;
}
function w(e) {
	return Number.isFinite(e) ? Number.isInteger(e) ? String(e) : e.toFixed(10).replace(/0+$/, "").replace(/\.$/, "") : "0";
}
function ze(e) {
	return e !== "" && !/[\s",]/.test(e) ? e : `"${e.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}
function Be(e) {
	return `"${e.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}
function Ve(e) {
	return e.map((e) => /[\s"]/.test(e) || e === "" ? ze(e) : e).join(" ");
}
function He(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function Ue(e, t) {
	if (e.kind === "fixed") return [e.value];
	if (!C(e)) return [];
	let n = t[e.name] ?? e.default;
	switch (e.kind) {
		case "float": return [w(He(Number(n), e.min, e.max))];
		case "int": return [w(Math.round(He(Number(n), e.min, e.max)))];
		case "bool": return [n === !0 ? "1" : "0"];
		case "choice": return [w(He(Math.round(Number(n)), 0, e.choices.length - 1))];
		case "color":
		case "point": return (Array.isArray(n) ? n : e.default).map(w);
		case "text": return [Be(String(n))];
	}
}
function We(e, t) {
	return e.filter((e) => "pos" in e).sort((e, t) => e.pos - t.pos).flatMap((e) => Ue(e, t)).join(",");
}
var T = (e) => e.toLowerCase().replace(/[^a-z0-9]/g, ""), Ge = (e) => e.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
function Ke(e, t) {
	let n = T(t), r = e.filter((e) => T(e.name) === n);
	return r.length > 0 ? r : e.filter((e) => T(e.name).startsWith(n) || Ge(e.name).some((e) => e.startsWith(n)));
}
function qe(e, t) {
	let n = Number(t);
	if (t.trim() === "" || !Number.isFinite(n)) throw Error(`${e.name} takes a number, not "${t}".`);
	return n;
}
function Je(e, t, n) {
	let r = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t);
	if (r) return r[1].match(/../g).map((e) => parseInt(e, 16));
	let i = t.split(",").map((e) => Number(e));
	if (i.some((e) => !Number.isFinite(e)) || n !== null && i.length !== n) {
		let r = n === 2 ? "x,y" : "#rrggbb or r,g,b";
		throw Error(`${e.name} takes ${r}, not "${t}".`);
	}
	return i;
}
var Ye = /* @__PURE__ */ new Set([
	"1",
	"on",
	"yes",
	"true"
]), Xe = /* @__PURE__ */ new Set([
	"0",
	"off",
	"no",
	"false"
]);
function Ze(e, t) {
	switch (e.kind) {
		case "float":
		case "int": return qe(e, t);
		case "bool": {
			let n = t.toLowerCase();
			if (Ye.has(n)) return !0;
			if (Xe.has(n)) return !1;
			throw Error(`${e.name} takes on or off, not "${t}".`);
		}
		case "choice": {
			let n = e.choices.findIndex((e) => T(e) === T(t));
			if (n >= 0) return n;
			let r = Number(t);
			if (Number.isInteger(r) && r >= 0 && r < e.choices.length) return r;
			throw Error(`${e.name} takes one of ${e.choices.join(", ")}.`);
		}
		case "color": return Je(e, t, null);
		case "point": {
			let [n, r] = Je(e, t, 2);
			return [n, r];
		}
		case "text": return t;
	}
}
function Qe(e, t) {
	let n = e.filter(C), r = Re(e);
	for (let e of t) {
		let t = e.indexOf("=");
		if (t <= 0) throw Error(`"${e}" isn't a value: write Name=value.`);
		let i = e.slice(0, t), a = Ke(n, i);
		if (a.length === 0) {
			let e = n.map((e) => e.name).join(", ");
			throw Error(`No parameter "${i}".${e ? ` It has: ${e}.` : " It has none."}`);
		}
		if (a.length > 1) throw Error(`"${i}" could be ${a.map((e) => e.name).join(" or ")}.`);
		r[a[0].name] = Ze(a[0], e.slice(t + 1));
	}
	return r;
}
//#endregion
//#region src/gmic/words.ts
var $e = [
	{
		name: "filters",
		summary: "List G'MIC's filters, or those matching a search"
	},
	{
		name: "filter",
		summary: "Run a filter by name, with Name=value settings"
	},
	{
		name: "script",
		summary: "Run a saved script by name, with Name=value settings"
	},
	{
		name: "scripts",
		summary: "List the saved scripts"
	},
	{
		name: "run",
		summary: "Run G'MIC words, even ones named like a subcommand"
	},
	{
		name: "help",
		summary: "G'MIC's own help for one of its commands"
	},
	{
		name: "status",
		summary: "Which gmic program runs, and its version"
	},
	{
		name: "update",
		summary: "Download G'MIC's latest filter definitions"
	}
], E = [
	"gmic <G'MIC words…>",
	"gmic filters [search]",
	"gmic filter <name> [Name=value…]",
	"gmic script <name> [Name=value…]",
	"gmic scripts",
	"gmic help [command]",
	"gmic status",
	"gmic update"
], et = (e) => e.indexOf("=") > 0;
function tt(e) {
	let t = e.findIndex(et);
	return {
		name: (t < 0 ? e : e.slice(0, t)).join(" ").trim(),
		assignments: t < 0 ? [] : e.slice(t)
	};
}
function nt(e) {
	if (e.length === 0) return { kind: "usage" };
	let [t, ...n] = e;
	switch (t) {
		case "run": return n.length === 0 ? { kind: "usage" } : {
			kind: "pipeline",
			line: Ve(n)
		};
		case "filters": return {
			kind: "filters",
			search: n.join(" ")
		};
		case "filter": {
			let { name: e, assignments: t } = tt(n);
			if (!e) throw Error("Name a filter: gmic filter <name> [Name=value…]. gmic filters lists them.");
			return {
				kind: "filter",
				name: e,
				assignments: t
			};
		}
		case "script": {
			if (n[0] === "--source") {
				if (n.length < 2) throw Error("Give the script's text after --source.");
				return {
					kind: "script",
					name: null,
					source: n[1],
					assignments: n.slice(2)
				};
			}
			let { name: e, assignments: t } = tt(n);
			if (!e) throw Error("Name a script: gmic script <name>. gmic scripts lists them.");
			return {
				kind: "script",
				name: e,
				source: null,
				assignments: t
			};
		}
		case "scripts": return { kind: "scripts" };
		case "help": return {
			kind: "help",
			topic: n.join(" ")
		};
		case "status": return { kind: "status" };
		case "update": return { kind: "update" };
		default: return {
			kind: "pipeline",
			line: Ve(e)
		};
	}
}
//#endregion
//#region src/scripts.ts
var rt = "scripts";
function it(e) {
	if (typeof e != "object" || !e) return !1;
	let t = e;
	return typeof t.id == "string" && typeof t.name == "string" && typeof t.source == "string";
}
function at(e) {
	let t = e.get(rt, []);
	return Array.isArray(t) ? t.filter(it) : [];
}
function ot(e, t) {
	let n = t.trim().replace(/\s+/g, " ").toLowerCase();
	return e.find((e) => e.name.trim().replace(/\s+/g, " ").toLowerCase() === n) ?? null;
}
var st = "#@gui : Strength = float(2,0,10)\n# A G'MIC script. Each line is G'MIC words, run on the photo in turn;\n# #@gui lines above give it settings, read here as $1, $2 and on.\nblur $1\n", D = "gmic", ct = "installed", O = (e) => `${D}.f.${e}`, lt = (e) => typeof e == "object" && !!e && !Array.isArray(e);
function ut(e) {
	return !lt(e) || typeof e.id != "string" || !/^[A-Za-z0-9_-]+$/.test(e.id) || typeof e.name != "string" ? !1 : e.kind === "filter" ? typeof e.command == "string" : e.kind === "script" && typeof e.source == "string";
}
function k(e) {
	let t = e.get(ct, []);
	if (!Array.isArray(t)) return [];
	let n = /* @__PURE__ */ new Set();
	return t.filter((e) => ut(e) && !n.has(e.id) && !!n.add(e.id));
}
function dt(e, t) {
	e.set(ct, t.map((e) => e.kind === "filter" ? {
		id: e.id,
		kind: e.kind,
		name: e.name,
		command: e.command
	} : {
		id: e.id,
		kind: e.kind,
		name: e.name,
		source: e.source
	}));
}
var ft = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
function pt(e, t, n = ft) {
	return e.some((e) => e.kind === "filter" && e.command === t.command) ? [...e] : [...e, {
		id: n(),
		kind: "filter",
		name: t.name,
		command: t.command
	}];
}
function mt(e, t, n, r = ft) {
	return [...e, {
		id: r(),
		kind: "script",
		name: t,
		source: n
	}];
}
var ht = (e, t) => e.filter((e) => e.id !== t);
function gt(e, t, n) {
	let r = e.find((e) => e.id === t);
	if (!r) return [...e];
	let i = e.filter((e) => e.id !== t), a = Math.max(0, Math.min(i.length, n));
	return [
		...i.slice(0, a),
		r,
		...i.slice(a)
	];
}
function _t(e, t, n) {
	return e.map((e) => e.id === t && e.kind === "script" ? {
		...e,
		...n
	} : e);
}
function A(e, t) {
	let n = e?.[O(t)];
	return !lt(n) || typeof n.on != "boolean" || !lt(n.values) ? null : n.data === void 0 ? {
		on: n.on,
		values: n.values
	} : {
		on: n.on,
		values: n.values,
		data: n.data
	};
}
var vt = (e, t) => ({ [O(e)]: t });
function yt(e, t, n) {
	let r = {
		...e?.values ?? {},
		[t]: n
	};
	return e?.data === void 0 ? {
		on: !0,
		values: r
	} : {
		on: !0,
		values: r,
		data: e.data
	};
}
function bt(e, t) {
	return {
		on: !0,
		values: e?.values ?? {},
		data: t
	};
}
function xt(e, t, n) {
	let r = [];
	for (let i of e) {
		let e = A(t, i.id);
		e?.on && !n?.(i.id) && r.push({
			...i,
			...e
		});
	}
	return r;
}
var St = (e) => e.filter((e) => e.on), Ct = [
	"_sl_curves : check \"isint($1,0,8)\"",
	"  repeat 5 { _slc$>=0,0,100,100 }",
	"  if narg($2)",
	"    l[] { ($2) s -,-1 repeat $! { _slc$>={$>,^} } rm }",
	"  fi",
	"  cs=${arg0\\ $1,rgb,cmy,cmyk,hsi,hsl,hsv,lab,lch,ycbcr}",
	"  if ['$cs']=='rgb' m \"_slgo:\" m \"_slback:\"",
	"  elif ['$cs']=='cmy' m \"_slgo: s c,-3 rgb2cmy[0] a c\" m \"_slback: s c,-3 cmy2rgb[0] a c\"",
	"  elif ['$cs']=='cmyk' m \"_slgo: s c,-3 rgb2cmyk[0] a c\" m \"_slback: s c,-4 cmyk2rgb[0] a c\"",
	"  elif ['$cs']=='hsi' m \"_slgo: s c,-3 rgb2hsi8[0] a c\" m \"_slback: s c,-3 hsi82rgb[0] a c\"",
	"  elif ['$cs']=='hsl' m \"_slgo: s c,-3 rgb2hsl8[0] a c\" m \"_slback: s c,-3 hsl82rgb[0] a c\"",
	"  elif ['$cs']=='hsv' m \"_slgo: s c,-3 rgb2hsv8[0] a c\" m \"_slback: s c,-3 hsv82rgb[0] a c\"",
	"  elif ['$cs']=='lab' m \"_slgo: s c,-3 srgb2rgb[0] apo[0] rgb2lab8,0,4 a c\" m \"_slback: s c,-3 apo[0] lab82rgb,0,4 rgb2srgb[0] a c\"",
	"  elif ['$cs']=='lch' m \"_slgo: s c,-3 srgb2rgb[0] apo[0] rgb2lch8[0],0,4 a c\" m \"_slback: s c,-3 apo[0] lch82rgb[0],0,4 rgb2srgb[0] a c\"",
	"  else m \"_slgo: s c,-3 rgb2ycbcr[0] a c\" m \"_slback: s c,-3 ycbcr2rgb[0] a c\"",
	"  fi",
	"  to_color",
	"  foreach {",
	"    _slgo",
	"    repeat s { function1d[] 1,${_slc$>} *. {255%} r. 256,1,1,1,5 c. 0,255 sh[0] $> map. .. rm[-2,-1] }",
	"    _slback",
	"  }",
	"  um _slgo,_slback"
].join("\n"), wt = [
	"_sl_warp : check \"isint(${2=1},1)\"",
	"  if narg($1)>=16",
	"    foreach {",
	"      ($1) r. 4,{w/4},1,1,-1 permute. zycx",
	"      _x_warp_rbf[1] {0,round([w,h]/$2)}",
	"      if $2>1 *[1] $2 r[1] {0,[w,h]},1,100%,3 fi",
	"      +[1] '[x,y]'",
	"      warp[0] [1],0,2,3",
	"      rm[1]",
	"    }",
	"  fi"
].join("\n"), Tt = [
	"_sl_colorize : check \"isint($1,0,1)\"",
	"  if narg($2)>=5",
	"    foreach {",
	"      w,h={w},{h}",
	"      if $1 +channels 0,0 n. 0,255",
	"      elif s==1 +. 0",
	"      else +luminance.",
	"      fi",
	"      => img",
	"      l[] {",
	"        ($2) r. 5,{w/5},1,1,-1",
	"        {h},6,1,1,\"y==2?0:y==0?round(i(#0,0,x)*($w-1)/100):y==1?round(i(#0,1,x)*($h-1)/100):i(#0,y-1,x)+1\"",
	"        k.",
	"      }",
	"      => points",
	"      [img] __x_colorize. $1",
	"      pointcloud[points] -1,$w,$h",
	"      +compose_channels[points] max !=. 0 distance. 1 *. 0.02 +. 1 ^. -1 +[potential,-1]",
	"      if !$1 dilate[points] 3 fi",
	"      watershed[points] [potential] -[points] 1 =>[points] colors",
	"      k[img,colors]",
	"      if $1 +*[img] -1 +. 255 channels. -3,0 blend[colors,-1] alpha rm[img]",
	"      else rgb2ycbcr[colors] j[colors] [img],0,0,0,0 rm[img] ycbcr2rgb[colors]",
	"      fi",
	"      k[colors]",
	"    }",
	"  fi"
].join("\n"), Et = (e) => typeof e == "object" && !!e && !Array.isArray(e), Dt = (e) => typeof e == "number" && Number.isFinite(e), j = (e, t, n) => Math.min(n, Math.max(t, e)), M = (e, t) => ({
	kind: "script",
	source: `${e}\nmain :\n  ${t}\n`,
	args: ""
}), N = (e) => `"\\"${e.map(w).join(",")}\\""`, Ot = [
	0,
	0,
	100,
	100
], kt = .5, At = [
	[
		"Red",
		"Green",
		"Blue"
	],
	[
		"Cyan",
		"Magenta",
		"Yellow"
	],
	[
		"Cyan",
		"Magenta",
		"Yellow",
		"Key"
	],
	[
		"Hue",
		"Saturation",
		"Intensity"
	],
	[
		"Hue",
		"Saturation",
		"Lightness"
	],
	[
		"Hue",
		"Saturation",
		"Value"
	],
	[
		"Lightness",
		"a",
		"b"
	],
	[
		"Lightness",
		"Chroma",
		"Hue"
	],
	[
		"Luma",
		"Blue difference",
		"Red difference"
	]
];
function jt(e) {
	if (!Array.isArray(e) || e.length < 4 || e.length % 2 != 0 || !e.every(Dt)) return !1;
	for (let t = 2; t < e.length; t += 2) if (e[t] <= e[t - 2]) return !1;
	return e[0] === 0 && e[e.length - 2] === 100;
}
function Mt(e) {
	let t = Et(e) && Array.isArray(e.curves) ? e.curves : [];
	return Array.from({ length: 5 }, (e, n) => jt(t[n]) ? [...t[n]] : [...Ot]);
}
var Nt = (e) => e.filter((e, t) => t % 2 == 0), Pt = (e) => e.filter((e, t) => t % 2 == 1);
function Ft(e, t) {
	let n = Nt(e), r = Pt(e), i = n.length;
	if (t <= n[0]) return r[0];
	if (t >= n[i - 1]) return r[i - 1];
	let a = 0;
	for (; n[a + 1] < t;) a++;
	let o = n[a], s = n[a + 1], c = r[a], l = r[a + 1], u = s - o, d = (t - o) / u;
	if (u < 1) return c + (l - c) * d;
	let f = (e) => e === 0 ? (r[1] - r[0]) / (n[1] - n[0]) : e === i - 1 ? (r[e] - r[e - 1]) / (n[e] - n[e - 1]) : (r[e + 1] - r[e - 1]) / (n[e + 1] - n[e - 1]), p = f(a) * u, m = f(a + 1) * u, h = d * d, g = h * d;
	return (2 * g - 3 * h + 1) * c + (g - 2 * h + d) * p + (-2 * g + 3 * h) * l + (g - h) * m;
}
function It(e, t, n) {
	let r = Nt(e), i = j(t, 0, 100);
	if (r.some((e) => Math.abs(e - i) < .5)) return {
		curve: e,
		index: -1
	};
	let a = r.findIndex((e) => e > i), o = [...e];
	return o.splice(a * 2, 0, i, j(n, 0, 100)), {
		curve: o,
		index: a
	};
}
function Lt(e, t, n, r) {
	let i = e.length / 2, a = [...e], o = t === 0 ? 0 : t === i - 1 ? 100 : e[(t - 1) * 2] + kt, s = t === 0 ? 0 : t === i - 1 ? 100 : e[(t + 1) * 2] - kt;
	return a[t * 2] = j(n, o, s), a[t * 2 + 1] = j(r, 0, 100), a;
}
function Rt(e, t) {
	if (t <= 0 || t >= e.length / 2 - 1) return e;
	let n = [...e];
	return n.splice(t * 2, 2), n;
}
var zt = "Color Space";
function Bt(e, t) {
	return M(Ct, `_sl_curves ${j(Math.round(Number(e["Color Space"] ?? 0)) || 0, 0, 8)},${N(Mt(t).flatMap((e, t) => t === 0 ? e : [-1, ...e]))}`);
}
function P(e, t) {
	return (Et(e) && Array.isArray(e.points) ? e.points : []).filter((e) => Array.isArray(e) && e.length === t && e.every(Dt)).map((e) => [...e]);
}
var Vt = (e, t, n) => e ? e([t, n]) : [t, n], Ht = [
	[
		0,
		0,
		0,
		0
	],
	[
		100,
		0,
		100,
		0
	],
	[
		0,
		100,
		0,
		100
	],
	[
		100,
		100,
		100,
		100
	]
];
function Ut(e, t) {
	return M(wt, `_sl_warp ${N([...Ht, ...P(e, 4)].flatMap(([e, n, r, i]) => [...Vt(t, e, n), ...Vt(t, r, i)]))}`);
}
var Wt = "Input Type";
function Gt(e, t, n) {
	return M(Tt, `_sl_colorize ${+(Number(e["Input Type"] ?? 0) === 1)},${N(P(t, 5).flatMap(([e, t, r, i, a]) => [
		...Vt(n, e, t),
		r,
		i,
		a
	]))}`);
}
//#endregion
//#region src/interactive/CurvesEditor.tsx
var Kt = 4, qt = {
	width: "100%",
	aspectRatio: "1",
	display: "block",
	touchAction: "none",
	cursor: "crosshair",
	borderRadius: 4
};
function Jt(e) {
	let t = [];
	for (let n = 0; n <= 100; n += .5) t.push(`${n === 0 ? "M" : "L"}${n},${100 - Math.min(100, Math.max(0, Ft(e, n)))}`);
	return t.join(" ");
}
function Yt(n) {
	let r = t.ui, i = e.useRef(null), [a, o] = e.useState(0), [s, c] = e.useState(null), l = e.useRef(!1), u = At[Math.min(8, Math.max(0, Math.round(Number(n.values["Color Space"] ?? 0)) || 0))], d = Math.min(a, u.length - 1), f = Mt(n.data), p = f[d], m = (e) => n.setData({ curves: f.map((t, n) => n === d ? e : t) }), h = (e) => {
		let t = i.current.getBoundingClientRect();
		return [(e.clientX - t.left) / t.width * 100, 100 - (e.clientY - t.top) / t.height * 100];
	}, g = (e, t) => {
		let n = -1, r = Kt;
		for (let i = 0; i < p.length / 2; i++) {
			let a = Math.hypot(p[i * 2] - e, p[i * 2 + 1] - t);
			a < r && ([n, r] = [i, a]);
		}
		return n;
	};
	return /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement(r.SegmentedControl, {
		size: "sm",
		value: String(d),
		onChange: (e) => o(Number(e)),
		options: u.map((e, t) => ({
			value: String(t),
			label: e
		}))
	}), /* @__PURE__ */ e.createElement("svg", {
		ref: i,
		role: "img",
		"aria-label": `${u[d]} curve`,
		viewBox: "-2 -2 104 104",
		style: qt,
		onPointerDown: (e) => {
			let [t, n] = h(e), r = g(t, n);
			if (l.current = r < 0, r < 0) {
				let e = It(p, t, n);
				if (e.index < 0) return;
				m(e.curve), r = e.index;
			}
			e.currentTarget.setPointerCapture?.(e.pointerId), c(r);
		},
		onPointerMove: (e) => {
			if (s === null) return;
			let [t, n] = h(e);
			l.current = !0, m(Lt(p, s, t, n));
		},
		onPointerUp: () => {
			s !== null && (c(null), l.current && n.commit(`${n.name}: ${u[d].toLowerCase()} curve`));
		},
		onDoubleClick: (e) => {
			let [t, r] = h(e), i = g(t, r);
			i <= 0 || (m(Rt(p, i)), n.commit(`${n.name}: ${u[d].toLowerCase()} curve`));
		}
	}, /* @__PURE__ */ e.createElement("rect", {
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		fill: "currentColor",
		opacity: .06
	}), [
		25,
		50,
		75
	].map((t) => /* @__PURE__ */ e.createElement("g", {
		key: t,
		stroke: "currentColor",
		opacity: .15,
		strokeWidth: .3
	}, /* @__PURE__ */ e.createElement("line", {
		x1: t,
		y1: 0,
		x2: t,
		y2: 100
	}), /* @__PURE__ */ e.createElement("line", {
		x1: 0,
		y1: t,
		x2: 100,
		y2: t
	}))), /* @__PURE__ */ e.createElement("line", {
		x1: 0,
		y1: 100,
		x2: 100,
		y2: 0,
		stroke: "currentColor",
		opacity: .25,
		strokeWidth: .3,
		strokeDasharray: "1.5 1.5"
	}), /* @__PURE__ */ e.createElement("path", {
		d: Jt(p),
		fill: "none",
		stroke: "currentColor",
		strokeWidth: .8
	}), Array.from({ length: p.length / 2 }, (t, n) => /* @__PURE__ */ e.createElement("circle", {
		key: n,
		cx: p[n * 2],
		cy: 100 - p[n * 2 + 1],
		r: s === n ? 2.2 : 1.8,
		fill: "currentColor"
	}))), /* @__PURE__ */ e.createElement(r.Row, {
		gap: 6,
		justify: "space-between"
	}, /* @__PURE__ */ e.createElement("p", { style: {
		margin: 0,
		fontSize: 11,
		opacity: .7
	} }, "Press to add a point, drag to move it, double-click to remove it."), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: () => {
			m([...Ot]), n.commit(`${n.name}: ${u[d].toLowerCase()} curve reset`);
		}
	}, "Reset curve")));
}
//#endregion
//#region src/state.ts
var Xt = "gmic.store", Zt = null, Qt = null;
function $t(e) {
	Zt = null, Qt = e;
}
function en() {
	let { catalogue: e, loading: t, problem: n } = F().getState();
	Qt && !e && !t && !n && I(Qt);
}
function F() {
	return Zt ??= t.stores.create()(() => ({
		status: {
			busy: !1,
			error: null
		},
		focus: null,
		catalogue: null,
		problem: null,
		loading: !1,
		storeTab: "filters",
		storeScript: null,
		placing: null,
		brush: [
			220,
			120,
			60
		]
	})), Zt;
}
var tn = (e) => e instanceof Error ? e.message : String(e);
async function I(e, t = !1) {
	let n = F();
	n.setState({
		loading: !0,
		problem: null
	});
	try {
		let r = t ? await e.engine.update() : await e.engine.catalogue();
		return n.setState({
			catalogue: r,
			loading: !1
		}), r;
	} catch (e) {
		return n.setState({
			catalogue: null,
			loading: !1,
			problem: {
				needsUpdate: e instanceof Oe,
				text: tn(e)
			}
		}), null;
	}
}
function L(e) {
	return F()(e);
}
function R() {
	let [n, r] = e.useState(() => k(t.settings));
	return e.useEffect(() => t.settings.onChange((e) => {
		e === "installed" && r(k(t.settings));
	}), []), n;
}
function z(e) {
	dt(t.settings, e);
}
function nn(e, n = null) {
	F().setState({
		storeTab: e,
		storeScript: n
	}), t.windows.open(Xt);
}
//#endregion
//#region src/interactive/handles.ts
function rn(e) {
	return {
		position: "absolute",
		width: e,
		height: e,
		marginLeft: -e / 2,
		marginTop: -e / 2,
		borderRadius: "50%",
		border: "2px solid white",
		boxShadow: "0 0 0 1px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)",
		pointerEvents: "auto",
		touchAction: "none",
		cursor: t.cursors.resolve("crop-move")
	};
}
function an(e, n, r, i) {
	let a = t.develop.framePoint(e, n.clientX, n.clientY), o = (e) => Math.min(i[1], Math.max(i[0], e));
	return [o((a.x - r.x) / r.w * 100), o((a.y - r.y) / r.h * 100)];
}
//#endregion
//#region src/interactive/PointsEditor.tsx
var on = {
	warp: 4,
	colour: 5
}, sn = {
	margin: 0,
	fontSize: 11,
	opacity: .7
}, cn = [0, 100], B = (e) => `#${e.map((e) => Math.round(Math.min(255, Math.max(0, e))).toString(16).padStart(2, "0")).join("")}`, ln = (e) => {
	let t = /^#?([0-9a-f]{6})$/i.exec(e.trim());
	return t ? t[1].match(/../g).map((e) => parseInt(e, 16)) : null;
};
function un(t) {
	return [L((e) => e.placing === t), e.useCallback((e) => F().setState(e ? {
		placing: t,
		focus: t
	} : { placing: null }), [t])];
}
function dn(n) {
	let r = t.ui, [i, a] = e.useState(B(n.value));
	return e.useEffect(() => a(B(n.value)), [n.value]), /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement("span", {
		"aria-hidden": !0,
		style: {
			width: 16,
			height: 16,
			borderRadius: 3,
			background: B(n.value),
			flex: "none",
			boxShadow: "0 0 0 1px rgba(127,127,127,0.5)"
		}
	}), /* @__PURE__ */ e.createElement(r.TextInput, {
		"aria-label": n.label,
		value: i,
		onBlur: n.onCommit,
		onChange: (e) => {
			a(e);
			let t = ln(e);
			t && n.onChange(t);
		}
	}));
}
function fn(n) {
	return function(r) {
		let i = t.ui, [a, o] = un(r.id), s = L((e) => e.brush), c = P(r.data, on[n]), l = (e) => r.setData({ points: e }), u = n === "warp" ? "keypoints" : "colours";
		return /* @__PURE__ */ e.createElement(i.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement(i.Row, {
			gap: 6,
			wrap: !0
		}, /* @__PURE__ */ e.createElement(i.Button, {
			size: "sm",
			active: a,
			"aria-pressed": a,
			onClick: () => o(!a)
		}, a ? "Done" : n === "warp" ? "Add keypoints on the photo" : "Place colours on the photo"), c.length > 0 && /* @__PURE__ */ e.createElement(i.Button, {
			size: "sm",
			variant: "ghost",
			onClick: () => {
				l([]), r.commit(`${r.name}: ${u} cleared`);
			}
		}, "Clear")), /* @__PURE__ */ e.createElement("p", { style: sn }, n === "warp" ? "Press on what to move and drag it where it goes. Drag a keypoint to change it; double-click it to remove it." : "Press on the photo to place the colour below there; drag a point to move it, double-click it to remove it.", a && " Esc when done."), n === "colour" && /* @__PURE__ */ e.createElement(i.Field, { label: "Colour to place" }, /* @__PURE__ */ e.createElement(dn, {
			label: "Colour to place",
			value: s,
			onChange: (e) => F().setState({ brush: e }),
			onCommit: () => {}
		})), n === "colour" && c.map((t, n) => /* @__PURE__ */ e.createElement(i.Row, {
			key: n,
			gap: 6
		}, /* @__PURE__ */ e.createElement(dn, {
			label: `Colour ${n + 1}`,
			value: t.slice(2),
			onChange: (e) => l(c.map((t, r) => r === n ? [
				t[0],
				t[1],
				...e
			] : t)),
			onCommit: () => r.commit(`${r.name}: colour`)
		}), /* @__PURE__ */ e.createElement(i.Button, {
			size: "sm",
			variant: "ghost",
			"aria-label": `Remove colour ${n + 1}`,
			onClick: () => {
				l(c.filter((e, t) => t !== n)), r.commit(`${r.name}: colour removed`);
			}
		}, "×"))), n === "warp" && /* @__PURE__ */ e.createElement("p", { style: sn }, c.length === 1 ? "1 keypoint" : `${c.length} keypoints`));
	};
}
function pn(n) {
	return function(r) {
		let i = e.useRef(null), a = L((e) => e.placing === r.id), o = L((e) => e.brush), [s, c] = e.useState(null), l = e.useRef(!1), u = P(r.data, on[n]), { image: d } = r, f = (e) => r.setData({ points: e }), p = n === "warp" ? "keypoint" : "colour", m = (e) => an(i.current, e, d, cn), h = (e, t) => ({
			left: d.x + e / 100 * d.w,
			top: d.y + t / 100 * d.h
		}), g = (e, t) => f(u.map((n, r) => r === e ? [...t, ...n.slice(2)] : n)), _ = {
			onPointerMove: (e) => {
				s !== null && (l.current = !0, g(s, m(e)));
			},
			onPointerUp: () => {
				s !== null && (c(null), l.current && r.commit(`${r.name}: ${p}`));
			},
			onPointerCancel: () => c(null)
		};
		return /* @__PURE__ */ e.createElement("div", {
			ref: i,
			style: {
				position: "absolute",
				inset: 0,
				pointerEvents: "none"
			}
		}, a && /* @__PURE__ */ e.createElement("div", {
			"data-testid": "gmic-place-layer",
			style: {
				position: "absolute",
				left: d.x,
				top: d.y,
				width: d.w,
				height: d.h,
				pointerEvents: "auto",
				cursor: t.cursors.resolve("crosshair"),
				touchAction: "none"
			},
			onPointerDown: (e) => {
				let t = m(e);
				e.currentTarget.setPointerCapture?.(e.pointerId), f([...u, n === "warp" ? [...t, ...t] : [...t, ...o]]), l.current = !0, c(u.length);
			},
			..._
		}), n === "warp" && /* @__PURE__ */ e.createElement("svg", { style: {
			position: "absolute",
			inset: 0,
			width: "100%",
			height: "100%",
			overflow: "visible",
			pointerEvents: "none"
		} }, u.map(([t, n, r, i], a) => {
			let o = h(r, i), s = h(t, n);
			return /* @__PURE__ */ e.createElement("line", {
				key: a,
				x1: o.left,
				y1: o.top,
				x2: s.left,
				y2: s.top,
				stroke: "white",
				strokeWidth: 1.5,
				strokeDasharray: "3 2"
			});
		})), u.map((t, i) => /* @__PURE__ */ e.createElement("div", {
			key: i,
			role: "slider",
			"aria-label": `${r.name}: ${p} ${i + 1}`,
			"aria-valuetext": `${Math.round(t[0])} %, ${Math.round(t[1])} %`,
			style: {
				...rn(12),
				...h(t[0], t[1]),
				background: n === "colour" ? B(t.slice(2)) : "rgba(255,255,255,0.15)"
			},
			onPointerDown: (e) => {
				e.stopPropagation(), e.currentTarget.setPointerCapture?.(e.pointerId), l.current = !1, c(i);
			},
			onDoubleClick: () => {
				f(u.filter((e, t) => t !== i)), r.commit(`${r.name}: ${p} removed`);
			},
			..._
		})));
	};
}
//#endregion
//#region src/interactive/index.ts
var mn = [
	{
		command: "fx_curves_interactive",
		settings: [zt],
		job: (e, t, n) => Bt(t, n),
		Panel: Yt
	},
	{
		command: "fx_warp_interactive",
		settings: [],
		job: (e, t, n, r) => Ut(n, r),
		Panel: fn("warp"),
		Canvas: pn("warp")
	},
	{
		command: "fx_colorize_interactive",
		settings: [Wt],
		job: (e, t, n, r) => Gt(t, n, r),
		Panel: fn("colour"),
		Canvas: pn("colour")
	}
], hn = new Map(mn.map((e) => [e.command, e]));
function gn(e) {
	return hn.get(e);
}
function _n(e) {
	return !e.interactive || hn.has(e.command);
}
//#endregion
//#region src/jobs.ts
function vn(e, t, n = e.command) {
	let r = We(e.params, t);
	return {
		kind: "line",
		line: r ? `${n} ${r}` : n
	};
}
function yn(e, t) {
	return {
		kind: "script",
		source: e,
		args: We(x(e), t)
	};
}
function bn(e, t, n) {
	let r = ie(e, t);
	if (!r) throw Error(`No filter "${t}". gmic filters <words> searches them.`);
	return vn(r, Qe(r.params, n));
}
function xn(e, t, n, r) {
	let i = n;
	if (i === null) {
		let n = ot(e, t ?? "");
		if (!n) throw Error(`No script "${t}". gmic scripts lists them.`);
		i = n.source;
	}
	return yn(i, Qe(x(i), r));
}
function Sn(e, t) {
	return e.kind === "script" ? x(e.source) : t && ae(t, e.command)?.params || [];
}
var Cn = (e, t) => Array.isArray(e) && e.every((e) => typeof e == "number" && Number.isFinite(e)) && (t === void 0 || e.length === t);
function wn(e, t) {
	switch (e.kind) {
		case "float":
		case "int":
		case "choice": return typeof t == "number" && Number.isFinite(t);
		case "bool": return typeof t == "boolean";
		case "text": return typeof t == "string";
		case "color": return Cn(t) && t.length >= 3;
		case "point": return Cn(t, 2);
	}
}
function V(e, t) {
	let n = Re(e);
	for (let r of e) C(r) && wn(r, t[r.name]) && (n[r.name] = t[r.name]);
	return n;
}
function Tn(e, t, n) {
	if (!n) return t;
	let r = { ...t };
	for (let t of e) t.kind === "point" && Cn(r[t.name], 2) && (r[t.name] = n(r[t.name]));
	return r;
}
function En(e, t, n) {
	return St(e).map((e) => {
		if (e.kind === "script") {
			let t = x(e.source);
			return {
				kind: "script",
				source: e.source,
				args: We(t, Tn(t, V(t, e.values), n))
			};
		}
		if (!t) throw Error("G'MIC's filter list isn't loaded.");
		let r = ae(t, e.command);
		if (!r) throw Error(`This G'MIC has no "${e.name}" filter. Update G'MIC's filters in Preferences.`);
		let i = V(r.params, e.values);
		if (r.interactive) {
			let t = gn(r.command);
			if (!t) throw Error(`"${r.name}" only works in G'MIC's own window, which Safelight doesn't open.`);
			return t.job(r, i, e.data, n);
		}
		return vn(r, Tn(r.params, i, n));
	});
}
//#endregion
//#region src/command.ts
var Dn = "gmic", On = (e) => e instanceof Error ? e.message : String(e), kn = (e) => e instanceof DOMException && e.name === "AbortError";
async function An(e, t, n) {
	let { photos: r } = t;
	if (r.length === 0) throw Error(t.caller === "cli" ? "No photo to run on: open one, or name photos after --." : "No photo to run on: open one in Develop, or select some in the Library.");
	for (let n of r) {
		let r = await t.canSaveBeside(n);
		if (r) throw Error(`${e.displayName(n)}: ${r}`);
	}
	if (!await e.engine.program()) throw new De();
	let i = [], a = [];
	for (let [o, s] of r.entries()) {
		t.signal.throwIfAborted();
		let c = e.displayName(s), l = r.length > 1 ? ` (${o + 1} of ${r.length})` : "", u = t.progress(`${c}${l}: rendering`);
		try {
			let r = await e.render(s, t.signal);
			u.update(`${c}${l}: running G'MIC`);
			let a = await e.engine.run(r, n, { signal: t.signal }), o = [];
			for (let e of a) o.push(await t.saveBeside(s, new Blob([new Uint8Array(e)], { type: "image/png" }), Dn, "png"));
			i.push(...o), u.done(`${c} → ${o.join(", ")}`);
		} catch (e) {
			if (u.done(), kn(e) || t.signal.aborted) throw e;
			a.push({
				photo: c,
				error: On(e)
			}), t.warn(`${c}: ${On(e)}`);
		}
	}
	if (t.result({
		saved: i,
		failed: a
	}), a.length === r.length) throw Error(a.length === 1 ? a[0].error : `G'MIC failed on every photo. The first: ${a[0].error}`);
}
function jn(e) {
	return {
		name: "gmic",
		summary: "Run G'MIC filters and scripts on photos, each result saved beside its photo",
		usage: [...E],
		examples: [
			"gmic blur 3 sharpen 50",
			"gmic filters sharpen",
			"gmic filter \"Sharpen [Unsharp Mask]\" radius=2",
			"gmic script Soft Glow strength=0.4"
		],
		subcommands: $e.map((e) => ({ ...e })),
		async run(t) {
			let n = nt(t.words);
			switch (n.kind) {
				case "usage":
					for (let e of E) t.print(e);
					return;
				case "status": {
					let n = await e.engine.program();
					if (!n) throw new De();
					t.print(`G'MIC ${await e.engine.version()}: ${n.path}`);
					return;
				}
				case "update": {
					let n = t.progress("Downloading G'MIC's filter definitions");
					try {
						let n = (await e.engine.update({ signal: t.signal })).categories.reduce((e, t) => e + t.filters.length, 0);
						t.print(`G'MIC's filters are up to date: ${n} filters.`);
					} finally {
						n.done();
					}
					return;
				}
				case "help":
					if (!n.topic) {
						for (let e of E) t.print(e);
						return;
					}
					t.print(await e.engine.help(n.topic));
					return;
				case "filters": {
					let r = oe(await e.engine.catalogue({ signal: t.signal }), n.search);
					r.length === 0 && t.info(n.search ? `No filter matches "${n.search}".` : "G'MIC lists no filters.");
					for (let e of r) t.print(`${e.category} › ${e.name}   ${e.command}`);
					t.result(r.map((e) => ({
						category: e.category,
						name: e.name,
						command: e.command
					})));
					return;
				}
				case "scripts": {
					let n = e.scripts();
					n.length === 0 && t.info("No scripts yet. Write one in the G'MIC store's Scripts tab.");
					for (let e of n) {
						let n = x(e.source).filter(C).map((e) => e.name);
						t.print(n.length > 0 ? `${e.name}   ${n.join(", ")}` : e.name);
					}
					t.result(n.map((e) => ({ name: e.name })));
					return;
				}
				case "pipeline": return An(e, t, {
					kind: "line",
					line: n.line
				});
				case "filter": return An(e, t, bn(await e.engine.catalogue({ signal: t.signal }), n.name, n.assignments));
				case "script": return An(e, t, xn(e.scripts(), n.name, n.source, n.assignments));
			}
		}
	};
}
var H = (e) => `${D}.${e}`, Mn = "\nif (mode > 0) {\n  vec2 t = (viewUv - area.xy) / area.zw;\n  bool ready = texture(gmicOut, vec2(0.5)).a > 1.5 && (mode == 1 || texture(gmicIn, vec2(0.5)).a > 1.5);\n  if (ready && t.x >= 0.0 && t.y >= 0.0 && t.x <= 1.0 && t.y <= 1.0) {\n    vec2 r = (t - place.xy) / place.zw;\n    bool inside = r.x >= 0.0 && r.y >= 0.0 && r.x <= 1.0 && r.y <= 1.0;\n    vec3 shown = inside ? texture(gmicOut, r).rgb : vec3(0.0);\n    c = mode == 2 ? c + (shown - texture(gmicIn, t).rgb) : shown;\n  }\n}";
function Nn() {
	return {
		id: D,
		name: "G'MIC",
		phase: "output-encode",
		priority: 1e5,
		viewOnly: !0,
		space: {
			encoding: "perceptual",
			primaries: "rec709"
		},
		uniforms: [
			{
				key: "mode",
				glslType: "int",
				default: 0
			},
			{
				key: "area",
				glslType: "vec4",
				default: [
					0,
					0,
					1,
					1
				]
			},
			{
				key: "place",
				glslType: "vec4",
				default: [
					0,
					0,
					1,
					1
				]
			}
		],
		textures: [{
			key: "gmicOut",
			kind: "dynamic",
			format: "rgba16f"
		}, {
			key: "gmicIn",
			kind: "dynamic",
			format: "rgba16f"
		}],
		dormantWhen: { mode: 0 },
		glsl: Mn
	};
}
function Pn(e, t, n, r) {
	for (let t = 3; t < e.length; t += 4) e[t] = 2;
	return {
		data: e,
		width: t,
		height: n,
		format: "rgba16f",
		version: r
	};
}
//#endregion
//#region src/preview.ts
var U = [
	0,
	0,
	1,
	1
], Fn = 1048576, In = {
	texture: 64 * Fn,
	held: 256 * Fn
}, Ln = (e, t) => e * t * 16;
function Rn(e, t = In.texture) {
	let n = Math.max(e, 1 / e), r = Math.floor(Math.sqrt(t / 16 * n));
	for (; r > 1 && Ln(r, Math.ceil(r / n)) > t;) r--;
	return r;
}
function W(e) {
	return JSON.stringify([
		St(e.stack),
		e.frame,
		e.upstream,
		e.area,
		e.maxEdge
	]);
}
function zn(e) {
	let [t, n, r, i] = e;
	return ([e, a]) => [(e / 100 - t) / r * 100, (a / 100 - n) / i * 100];
}
function Bn(e, t, n) {
	let r = t / n;
	return Math.abs(r - e) < 1e-6 ? U : r > e ? [
		0,
		(1 - e / r) / 2,
		1,
		e / r
	] : [
		(1 - r / e) / 2,
		0,
		r / e,
		1
	];
}
function Vn(e, t) {
	let n = fe(e, 1 / 255), r = e.width === t.width && e.height === t.height;
	for (let e = 0; e < n.length; e += 4) {
		let i = Math.min(1, Math.max(0, n[e + 3]));
		if (i < 1) for (let a = 0; a < 3; a++) n[e + a] = n[e + a] * i + (r ? t.rgba[e + a] * (1 - i) : 0);
		n[e + 3] = 1;
	}
	return {
		rgba: n,
		width: e.width,
		height: e.height
	};
}
var Hn = (e) => e instanceof Error ? e.message : String(e), Un = 4, Wn = class {
	io;
	limits;
	request = null;
	shown = null;
	kept = [];
	made = 0;
	timer = null;
	running = !1;
	generation = 0;
	stopped = !1;
	drawn = "";
	constructor(e, t = In) {
		this.io = e, this.limits = t;
	}
	view(e, t) {
		let n = t?.area ?? U, r = t?.place ?? U, i = e === 0 ? null : t?.variant ?? null, a = e === 0 ? "" : JSON.stringify([
			e,
			n,
			r,
			i
		]);
		a !== this.drawn && (this.drawn = a, this.io.view(e, n, r, i));
	}
	hide() {
		this.view(0, null), this.shown = null;
	}
	forgetAll() {
		this.hide();
		for (let e of this.kept) this.io.forget(e.variant);
		this.kept = [];
	}
	show(e) {
		this.kept = [...this.kept.filter((t) => t !== e), e], this.shown = e, this.view(1, e);
	}
	makeRoom(e) {
		let t = this.kept.reduce((e, t) => e + t.bytes, 0);
		for (; this.kept.length > 0 && t + e > this.limits.held;) {
			let e = this.kept.shift();
			t -= e.bytes, this.io.forget(e.variant);
		}
	}
	keep(e) {
		for (this.kept.push(e); this.kept.length > Un;) this.io.forget(this.kept.shift().variant);
	}
	update(e) {
		if (this.stopped) return;
		if (!e || St(e.stack).length === 0) {
			this.request = null, this.clearTimer(), this.generation++, this.hide(), this.io.status({
				busy: !1,
				error: null
			});
			return;
		}
		this.request = e, this.kept.length > 0 && this.kept[0].frame !== e.frame && this.forgetAll();
		let t = this.shown;
		if (e.held) {
			this.clearTimer(), t?.sameSize && this.view(2, t);
			return;
		}
		let n = this.kept.find((t) => t.key === W(e));
		n ? (this.clearTimer(), this.running || this.show(n)) : (t && t.upstream !== e.upstream && t.sameSize && this.view(2, t), this.schedule(this.io.delay));
	}
	dispose() {
		this.update(null), this.forgetAll(), this.stopped = !0;
	}
	clearTimer() {
		this.timer !== null && clearTimeout(this.timer), this.timer = null;
	}
	schedule(e) {
		this.clearTimer(), this.timer = setTimeout(() => {
			this.timer = null, this.start();
		}, e);
	}
	async start() {
		let e = this.request;
		if (this.running || !e || e.held) return;
		let t = W(e), n = this.kept.find((e) => e.key === t);
		if (n) return this.show(n);
		this.running = !0;
		let r = this.generation;
		this.io.status({
			busy: !0,
			error: null
		});
		try {
			let n = await this.io.capture(e.maxEdge);
			if (r !== this.generation) return;
			if (!n) {
				this.io.status({
					busy: !1,
					error: null
				});
				return;
			}
			let i = await this.io.run(de(n.rgba, n.width, n.height, 255), e.stack, zn(n.area));
			if (r !== this.generation) return;
			let a = Ln(i.width, i.height), o = Ln(n.width, n.height), s = a + o;
			if (Math.max(a, o) > this.limits.texture || s > this.limits.held) throw Error(`G'MIC's result, ${i.width} × ${i.height}, is too big to preview. Choose a smaller Preview size in Preferences ▸ G'MIC.`);
			let c = i.width === n.width && i.height === n.height, l = c ? U : Bn(n.width / n.height, i.width, i.height), u = `r${++this.made}`, d = Vn(i, n);
			this.makeRoom(s), this.io.upload(u, d, {
				rgba: n.rgba,
				width: n.width,
				height: n.height
			});
			let f = {
				key: t,
				frame: e.frame,
				upstream: e.upstream,
				area: n.area,
				place: l,
				sameSize: c,
				variant: u,
				bytes: s
			};
			this.keep(f), this.shown = f;
			let p = this.request, m = p !== null && (p.held || W(p) !== t && p.upstream !== e.upstream) && c;
			this.view(m ? 2 : 1, f), this.io.status({
				busy: !1,
				error: null
			});
		} catch (e) {
			if (r !== this.generation) return;
			this.hide(), this.io.status({
				busy: !1,
				error: Hn(e)
			});
		} finally {
			this.running = !1;
			let e = this.request;
			e && !e.held && r === this.generation && W(e) !== t ? this.schedule(0) : e && !e.held && r !== this.generation && this.schedule(this.io.delay);
		}
	}
}, Gn = 65535;
function Kn(e) {
	if (!e || e.stack.length === 0) return null;
	let t = typeof e.currentIndex == "number" ? Math.trunc(e.currentIndex) : NaN, n = Number.isNaN(t) ? e.stack.length - 1 : Math.min(Math.max(t, 0), e.stack.length - 1);
	return e.stack[n].paramBag ?? null;
}
function qn(e) {
	return {
		id: "gmic.export",
		label: "G'MIC",
		settings: [{
			key: "enabled",
			label: "Apply G'MIC filters",
			hint: "Each photo's G'MIC panels, as it shows them in Develop.",
			type: "boolean",
			default: !0
		}],
		async processPixels(t, n, r) {
			if (r.enabled === !1) return;
			let i = xt(e.installed(), Kn(await e.editState(n.id)));
			if (i.length === 0) return;
			let a = En(i, i.some((e) => e.kind === "filter") ? await e.catalogue() : null), { width: o, height: s } = t, c = de(t.data, o, s, 255 / Gn), l = await e.runStack(c, a, { vars: Ce(o, s) }), u = new Float32Array(t.data.length);
			for (let e = 0; e < u.length; e++) u[e] = t.data[e] / Gn;
			let d = Vn(l, {
				rgba: u,
				width: o,
				height: s
			}), f = new Uint16Array(d.rgba.length);
			for (let e = 0; e < f.length; e++) f[e] = Math.round(Math.min(1, Math.max(0, d.rgba[e])) * Gn);
			return {
				...t,
				data: f,
				width: d.width,
				height: d.height
			};
		}
	};
}
//#endregion
//#region src/render.ts
var Jn = [
	{
		value: "full",
		label: "Full size"
	},
	{
		value: "4096",
		label: "4096 px"
	},
	{
		value: "2048",
		label: "2048 px"
	},
	{
		value: "1024",
		label: "1024 px"
	}
];
function Yn(e) {
	let t = e.get("size", null);
	return typeof t == "number" && t > 0 ? t : null;
}
function Xn(e, t) {
	e.set("size", t === "full" ? null : Number(t));
}
async function Zn(e, t, n) {
	let [r] = await e.export.renderPhotos([t], {
		format: "image/png",
		pngBitDepth: n.bits,
		colorSpace: "srgb",
		includeMetadata: !1,
		sharpenAmount: 0,
		longEdge: n.longEdge
	}, void 0, {
		processors: !1,
		signal: n.signal
	});
	if (n.signal?.throwIfAborted(), !r?.blob) throw Error("Safelight couldn't render the photo.");
	return new Uint8Array(await r.blob.arrayBuffer());
}
//#endregion
//#region src/download.ts
var G = "https://gmic.eu/download.html", Qn = "brew install gmic";
function $n(e, t) {
	let n = e ?? "";
	return n === "win32" || !n && /Windows/i.test(t) ? "windows" : n === "darwin" || !n && /Mac OS X|Macintosh/i.test(t) ? "mac" : "linux";
}
function er() {
	return $n(window.safelightNative?.platform, navigator.userAgent);
}
var tr = (e) => e.split(".").map(Number);
function nr(e, t) {
	let [n, r] = [tr(e), tr(t)];
	for (let e = 0; e < Math.max(n.length, r.length); e++) if ((n[e] ?? 0) !== (r[e] ?? 0)) return (n[e] ?? 0) > (r[e] ?? 0);
	return !1;
}
function rr(e) {
	let t = null;
	for (let n of e.matchAll(/windows\/gmic_(\d+(?:\.\d+)+)_cli_win64\.zip/g)) (!t || nr(n[1], t)) && (t = n[1]);
	return t ? `https://gmic.eu/get_file.php?file=windows/gmic_${t}_cli_win64.zip` : null;
}
async function ir(e) {
	try {
		let t = await e(G);
		return t.ok ? rr(await t.text()) ?? "https://gmic.eu/download.html" : G;
	} catch {
		return G;
	}
}
//#endregion
//#region src/Setup.tsx
var ar = (e) => e instanceof Error ? e.message : String(e), K = {
	margin: 0,
	fontSize: 11,
	opacity: .7
};
function or(t) {
	let [n, r] = e.useState(void 0), [i, a] = e.useState(""), o = e.useCallback(async () => {
		let e = await t.engine.program();
		r(e), a(""), e && t.engine.version().then(a, () => a(""));
	}, [t]);
	return e.useEffect(() => void o(), [o]), {
		program: n,
		version: i,
		refresh: o
	};
}
function sr(n) {
	let r = t.ui, [i, a] = e.useState(null), o = (e) => async () => {
		a(null);
		try {
			await e(), n.deps.engine.reset(), n.onChange();
		} catch (e) {
			a(ar(e));
		}
	}, s = o(async () => {
		await t.programs.locate("gmic") || a("No gmic program was found where programs usually are, or it wasn't allowed. Choose it yourself.");
	}), c = o(() => t.programs.pick({
		title: "Choose the gmic program",
		replacing: n.program?.token ?? null
	})), l = o(async () => {
		n.program && await t.programs.forget(n.program.token);
	});
	return /* @__PURE__ */ e.createElement(r.Section, { title: "G'MIC program" }, /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, n.program ? /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement("p", { style: {
		...K,
		wordBreak: "break-all"
	} }, n.version ? `G'MIC ${n.version}` : "G'MIC", " · ", n.program.path), /* @__PURE__ */ e.createElement(r.Row, {
		gap: 6,
		wrap: !0
	}, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		onClick: c
	}, "Change…"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: l
	}, "Forget"))) : /* @__PURE__ */ e.createElement(ur, {
		find: s,
		choose: c
	}), i && /* @__PURE__ */ e.createElement("p", {
		role: "alert",
		style: {
			...K,
			opacity: 1
		}
	}, i)));
}
var q = {
	margin: 0,
	paddingLeft: 18,
	fontSize: 11,
	display: "grid",
	gap: 6
}, cr = {
	fontSize: 11,
	userSelect: "all"
}, lr = (e) => void window.open(e, "_blank", "noopener,noreferrer");
function ur(n) {
	let r = t.ui, i = e.useMemo(er, []), [a, o] = e.useState(null), [s, c] = e.useState(!1), l = async () => {
		o("Looking up the newest G'MIC…");
		let e = await ir((e) => t.network.fetch(e));
		lr(e), o(e === "https://gmic.eu/download.html" ? "gmic.eu's download page is open in your browser: get the command-line (CLI) zip for Windows." : "Your browser is downloading the zip.");
	}, u = async () => {
		await navigator.clipboard.writeText(Qn), c(!0);
	}, d = /* @__PURE__ */ e.createElement("p", { style: K }, "G'MIC is a free program, from gmic.eu, that this panel runs. Set it up once:");
	return i === "windows" ? /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, d, /* @__PURE__ */ e.createElement("ol", { style: q }, /* @__PURE__ */ e.createElement("li", null, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "primary",
		onClick: () => void l()
	}, "Download G'MIC")), /* @__PURE__ */ e.createElement("li", null, "Unzip it into a folder you keep, such as Documents\\G'MIC."), /* @__PURE__ */ e.createElement("li", null, "Choose gmic.exe in that folder.", /* @__PURE__ */ e.createElement(r.Row, {
		gap: 6,
		wrap: !0
	}, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		onClick: n.choose
	}, "Choose…"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: n.find
	}, "Find G'MIC")))), a && /* @__PURE__ */ e.createElement("p", { style: K }, a)) : i === "mac" ? /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, d, /* @__PURE__ */ e.createElement("ol", { style: q }, /* @__PURE__ */ e.createElement("li", null, "Install it with Homebrew: in the Terminal app, run", /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement("code", { style: cr }, Qn), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: () => void u()
	}, s ? "Copied" : "Copy"))), /* @__PURE__ */ e.createElement("li", null, "Then find it here.", /* @__PURE__ */ e.createElement(r.Row, {
		gap: 6,
		wrap: !0
	}, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "primary",
		onClick: n.find
	}, "Find G'MIC"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		onClick: n.choose
	}, "Choose…")))), /* @__PURE__ */ e.createElement("p", { style: K }, "No Homebrew yet? It installs from brew.sh.")) : /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, d, /* @__PURE__ */ e.createElement("ol", { style: q }, /* @__PURE__ */ e.createElement("li", null, "Install your distribution's gmic package, such as sudo apt install gmic or sudo dnf install gmic."), /* @__PURE__ */ e.createElement("li", null, "Then find it here.", /* @__PURE__ */ e.createElement(r.Row, {
		gap: 6,
		wrap: !0
	}, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "primary",
		onClick: n.find
	}, "Find G'MIC"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		onClick: n.choose
	}, "Choose…"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: () => lr(G)
	}, "Download page")))));
}
//#endregion
//#region src/Prefs.tsx
var dr = {
	margin: 0,
	fontSize: 11,
	opacity: .7
}, J = "previewSize", fr = [
	{
		value: "screen",
		label: "As shown on screen"
	},
	{
		value: "2048",
		label: "2048 px at most"
	},
	{
		value: "1024",
		label: "1024 px at most (fastest)"
	}
];
function pr(e, t) {
	let n = e.get(J, "screen"), r = typeof n == "string" && /^\d+$/.test(n) ? Number(n) : Infinity;
	return Math.max(64, Math.round(Math.min(t, r)));
}
function mr(n) {
	let r = t.ui, i = L((e) => e.catalogue), a = L((e) => e.problem), o = L((e) => e.loading), s = i?.categories.reduce((e, t) => e + t.filters.length, 0) ?? 0;
	return /* @__PURE__ */ e.createElement(r.Section, { title: "Filters" }, /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, o && /* @__PURE__ */ e.createElement(r.ProgressBar, {
		indeterminate: !0,
		label: "Reading G'MIC's filters…"
	}), !o && i && /* @__PURE__ */ e.createElement("p", { style: dr }, `${s} filters${i.version ? `, for G'MIC ${i.version}` : ""}.`), !o && a && /* @__PURE__ */ e.createElement("p", { style: dr }, a.needsUpdate ? "G'MIC's filter list comes with its update, which hasn't been downloaded yet." : a.text), /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		disabled: o,
		onClick: () => void I(n.deps, !0)
	}, i ? "Update filters" : "Download filters"))));
}
function hr(n) {
	let r = t.ui, [i, a] = e.useState(n.value);
	return /* @__PURE__ */ e.createElement(r.Field, {
		label: n.label,
		hint: n.hint
	}, /* @__PURE__ */ e.createElement(r.Select, {
		ariaLabel: n.label,
		value: i,
		options: n.options.map((e) => ({ ...e })),
		onChange: (e) => {
			a(e), n.onChange(e);
		}
	}));
}
function gr(n) {
	let r = t.ui, { program: i, version: a, refresh: o } = or(n.deps);
	return i === void 0 ? null : /* @__PURE__ */ e.createElement(r.Stack, { gap: 12 }, /* @__PURE__ */ e.createElement(sr, {
		deps: n.deps,
		program: i,
		version: a,
		onChange: () => {
			o(), I(n.deps);
		}
	}), i && /* @__PURE__ */ e.createElement(mr, { deps: n.deps }), /* @__PURE__ */ e.createElement(r.Section, { title: "Preview" }, /* @__PURE__ */ e.createElement(hr, {
		label: "Preview size",
		hint: "How large a picture G'MIC previews in Develop. Smaller is faster; exports always run at full size.",
		value: String(t.settings.get(J, "screen")),
		options: fr,
		onChange: (e) => t.settings.set(J, e)
	})), /* @__PURE__ */ e.createElement(r.Section, { title: "gmic command" }, /* @__PURE__ */ e.createElement(hr, {
		label: "Render at",
		hint: "The size the gmic command in the Terminal and at the command line runs at, each result saved beside its photo.",
		value: String(Yn(t.settings) ?? "full"),
		options: Jn,
		onChange: (e) => Xn(t.settings, e)
	})));
}
//#endregion
//#region src/Overlay.tsx
var _r = {
	encoding: "perceptual",
	primaries: "rec709"
};
function vr(e, t) {
	return [
		(e.x - t.x) / t.w,
		(e.y - t.y) / t.h,
		e.w / t.w,
		e.h / t.h
	];
}
function yr(e, t) {
	return JSON.stringify([
		e,
		t.crop,
		t.straighten,
		t.transform,
		t.uprightMode,
		t.guidedLines
	]);
}
var br = (e) => Object.entries(e).some(([e, t]) => t && !e.startsWith("gmic.f."));
function xr(e, t, n) {
	let r = Object.keys(n).filter((e) => !e.startsWith(`${D}.`)).sort().map((e) => [e, n[e]]);
	return JSON.stringify([
		e,
		t,
		r
	]);
}
function Sr(n, r) {
	let i = e.useRef(r);
	i.current = r;
	let a = e.useRef(null);
	e.useEffect(() => {
		let e = 0, r = new Wn({
			delay: 120,
			async capture(e) {
				let { rect: n, imageRect: r } = i.current;
				if (!n || !r) return null;
				let a = t.stores.useDevelopStore.getState().params, o = await t.develop.captureFloatFrame(a, {
					point: "pre-output",
					space: _r,
					maxEdge: e
				});
				return o ? {
					rgba: o.data,
					width: o.width,
					height: o.height,
					area: vr(n, r)
				} : null;
			},
			run(e, t, r) {
				let i = En(t, F().getState().catalogue, r);
				return n.engine.runStack(e, i, { vars: Ce(e.width, e.height, !0) });
			},
			upload(n, r, i) {
				e++, t.setStageTexture(D, "gmicOut", Pn(r.rgba, r.width, r.height, e), n), t.setStageTexture(D, "gmicIn", Pn(i.rgba, i.width, i.height, e), n);
			},
			forget(e) {
				t.setStageTexture(D, "gmicOut", null, e), t.setStageTexture(D, "gmicIn", null, e);
			},
			view(e, n, r, i) {
				t.develop.setViewValues(e === 0 ? null : {
					[H("mode")]: e,
					[H("area")]: [...n],
					[H("place")]: [...r],
					[H("gmicOut")]: i,
					[H("gmicIn")]: i
				});
			},
			status: (e) => F().setState({ status: e })
		});
		return a.current = r, () => {
			r.dispose(), a.current = null, t.develop.setViewValues(null);
		};
	}, [n]);
	let o = R(), s = t.stores.useDevelopStore((e) => e.photoId), c = t.stores.useDevelopStore((e) => e.params), l = t.stores.useDevelopStore((e) => e.paramBag), u = t.stores.useDevelopStore((e) => e.bypassedPanels), d = L((e) => e.catalogue), [f, p] = e.useState(() => t.settings.get(J, "screen"));
	e.useEffect(() => t.settings.onChange((e, t) => e === "previewSize" && p(t)), []);
	let { rect: m, imageRect: h, nonce: g } = r;
	e.useEffect(() => {
		let e = a.current;
		if (!e) return;
		let n = xt(o, l, (e) => u[O(e)] === !0);
		if (!s || !m || !h || n.length === 0) return e.update(null);
		if (!d && n.some((e) => e.kind === "filter")) return en(), e.update(null);
		let r = Math.max(m.w, m.h) * (window.devicePixelRatio || 1);
		e.update({
			stack: n,
			frame: yr(s, c),
			upstream: xr(s, c, l),
			held: br(u),
			area: vr(m, h),
			maxEdge: Math.min(pr(t.settings, r), Rn(m.w / m.h))
		});
	}, [
		n,
		o,
		s,
		c,
		l,
		u,
		d,
		m,
		h,
		g,
		f
	]);
}
var Cr = [-200, 300];
function wr(n) {
	let r = e.useRef(null), [i, a] = e.useState(null), o = t.stores.useDevelopStore((e) => e.paramBag[O(n.item.id)]), s = L((e) => e.catalogue), c = A({ [O(n.item.id)]: o }, n.item.id), l = Sn(n.item, s), u = V(l, c?.values ?? {}), d = l.filter((e) => e.kind === "point");
	if (!c?.on || d.length === 0) return null;
	let f = (e) => {
		let t = r.current;
		return t ? an(t, e, n.image, Cr) : null;
	}, p = (e, r) => {
		let i = f(r);
		if (!i) return;
		let a = A(t.stores.useDevelopStore.getState().paramBag, n.item.id);
		t.stores.useDevelopStore.getState().setDynParams(vt(n.item.id, yt(a, e, i)));
	};
	return /* @__PURE__ */ e.createElement("div", {
		ref: r,
		style: {
			position: "absolute",
			inset: 0,
			pointerEvents: "none"
		}
	}, d.map((r) => {
		if (r.kind !== "point") return null;
		let [o, s] = u[r.name];
		return /* @__PURE__ */ e.createElement("div", {
			key: r.name,
			role: "slider",
			"aria-label": `${n.item.name}: ${r.name}`,
			"aria-valuetext": `${Math.round(o)} %, ${Math.round(s)} %`,
			title: r.name,
			style: {
				...rn(14),
				background: "rgba(255,255,255,0.15)",
				left: n.image.x + o / 100 * n.image.w,
				top: n.image.y + s / 100 * n.image.h
			},
			onPointerDown: (e) => {
				e.stopPropagation(), e.currentTarget.setPointerCapture(e.pointerId), a(r.name);
			},
			onPointerMove: (e) => i === r.name && p(r.name, e),
			onPointerUp: (e) => {
				i === r.name && (p(r.name, e), a(null), t.stores.useDevelopStore.getState().commitEdit(`G'MIC: ${n.item.name}: ${r.name.toLowerCase()}`));
			},
			onPointerCancel: () => a(null)
		});
	}));
}
function Tr(n) {
	let r = t.develop.useDevelopOverlay();
	Sr(n.deps, r);
	let i = L((e) => e.focus), a = R().find((e) => e.id === i), o = Dr();
	return /* @__PURE__ */ e.createElement(e.Fragment, null, r.rect && /* @__PURE__ */ e.createElement(kr, { shown: r.rect }), a && r.imageRect && !o && /* @__PURE__ */ e.createElement(Ar, {
		item: a,
		image: r.imageRect
	}));
}
var Er = {
	overlay: Or,
	zoomable: !0,
	onEscape: () => F().setState({ placing: null })
};
function Dr() {
	let n = L((e) => e.placing !== null), r = t.develop.useCanvasToolHeld(), i = e.useRef(!1);
	return e.useEffect(() => {
		!r && i.current && F().setState({ placing: null });
	}, [r]), e.useEffect(() => {
		if (n) return t.develop.setCanvasTool(Er), i.current = !0, () => {
			i.current = !1, t.develop.setCanvasTool(null);
		};
	}, [n]), n;
}
function Or() {
	let n = t.develop.useDevelopOverlay(), r = L((e) => e.placing), i = R().find((e) => e.id === r);
	return i && n.imageRect ? /* @__PURE__ */ e.createElement(Ar, {
		item: i,
		image: n.imageRect
	}) : null;
}
function kr(n) {
	let r = L((e) => e.status.busy);
	if (!t.ui.useDelayedFlag(r, 250)) return null;
	let { x: i, y: a, w: o } = n.shown, { tokens: s } = t.ui;
	return /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement("div", {
		role: "progressbar",
		"aria-label": "G'MIC is working on the preview",
		className: "sl-enter-fade",
		style: {
			position: "absolute",
			left: i,
			top: a,
			width: o,
			height: 2,
			overflow: "hidden",
			pointerEvents: "none"
		}
	}, /* @__PURE__ */ e.createElement("div", {
		className: "sl-indeterminate",
		style: {
			position: "absolute",
			top: 0,
			bottom: 0,
			width: "33.333%",
			background: s.sliderFill
		}
	})), /* @__PURE__ */ e.createElement("div", {
		"aria-hidden": !0,
		className: "sl-enter-fade",
		style: {
			position: "absolute",
			left: i + o - 8,
			top: a + 8,
			transform: "translateX(-100%)",
			padding: "2px 8px",
			borderRadius: 4,
			background: s.surface2,
			color: s.textMuted,
			fontSize: 11,
			pointerEvents: "none",
			whiteSpace: "nowrap"
		}
	}, /* @__PURE__ */ e.createElement(t.ui.LoadingDots, { label: "G'MIC" })));
}
function Ar(n) {
	let { item: r, image: i } = n, a = t.stores.useDevelopStore((e) => e.paramBag[O(r.id)]), o = L((e) => e.catalogue), s = r.kind === "filter" ? o?.categories.flatMap((e) => e.filters).find((e) => e.command === r.command) : void 0, c = s?.interactive ? gn(s.command) : void 0, l = L((e) => e.placing === r.id);
	if (!c?.Canvas || !s) return /* @__PURE__ */ e.createElement(wr, {
		item: r,
		image: i
	});
	let u = A({ [O(r.id)]: a }, r.id);
	if (!u?.on && !l) return null;
	let d = c.Canvas;
	return /* @__PURE__ */ e.createElement(d, {
		id: r.id,
		name: r.name,
		filter: s,
		values: V(s.params, u?.values ?? {}),
		data: u?.data,
		image: i,
		setData: (e) => {
			let n = A(t.stores.useDevelopStore.getState().paramBag, r.id);
			t.stores.useDevelopStore.getState().setDynParams(vt(r.id, bt(n, e)));
		},
		commit: (e) => void t.stores.useDevelopStore.getState().commitEdit(`G'MIC: ${e}`)
	});
}
//#endregion
//#region src/ParamControls.tsx
var jr = (e) => `#${e.slice(0, 3).map((e) => Math.max(0, Math.min(255, Math.round(e))).toString(16).padStart(2, "0")).join("")}`;
function Mr(e) {
	let t = /^#?([0-9a-f]{6})$/i.exec(e.trim());
	return t ? t[1].match(/../g).map((e) => parseInt(e, 16)) : null;
}
function Nr(n) {
	let r = t.ui, [i, a] = e.useState(jr(n.value));
	e.useEffect(() => a(jr(n.value)), [n.value]);
	let o = n.value.length > 3 ? n.value[3] : null;
	return /* @__PURE__ */ e.createElement(r.Field, { label: n.name }, /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement(r.TextInput, {
		value: i,
		"aria-label": n.name,
		onBlur: n.onCommit,
		onChange: (e) => {
			a(e);
			let t = Mr(e);
			t && n.onChange(o === null ? t : [...t, o]);
		}
	}), o !== null && /* @__PURE__ */ e.createElement(r.NumberInput, {
		value: o,
		min: 0,
		max: 255,
		width: "4.5em",
		"aria-label": `${n.name} opacity`,
		onBlur: n.onCommit,
		onChange: (e) => n.onChange([...n.value.slice(0, 3), Math.max(0, Math.min(255, e))])
	})));
}
var Pr = {
	margin: 0,
	fontSize: 11,
	opacity: .7,
	whiteSpace: "pre-wrap"
};
function Fr(n) {
	let r = t.ui, { Slider: i } = t.components, a = (e, t) => {
		n.onChange(e, t), n.onCommit(e);
	};
	return /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, n.params.map((t, o) => {
		switch (t.kind) {
			case "float":
			case "int": {
				let r = Number(n.values[t.name] ?? t.default), a = t.kind === "int" ? 1 : Math.max((t.max - t.min) / 200, 1e-4);
				return /* @__PURE__ */ e.createElement(i, {
					key: o,
					label: t.name,
					value: r,
					min: t.min,
					max: t.max,
					step: a,
					defaultValue: t.default,
					onChange: (e) => n.onChange(t.name, t.kind === "int" ? Math.round(e) : e),
					onCommit: () => n.onCommit(t.name)
				});
			}
			case "bool": return /* @__PURE__ */ e.createElement(r.Toggle, {
				key: o,
				label: t.name,
				checked: n.values[t.name] === !0,
				onChange: (e) => a(t.name, e)
			});
			case "choice": return /* @__PURE__ */ e.createElement(r.Field, {
				key: o,
				label: t.name
			}, /* @__PURE__ */ e.createElement(r.Select, {
				ariaLabel: t.name,
				value: String(n.values[t.name] ?? t.default),
				options: t.choices.map((e, t) => ({
					value: String(t),
					label: e
				})),
				onChange: (e) => a(t.name, Number(e))
			}));
			case "color": {
				let r = n.values[t.name];
				return /* @__PURE__ */ e.createElement(Nr, {
					key: o,
					name: t.name,
					value: Array.isArray(r) ? r : t.default,
					onChange: (e) => n.onChange(t.name, e),
					onCommit: () => n.onCommit(t.name)
				});
			}
			case "point": {
				let i = n.values[t.name], [a, s] = Array.isArray(i) ? i : t.default;
				return /* @__PURE__ */ e.createElement(r.Field, {
					key: o,
					label: `${t.name} (%)`
				}, /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement(r.NumberInput, {
					value: a,
					width: "5em",
					"aria-label": `${t.name} x`,
					onBlur: () => n.onCommit(t.name),
					onChange: (e) => n.onChange(t.name, [e, s])
				}), /* @__PURE__ */ e.createElement(r.NumberInput, {
					value: s,
					width: "5em",
					"aria-label": `${t.name} y`,
					onBlur: () => n.onCommit(t.name),
					onChange: (e) => n.onChange(t.name, [a, e])
				})));
			}
			case "text": return /* @__PURE__ */ e.createElement(r.Field, {
				key: o,
				label: t.name
			}, /* @__PURE__ */ e.createElement(r.TextInput, {
				"aria-label": t.name,
				value: String(n.values[t.name] ?? t.default),
				onBlur: () => n.onCommit(t.name),
				onChange: (e) => n.onChange(t.name, e)
			}));
			case "note": return t.text ? /* @__PURE__ */ e.createElement("p", {
				key: o,
				style: Pr
			}, t.text) : null;
			case "separator": return /* @__PURE__ */ e.createElement("div", {
				key: o,
				style: { height: 4 }
			});
			case "fixed":
			case "link": return null;
		}
	}));
}
//#endregion
//#region src/FilterPanel.tsx
var Y = {
	margin: 0,
	fontSize: 11,
	opacity: .7
}, Ir = {
	actual: "Its settings are in pixels: judge it at 100 %.",
	whole: "Judge it with the whole photo in view: zoomed in, its preview can differ from the export."
};
function X(e, n) {
	t.stores.useDevelopStore.getState().setDynParams(vt(e, n));
}
function Z(e) {
	t.stores.useDevelopStore.getState().commitEdit(`G'MIC: ${e}`);
}
function Lr(e) {
	X(e.id, {
		on: !1,
		values: {}
	}), Z(`${e.name} reset`);
}
function Rr(n) {
	let r = t.ui, { item: i } = n, a = t.stores.useDevelopStore((e) => e.paramBag[O(i.id)]), o = L((e) => e.catalogue), s = L((e) => e.problem), c = L((e) => e.status.error), l = A({ [O(i.id)]: a }, i.id), u = e.useMemo(() => Sn(i, o), [i, o]), d = e.useMemo(() => V(u, l?.values ?? {}), [u, l?.values]);
	e.useEffect(() => {
		i.kind === "filter" && en();
	}, [i.kind]);
	let f = i.kind === "filter" && o ? o.categories.flatMap((e) => e.filters).find((e) => e.command === i.command) : void 0;
	if (i.kind === "filter" && !o) return /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement("p", { style: Y }, s ? s.text : "Reading G'MIC's filters…"), s && /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		onClick: () => nn("filters")
	}, "Open the G'MIC store"));
	if (i.kind === "filter" && !f) return /* @__PURE__ */ e.createElement("p", { style: Y }, "This G'MIC has no \"", i.name, "\" filter. Update G'MIC's filters in Preferences, or remove it in the G'MIC store.");
	let p = f?.interactive ? gn(f.command) : void 0, m = p ? u.filter((e) => "name" in e && p.settings.includes(e.name)) : u;
	return /* @__PURE__ */ e.createElement(r.Stack, { gap: 8 }, /* @__PURE__ */ e.createElement(r.Toggle, {
		label: "On",
		checked: l?.on === !0,
		onChange: (e) => {
			X(i.id, {
				on: e,
				values: zr(i.id)?.values ?? d
			}), Z(`${i.name} ${e ? "on" : "off"}`);
		}
	}), f && f.previewScale !== "any" && /* @__PURE__ */ e.createElement("p", { style: Y }, Ir[f.previewScale]), /* @__PURE__ */ e.createElement(Fr, {
		params: m,
		values: d,
		onChange: (e, t) => X(i.id, yt(zr(i.id), e, t)),
		onCommit: (e) => Z(`${i.name}: ${e.toLowerCase()}`)
	}), p?.Panel && f && /* @__PURE__ */ e.createElement(p.Panel, {
		id: i.id,
		name: i.name,
		filter: f,
		values: d,
		data: l?.data,
		setData: (e) => X(i.id, bt(zr(i.id), e)),
		commit: (e) => Z(e.replace(/^G'MIC: /, ""))
	}), m.length === 0 && !p && /* @__PURE__ */ e.createElement("p", { style: Y }, "No settings."), i.kind === "script" && /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: () => nn("scripts", i.id)
	}, "Edit script…"), l?.on && c && /* @__PURE__ */ e.createElement("p", {
		role: "alert",
		style: {
			...Y,
			opacity: 1,
			whiteSpace: "pre-wrap"
		}
	}, c));
}
function zr(e) {
	return A(t.stores.useDevelopStore.getState().paramBag, e);
}
function Br(t) {
	let n = R().find((e) => e.id === t.id);
	return n ? /* @__PURE__ */ e.createElement("div", {
		style: { padding: 8 },
		onPointerDownCapture: () => F().setState({ focus: t.id })
	}, /* @__PURE__ */ e.createElement(Rr, { item: n })) : null;
}
//#endregion
//#region src/panels.ts
function Vr(t) {
	let n = /* @__PURE__ */ new Map();
	return { sync(r, i) {
		let a = new Set(r.map((e) => e.id));
		for (let [e] of n) a.has(e) || (t.dock.isPanelOpen(O(e)) && t.dock.togglePanel(O(e)), t.unregisterPanel(O(e)), n.delete(e));
		r.forEach((r, a) => {
			let o = n.get(r.id);
			o !== r.name && (t.registerPanel({
				id: O(r.id),
				title: r.name,
				component: () => e.createElement(Br, { id: r.id }),
				order: 200 + a,
				defaultDock: {
					module: "develop",
					direction: "right"
				},
				modules: ["develop"],
				onReset: () => Lr(r),
				ownsBag: [O(r.id)]
			}), n.set(r.id, r.name), o === void 0 && i && !t.dock.isPanelOpen(O(r.id)) && t.dock.togglePanel(O(r.id)));
		});
	} };
}
//#endregion
//#region src/Store.tsx
var Hr = 150, Q = "", $ = {
	margin: 0,
	fontSize: 11,
	opacity: .7
};
function Ur(e, t, n) {
	let r = (t) => e.some((e) => e.id !== n && e.kind === "script" && e.name.trim().toLowerCase() === t.toLowerCase());
	if (!r(t)) return t;
	for (let e = 2;; e++) if (!r(`${t} ${e}`)) return `${t} ${e}`;
}
function Wr(e) {
	return [...new Set(e.categories.map((e) => e.name.split(" › ")[0]))];
}
function Gr(n) {
	let r = t.ui, i = L((e) => e.catalogue), [a, o] = e.useState(""), { category: s } = n, c = e.useMemo(() => i ? oe(i, a).filter((e) => s === Q || e.category === s || e.category.startsWith(`${s} › `)) : [], [
		i,
		a,
		s
	]);
	if (!i) return null;
	let l = (e) => n.items.find((t) => t.kind === "filter" && t.command === e.command);
	return /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement(r.TextInput, {
		value: a,
		placeholder: s === Q ? "Search filters" : `Search ${s}`,
		"aria-label": "Search filters",
		onChange: o
	}), /* @__PURE__ */ e.createElement("p", { style: $ }, c.length === 1 ? "1 filter" : `${c.length} filters`), /* @__PURE__ */ e.createElement("div", {
		role: "list",
		"aria-label": "Filters",
		style: {
			display: "grid",
			gap: 2
		}
	}, c.slice(0, Hr).map((t) => {
		let i = l(t);
		return /* @__PURE__ */ e.createElement("div", {
			key: `${t.category}/${t.command}`,
			role: "listitem",
			style: {
				display: "flex",
				alignItems: "center",
				gap: 6
			}
		}, /* @__PURE__ */ e.createElement("span", {
			style: {
				flex: 1,
				minWidth: 0,
				fontSize: 12
			},
			title: `${t.category} › ${t.name}`
		}, t.name, /* @__PURE__ */ e.createElement("span", { style: {
			...$,
			marginLeft: 6
		} }, t.category)), i ? /* @__PURE__ */ e.createElement(r.Button, {
			size: "sm",
			variant: "ghost",
			"aria-label": `Remove ${t.name}`,
			onClick: () => z(ht(n.items, i.id))
		}, "Remove") : _n(t) ? /* @__PURE__ */ e.createElement(r.Button, {
			size: "sm",
			"aria-label": `Install ${t.name}`,
			onClick: () => z(pt(n.items, t))
		}, "Install") : /* @__PURE__ */ e.createElement("span", {
			style: $,
			title: "It only works in G'MIC's own window, which Safelight doesn't open."
		}, "Not available"));
	})), c.length > Hr && /* @__PURE__ */ e.createElement("p", { style: $ }, c.length - Hr, " more: narrow the search."));
}
function Kr(n) {
	let r = t.ui, i = n.items.filter((e) => e.kind === "script"), a = L((e) => e.storeScript), [o, s] = e.useState(a ?? i[0]?.id ?? null);
	e.useEffect(() => {
		a && s(a);
	}, [a]);
	let c = i.find((e) => e.id === o) ?? null, l = c ? x(c.source).filter(C).map((e) => e.name) : [], u = () => {
		let e = mt(n.items, Ur(n.items, "New script"), st);
		z(e), s(e[e.length - 1].id);
	}, d = (e) => c && z(_t(n.items, c.id, e));
	return /* @__PURE__ */ e.createElement(r.Stack, { gap: 8 }, /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, i.length > 0 && /* @__PURE__ */ e.createElement(r.Select, {
		ariaLabel: "Script",
		value: c?.id ?? "",
		options: i.map((e) => ({
			value: e.id,
			label: e.name
		})),
		onChange: s
	}), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		onClick: u
	}, "New script"), c && /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: () => z(ht(n.items, c.id))
	}, "Delete")), !c && /* @__PURE__ */ e.createElement("p", { style: $ }, "A script is G'MIC words run on the photo, each script a Develop panel of its own. #@gui lines give it settings, as G'MIC-Qt's filters have; they reach it as $1, $2 and on."), c && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement(r.Field, { label: "Name" }, /* @__PURE__ */ e.createElement(r.TextInput, {
		"aria-label": "Script name",
		value: c.name,
		onChange: (e) => d({ name: e }),
		onBlur: () => d({ name: Ur(n.items, c.name.trim() || "Script", c.id) })
	})), /* @__PURE__ */ e.createElement(r.TextArea, {
		mono: !0,
		rows: 20,
		"aria-label": "Script source",
		spellCheck: !1,
		value: c.source,
		onChange: (e) => d({ source: e })
	}), /* @__PURE__ */ e.createElement("p", { style: $ }, l.length > 0 ? `Settings: ${l.join(", ")}.` : "No settings.", " Changes show in Develop as you type.")));
}
var qr = {
	display: "flex",
	alignItems: "center",
	gap: 6,
	padding: "2px 0"
}, Jr = {
	cursor: "grab",
	touchAction: "none",
	padding: "0 4px",
	opacity: .6,
	userSelect: "none"
};
function Yr(n) {
	let r = t.ui, i = e.useRef(null), [a, o] = e.useState(null), s = (e, t) => z(gt(n.items, e, t)), c = (e) => {
		let t = [...i.current?.querySelectorAll("[data-row]") ?? []], n = t.findIndex((t) => {
			let n = t.getBoundingClientRect();
			return e < n.top + n.height / 2;
		});
		return n < 0 ? t.length - 1 : n;
	};
	return n.items.length === 0 ? /* @__PURE__ */ e.createElement("p", { style: $ }, "Nothing installed yet. Install filters, or write a script, and each becomes a Develop panel.") : /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement("p", { style: $ }, "They apply in this order, top first. Drag to reorder."), /* @__PURE__ */ e.createElement("div", {
		ref: i,
		role: "list",
		"aria-label": "Installed"
	}, n.items.map((t, i) => /* @__PURE__ */ e.createElement("div", {
		key: t.id,
		"data-row": !0,
		role: "listitem",
		style: {
			...qr,
			opacity: a?.id === t.id ? .5 : 1
		}
	}, /* @__PURE__ */ e.createElement("span", {
		"aria-hidden": !0,
		style: Jr,
		onPointerDown: (e) => {
			e.currentTarget.setPointerCapture(e.pointerId), o({
				id: t.id,
				to: i
			});
		},
		onPointerMove: (e) => a?.id === t.id && o({
			id: t.id,
			to: c(e.clientY)
		}),
		onPointerUp: () => {
			a?.id === t.id && a.to !== i && s(t.id, a.to > i ? a.to - 1 : a.to), o(null);
		},
		onPointerCancel: () => o(null)
	}, "⠿"), /* @__PURE__ */ e.createElement("span", { style: {
		flex: 1,
		minWidth: 0,
		fontSize: 12
	} }, t.name, t.kind === "script" && /* @__PURE__ */ e.createElement("span", { style: {
		...$,
		marginLeft: 6
	} }, "script")), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		"aria-label": `Move ${t.name} up`,
		disabled: i === 0,
		onClick: () => s(t.id, i - 1)
	}, "↑"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		"aria-label": `Move ${t.name} down`,
		disabled: i === n.items.length - 1,
		onClick: () => s(t.id, i + 1)
	}, "↓"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		"aria-label": `Remove ${t.name}`,
		onClick: () => z(ht(n.items, t.id))
	}, "Remove")))));
}
function Xr(n) {
	let r = t.ui, i = L((e) => e.catalogue), a = L((e) => e.problem), o = L((e) => e.loading);
	return e.useEffect(en, []), o ? /* @__PURE__ */ e.createElement(r.ProgressBar, {
		indeterminate: !0,
		label: "Reading G'MIC's filters…"
	}) : a || !i ? /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement("p", { style: $ }, a?.needsUpdate ? "G'MIC's filter list comes with its update, which hasn't been downloaded yet." : a?.text ?? ""), /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: a?.needsUpdate ? "primary" : void 0,
		onClick: () => void I(n.deps, a?.needsUpdate === !0)
	}, a?.needsUpdate ? "Download filters" : "Try again"))) : null;
}
var Zr = {
	width: 190,
	flex: "none",
	display: "grid",
	alignContent: "start",
	gap: 2,
	paddingRight: 12,
	overflowY: "auto"
}, Qr = { paddingLeft: 18 };
function $r(n) {
	let r = t.ui, i = L((e) => e.catalogue), a = (e) => F().setState({
		storeTab: e,
		storeScript: null
	}), o = (t, i) => /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		full: !0,
		role: "tab",
		"aria-selected": n.tab === t,
		active: n.tab === t && (t !== "filters" || n.category === Q),
		onClick: () => {
			a(t), t === "filters" && n.onCategory(Q);
		}
	}, i);
	return /* @__PURE__ */ e.createElement("div", {
		role: "tablist",
		"aria-orientation": "vertical",
		style: Zr
	}, o("filters", "Filters"), n.tab === "filters" && i && Wr(i).map((t) => /* @__PURE__ */ e.createElement(r.Button, {
		key: t,
		size: "sm",
		variant: "ghost",
		full: !0,
		active: n.category === t,
		style: Qr,
		onClick: () => n.onCategory(t)
	}, t)), o("scripts", "Scripts"), o("installed", `Installed (${n.installed})`));
}
function ei(n) {
	let r = t.ui, i = R(), a = L((e) => e.storeTab), [o, s] = e.useState(Q), { program: c, version: l, refresh: u } = or(n.deps);
	return c === void 0 ? null : c ? /* @__PURE__ */ e.createElement("div", { style: {
		display: "flex",
		flex: 1,
		minHeight: 0,
		padding: 16
	} }, /* @__PURE__ */ e.createElement($r, {
		tab: a,
		category: o,
		installed: i.length,
		onCategory: s
	}), /* @__PURE__ */ e.createElement("div", { style: {
		flex: 1,
		minWidth: 0,
		overflowY: "auto",
		paddingRight: 4
	} }, a === "filters" && /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement(Xr, { deps: n.deps }), /* @__PURE__ */ e.createElement(Gr, {
		items: i,
		category: o
	})), a === "scripts" && /* @__PURE__ */ e.createElement(Kr, { items: i }), a === "installed" && /* @__PURE__ */ e.createElement(Yr, { items: i }))) : /* @__PURE__ */ e.createElement("div", { style: {
		maxWidth: 560,
		padding: 16
	} }, /* @__PURE__ */ e.createElement(sr, {
		deps: n.deps,
		program: null,
		version: l,
		onChange: () => {
			u(), I(n.deps);
		}
	}));
}
//#endregion
//#region src/index.tsx
var ti = "gmic.store-button", ni = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><path fill=\"black\" d=\"M3 2h10a1 1 0 0 1 1 1v3h-1.5V3.5h-9v9h9V10H8V8.5h6V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z\"/><circle cx=\"8\" cy=\"8\" r=\"1.6\" fill=\"black\"/></svg>";
function ri(e) {
	return {
		engine: Le(e.programs),
		scripts: () => k(e.settings).filter((e) => e.kind === "script"),
		render: (t, n) => Zn(e, t, {
			longEdge: Yn(e.settings),
			bits: 16,
			signal: n
		}),
		displayName: (t) => e.catalog.photoDisplayName(t)
	};
}
function ii(e) {
	let t = at(e.settings);
	if (t.length === 0) return;
	let n = k(e.settings);
	for (let e of t) n = mt(n, e.name, e.source);
	dt(e.settings, n), e.settings.set(rt, null);
}
function ai(t) {
	n(t), ii(t);
	let r = ri(t);
	$t(r), t.registerProcessingStage(Nn()), t.registerExportProcessor(qn({
		installed: () => k(t.settings),
		editState: (e) => t.catalog.getEditState(e),
		catalogue: () => r.engine.catalogue(),
		runStack: (e, t, n) => r.engine.runStack(e, t, n)
	})), t.commands.register(jn(r)), t.registerSettings({
		title: "G'MIC",
		fields: [],
		component: () => /* @__PURE__ */ e.createElement(gr, { deps: r }),
		keywords: [
			"gmic",
			"g'mic",
			"filters",
			"scripts"
		]
	}), t.registerWindow({
		id: Xt,
		title: "G'MIC store",
		component: () => /* @__PURE__ */ e.createElement(ei, { deps: r }),
		maximizable: !0
	}), t.registerTopBarButton({
		id: ti,
		label: "G'MIC store",
		svg: ni,
		onClick: () => t.windows.toggle(Xt)
	}), t.registerSlot({
		id: "gmic.canvas",
		slot: "develop-canvas-overlay",
		component: () => /* @__PURE__ */ e.createElement(Tr, { deps: r })
	});
	let i = Vr(t);
	i.sync(k(t.settings), !1), t.settings.onChange((e) => {
		e === "installed" && i.sync(k(t.settings), !0);
	});
}
//#endregion
export { ni as ICON, ti as STORE_BUTTON, ai as activate, ri as createDeps };

//# sourceMappingURL=index.js.map