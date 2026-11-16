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
function f(e, t, n, r) {
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
				value: n[0] ?? ""
			},
			slots: 1
		};
		default: return null;
	}
}
var p = /\s*,?\s*([^=,]+?)\s*=\s*[_~]*([A-Za-z]+)\s*([([{])/y;
function m(e) {
	let t = [], n = 1;
	for (let r of e) {
		let e = 0;
		for (; e < r.length;) {
			p.lastIndex = e;
			let a = p.exec(r);
			if (!a) break;
			let [, o, u, d] = a, m = c(r, p.lastIndex, s[d]);
			if (m < 0) break;
			let h = l(r.slice(p.lastIndex, m)), g = i(o);
			if (e = m + 1, u === "separator") t.push({ kind: "separator" });
			else if (u === "note") t.push({
				kind: "note",
				text: i(h.join(","))
			});
			else if (u === "link") t.push({
				kind: "link",
				name: h.length > 1 ? i(h[h.length - 2]) : g,
				url: h[h.length - 1] ?? ""
			});
			else {
				let e = f(g, u, h, n);
				if (!e) continue;
				t.push(e.param), n += e.slots;
			}
		}
	}
	return t;
}
//#endregion
//#region src/gmic/catalogue.ts
function h(e) {
	let t = /for version (\d+(?:\.\d+)*)/.exec(e.slice(0, 2e3))?.[1] ?? "", n = /* @__PURE__ */ new Map(), r = [], o = null, s = () => {
		if (!o) return;
		let { name: e, category: t, command: r, lines: i } = o;
		if (o = null, !r || r === "_none_" || !t) return;
		let a = n.get(t) ?? [];
		a.push({
			name: e,
			category: t,
			command: r,
			params: m(i)
		}), n.set(t, a);
	};
	for (let t of a(e)) {
		let e = /^#@gui (.*)$/.exec(t);
		if (!e) continue;
		let n = e[1];
		if (/^\s*:/.test(n)) {
			o?.lines.push(n.replace(/^\s*:/, ""));
			continue;
		}
		s();
		let a = n.indexOf(":");
		if (a < 0) {
			let e = /^_*/.exec(n)[0].length;
			r.length = Math.max(0, r.length - e);
			let t = i(n.slice(e));
			t && r.push(t);
			continue;
		}
		let c = n.slice(a + 1).split(",")[0].split(":")[0].trim();
		o = {
			name: i(n.slice(0, a)),
			category: r.join(" › "),
			command: c,
			lines: []
		};
	}
	return s(), {
		version: t,
		categories: [...n].map(([e, t]) => ({
			name: e,
			filters: t
		}))
	};
}
function g(e) {
	return e.categories.flatMap((e) => e.filters);
}
function _(e, t) {
	let n = t.trim().toLowerCase(), r = g(e);
	return r.find((e) => e.name.toLowerCase() === n) ?? r.find((e) => e.command.toLowerCase() === n) ?? null;
}
function v(e, t) {
	let n = t.toLowerCase().split(/\s+/).filter(Boolean);
	return g(e).filter((e) => {
		let t = `${e.name} ${e.category} ${e.command}`.toLowerCase();
		return n.every((e) => t.includes(e));
	});
}
//#endregion
//#region src/gmic/script.ts
var y = "_safelight_run", b = "_safelight_job", ee = /^[A-Za-z_][A-Za-z0-9_]*\s*:/m;
function te(e) {
	return ee.test(e);
}
var ne = (e, t) => t ? `${e} ${t}` : e, x = (e) => e.split(/\r?\n/).map((e) => e.trim() === "" ? "" : `  ${e}`).join("\n");
function re(e, t) {
	return [
		`${y} :`,
		...t === 16 ? ["  div 257"] : [],
		`  ${e}`,
		"  foreach { cut 0,255 mul 257 }",
		""
	].join("\n");
}
function ie(e, t = 16) {
	let n = (e) => re(e, t);
	if (e.kind === "line") return `${n(b)}\n${b} :\n${x(e.line)}\n`;
	if (te(e.source)) {
		if (!/^main\s*:/m.test(e.source)) throw Error("This script defines commands, so it needs one called main: that's where it starts.");
		return `${n(ne("main", e.args))}\n${e.source}\n`;
	}
	let r = `${b}_body`;
	return `${n(ne(r, e.args))}\n${r} :\n${x(e.source)}\n`;
}
var S = "_safelight_catalogue";
function ae() {
	return [
		`${S} :`,
		"  l[] { i cimgz:${_path_rc}update$_version.gmic onfail l[] { it ${_path_rc}update$_version.gmic onfail } }",
		"  if $! o[-1] raw:filters.gmic,uint8 fi",
		""
	].join("\n");
}
function oe() {
	return [
		"-v",
		"0",
		"-m",
		"job.gmic",
		"input.png",
		y,
		"-o",
		"out.png,16"
	];
}
function C(e) {
	return m(o(e));
}
//#endregion
//#region src/gmic/engine.ts
var w = class extends Error {
	constructor() {
		super("G'MIC isn't set up. Open the G'MIC panel and choose Find G'MIC."), this.name = "NotSetUpError";
	}
}, T = class extends Error {
	constructor() {
		super("G'MIC has no filter list yet: it comes with G'MIC's update. Run gmic update, or choose Download filters in the G'MIC panel."), this.name = "NeedsUpdateError";
	}
}, se = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
], ce = 36e5, E = 3e5;
function le(e) {
	if (!(e.length > 24 && se.every((t, n) => e[n] === t))) throw Error("Safelight's render isn't a PNG.");
	return e[24];
}
var ue = /\u001b\[[0-9;]*[A-Za-z]/g, D = (e) => e.replace(ue, "").replace(/\r/g, "");
function de(e) {
	if (e.killed === "timeout") return "G'MIC took too long and was stopped.";
	if (e.killed === "cancelled") return "Stopped.";
	let t = D(e.stderr).split("\n").map((e) => e.replace(/^\s*\[gmic\]\s?/, "").trim()).filter(Boolean), n = t.filter((e) => e.includes("***")), r = n.length > 0 ? n : t.slice(-6);
	return r.length > 0 ? `G'MIC: ${r.join("\n")}` : `G'MIC stopped with exit code ${e.exitCode ?? "unknown"}.`;
}
var O = (e) => new TextEncoder().encode(e);
function fe(e) {
	return Object.keys(e).filter((e) => /^out(_\d+)?\.png$/.test(e)).sort().map((t) => e[t]);
}
function pe(e) {
	let t = null;
	async function n() {
		let [t] = await e.list();
		return t ?? null;
	}
	async function r() {
		let e = await n();
		if (!e) throw new w();
		return e.token;
	}
	async function i(t, n) {
		let i = await e.run(await r(), t, n);
		if (i.killed === "cancelled") throw new DOMException("Stopped.", "AbortError");
		if (i.exitCode !== 0 || i.killed) throw Error(de(i));
		return i;
	}
	async function a(e) {
		let t = (await i([
			"-v",
			"0",
			"-m",
			"catalogue.gmic",
			S
		], {
			files: { "catalogue.gmic": O(ae()) },
			outputs: ["filters.gmic"],
			timeoutMs: E,
			signal: e.signal
		})).files["filters.gmic"], n = t ? h(new TextDecoder().decode(t)) : null;
		if (!n || n.categories.length === 0) throw new T();
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
			let r = le(e) === 16 ? 16 : 8, a = fe((await i(oe(), {
				files: {
					"input.png": e,
					"job.gmic": O(ie(t, r))
				},
				outputs: ["out.png", "out_*"],
				timeoutMs: ce,
				signal: n.signal,
				onOutput: n.onOutput
			})).files);
			if (a.length === 0) throw Error("G'MIC left no image to save.");
			return a;
		},
		catalogue: o,
		async update(e = {}) {
			return await i([
				"-v",
				"0",
				"update"
			], {
				timeoutMs: E,
				signal: e.signal,
				onOutput: e.onOutput
			}), t = null, o(e);
		},
		async version() {
			let e = await i(["version"], { timeoutMs: E });
			return /(\d+\.\d+\.\d+)/.exec(D(e.stdout + e.stderr))?.[1] ?? "unknown";
		},
		async help(e) {
			let t = await i(["help", e], { timeoutMs: E });
			return D(t.stdout || t.stderr).replace(/^\n+|\s+$/g, "");
		},
		reset() {
			t = null;
		}
	};
}
//#endregion
//#region src/gmic/params.ts
function k(e) {
	return e.kind !== "fixed" && e.kind !== "note" && e.kind !== "link" && e.kind !== "separator";
}
function A(e) {
	let t = {};
	for (let n of e) k(n) && (t[n.name] = Array.isArray(n.default) ? [...n.default] : n.default);
	return t;
}
function j(e) {
	return Number.isFinite(e) ? Number.isInteger(e) ? String(e) : e.toFixed(10).replace(/0+$/, "").replace(/\.$/, "") : "0";
}
function me(e) {
	return e !== "" && !/[\s",]/.test(e) ? e : `"${e.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}
function he(e) {
	return `"${e.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}
function M(e) {
	return e.map((e) => /[\s"]/.test(e) || e === "" ? me(e) : e).join(" ");
}
function N(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function ge(e, t) {
	if (e.kind === "fixed") return [e.value];
	if (!k(e)) return [];
	let n = t[e.name] ?? e.default;
	switch (e.kind) {
		case "float": return [j(N(Number(n), e.min, e.max))];
		case "int": return [j(Math.round(N(Number(n), e.min, e.max)))];
		case "bool": return [n === !0 ? "1" : "0"];
		case "choice": return [j(N(Math.round(Number(n)), 0, e.choices.length - 1))];
		case "color":
		case "point": return (Array.isArray(n) ? n : e.default).map(j);
		case "text": return [he(String(n))];
	}
}
function P(e, t) {
	return e.filter((e) => "pos" in e).sort((e, t) => e.pos - t.pos).flatMap((e) => ge(e, t)).join(",");
}
var F = (e) => e.toLowerCase().replace(/[^a-z0-9]/g, ""), _e = (e) => e.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
function ve(e, t) {
	let n = F(t), r = e.filter((e) => F(e.name) === n);
	return r.length > 0 ? r : e.filter((e) => F(e.name).startsWith(n) || _e(e.name).some((e) => e.startsWith(n)));
}
function ye(e, t) {
	let n = Number(t);
	if (t.trim() === "" || !Number.isFinite(n)) throw Error(`${e.name} takes a number, not "${t}".`);
	return n;
}
function I(e, t, n) {
	let r = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t);
	if (r) return r[1].match(/../g).map((e) => parseInt(e, 16));
	let i = t.split(",").map((e) => Number(e));
	if (i.some((e) => !Number.isFinite(e)) || n !== null && i.length !== n) {
		let r = n === 2 ? "x,y" : "#rrggbb or r,g,b";
		throw Error(`${e.name} takes ${r}, not "${t}".`);
	}
	return i;
}
var be = /* @__PURE__ */ new Set([
	"1",
	"on",
	"yes",
	"true"
]), xe = /* @__PURE__ */ new Set([
	"0",
	"off",
	"no",
	"false"
]);
function Se(e, t) {
	switch (e.kind) {
		case "float":
		case "int": return ye(e, t);
		case "bool": {
			let n = t.toLowerCase();
			if (be.has(n)) return !0;
			if (xe.has(n)) return !1;
			throw Error(`${e.name} takes on or off, not "${t}".`);
		}
		case "choice": {
			let n = e.choices.findIndex((e) => F(e) === F(t));
			if (n >= 0) return n;
			let r = Number(t);
			if (Number.isInteger(r) && r >= 0 && r < e.choices.length) return r;
			throw Error(`${e.name} takes one of ${e.choices.join(", ")}.`);
		}
		case "color": return I(e, t, null);
		case "point": {
			let [n, r] = I(e, t, 2);
			return [n, r];
		}
		case "text": return t;
	}
}
function L(e, t) {
	let n = e.filter(k), r = A(e);
	for (let e of t) {
		let t = e.indexOf("=");
		if (t <= 0) throw Error(`"${e}" isn't a value: write Name=value.`);
		let i = e.slice(0, t), a = ve(n, i);
		if (a.length === 0) {
			let e = n.map((e) => e.name).join(", ");
			throw Error(`No parameter "${i}".${e ? ` It has: ${e}.` : " It has none."}`);
		}
		if (a.length > 1) throw Error(`"${i}" could be ${a.map((e) => e.name).join(" or ")}.`);
		r[a[0].name] = Se(a[0], e.slice(t + 1));
	}
	return r;
}
//#endregion
//#region src/gmic/words.ts
var Ce = [
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
], R = [
	"gmic <G'MIC words…>",
	"gmic filters [search]",
	"gmic filter <name> [Name=value…]",
	"gmic script <name> [Name=value…]",
	"gmic scripts",
	"gmic help [command]",
	"gmic status",
	"gmic update"
], we = (e) => e.indexOf("=") > 0;
function z(e) {
	let t = e.findIndex(we);
	return {
		name: (t < 0 ? e : e.slice(0, t)).join(" ").trim(),
		assignments: t < 0 ? [] : e.slice(t)
	};
}
function Te(e) {
	if (e.length === 0) return { kind: "usage" };
	let [t, ...n] = e;
	switch (t) {
		case "run": return n.length === 0 ? { kind: "usage" } : {
			kind: "pipeline",
			line: M(n)
		};
		case "filters": return {
			kind: "filters",
			search: n.join(" ")
		};
		case "filter": {
			let { name: e, assignments: t } = z(n);
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
			let { name: e, assignments: t } = z(n);
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
			line: M(e)
		};
	}
}
//#endregion
//#region src/scripts.ts
var B = "scripts";
function Ee(e) {
	if (typeof e != "object" || !e) return !1;
	let t = e;
	return typeof t.id == "string" && typeof t.name == "string" && typeof t.source == "string";
}
function V(e) {
	let t = e.get(B, []);
	return Array.isArray(t) ? t.filter(Ee) : [];
}
function De(e, t) {
	e.set(B, t.map(({ id: e, name: t, source: n }) => ({
		id: e,
		name: t,
		source: n
	})));
}
function H(e, t) {
	let n = t.trim().replace(/\s+/g, " ").toLowerCase();
	return e.find((e) => e.name.trim().replace(/\s+/g, " ").toLowerCase() === n) ?? null;
}
function U(e, t) {
	if (!H(e, t)) return t;
	for (let n = 2;; n++) if (!H(e, `${t} ${n}`)) return `${t} ${n}`;
}
var Oe = "#@gui : Strength = float(2,0,10)\n# A G'MIC script. Each line is G'MIC words, run on the photo in turn;\n# #@gui lines above give it settings, read here as $1, $2 and on.\nblur $1\n";
//#endregion
//#region src/jobs.ts
function W(e, t) {
	let n = P(e.params, t);
	return {
		kind: "line",
		line: n ? `${e.command} ${n}` : e.command
	};
}
function G(e, t) {
	return {
		kind: "script",
		source: e,
		args: P(C(e), t)
	};
}
function ke(e, t, n) {
	let r = _(e, t);
	if (!r) throw Error(`No filter "${t}". gmic filters <words> searches them.`);
	return W(r, L(r.params, n));
}
function Ae(e, t, n, r) {
	let i = n;
	if (i === null) {
		let n = H(e, t ?? "");
		if (!n) throw Error(`No script "${t}". gmic scripts lists them.`);
		i = n.source;
	}
	return G(i, L(C(i), r));
}
//#endregion
//#region src/command.ts
var je = "gmic", K = (e) => e instanceof Error ? e.message : String(e), Me = (e) => e instanceof DOMException && e.name === "AbortError";
async function q(e, t, n) {
	let { photos: r } = t;
	if (r.length === 0) throw Error(t.caller === "cli" ? "No photo to run on: open one, or name photos after --." : "No photo to run on: open one in Develop, or select some in the Library.");
	for (let n of r) {
		let r = await t.canSaveBeside(n);
		if (r) throw Error(`${e.displayName(n)}: ${r}`);
	}
	if (!await e.engine.program()) throw new w();
	let i = [], a = [];
	for (let [o, s] of r.entries()) {
		t.signal.throwIfAborted();
		let c = e.displayName(s), l = r.length > 1 ? ` (${o + 1} of ${r.length})` : "", u = t.progress(`${c}${l}: rendering`);
		try {
			let r = await e.render(s, t.signal);
			u.update(`${c}${l}: running G'MIC`);
			let a = await e.engine.run(r, n, { signal: t.signal }), o = [];
			for (let e of a) o.push(await t.saveBeside(s, new Blob([new Uint8Array(e)], { type: "image/png" }), je, "png"));
			i.push(...o), u.done(`${c} → ${o.join(", ")}`);
		} catch (e) {
			if (u.done(), Me(e) || t.signal.aborted) throw e;
			a.push({
				photo: c,
				error: K(e)
			}), t.warn(`${c}: ${K(e)}`);
		}
	}
	if (t.result({
		saved: i,
		failed: a
	}), a.length === r.length) throw Error(a.length === 1 ? a[0].error : `G'MIC failed on every photo. The first: ${a[0].error}`);
}
function Ne(e) {
	return {
		name: "gmic",
		summary: "Run G'MIC filters and scripts on photos, each result saved beside its photo",
		usage: [...R],
		examples: [
			"gmic blur 3 sharpen 50",
			"gmic filters sharpen",
			"gmic filter \"Sharpen [Unsharp Mask]\" radius=2",
			"gmic script Soft Glow strength=0.4"
		],
		subcommands: Ce.map((e) => ({ ...e })),
		async run(t) {
			let n = Te(t.words);
			switch (n.kind) {
				case "usage":
					for (let e of R) t.print(e);
					return;
				case "status": {
					let n = await e.engine.program();
					if (!n) throw new w();
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
						for (let e of R) t.print(e);
						return;
					}
					t.print(await e.engine.help(n.topic));
					return;
				case "filters": {
					let r = v(await e.engine.catalogue({ signal: t.signal }), n.search);
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
					n.length === 0 && t.info("No saved scripts. Write one in the G'MIC panel's Scripts tab.");
					for (let e of n) {
						let n = C(e.source).filter(k).map((e) => e.name);
						t.print(n.length > 0 ? `${e.name}   ${n.join(", ")}` : e.name);
					}
					t.result(n.map((e) => ({ name: e.name })));
					return;
				}
				case "pipeline": return q(e, t, {
					kind: "line",
					line: n.line
				});
				case "filter": return q(e, t, ke(await e.engine.catalogue({ signal: t.signal }), n.name, n.assignments));
				case "script": return q(e, t, Ae(e.scripts(), n.name, n.source, n.assignments));
			}
		}
	};
}
//#endregion
//#region src/download.ts
var J = "https://gmic.eu/download.html", Pe = "brew install gmic";
function Fe(e, t) {
	let n = e ?? "";
	return n === "win32" || !n && /Windows/i.test(t) ? "windows" : n === "darwin" || !n && /Mac OS X|Macintosh/i.test(t) ? "mac" : "linux";
}
function Ie() {
	return Fe(window.safelightNative?.platform, navigator.userAgent);
}
var Le = (e) => e.split(".").map(Number);
function Re(e, t) {
	let [n, r] = [Le(e), Le(t)];
	for (let e = 0; e < Math.max(n.length, r.length); e++) if ((n[e] ?? 0) !== (r[e] ?? 0)) return (n[e] ?? 0) > (r[e] ?? 0);
	return !1;
}
function ze(e) {
	let t = null;
	for (let n of e.matchAll(/windows\/gmic_(\d+(?:\.\d+)+)_cli_win64\.zip/g)) (!t || Re(n[1], t)) && (t = n[1]);
	return t ? `https://gmic.eu/get_file.php?file=windows/gmic_${t}_cli_win64.zip` : null;
}
async function Be(e) {
	try {
		let t = await e(J);
		return t.ok ? ze(await t.text()) ?? "https://gmic.eu/download.html" : J;
	} catch {
		return J;
	}
}
//#endregion
//#region src/ParamControls.tsx
var Ve = (e) => `#${e.slice(0, 3).map((e) => Math.max(0, Math.min(255, Math.round(e))).toString(16).padStart(2, "0")).join("")}`;
function He(e) {
	let t = /^#?([0-9a-f]{6})$/i.exec(e.trim());
	return t ? t[1].match(/../g).map((e) => parseInt(e, 16)) : null;
}
function Ue(n) {
	let r = t.ui, [i, a] = e.useState(Ve(n.value));
	e.useEffect(() => a(Ve(n.value)), [n.value]);
	let o = n.value.length > 3 ? n.value[3] : null;
	return /* @__PURE__ */ e.createElement(r.Field, { label: n.name }, /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement(r.TextInput, {
		value: i,
		"aria-label": n.name,
		onChange: (e) => {
			a(e);
			let t = He(e);
			t && n.onChange(o === null ? t : [...t, o]);
		}
	}), o !== null && /* @__PURE__ */ e.createElement(r.NumberInput, {
		value: o,
		min: 0,
		max: 255,
		width: "4.5em",
		"aria-label": `${n.name} opacity`,
		onChange: (e) => n.onChange([...n.value.slice(0, 3), Math.max(0, Math.min(255, e))])
	})));
}
var We = {
	margin: 0,
	fontSize: 11,
	opacity: .7,
	whiteSpace: "pre-wrap"
};
function Ge(n) {
	let r = t.ui, { Slider: i } = t.components;
	return /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, n.params.map((t, a) => {
		switch (t.kind) {
			case "float":
			case "int": {
				let r = Number(n.values[t.name] ?? t.default), o = t.kind === "int" ? 1 : Math.max((t.max - t.min) / 200, 1e-4);
				return /* @__PURE__ */ e.createElement(i, {
					key: a,
					label: t.name,
					value: r,
					min: t.min,
					max: t.max,
					step: o,
					defaultValue: t.default,
					onChange: (e) => n.onChange(t.name, t.kind === "int" ? Math.round(e) : e)
				});
			}
			case "bool": return /* @__PURE__ */ e.createElement(r.Toggle, {
				key: a,
				label: t.name,
				checked: n.values[t.name] === !0,
				onChange: (e) => n.onChange(t.name, e)
			});
			case "choice": return /* @__PURE__ */ e.createElement(r.Field, {
				key: a,
				label: t.name
			}, /* @__PURE__ */ e.createElement(r.Select, {
				ariaLabel: t.name,
				value: String(n.values[t.name] ?? t.default),
				options: t.choices.map((e, t) => ({
					value: String(t),
					label: e
				})),
				onChange: (e) => n.onChange(t.name, Number(e))
			}));
			case "color": {
				let r = n.values[t.name];
				return /* @__PURE__ */ e.createElement(Ue, {
					key: a,
					name: t.name,
					value: Array.isArray(r) ? r : t.default,
					onChange: (e) => n.onChange(t.name, e)
				});
			}
			case "point": {
				let i = n.values[t.name], [o, s] = Array.isArray(i) ? i : t.default;
				return /* @__PURE__ */ e.createElement(r.Field, {
					key: a,
					label: `${t.name} (%)`
				}, /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement(r.NumberInput, {
					value: o,
					width: "5em",
					"aria-label": `${t.name} x`,
					onChange: (e) => n.onChange(t.name, [e, s])
				}), /* @__PURE__ */ e.createElement(r.NumberInput, {
					value: s,
					width: "5em",
					"aria-label": `${t.name} y`,
					onChange: (e) => n.onChange(t.name, [o, e])
				})));
			}
			case "text": return /* @__PURE__ */ e.createElement(r.Field, {
				key: a,
				label: t.name
			}, /* @__PURE__ */ e.createElement(r.TextInput, {
				"aria-label": t.name,
				value: String(n.values[t.name] ?? t.default),
				onChange: (e) => n.onChange(t.name, e)
			}));
			case "note": return t.text ? /* @__PURE__ */ e.createElement("p", {
				key: a,
				style: We
			}, t.text) : null;
			case "separator": return /* @__PURE__ */ e.createElement("div", {
				key: a,
				style: { height: 4 }
			});
			case "fixed":
			case "link": return null;
		}
	}));
}
//#endregion
//#region src/render.ts
var Ke = [
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
function qe(e) {
	let t = e.get("size", null);
	return typeof t == "number" && t > 0 ? t : null;
}
function Je(e, t) {
	e.set("size", t === "full" ? null : Number(t));
}
var Y = 1024;
async function Ye(e, t, n) {
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
//#region src/GmicPanel.tsx
var X = 150, Z = (e) => e instanceof Error ? e.message : String(e), Xe = (e) => e instanceof DOMException && e.name === "AbortError", Q = {
	margin: 0,
	fontSize: 11,
	opacity: .7
};
function Ze() {
	let n = t.stores.useDevelopStore((e) => e.photoId), r = t.stores.useCatalogStore((e) => e.photos);
	return e.useMemo(() => r.find((e) => e.id === n) ?? null, [r, n]);
}
function Qe(n, r) {
	let [i, a] = e.useState({
		busy: null,
		status: "",
		error: null,
		preview: null
	}), o = e.useRef(null), s = e.useRef(null), c = e.useCallback((e) => {
		s.current && URL.revokeObjectURL(s.current), s.current = e, a((t) => ({
			...t,
			preview: e
		}));
	}, []);
	e.useEffect(() => () => {
		o.current?.abort(), s.current && URL.revokeObjectURL(s.current);
	}, []), e.useEffect(() => c(null), [r?.id, c]);
	async function l(e, t) {
		o.current?.abort();
		let n = new AbortController();
		o.current = n, a((t) => ({
			...t,
			busy: e,
			status: e === "preview" ? "Previewing…" : "Applying…",
			error: null
		}));
		try {
			let e = await t(n.signal);
			o.current === n && a((t) => ({
				...t,
				busy: null,
				status: e
			}));
		} catch (e) {
			o.current === n && a((t) => ({
				...t,
				busy: null,
				status: "",
				error: Xe(e) ? null : Z(e)
			}));
		}
	}
	return {
		state: i,
		cancel: () => o.current?.abort(),
		preview: (e) => l("preview", async (i) => {
			if (!r) throw Error("Open a photo in Develop.");
			let a = await Ye(t, r, {
				longEdge: Y,
				bits: 8,
				signal: i
			}), [o] = await n.engine.run(a, e, { signal: i });
			return c(URL.createObjectURL(new Blob([new Uint8Array(o)], { type: "image/png" }))), `Preview at ${Y} px.`;
		}),
		apply: (e) => l("apply", async (i) => {
			if (!r) throw Error("Open a photo in Develop.");
			let o = [];
			return await q(n, {
				words: [],
				photos: [r],
				caller: "app",
				from: t.extensionId,
				signal: i,
				print: () => {},
				info: () => {},
				warn: (e) => a((t) => ({
					...t,
					error: e
				})),
				progress: (e) => (a((t) => ({
					...t,
					status: e
				})), {
					update: (e) => a((t) => ({
						...t,
						status: e
					})),
					done: () => {}
				}),
				canSaveBeside: (e) => t.commands.canSaveBeside(e),
				saveBeside: (e, n, r, i) => t.commands.saveBeside(e, n, r, i),
				result: (e) => {
					o = e?.saved ?? [];
				}
			}, e), o.length > 0 ? `Saved ${o.join(", ")}.` : "Done.";
		})
	};
}
function $e(n) {
	let r = t.ui, { state: i } = n.runner, [a, o] = e.useState(() => String(qe(t.settings) ?? "full")), s = (e) => {
		let t = n.job();
		t && n.runner[e](t);
	}, c = !n.photo || n.disabled;
	return /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		disabled: c || i.busy !== null,
		onClick: () => s("preview")
	}, "Preview"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "primary",
		disabled: c || i.busy !== null,
		onClick: () => s("apply")
	}, "Apply"), i.busy && /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: n.runner.cancel
	}, "Cancel")), /* @__PURE__ */ e.createElement(r.Field, {
		label: "Apply at",
		hint: "Apply saves the result as a new photo beside this one."
	}, /* @__PURE__ */ e.createElement(r.Select, {
		ariaLabel: "Apply at",
		value: a,
		options: Ke.map((e) => ({ ...e })),
		onChange: (e) => {
			o(e), Je(t.settings, e);
		}
	})), i.busy && /* @__PURE__ */ e.createElement(r.ProgressBar, {
		indeterminate: !0,
		label: i.status
	}), !i.busy && i.status && /* @__PURE__ */ e.createElement("p", { style: Q }, i.status), i.error && /* @__PURE__ */ e.createElement("p", {
		role: "alert",
		style: {
			...Q,
			opacity: 1,
			whiteSpace: "pre-wrap"
		}
	}, i.error), i.preview && /* @__PURE__ */ e.createElement("img", {
		src: i.preview,
		alt: "G'MIC preview",
		style: {
			width: "100%",
			display: "block"
		}
	}), !n.photo && /* @__PURE__ */ e.createElement("p", { style: Q }, "Open a photo in Develop to preview or apply."));
}
function et(n) {
	let r = t.ui, [i, a] = e.useState(null), o = (e) => async () => {
		a(null);
		try {
			await e(), n.deps.engine.reset(), n.onChange();
		} catch (e) {
			a(Z(e));
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
		...Q,
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
	}, "Forget"))) : /* @__PURE__ */ e.createElement(rt, {
		find: s,
		choose: c
	}), i && /* @__PURE__ */ e.createElement("p", {
		role: "alert",
		style: {
			...Q,
			opacity: 1
		}
	}, i)));
}
var $ = {
	margin: 0,
	paddingLeft: 18,
	fontSize: 11,
	display: "grid",
	gap: 6
}, tt = {
	fontSize: 11,
	userSelect: "all"
}, nt = (e) => void window.open(e, "_blank", "noopener,noreferrer");
function rt(n) {
	let r = t.ui, i = e.useMemo(Ie, []), [a, o] = e.useState(null), [s, c] = e.useState(!1), l = async () => {
		o("Looking up the newest G'MIC…");
		let e = await Be((e) => t.network.fetch(e));
		nt(e), o(e === "https://gmic.eu/download.html" ? "gmic.eu's download page is open in your browser: get the command-line (CLI) zip for Windows." : "Your browser is downloading the zip.");
	}, u = async () => {
		await navigator.clipboard.writeText(Pe), c(!0);
	}, d = /* @__PURE__ */ e.createElement("p", { style: Q }, "G'MIC is a free program, from gmic.eu, that this panel runs. Set it up once:");
	return i === "windows" ? /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, d, /* @__PURE__ */ e.createElement("ol", { style: $ }, /* @__PURE__ */ e.createElement("li", null, /* @__PURE__ */ e.createElement(r.Button, {
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
	}, "Find G'MIC")))), a && /* @__PURE__ */ e.createElement("p", { style: Q }, a)) : i === "mac" ? /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, d, /* @__PURE__ */ e.createElement("ol", { style: $ }, /* @__PURE__ */ e.createElement("li", null, "Install it with Homebrew: in the Terminal app, run", /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement("code", { style: tt }, Pe), /* @__PURE__ */ e.createElement(r.Button, {
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
	}, "Choose…")))), /* @__PURE__ */ e.createElement("p", { style: Q }, "No Homebrew yet? It installs from brew.sh.")) : /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, d, /* @__PURE__ */ e.createElement("ol", { style: $ }, /* @__PURE__ */ e.createElement("li", null, "Install your distribution's gmic package, such as sudo apt install gmic or sudo dnf install gmic."), /* @__PURE__ */ e.createElement("li", null, "Then find it here.", /* @__PURE__ */ e.createElement(r.Row, {
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
		onClick: () => nt(J)
	}, "Download page")))));
}
function it(n) {
	let r = t.ui, [i, a] = e.useState(null), [o, s] = e.useState(null), [c, l] = e.useState(!1), [u, d] = e.useState(""), [f, p] = e.useState(null), [m, h] = e.useState({}), g = Qe(n.deps, n.photo), _ = e.useCallback(async (e) => {
		l(!0), s(null);
		try {
			a(e ? await n.deps.engine.update() : await n.deps.engine.catalogue());
		} catch (e) {
			s({
				needsUpdate: e instanceof T,
				text: Z(e)
			});
		} finally {
			l(!1);
		}
	}, [n.deps]);
	e.useEffect(() => void _(!1), [_]);
	let y = e.useMemo(() => i ? v(i, u) : [], [i, u]);
	return c ? /* @__PURE__ */ e.createElement(r.ProgressBar, {
		indeterminate: !0,
		label: "Reading G'MIC's filters…"
	}) : o ? /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement("p", { style: Q }, o.needsUpdate ? "G'MIC's filter list comes with its update, which hasn't been downloaded yet." : o.text), /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, o.needsUpdate ? /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "primary",
		onClick: () => void _(!0)
	}, "Download filters") : /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		onClick: () => void _(!1)
	}, "Try again"))) : i ? f ? /* @__PURE__ */ e.createElement(r.Stack, { gap: 8 }, /* @__PURE__ */ e.createElement(r.Row, {
		gap: 6,
		justify: "space-between"
	}, /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: () => p(null)
	}, "← Filters"), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: () => h(A(f.params))
	}, "Reset")), /* @__PURE__ */ e.createElement("p", { style: {
		margin: 0,
		fontWeight: 600
	} }, f.name), /* @__PURE__ */ e.createElement("p", { style: Q }, f.category, " · ", f.command), /* @__PURE__ */ e.createElement(Ge, {
		params: f.params,
		values: m,
		onChange: (e, t) => h((n) => ({
			...n,
			[e]: t
		}))
	}), /* @__PURE__ */ e.createElement($e, {
		runner: g,
		photo: n.photo,
		job: () => W(f, m)
	})) : /* @__PURE__ */ e.createElement(r.Stack, { gap: 6 }, /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, /* @__PURE__ */ e.createElement(r.TextInput, {
		value: u,
		placeholder: "Search filters",
		"aria-label": "Search filters",
		onChange: d
	}), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		title: "Download G'MIC's latest filters",
		onClick: () => void _(!0)
	}, "Update")), /* @__PURE__ */ e.createElement("p", { style: Q }, y.length === 1 ? "1 filter" : `${y.length} filters`), /* @__PURE__ */ e.createElement("div", {
		role: "list",
		"aria-label": "Filters"
	}, y.slice(0, X).map((t) => /* @__PURE__ */ e.createElement(r.Button, {
		key: `${t.category}/${t.name}`,
		role: "listitem",
		size: "sm",
		variant: "ghost",
		full: !0,
		title: `${t.category} › ${t.name}`,
		onClick: () => {
			p(t), h(A(t.params));
		}
	}, /* @__PURE__ */ e.createElement("span", { style: { opacity: .6 } }, t.category, " › "), t.name))), y.length > X && /* @__PURE__ */ e.createElement("p", { style: Q }, y.length - X, " more: narrow the search.")) : null;
}
function at(n) {
	let r = t.ui, [i, a] = e.useState(() => V(t.settings)), [o, s] = e.useState(() => i[0]?.id ?? null), [c, l] = e.useState({}), u = Qe(n.deps, n.photo), d = i.find((e) => e.id === o) ?? null, f = e.useMemo(() => d ? C(d.source) : [], [d?.source]);
	e.useEffect(() => l(A(f)), [o, f.length]), e.useEffect(() => t.settings.onChange((e) => e === "scripts" && a(V(t.settings))), []);
	let p = (e) => {
		a(e), De(t.settings, e);
	}, m = (e) => d && p(i.map((t) => t.id === d.id ? {
		...t,
		...e
	} : t)), h = () => {
		let e = {
			id: crypto.randomUUID(),
			name: U(i, "New script"),
			source: Oe
		};
		p([...i, e]), s(e.id);
	}, g = () => {
		if (!d) return;
		let e = i.filter((e) => e.id !== d.id);
		p(e), s(e[0]?.id ?? null);
	}, _ = d ? U(i.filter((e) => e.id !== d.id), d.name.trim() || "Script") : "";
	return /* @__PURE__ */ e.createElement(r.Stack, { gap: 8 }, /* @__PURE__ */ e.createElement(r.Row, { gap: 6 }, i.length > 0 && /* @__PURE__ */ e.createElement(r.Select, {
		ariaLabel: "Saved script",
		value: o ?? "",
		options: i.map((e) => ({
			value: e.id,
			label: e.name
		})),
		onChange: s
	}), /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		onClick: h
	}, "New"), d && /* @__PURE__ */ e.createElement(r.Button, {
		size: "sm",
		variant: "ghost",
		onClick: g
	}, "Delete")), !d && /* @__PURE__ */ e.createElement("p", { style: Q }, "No scripts yet. A script is G'MIC words, run on the photo; it also runs as gmic script <name> in the Terminal and the safelight command line."), d && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement(r.Field, {
		label: "Name",
		hint: _ === d.name ? void 0 : `Another script has this name; it runs as "${_}" once renamed.`
	}, /* @__PURE__ */ e.createElement(r.TextInput, {
		"aria-label": "Script name",
		value: d.name,
		onChange: (e) => m({ name: e }),
		onBlur: () => m({ name: _ })
	})), /* @__PURE__ */ e.createElement(r.TextArea, {
		mono: !0,
		rows: 10,
		"aria-label": "Script source",
		spellCheck: !1,
		value: d.source,
		onChange: (e) => m({ source: e })
	}), /* @__PURE__ */ e.createElement(Ge, {
		params: f,
		values: c,
		onChange: (e, t) => l((n) => ({
			...n,
			[e]: t
		}))
	}), /* @__PURE__ */ e.createElement($e, {
		runner: u,
		photo: n.photo,
		job: () => G(d.source, c)
	})));
}
function ot(n) {
	let r = t.ui, i = Ze(), [a, o] = e.useState("filters"), [s, c] = e.useState(void 0), [l, u] = e.useState(""), d = e.useCallback(async () => {
		let e = await n.deps.engine.program();
		c(e), u(""), e && n.deps.engine.version().then(u, () => u(""));
	}, [n.deps]);
	return e.useEffect(() => void d(), [d]), s === void 0 ? null : /* @__PURE__ */ e.createElement(r.Stack, { gap: 10 }, /* @__PURE__ */ e.createElement(et, {
		deps: n.deps,
		program: s,
		version: l,
		onChange: () => void d()
	}), s && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement(r.SegmentedControl, {
		size: "sm",
		value: a,
		onChange: o,
		options: [{
			value: "filters",
			label: "Filters"
		}, {
			value: "scripts",
			label: "Scripts"
		}]
	}), a === "filters" ? /* @__PURE__ */ e.createElement(it, {
		key: s.token,
		deps: n.deps,
		photo: i
	}) : /* @__PURE__ */ e.createElement(at, {
		deps: n.deps,
		photo: i
	})));
}
//#endregion
//#region src/index.tsx
var st = "gmic.panel";
function ct(e) {
	return {
		engine: pe(e.programs),
		scripts: () => V(e.settings),
		render: (t, n) => Ye(e, t, {
			longEdge: qe(e.settings),
			bits: 16,
			signal: n
		}),
		displayName: (t) => e.catalog.photoDisplayName(t)
	};
}
function lt(t) {
	n(t);
	let r = ct(t);
	t.commands.register(Ne(r)), t.registerPanel({
		id: st,
		title: "G'MIC",
		component: () => /* @__PURE__ */ e.createElement(ot, { deps: r }),
		defaultDock: {
			module: "develop",
			direction: "right"
		}
	});
}
//#endregion
export { st as PANEL_ID, lt as activate, ct as createDeps };

//# sourceMappingURL=index.js.map