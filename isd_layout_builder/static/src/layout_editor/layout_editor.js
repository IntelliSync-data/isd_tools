/** @odoo-module **/
import { Component, onWillUnmount, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

// Corner and edge handles, with the cursor each one shows
const HANDLES = [
    { dir: "nw", cursor: "nwse-resize" },
    { dir: "n", cursor: "ns-resize" },
    { dir: "ne", cursor: "nesw-resize" },
    { dir: "e", cursor: "ew-resize" },
    { dir: "se", cursor: "nwse-resize" },
    { dir: "s", cursor: "ns-resize" },
    { dir: "sw", cursor: "nesw-resize" },
    { dir: "w", cursor: "ew-resize" },
];
const SNAP_PX = 6; // how close, on screen, before an edge sticks to a guide
const HANDLE_PX = 8;
const MAX_WIDTH_PX = 640;
const MAX_HEIGHT_PX = 560;
const MIN_SIZE = 2; // viewBox units

const round2 = (v) => Math.round(v * 100) / 100;
// A saved row keeps its database id across a save; a new one only has the
// list's temporary id. Keyed this way, the selection survives saving.
const keyOf = (rec) => rec.resId || rec.id;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Drag-and-drop editor for the frames of a layout.
 *
 * The frames are the rows of the system_ids list. While the mouse is down
 * the editor draws its own copy of the frame being moved, and writes to the
 * row once, on release: writing on every mouse move would fill the form with
 * intermediate values and make dragging stutter.
 */
export class LayoutEditor extends Component {
    static template = "isd_layout_builder.LayoutEditor";
    static props = { ...standardWidgetProps };

    setup() {
        this.svgRef = useRef("svg");
        this.handles = HANDLES;
        this.state = useState({ selectedId: null, live: null, guides: [], hints: [] });
        this.drag = null;
        this.onWindowMove = (ev) => this.onPointerMove(ev);
        this.onWindowUp = () => this.onPointerUp();
        onWillUnmount(() => this.stopListening());
    }

    // ------------------------------------------------------------ geometry
    get data() {
        return this.props.record.data;
    }
    get vbw() {
        return parseFloat(this.data.view_box_width) || 0;
    }
    get vbh() {
        return parseFloat(this.data.view_box_height) || 0;
    }
    get ready() {
        return this.vbw > 0 && this.vbh > 0;
    }
    get editable() {
        return !this.props.readonly;
    }
    get display() {
        const scale = Math.min(MAX_WIDTH_PX / this.vbw, MAX_HEIGHT_PX / this.vbh);
        return { width: this.vbw * scale, height: this.vbh * scale, scale };
    }
    /** One screen pixel, in viewBox units. */
    get px() {
        return 1 / this.display.scale;
    }
    /** The printable area inside the print margins (mm), in viewBox units. */
    get safe() {
        const d = this.data;
        const perX = d.actual_width ? this.vbw / d.actual_width : 0;
        const perY = d.actual_height ? this.vbh / d.actual_height : 0;
        const box = {
            x: (d.print_left || 0) * perX,
            y: (d.print_top || 0) * perY,
            r: this.vbw - (d.print_right || 0) * perX,
            b: this.vbh - (d.print_bottom || 0) * perY,
        };
        box.valid = perX > 0 && perY > 0 && box.r > box.x && box.b > box.y;
        return box;
    }

    get frames() {
        const ghost = Math.min(this.vbw, this.vbh) * 0.12;
        const live = this.state.live;
        return this.data.system_ids.records.map((rec) => {
            const d = rec.data;
            const id = keyOf(rec);
            // A frame added by hand starts at 0 x 0: show it as a small
            // dashed box so it can be grabbed and given a size
            const empty = !(d.width > 0 && d.height > 0);
            const w = empty ? ghost : d.width;
            const h = empty ? ghost : d.height;
            const geo =
                live && live.id === id
                    ? live
                    : {
                          x: clamp(d.x || 0, 0, this.vbw - w),
                          y: clamp(d.y || 0, 0, this.vbh - h),
                          width: w,
                          height: h,
                      };
            return {
                id,
                no: d.no,
                isQr: d.frame_type === "qr",
                empty: empty && !(live && live.id === id),
                x: geo.x,
                y: geo.y,
                width: geo.width,
                height: geo.height,
            };
        });
    }
    get selected() {
        return this.frames.find((f) => f.id === this.state.selectedId) || null;
    }

    label(frame) {
        return frame.isQr ? "QR" : String(frame.no || "");
    }
    labelSize(frame) {
        return Math.max(Math.min(frame.width, frame.height) * 0.28, 9 * this.px);
    }
    handleBox(frame, dir) {
        const s = HANDLE_PX * this.px;
        const xs = { w: frame.x, e: frame.x + frame.width, c: frame.x + frame.width / 2 };
        const ys = { n: frame.y, s: frame.y + frame.height, c: frame.y + frame.height / 2 };
        const x = dir.includes("w") ? xs.w : dir.includes("e") ? xs.e : xs.c;
        const y = dir.includes("n") ? ys.n : dir.includes("s") ? ys.s : ys.c;
        return { x: x - s / 2, y: y - s / 2, size: s };
    }
    fmt(v) {
        return (Math.round(v * 100) / 100).toFixed(2);
    }

    // ------------------------------------------------------------- snapping
    /**
     * The lines an edge can stick to. The print margins, the centre and the
     * other frames come first; the canvas edges only count when none of those
     * is in reach, since a frame on the canvas edge prints outside the margins.
     */
    targets(excludeId) {
        const xs = [this.vbw / 2];
        const ys = [this.vbh / 2];
        const safe = this.safe;
        if (safe.valid) {
            xs.push(safe.x, safe.r);
            ys.push(safe.y, safe.b);
        }
        const others = this.frames.filter((f) => f.id !== excludeId && !f.empty);
        for (const f of others) {
            xs.push(f.x, f.x + f.width / 2, f.x + f.width);
            ys.push(f.y, f.y + f.height / 2, f.y + f.height);
        }
        return { xs, ys, edgeXs: [0, this.vbw], edgeYs: [0, this.vbh], others };
    }
    /** Every line the frame now sits on, so all the alignments show, not just the one that pulled. */
    aligned(values, lines) {
        const hits = new Set();
        for (const v of values) {
            for (const line of lines) {
                if (Math.abs(line - v) < 0.01) {
                    hits.add(line);
                }
            }
        }
        return [...hits];
    }
    snapX(values, t, threshold) {
        return this.nearest(values, t.xs, threshold) || this.nearest(values, t.edgeXs, threshold);
    }
    snapY(values, t, threshold) {
        return this.nearest(values, t.ys, threshold) || this.nearest(values, t.edgeYs, threshold);
    }
    /** The smallest shift that puts one of `values` on one of `lines`. */
    nearest(values, lines, threshold) {
        let best = null;
        for (const v of values) {
            for (const line of lines) {
                const delta = line - v;
                if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
                    best = { delta, at: line };
                }
            }
        }
        return best;
    }
    /** Another frame whose width (or height) is within reach of `value`. */
    sameSize(value, others, key, threshold) {
        let best = null;
        for (const f of others) {
            const diff = Math.abs(f[key] - value);
            if (diff <= threshold && (!best || diff < best.diff)) {
                best = { diff, value: f[key], no: f.isQr ? "QR" : f.no };
            }
        }
        return best;
    }

    move(drag, dx, dy, ev, snap, threshold) {
        const o = drag.orig;
        if (ev.shiftKey) {
            // Shift keeps the frame on one axis, whichever it has moved along most
            if (Math.abs(dx) > Math.abs(dy)) {
                dy = 0;
            } else {
                dx = 0;
            }
        }
        let x = o.x + dx;
        let y = o.y + dy;
        const guides = [];
        if (snap) {
            const t = this.targets(drag.id);
            const sx = !(ev.shiftKey && dx === 0) && this.snapX([x, x + o.width / 2, x + o.width], t, threshold);
            if (sx) {
                x += sx.delta;
                guides.push({ axis: "x", at: sx.at });
            }
            const sy = !(ev.shiftKey && dy === 0) && this.snapY([y, y + o.height / 2, y + o.height], t, threshold);
            if (sy) {
                y += sy.delta;
                guides.push({ axis: "y", at: sy.at });
            }
        }
        x = clamp(x, 0, this.vbw - o.width);
        y = clamp(y, 0, this.vbh - o.height);
        if (guides.length) {
            const t = this.targets(drag.id);
            const xs = this.aligned([x, x + o.width / 2, x + o.width], [...t.xs, ...t.edgeXs]);
            const ys = this.aligned([y, y + o.height / 2, y + o.height], [...t.ys, ...t.edgeYs]);
            guides.splice(0, guides.length, ...xs.map((at) => ({ axis: "x", at })), ...ys.map((at) => ({ axis: "y", at })));
        }
        return { rect: { x, y, width: o.width, height: o.height }, guides, hints: [] };
    }

    resize(drag, dx, dy, ev, snap, threshold) {
        const o = drag.orig;
        const dir = drag.handle;
        const hasW = dir.includes("w");
        const hasE = dir.includes("e");
        const hasN = dir.includes("n");
        const hasS = dir.includes("s");
        const fromCenter = ev.altKey;
        // A QR code is always square; Shift keeps any frame's proportions
        const keepRatio = drag.isQr || ev.shiftKey;
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        let left = o.x + (hasW ? dx : 0);
        let right = o.x + o.width + (hasE ? dx : 0);
        let top = o.y + (hasN ? dy : 0);
        let bottom = o.y + o.height + (hasS ? dy : 0);
        const mirror = () => {
            if (!fromCenter) {
                return;
            }
            if (hasE) {
                left = 2 * cx - right;
            } else if (hasW) {
                right = 2 * cx - left;
            }
            if (hasS) {
                top = 2 * cy - bottom;
            } else if (hasN) {
                bottom = 2 * cy - top;
            }
        };
        mirror();

        const guides = [];
        const hints = [];
        let snappedX = false;
        let snappedY = false;
        if (snap) {
            const t = this.targets(drag.id);
            if (hasE || hasW) {
                const s = this.snapX([hasE ? right : left], t, threshold);
                if (s) {
                    if (hasE) {
                        right += s.delta;
                    } else {
                        left += s.delta;
                    }
                    guides.push({ axis: "x", at: s.at });
                    snappedX = true;
                } else {
                    const m = this.sameSize(right - left, t.others, "width", threshold);
                    if (m) {
                        const grow = m.value - (right - left);
                        if (hasE) {
                            right += grow;
                        } else {
                            left -= grow;
                        }
                        hints.push(`W = #${m.no}`);
                        snappedX = true;
                    }
                }
            }
            if (hasN || hasS) {
                const s = this.snapY([hasS ? bottom : top], t, threshold);
                if (s) {
                    if (hasS) {
                        bottom += s.delta;
                    } else {
                        top += s.delta;
                    }
                    guides.push({ axis: "y", at: s.at });
                    snappedY = true;
                } else {
                    const m = this.sameSize(bottom - top, t.others, "height", threshold);
                    if (m) {
                        const grow = m.value - (bottom - top);
                        if (hasS) {
                            bottom += grow;
                        } else {
                            top -= grow;
                        }
                        hints.push(`H = #${m.no}`);
                        snappedY = true;
                    }
                }
            }
            mirror();
        }

        let w = Math.max(right - left, MIN_SIZE);
        let h = Math.max(bottom - top, MIN_SIZE);
        if (keepRatio) {
            const ratio = drag.ratio;
            // Follow the side that snapped, else the one dragged furthest
            const byWidth =
                (hasE || hasW) && (!(hasN || hasS) || (snappedX && !snappedY) ||
                    (!snappedY && Math.abs(w / o.width) >= Math.abs(h / o.height)));
            if (byWidth) {
                h = w / ratio;
                if (guides.length && !snappedY) {
                    guides.splice(0, guides.length, ...guides.filter((g) => g.axis === "x"));
                }
            } else {
                w = h * ratio;
                if (guides.length && !snappedX) {
                    guides.splice(0, guides.length, ...guides.filter((g) => g.axis === "y"));
                }
            }
            // Never larger than the canvas allows
            const fit = Math.min(1, this.vbw / w, this.vbh / h);
            w *= fit;
            h *= fit;
        }

        // Anchor the side opposite the handle (or the centre with Alt)
        const place = (size, lowEdge, highEdge, lowHandle, highHandle, centre, origLow, origHigh) => {
            if (fromCenter) {
                return centre - size / 2;
            }
            if (lowHandle) {
                return origHigh - size;
            }
            if (highHandle) {
                return origLow;
            }
            return keepRatio ? centre - size / 2 : lowEdge;
        };
        let x = place(w, left, right, hasW, hasE, cx, o.x, o.x + o.width);
        let y = place(h, top, bottom, hasN, hasS, cy, o.y, o.y + o.height);
        if (!keepRatio && !fromCenter) {
            if (hasW) {
                x = Math.min(left, o.x + o.width - MIN_SIZE);
            }
            if (hasN) {
                y = Math.min(top, o.y + o.height - MIN_SIZE);
            }
        }
        // Stay on the canvas
        if (x < 0) {
            if (!keepRatio) {
                w += x;
            }
            x = 0;
        }
        if (y < 0) {
            if (!keepRatio) {
                h += y;
            }
            y = 0;
        }
        if (x + w > this.vbw) {
            if (keepRatio) {
                x = this.vbw - w;
            } else {
                w = this.vbw - x;
            }
        }
        if (y + h > this.vbh) {
            if (keepRatio) {
                y = this.vbh - h;
            } else {
                h = this.vbh - y;
            }
        }
        return { rect: { x, y, width: Math.max(w, MIN_SIZE), height: Math.max(h, MIN_SIZE) }, guides, hints };
    }

    // ---------------------------------------------------------------- mouse
    toSvg(ev) {
        const svg = this.svgRef.el;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        return { x: p.x, y: p.y };
    }

    onCanvasPointerDown(ev) {
        if (ev.target === this.svgRef.el || ev.target.classList.contains("o_isd_le_bg")) {
            this.state.selectedId = null;
        }
    }

    onPointerDown(ev, frame, handle) {
        if (ev.button !== 0) {
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        this.state.selectedId = frame.id;
        // For the arrow keys. Without preventScroll the browser may scroll the
        // canvas into view mid-drag, and the frame would jump by that much.
        this.svgRef.el.focus({ preventScroll: true });
        if (!this.editable) {
            return;
        }
        this.drag = {
            id: frame.id,
            handle,
            isQr: frame.isQr,
            ratio: frame.isQr ? 1 : frame.width / frame.height,
            start: this.toSvg(ev),
            orig: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
            moved: false,
        };
        window.addEventListener("pointermove", this.onWindowMove);
        window.addEventListener("pointerup", this.onWindowUp);
    }

    onPointerMove(ev) {
        const drag = this.drag;
        if (!drag) {
            return;
        }
        const p = this.toSvg(ev);
        const dx = p.x - drag.start.x;
        const dy = p.y - drag.start.y;
        // A click is not a drag: ignore the first couple of pixels
        if (!drag.moved && Math.hypot(dx, dy) < 3 * this.px) {
            return;
        }
        drag.moved = true;
        const snap = !(ev.ctrlKey || ev.metaKey);
        const threshold = SNAP_PX * this.px;
        const result = drag.handle
            ? this.resize(drag, dx, dy, ev, snap, threshold)
            : this.move(drag, dx, dy, ev, snap, threshold);
        this.state.live = { id: drag.id, ...result.rect };
        this.state.guides = result.guides;
        this.state.hints = result.hints;
    }

    async onPointerUp() {
        this.stopListening();
        const drag = this.drag;
        this.drag = null;
        const live = this.state.live;
        this.state.guides = [];
        this.state.hints = [];
        if (drag && drag.moved && live) {
            await this.write(drag.id, live);
        }
        this.state.live = null;
    }

    stopListening() {
        window.removeEventListener("pointermove", this.onWindowMove);
        window.removeEventListener("pointerup", this.onWindowUp);
    }

    async write(id, geo) {
        const rec = this.data.system_ids.records.find((r) => keyOf(r) === id);
        if (rec) {
            await rec.update({
                x: round2(geo.x),
                y: round2(geo.y),
                width: round2(geo.width),
                height: round2(geo.height),
            });
        }
    }

    // ------------------------------------------------------------- keyboard
    async onKeydown(ev) {
        const frame = this.selected;
        if (!frame) {
            return;
        }
        if (ev.key === "Escape") {
            this.state.selectedId = null;
            return;
        }
        const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!moves[ev.key] || !this.editable) {
            return;
        }
        ev.preventDefault();
        const step = ev.shiftKey ? 5 : 0.5;
        const [mx, my] = moves[ev.key];
        await this.write(frame.id, {
            x: clamp(frame.x + mx * step, 0, this.vbw - frame.width),
            y: clamp(frame.y + my * step, 0, this.vbh - frame.height),
            width: frame.width,
            height: frame.height,
        });
    }
}

registry.category("view_widgets").add("isd_layout_editor", {
    component: LayoutEditor,
    fieldDependencies: [
        { name: "view_box_width", type: "selection" },
        { name: "view_box_height", type: "selection" },
        { name: "actual_width", type: "float" },
        { name: "actual_height", type: "float" },
        { name: "print_top", type: "float" },
        { name: "print_left", type: "float" },
        { name: "print_bottom", type: "float" },
        { name: "print_right", type: "float" },
    ],
});
