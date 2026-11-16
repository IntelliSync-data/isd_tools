# -*- coding: utf-8 -*-
from odoo import api, fields, models

# Odoo creates this category from 'category': 'ISD Tools' in a manifest
TOOLS_CATEGORY_XMLID = 'base.module_category_isd_tools'
FALLBACK_ICON = '/isd_tool/static/description/icon.png'


class IsdToolCategory(models.Model):
    _name = 'isd.tool.category'
    _description = 'ISD Tool Category'
    _order = 'sequence, id'

    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer(default=10)
    tool_ids = fields.One2many('isd.tool', 'category_id', string='Tools')


class IsdTool(models.Model):
    """One card in the ISD Tools hub. A tool module adds its own record in a
    data file, so the card comes and goes with the module."""
    _name = 'isd.tool'
    _description = 'ISD Tool'
    _order = 'sequence, name, id'

    name = fields.Char(required=True, translate=True)
    description = fields.Char(translate=True, help='One line under the name on the card')
    icon = fields.Image(max_width=256, max_height=256)
    category_id = fields.Many2one('isd.tool.category', string='Category', ondelete='set null')
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True, help='Untick to hide the card without uninstalling the tool')
    action_id = fields.Many2one('ir.actions.actions', string='Opens', required=True, ondelete='cascade',
                                help='What a click on the card opens')
    link_ids = fields.One2many('isd.tool.link', 'tool_id', string='Shortcuts',
                               help='Other screens of the tool, shown as links on the card')
    group_ids = fields.Many2many('res.groups', string='Visible To',
                                 help='Empty means every internal user')

    # ------------------------------------------------------------------ hub
    def _visible_to(self, user):
        self.ensure_one()
        return (not self.group_ids or bool(self.group_ids & user.groups_id)) \
            and _action_allowed(self.env, self.action_id, user)

    @api.model
    def get_hub_data(self):
        """Everything the hub page draws, already filtered for the current user."""
        user = self.env.user
        tools = []
        for tool in self.search([]):
            if not tool._visible_to(user):
                continue
            tools.append({
                'id': tool.id,
                'name': tool.name,
                'description': tool.description or '',
                'icon_url': '/web/image/isd.tool/%d/icon?unique=%s' % (
                    tool.id, int(tool.write_date.timestamp())) if tool.icon else FALLBACK_ICON,
                'category_id': tool.category_id.id or False,
                'action_id': tool.action_id.id,
                'links': [{'id': link.id, 'name': link.name, 'action_id': link.action_id.id}
                          for link in tool.link_ids
                          if (not link.group_ids or link.group_ids & user.groups_id)
                          and _action_allowed(self.env, link.action_id, user)],
            })
        used = {t['category_id'] for t in tools}
        categories = [{'id': c.id, 'name': c.name}
                      for c in self.env['isd.tool.category'].search([]) if c.id in used]
        return {
            'tools': tools,
            'categories': categories,
            'can_install': user.has_group('base.group_system'),
            'available': self._available_modules() if user.has_group('base.group_system') else [],
        }

    @api.model
    def _available_modules(self):
        """ISD tools that are in the addons path but not installed."""
        category = self.env.ref(TOOLS_CATEGORY_XMLID, raise_if_not_found=False)
        if not category:
            return []
        modules = self.env['ir.module.module'].sudo().search([
            ('category_id', '=', category.id),
            ('state', 'not in', ('installed', 'to upgrade', 'uninstallable')),
            ('name', '!=', 'isd_tool'),
        ], order='shortdesc')
        return [{'id': m.id, 'name': m.shortdesc or m.name, 'description': m.summary or '',
                 'icon_url': m.icon or FALLBACK_ICON, 'state': m.state} for m in modules]


class IsdToolLink(models.Model):
    _name = 'isd.tool.link'
    _description = 'ISD Tool Shortcut'
    _order = 'sequence, id'

    tool_id = fields.Many2one('isd.tool', required=True, ondelete='cascade', index=True)
    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer(default=10)
    action_id = fields.Many2one('ir.actions.actions', string='Opens', required=True, ondelete='cascade')
    group_ids = fields.Many2many('res.groups', string='Visible To', help='Empty means everyone who sees the tool')


def _action_allowed(env, action, user):
    """Whether the user could open this action: its groups, and read access to
    the model of a window action. A card that opens onto an access error is
    worse than no card."""
    if not action:
        return False
    # Only administrators may read ir.actions.actions; the checks below are
    # still made against the user
    action = action.sudo()
    concrete = env[action.type].sudo().browse(action.id)
    if 'groups_id' in concrete._fields and concrete.groups_id and not (concrete.groups_id & user.groups_id):
        return False
    if action.type == 'ir.actions.act_window' and concrete.res_model in env:
        return env[concrete.res_model].has_access('read')
    return True
