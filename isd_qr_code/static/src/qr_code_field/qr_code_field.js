/** @odoo-module **/

import { Component, markup, onWillUnmount, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { isBinarySize } from "@web/core/utils/binary";
import { useService } from "@web/core/utils/hooks";
import { imageUrl } from "@web/core/utils/urls";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import {
    PAYLOAD_FIELDS,
    buildPayload,
    copyPng,
    downloadPng,
    downloadSvg,
    guessImageMime,
    hasContent,
    printQr,
    renderKey,
    renderPngDataUrl,
    renderSvg,
    stripDataUrl,
} from "../js/qr_utils";

function safeSvg(opts, size) {
    try {
        return { svg: markup(renderSvg(opts, size)) };
    } catch {
        return { error: true };
    }
}

/**
 * Widget `qr_code` dùng chung: hiển thị mã QR của giá trị field Char/Text.
 *   <field name="website" widget="qr_code" options="{'size': 160, 'ecc': 'M', 'fg_color': '#000000'}"/>
 */
export class QrCodeField extends Component {
    static template = "isd_qr_code.QrCodeField";
    static props = {
        ...standardFieldProps,
        size: { type: Number, optional: true },
        ecc: { type: String, optional: true },
        fgColor: { type: String, optional: true },
        bgColor: { type: String, optional: true },
        margin: { type: Number, optional: true },
        downloadable: { type: Boolean, optional: true },
    };
    static defaultProps = { size: 160, ecc: "M", fgColor: "#000000", bgColor: "#ffffff", margin: 2, downloadable: true };

    get value() {
        return (this.props.record.data[this.props.name] || "").trim();
    }

    get opts() {
        return {
            payload: this.value,
            fgColor: this.props.fgColor,
            bgColor: this.props.bgColor,
            eccLevel: this.props.ecc,
            margin: this.props.margin,
        };
    }

    get preview() {
        return this.value ? safeSvg(this.opts, this.props.size) : { empty: true };
    }

    async onDownload() {
        await downloadPng(this.opts, 1024, `${this.props.name}_${this.props.record.resId || "qr"}`);
    }
}

export const qrCodeField = {
    component: QrCodeField,
    displayName: "Mã QR",
    supportedTypes: ["char", "text"],
    supportedOptions: [
        { label: "Kích thước (px)", name: "size", type: "number" },
        { label: "Mức sửa lỗi (L/M/Q/H)", name: "ecc", type: "string" },
        { label: "Màu mã", name: "fg_color", type: "string" },
        { label: "Màu nền", name: "bg_color", type: "string" },
        { label: "Viền", name: "margin", type: "number" },
        { label: "Cho tải PNG", name: "downloadable", type: "boolean" },
    ],
    extractProps: ({ options }) => ({
        size: options.size,
        ecc: options.ecc,
        fgColor: options.fg_color,
        bgColor: options.bg_color,
        margin: options.margin,
        downloadable: options.downloadable,
    }),
};

registry.category("fields").add("qr_code", qrCodeField);

/**
 * Widget xem trước cho form isd.qr.code (gắn vào field payload): vẽ trực tiếp từ các field
 * đang nhập, có nút xuất file, và cập nhật ảnh lưu kèm (image, svg_content) khi nội dung/kiểu đổi.
 */
export class QrPreviewField extends Component {
    static template = "isd_qr_code.QrPreviewField";
    static props = { ...standardFieldProps };

    setup() {
        this.notification = useService("notification");
        this.initialKey = this.currentKey;
        this.timer = null;
        useEffect(
            (key) => {
                clearTimeout(this.timer);
                if (!this.props.record.isInEdition || !this.canExport) {
                    return;
                }
                if (key !== this.initialKey || !this.props.record.data.image) {
                    this.timer = setTimeout(() => this.refreshStoredImage(key), 400);
                }
            },
            () => [this.currentKey]
        );
        onWillUnmount(() => clearTimeout(this.timer));
    }

    get data() {
        return this.props.record.data;
    }

    get payload() {
        const values = Object.fromEntries(PAYLOAD_FIELDS.map((name) => [name, this.data[name]]));
        return buildPayload(values);
    }

    get logoSrc() {
        const logo = this.data.logo;
        if (!logo) {
            return null;
        }
        if (isBinarySize(logo)) {
            return imageUrl("isd.qr.code", this.props.record.resId, "logo", { unique: this.data.write_date });
        }
        return `data:${guessImageMime(logo)};base64,${logo}`;
    }

    get logoToken() {
        const logo = this.data.logo;
        if (!logo) {
            return "";
        }
        return isBinarySize(logo) ? "stored" : `new-${logo.length}-${logo.slice(-32)}`;
    }

    get opts() {
        return {
            payload: this.payload,
            fgColor: this.data.fg_color || "#000000",
            bgColor: this.data.bg_color || "#ffffff",
            eccLevel: this.data.ecc_level || "Q",
            margin: this.data.margin || "2",
            logoSrc: this.logoSrc,
        };
    }

    get currentKey() {
        return renderKey(this.opts, this.logoToken);
    }

    get hasContent() {
        const values = Object.fromEntries(PAYLOAD_FIELDS.map((name) => [name, this.data[name]]));
        return hasContent(values, this.payload);
    }

    get preview() {
        return this.hasContent ? safeSvg(this.opts, 280) : { empty: true };
    }

    get canExport() {
        return Boolean(this.preview.svg);
    }

    get filename() {
        return this.data.name || "QRCode";
    }

    async refreshStoredImage(key) {
        if (key !== this.currentKey || !this.canExport) {
            return;
        }
        const opts = this.opts;
        const png = await renderPngDataUrl(opts, 512);
        if (key !== this.currentKey) {
            return;
        }
        this.initialKey = key;
        await this.props.record.update({ image: stripDataUrl(png), svg_content: renderSvg(opts, 512) });
    }

    async onDownloadPng() {
        await downloadPng(this.opts, this.data.png_size || "1024", this.filename);
    }

    async onDownloadSvg() {
        await downloadSvg(this.opts, this.filename);
    }

    async onCopy() {
        const ok = await copyPng(this.opts, this.data.png_size || "1024");
        this.notification.add(ok ? "Đã copy ảnh QR vào clipboard." : "Trình duyệt không cho phép copy ảnh, hãy dùng nút Tải PNG.", {
            type: ok ? "success" : "warning",
        });
    }

    async onPrint() {
        if (!(await printQr(this.opts, this.payload))) {
            this.notification.add("Trình duyệt đã chặn cửa sổ in, hãy cho phép popup.", { type: "warning" });
        }
    }
}

export const qrPreviewField = {
    component: QrPreviewField,
    displayName: "Xem trước mã QR (ISD)",
    supportedTypes: ["text", "char"],
};

registry.category("fields").add("isd_qr_preview", qrPreviewField);
