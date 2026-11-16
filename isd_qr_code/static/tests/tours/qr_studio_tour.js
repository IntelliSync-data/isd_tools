/** @odoo-module **/

import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("isd_qr_code_studio_tour", {
    url: "/odoo/action-isd_qr_code.action_qr_studio",
    steps: () => [
        {
            content: "Studio mở với tab Link URL",
            trigger: ".o_isd_qr_studio .o_isd_qr_tab.active:contains(Link URL)",
        },
        {
            content: "Chưa có nội dung thì không vẽ mã",
            trigger: ".o_isd_qr_stage:contains(Nhập nội dung để tạo mã QR)",
        },
        {
            content: "Nhập URL",
            trigger: "#isd_qr_url",
            run: "edit intellisyncdata.com",
        },
        {
            content: "Mã QR được vẽ",
            trigger: ".o_isd_qr_stage svg path[fill='#000000']",
        },
        {
            content: "Chuyển sang Wi-Fi",
            trigger: ".o_isd_qr_tab:contains(Wi-Fi)",
            run: "click",
        },
        {
            content: "Nhập SSID",
            trigger: ".o_isd_qr_pane input[placeholder='MyCoffee_5G']",
            run: "edit ISD Office",
        },
        {
            content: "Nhập mật khẩu",
            trigger: ".o_isd_qr_pane input[placeholder='pass123456']",
            run: "edit secret123",
        },
        {
            content: "Chọn mẫu màu Azure Blue",
            trigger: ".o_isd_qr_preset[title='Azure Blue']",
            run: "click",
        },
        {
            content: "Màu mã đổi theo preset",
            trigger: ".o_isd_qr_stage svg path[fill='#0284c7']",
        },
        {
            content: "Tải logo (file PNG tạo ngay trong trình duyệt)",
            trigger: ".o_isd_qr_logo_box input[type=file]:not(:visible)",
            run: async function () {
                const canvas = document.createElement("canvas");
                canvas.width = canvas.height = 64;
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#e11d48";
                ctx.fillRect(0, 0, 64, 64);
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
                const transfer = new DataTransfer();
                transfer.items.add(new File([blob], "logo.png", { type: "image/png" }));
                const input = document.querySelector(".o_isd_qr_logo_box input[type=file]");
                input.files = transfer.files;
                input.dispatchEvent(new Event("change", { bubbles: true }));
            },
        },
        {
            content: "Logo được chèn giữa mã",
            trigger: ".o_isd_qr_stage svg image",
        },
        {
            content: "Lưu vào thư viện",
            trigger: ".o_isd_qr_preview_card button:contains(Lưu vào thư viện)",
            run: "click",
        },
        {
            content: "Xuất hiện trong lịch sử",
            trigger: ".o_isd_qr_history li.active:contains(Wi-Fi)",
        },
        {
            content: "Mở bản ghi",
            trigger: ".o_isd_qr_preview_card a:contains(Mở bản ghi)",
            run: "click",
        },
        {
            content: "Form có widget xem trước",
            trigger: ".o_form_view .o_isd_qr_field svg path[fill='#0284c7']",
        },
        {
            content: "Sửa SSID trên form",
            trigger: ".o_form_view .o_field_widget[name='wifi_ssid'] input",
            run: "edit ISD Office 5G",
        },
        {
            content: "Xem trước vẫn hiển thị",
            trigger: ".o_form_view .o_isd_qr_field svg",
        },
        {
            content: "Chờ widget sinh lại ảnh rồi lưu",
            trigger: ".o_form_view .o_form_button_save:enabled",
            run: async function (helpers) {
                await new Promise((resolve) => setTimeout(resolve, 900));
                await helpers.click();
            },
        },
        {
            content: "Đã lưu",
            trigger: ".o_form_view .o_form_saved",
        },
    ],
});
