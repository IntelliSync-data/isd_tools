/** @odoo-module **/

import { Component, markup, onWillStart, useState } from "@odoo/owl";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { getDataURLFromFile } from "@web/core/utils/urls";
import {
    COLOR_PRESETS,
    ECC_OPTIONS,
    MARGIN_OPTIONS,
    PAYLOAD_FIELDS,
    PNG_SIZE_OPTIONS,
    QR_TYPES,
    WIFI_AUTH_OPTIONS,
    buildPayload,
    copyPng,
    downloadPng,
    downloadSvg,
    guessImageMime,
    hasContent,
    printQr,
    renderPngDataUrl,
    renderSvg,
    stripDataUrl,
} from "../js/qr_utils";

const MODEL = "isd.qr.code";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function emptyForm() {
    const form = Object.fromEntries(PAYLOAD_FIELDS.map((name) => [name, ""]));
    return Object.assign(form, { qr_type: "link", wifi_auth: "WPA", wifi_hidden: false });
}

function defaultStyle() {
    return { fg_color: "#000000", bg_color: "#ffffff", ecc_level: "Q", margin: "2", png_size: "1024" };
}

export class QrStudio extends Component {
    static template = "isd_qr_code.QrStudio";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.dialog = useService("dialog");
        this.action = useService("action");

        this.types = QR_TYPES;
        this.eccOptions = ECC_OPTIONS;
        this.marginOptions = MARGIN_OPTIONS;
        this.sizeOptions = PNG_SIZE_OPTIONS;
        this.wifiAuthOptions = WIFI_AUTH_OPTIONS;
        this.presets = COLOR_PRESETS;

        this.state = useState({
            form: emptyForm(),
            style: defaultStyle(),
            name: "",
            nameTouched: false,
            logoDataUrl: null,
            recordId: null,
            dirty: false,
            saving: false,
            history: [],
        });

        onWillStart(async () => {
            const recordId = this.props.action?.params?.record_id;
            await Promise.all([this.loadHistory(), recordId ? this.loadRecord(recordId) : null]);
        });
    }

    // ------------------------------------------------------------------ getters
    get payload() {
        return buildPayload(this.state.form);
    }

    get hasContent() {
        return hasContent(this.state.form, this.payload);
    }

    get renderOpts() {
        const { style } = this.state;
        return {
            payload: this.payload,
            fgColor: style.fg_color,
            bgColor: style.bg_color,
            eccLevel: style.ecc_level,
            margin: style.margin,
            logoSrc: this.state.logoDataUrl,
        };
    }

    /** {svg} hoặc {error} — tính lại mỗi lần render, đủ nhanh cho live preview. */
    get preview() {
        if (!this.hasContent) {
            return { empty: true };
        }
        try {
            return { svg: markup(renderSvg(this.renderOpts, 300)) };
        } catch {
            return { error: true };
        }
    }

    get canExport() {
        return Boolean(this.preview.svg);
    }

    get lowContrast() {
        return contrastRatio(this.state.style.fg_color, this.state.style.bg_color) < 3;
    }

    get inverted() {
        return luminance(this.state.style.fg_color) > luminance(this.state.style.bg_color);
    }

    get logoNeedsHighEcc() {
        return Boolean(this.state.logoDataUrl) && ["L", "M"].includes(this.state.style.ecc_level);
    }

    get defaultName() {
        return defaultNameFor(this.state.form);
    }

    // ------------------------------------------------------------------ input handlers
    setType(type) {
        if (type === this.state.form.qr_type) {
            return;
        }
        // Đổi loại nội dung = một mã khác: không ghi đè bản ghi đang mở.
        if (this.state.recordId) {
            this.state.recordId = null;
            if (!this.state.nameTouched) {
                this.state.name = "";
            }
        }
        this.state.form.qr_type = type;
        this.state.dirty = true;
    }

    onInput(field, ev) {
        const target = ev.target;
        this.state.form[field] = target.type === "checkbox" ? target.checked : target.value;
        this.state.dirty = true;
    }

    onNameInput(ev) {
        this.state.name = ev.target.value;
        this.state.nameTouched = Boolean(ev.target.value.trim());
        this.state.dirty = true;
    }

    onStyle(field, ev) {
        let value = ev.target.value;
        if (field === "fg_color" || field === "bg_color") {
            value = normalizeHex(value);
            if (!value) {
                return;
            }
        }
        this.state.style[field] = value;
        this.state.dirty = true;
    }

    applyPreset(preset) {
        this.state.style.fg_color = preset.fg;
        this.state.style.bg_color = preset.bg;
        this.state.dirty = true;
    }

    isPresetActive(preset) {
        return preset.fg === this.state.style.fg_color && preset.bg === this.state.style.bg_color;
    }

    async onLogoChange(ev) {
        const file = ev.target.files && ev.target.files[0];
        ev.target.value = "";
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            this.notification.add("Vui lòng chọn file ảnh (PNG, JPG, SVG).", { type: "warning" });
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            this.notification.add("Logo tối đa 2MB.", { type: "warning" });
            return;
        }
        this.state.logoDataUrl = await getDataURLFromFile(file);
        if (["L", "M"].includes(this.state.style.ecc_level)) {
            this.state.style.ecc_level = "H";
            this.notification.add("Đã chuyển mức sửa lỗi lên High (30%) để mã vẫn quét được khi có logo.", {
                type: "info",
            });
        }
        this.state.dirty = true;
    }

    removeLogo() {
        this.state.logoDataUrl = null;
        this.state.dirty = true;
    }

    // ------------------------------------------------------------------ export
    async onDownloadPng() {
        await downloadPng(this.renderOpts, this.state.style.png_size, this.state.name || this.defaultName);
        this.notification.add(`Đã tải PNG ${this.state.style.png_size}px.`, { type: "success" });
        await this.save({ silent: true });
    }

    async onDownloadSvg() {
        await downloadSvg(this.renderOpts, this.state.name || this.defaultName);
        this.notification.add("Đã tải file Vector SVG.", { type: "success" });
        await this.save({ silent: true });
    }

    async onCopy() {
        const ok = await copyPng(this.renderOpts, this.state.style.png_size);
        if (ok) {
            this.notification.add("Đã copy ảnh QR vào clipboard.", { type: "success" });
        } else {
            this.notification.add("Trình duyệt không cho phép copy ảnh, hãy dùng nút Tải PNG.", { type: "warning" });
        }
    }

    async onPrint() {
        const ok = await printQr(this.renderOpts, this.payload);
        if (!ok) {
            this.notification.add("Trình duyệt đã chặn cửa sổ in, hãy cho phép popup.", { type: "warning" });
        }
    }

    // ------------------------------------------------------------------ persistence
    async recordValues() {
        const values = { ...this.state.form, ...this.state.style };
        values.name = (this.state.name || "").trim() || this.defaultName;
        values.logo = this.state.logoDataUrl ? stripDataUrl(this.state.logoDataUrl) : false;
        values.image = stripDataUrl(await renderPngDataUrl(this.renderOpts, 512));
        values.svg_content = renderSvg(this.renderOpts, 512);
        for (const key of Object.keys(values)) {
            if (values[key] === "") {
                values[key] = false;
            }
        }
        values.wifi_hidden = Boolean(this.state.form.wifi_hidden);
        return values;
    }

    async save({ silent = false } = {}) {
        if (!this.canExport || this.state.saving) {
            return;
        }
        if (silent && !this.state.dirty && this.state.recordId) {
            return;
        }
        this.state.saving = true;
        try {
            const values = await this.recordValues();
            if (!this.state.recordId) {
                const duplicate = this.state.history.find(
                    (item) => item.payload === this.payload && item.qr_type === this.state.form.qr_type
                );
                if (duplicate) {
                    this.state.recordId = duplicate.id;
                }
            }
            if (this.state.recordId) {
                await this.orm.write(MODEL, [this.state.recordId], values);
            } else {
                [this.state.recordId] = await this.orm.create(MODEL, [values]);
            }
            if (this.state.nameTouched) {
                this.state.name = values.name;
            }
            this.state.dirty = false;
            await this.loadHistory();
            if (!silent) {
                this.notification.add("Đã lưu vào thư viện mã QR.", { type: "success" });
            }
        } finally {
            this.state.saving = false;
        }
    }

    newCode() {
        Object.assign(this.state, {
            form: emptyForm(),
            style: defaultStyle(),
            name: "",
            nameTouched: false,
            logoDataUrl: null,
            recordId: null,
            dirty: false,
        });
    }

    async loadHistory() {
        this.state.history = await this.orm.call(MODEL, "get_studio_history", [], { limit: 10 });
    }

    async loadRecord(recordId) {
        const values = await this.orm.call(MODEL, "get_studio_values", [[recordId]]);
        const form = emptyForm();
        for (const name of PAYLOAD_FIELDS) {
            form[name] = values[name] === false ? (name === "wifi_hidden" ? false : "") : values[name];
        }
        form.wifi_auth = form.wifi_auth || "WPA";
        const autoName = defaultNameFor(form);
        Object.assign(this.state, {
            form,
            style: {
                fg_color: values.fg_color,
                bg_color: values.bg_color,
                ecc_level: values.ecc_level,
                margin: values.margin,
                png_size: values.png_size,
            },
            name: values.name === autoName ? "" : values.name,
            nameTouched: values.name !== autoName,
            logoDataUrl: values.logo ? `data:${guessImageMime(values.logo)};base64,${values.logo}` : null,
            recordId,
            dirty: false,
        });
    }

    async reuse(item) {
        await this.loadRecord(item.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    deleteItem(item) {
        this.dialog.add(ConfirmationDialog, {
            title: "Xoá mã QR",
            body: `Xoá "${item.name}" khỏi thư viện?`,
            confirmLabel: "Xoá",
            confirm: async () => {
                await this.orm.unlink(MODEL, [item.id]);
                if (this.state.recordId === item.id) {
                    this.state.recordId = null;
                    this.state.dirty = true;
                }
                await this.loadHistory();
            },
            cancel: () => {},
        });
    }

    clearHistory() {
        this.dialog.add(ConfirmationDialog, {
            title: "Dọn lịch sử",
            body: "Lưu trữ (archive) toàn bộ mã QR trong lịch sử gần đây của bạn? Có thể khôi phục trong Thư viện.",
            confirmLabel: "Lưu trữ",
            confirm: async () => {
                const ids = this.state.history.map((item) => item.id);
                if (ids.length) {
                    await this.orm.write(MODEL, ids, { active: false });
                }
                this.state.recordId = null;
                await this.loadHistory();
            },
            cancel: () => {},
        });
    }

    openLibrary() {
        this.action.doAction("isd_qr_code.action_qr_code");
    }

    openRecord() {
        if (this.state.recordId) {
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: MODEL,
                res_id: this.state.recordId,
                views: [[false, "form"]],
            });
        }
    }

    typeLabel(value) {
        const type = QR_TYPES.find((t) => t.value === value);
        return type ? type.label : value;
    }

    typeIcon(value) {
        const type = QR_TYPES.find((t) => t.value === value);
        return type ? type.icon : "fa-qrcode";
    }

    shortPayload(payload) {
        const line = (payload || "").split("\n").find((l) => l && !l.startsWith("BEGIN:") && !l.startsWith("VERSION:")) || "";
        return line.length > 38 ? `${line.slice(0, 38)}…` : line;
    }

    timeAgo(dateString) {
        const date = new Date(dateString.replace(" ", "T") + "Z");
        const minutes = Math.round((Date.now() - date.getTime()) / 60000);
        if (minutes < 1) {
            return "vừa xong";
        }
        if (minutes < 60) {
            return `${minutes} phút trước`;
        }
        const hours = Math.round(minutes / 60);
        if (hours < 24) {
            return `${hours} giờ trước`;
        }
        return `${Math.round(hours / 24)} ngày trước`;
    }
}

/** Tên tự sinh: "<Loại> - <dòng đầu nội dung>" (bỏ phần đầu vCard). */
export function defaultNameFor(form) {
    const type = QR_TYPES.find((t) => t.value === form.qr_type);
    const lines = buildPayload(form).split("\n");
    let first = lines[0];
    if (form.qr_type === "vcard") {
        first = (lines.find((l) => l.startsWith("FN:")) || "FN:").slice(3);
    }
    const preview = first.length > 38 ? `${first.slice(0, 38)}…` : first;
    return `${type ? type.label : "QR"} - ${preview}`;
}

export function normalizeHex(value) {
    let hex = String(value || "").trim();
    if (!hex.startsWith("#")) {
        hex = `#${hex}`;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

export function luminance(hex) {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tỉ lệ tương phản WCAG giữa hai màu #RRGGBB. */
export function contrastRatio(fg, bg) {
    const a = luminance(fg);
    const b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

registry.category("actions").add("isd_qr_code.studio", QrStudio);
