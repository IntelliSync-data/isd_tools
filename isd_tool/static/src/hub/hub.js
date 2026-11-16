/** @odoo-module **/
import { Component, onWillStart, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

// "Tài liệu" and "tai lieu" should find the same tool
function fold(text) {
    return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d");
}

export class ToolHub extends Component {
    static template = "isd_tool.ToolHub";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.state = useState({
            data: { tools: [], categories: [], available: [], can_install: false },
            search: "",
            categoryId: false,
        });
        onWillStart(async () => {
            this.state.data = await this.orm.call("isd.tool", "get_hub_data", []);
        });
    }

    matches(item) {
        const query = fold(this.state.search.trim());
        return !query || fold(`${item.name} ${item.description}`).includes(query);
    }

    /** Visible tools, one block per category in the configured order. */
    get groups() {
        const { tools, categories } = this.state.data;
        const shown = tools.filter(
            (t) => this.matches(t) && (!this.state.categoryId || t.category_id === this.state.categoryId)
        );
        const groups = categories
            .map((c) => ({ key: c.id, name: c.name, tools: shown.filter((t) => t.category_id === c.id) }))
            .filter((g) => g.tools.length);
        const loose = shown.filter((t) => !t.category_id);
        if (loose.length) {
            groups.push({ key: "none", name: categories.length ? _t("Other") : "", tools: loose });
        }
        return groups;
    }

    get available() {
        return this.state.categoryId ? [] : this.state.data.available.filter((m) => this.matches(m));
    }

    setCategory(categoryId) {
        this.state.categoryId = categoryId;
    }

    open(actionId) {
        this.action.doAction(actionId);
    }

    onCardKeydown(ev, actionId) {
        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this.open(actionId);
        }
    }

    openModule(module) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "ir.module.module",
            res_id: module.id,
            views: [[false, "form"]],
            target: "current",
        });
    }
}

registry.category("actions").add("isd_tool.hub", ToolHub);
