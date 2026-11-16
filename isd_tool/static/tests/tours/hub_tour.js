/** @odoo-module **/
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("isd_tool_hub_tour", {
    url: "/odoo/action-isd_tool.action_hub",
    steps: () => [
        {
            content: "The card is on the hub",
            trigger: ".o_isd_tool_card .o_isd_tool_name:contains('Tour Tool')",
        },
        {
            content: "Searching without accents still finds it",
            trigger: ".o_isd_tool_search",
            run: "edit tour tool",
        },
        {
            content: "A search that matches nothing empties the page",
            trigger: ".o_isd_tool_search",
            run: "edit zzz-nothing",
        },
        {
            trigger: ".o_isd_tool_empty",
        },
        {
            trigger: ".o_isd_tool_search",
            run: "clear",
        },
        {
            content: "Clicking the card opens the tool",
            trigger: ".o_isd_tool_card:contains('Tour Tool')",
            run: "click",
        },
        {
            content: "The tool opened, with the hub in the breadcrumbs",
            trigger: ".o_list_view .o_breadcrumb:contains('ISD Tools')",
        },
    ],
});
