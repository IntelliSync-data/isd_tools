/** @odoo-module **/

/**
 * Tiện ích dùng chung cho QR Studio và widget: dựng payload, render SVG/PNG, xuất file.
 * Lõi sinh mã là QREngine (static/lib/qr_engine/qr_engine.js, nạp sẵn vào web.assets_backend).
 */

export const QR_TYPES = [
    { value: "link", label: "Link URL", icon: "fa-link" },
    { value: "text", label: "Văn bản", icon: "fa-align-left" },
    { value: "wifi", label: "Wi-Fi", icon: "fa-wifi" },
    { value: "vcard", label: "Danh thiếp", icon: "fa-address-card-o" },
    { value: "email", label: "Email", icon: "fa-envelope-o" },
    { value: "phone", label: "Điện thoại", icon: "fa-phone" },
    { value: "sms", label: "SMS", icon: "fa-commenting-o" },
];

export const ECC_OPTIONS = [
    { value: "L", label: "Low (7% - Gọn nhất)" },
    { value: "M", label: "Medium (15% - Tiêu chuẩn)" },
    { value: "Q", label: "Quartile (25% - Đề xuất)" },
    { value: "H", label: "High (30% - Chèn logo)" },
];

export const MARGIN_OPTIONS = [
    { value: "0", label: "Không viền (0)" },
    { value: "1", label: "Viền mỏng (1)" },
    { value: "2", label: "Tiêu chuẩn (2)" },
    { value: "4", label: "Viền rộng (4)" },
];

export const PNG_SIZE_OPTIONS = [
    { value: "512", label: "512 px" },
    { value: "1024", label: "1024 px (HD)" },
    { value: "2048", label: "2048 px (2K)" },
    { value: "4096", label: "4096 px (4K in ấn)" },
];

export const WIFI_AUTH_OPTIONS = [
    { value: "WPA", label: "WPA / WPA2 / WPA3 (Phổ biến)" },
    { value: "WEP", label: "WEP" },
    { value: "nopass", label: "Không mật khẩu (Mạng mở)" },
];

export const COLOR_PRESETS = [
    { name: "Classic", fg: "#000000", bg: "#ffffff" },
    { name: "Obsidian", fg: "#0f172a", bg: "#f8fafc" },
    { name: "Azure Blue", fg: "#0284c7", bg: "#ffffff" },
    { name: "Emerald Forest", fg: "#059669", bg: "#ffffff" },
    { name: "Royal Purple", fg: "#7c3aed", bg: "#ffffff" },
    { name: "Crimson Rose", fg: "#e11d48", bg: "#ffffff" },
    { name: "Cyberpunk", fg: "#00f0ff", bg: "#0b0f19" },
];

/** Các field nội dung, trùng với PAYLOAD_FIELDS bên Python (models/qr_code.py). */
export const PAYLOAD_FIELDS = [
    "qr_type", "url", "text", "wifi_ssid", "wifi_password", "wifi_auth", "wifi_hidden",
    "vcard_first_name", "vcard_last_name", "vcard_phone", "vcard_email", "vcard_organization",
    "vcard_title", "vcard_website", "vcard_address", "vcard_note",
    "email_to", "email_subject", "email_body", "phone", "sms_message",
];

export const STYLE_FIELDS = ["fg_color", "bg_color", "ecc_level", "margin", "png_size"];

export const LOGO_RATIO = 0.22;

export function getEngine() {
    const engine = globalThis.QREngine;
    if (!engine) {
        throw new Error("QREngine chưa được nạp");
    }
    return engine;
}

const str = (value) => (value === false || value === null || value === undefined ? "" : String(value));

/** Dựng payload giống format_payload() bên Python. */
export function buildPayload(data) {
    const F = getEngine().formatters;
    switch (data.qr_type) {
        case "link":
            return F.url(str(data.url));
        case "text":
            return F.text(str(data.text));
        case "wifi":
            return F.wifi({
                ssid: str(data.wifi_ssid),
                password: str(data.wifi_password),
                authType: str(data.wifi_auth) || "WPA",
                hidden: Boolean(data.wifi_hidden),
            });
        case "vcard":
            return F.vcard({
                firstName: str(data.vcard_first_name),
                lastName: str(data.vcard_last_name),
                phone: str(data.vcard_phone),
                email: str(data.vcard_email),
                organization: str(data.vcard_organization),
                title: str(data.vcard_title),
                url: str(data.vcard_website),
                address: str(data.vcard_address),
                note: str(data.vcard_note),
            });
        case "email":
            return F.email({
                email: str(data.email_to),
                subject: str(data.email_subject),
                body: str(data.email_body),
            });
        case "phone":
            return F.phone(str(data.phone));
        case "sms":
            return F.sms({ phone: str(data.phone), message: str(data.sms_message) });
        default:
            return "";
    }
}

/** Kiểm tra nhanh xem payload có dữ liệu thật chưa (form trống thì không vẽ). */
export function hasContent(data, payload) {
    switch (data.qr_type) {
        case "wifi":
            return Boolean(str(data.wifi_ssid).trim());
        case "vcard":
            return Boolean(str(data.vcard_first_name).trim() || str(data.vcard_last_name).trim());
        case "email":
            return Boolean(str(data.email_to).trim());
        case "phone":
        case "sms":
            return Boolean(str(data.phone).trim());
        default:
            return Boolean(payload);
    }
}

function renderOptions({ payload, fgColor, bgColor, eccLevel, margin }) {
    return {
        text: payload,
        eccLevel: eccLevel || "Q",
        fgColor: fgColor || "#000000",
        bgColor: bgColor || "#ffffff",
        margin: parseInt(margin ?? 2, 10),
        logoRatio: LOGO_RATIO,
        title: "QR Code",
    };
}

/** SVG string. Ném lỗi nếu dữ liệu quá dài cho QR (version 40). */
export function renderSvg(opts, size = 300) {
    return getEngine().renderSVG({ ...renderOptions(opts), size, logoSrc: opts.logoSrc || null });
}

export function loadImage(src) {
    return new Promise((resolve, reject) => {
        if (!src) {
            resolve(null);
            return;
        }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Không đọc được ảnh logo"));
        img.src = src;
    });
}

/** Canvas PNG kích thước `size` (px). */
export async function renderCanvas(opts, size) {
    const canvas = document.createElement("canvas");
    const logoImage = await loadImage(opts.logoSrc);
    getEngine().renderCanvas(canvas, { ...renderOptions(opts), size: parseInt(size, 10), logoImage });
    return canvas;
}

export async function renderPngDataUrl(opts, size) {
    return (await renderCanvas(opts, size)).toDataURL("image/png");
}

/** Chuyển URL ảnh (vd. /web/image/...) thành data URL để nhúng vào SVG xuất ra. */
export async function toDataUrl(src) {
    if (!src || src.startsWith("data:")) {
        return src || null;
    }
    const response = await fetch(src);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function timestamp() {
    return new Date().toISOString().replace(/[:.-]/g, "").slice(0, 15);
}

export function makeFilename(name, ext) {
    const base = str(name)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return `${base || "QRCode"}_${timestamp()}.${ext}`;
}

function triggerDownload(href, filename) {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export async function downloadPng(opts, size, name) {
    triggerDownload(await renderPngDataUrl(opts, size), makeFilename(name, "png"));
}

export async function downloadSvg(opts, name) {
    const svg = renderSvg({ ...opts, logoSrc: await toDataUrl(opts.logoSrc) }, 512);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    triggerDownload(url, makeFilename(name, "svg"));
    URL.revokeObjectURL(url);
}

/** Copy PNG vào clipboard. Trả về false nếu trình duyệt không cho phép. */
export async function copyPng(opts, size) {
    if (!navigator.clipboard || !globalThis.ClipboardItem) {
        return false;
    }
    try {
        const canvas = await renderCanvas(opts, size);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        return true;
    } catch {
        return false;
    }
}

function escapeHtml(value) {
    return str(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Mở cửa sổ in với mã QR và dòng chú thích. Trả về false nếu popup bị chặn. */
export async function printQr(opts, caption) {
    const win = window.open("", "_blank");
    if (!win) {
        return false;
    }
    const svg = renderSvg({ ...opts, logoSrc: await toDataUrl(opts.logoSrc) }, 320);
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>In mã QR</title>
<style>
body { display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:sans-serif; }
.box { text-align:center; } svg { width:320px; height:320px; }
p { margin-top:1.5rem; font-size:14px; color:#475569; word-break:break-all; max-width:400px; white-space:pre-wrap; }
</style></head><body><div class="box">${svg.replace(/^<\?xml[^>]*>\s*/, "")}<p>${escapeHtml(caption)}</p></div>
<script>window.onload = function () { window.print(); window.close(); };<\/script></body></html>`);
    win.document.close();
    return true;
}

/** Dấu vân tay nội dung + kiểu dáng để biết ảnh đã lưu còn khớp không. */
export function renderKey(opts, logoToken) {
    const source = JSON.stringify([opts.payload, opts.fgColor, opts.bgColor, opts.eccLevel, String(opts.margin),
                                   logoToken || ""]);
    let hash = 5381;
    for (let i = 0; i < source.length; i++) {
        hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0;
    }
    return `v1-${(hash >>> 0).toString(16)}-${source.length}`;
}

export function stripDataUrl(dataUrl) {
    return dataUrl ? dataUrl.slice(dataUrl.indexOf(",") + 1) : false;
}

export function guessImageMime(base64) {
    if (!base64) {
        return "image/png";
    }
    if (base64.startsWith("/9j/")) {
        return "image/jpeg";
    }
    if (base64.startsWith("R0lG")) {
        return "image/gif";
    }
    if (base64.startsWith("PHN2") || base64.startsWith("PD94")) {
        return "image/svg+xml";
    }
    if (base64.startsWith("UklG")) {
        return "image/webp";
    }
    return "image/png";
}
