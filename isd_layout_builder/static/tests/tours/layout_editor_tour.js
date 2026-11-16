/** @odoo-module **/
import { registry } from "@web/core/registry";

/** Press at the centre of `el`, move by (dx, dy) screen pixels in steps, release. */
function dragBy(el, dx, dy) {
    const box = el.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const opts = (cx, cy) => ({ bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1 });
    el.dispatchEvent(new PointerEvent("pointerdown", opts(x, y)));
    for (let i = 1; i <= 5; i++) {
        window.dispatchEvent(new PointerEvent("pointermove", opts(x + (dx * i) / 5, y + (dy * i) / 5)));
    }
    window.dispatchEvent(new PointerEvent("pointerup", opts(x + dx, y + dy)));
}

registry.category("web_tour.tours").add("isd_layout_editor_tour", {
    steps: () => [
        {
            content: "The editor shows the frames",
            trigger: ".o_isd_layout_editor .o_isd_le_frame",
        },
        {
            content: "Zoom to 2x",
            trigger: ".o_isd_le_toolbar button[data-zoom='2']",
            run: "click",
        },
        {
            content: "The canvas is drawn twice as large, in a scrolling window",
            trigger: ".o_isd_le_viewport.o_isd_le_zoomed .o_isd_le_canvas",
        },
        {
            content: "Drag photo 1 down, slipping 3px sideways",
            trigger: ".o_isd_layout_editor .o_isd_le_frame",
            run() {
                dragBy(document.querySelectorAll(".o_isd_le_frame")[0], 3, 40);
            },
        },
        {
            content: "The form now has unsaved changes",
            trigger: ".o_form_status_indicator_buttons:not(.invisible)",
        },
        {
            content: "Select the QR frame",
            trigger: ".o_isd_le_frame.o_isd_le_qr",
            run() {
                dragBy(document.querySelector(".o_isd_le_frame.o_isd_le_qr"), 0, 0);
            },
        },
        {
            content: "Drag its top-left handle outwards, more sideways than up",
            trigger: ".o_isd_le_handle[data-handle=nw]",
            run() {
                dragBy(document.querySelector(".o_isd_le_handle[data-handle=nw]"), -40, -10);
            },
        },
        {
            content: "Save",
            trigger: ".o_form_button_save",
            run: "click",
        },
        {
            content: "Saved",
            trigger: ".o_form_view:has(.o_form_status_indicator_buttons.invisible)",
        },
        {
            content: "The QR frame is still selected after saving",
            trigger: ".o_isd_le_frame.o_isd_le_qr.o_isd_le_selected",
        },
    ],
});
