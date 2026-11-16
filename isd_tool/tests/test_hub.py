# -*- coding: utf-8 -*-
from odoo.exceptions import AccessError
from odoo.tests import HttpCase, TransactionCase, new_test_user, tagged


@tagged('post_install', '-at_install')
class TestToolHub(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.employee = new_test_user(cls.env, login='hub_employee', groups='base.group_user')
        cls.admin = new_test_user(cls.env, login='hub_admin', groups='base.group_user,base.group_system')
        cls.portal = new_test_user(cls.env, login='hub_portal', groups='base.group_portal')
        cls.action = cls.env['ir.actions.client'].create({'name': 'Hub Test', 'tag': 'hub_test'})
        cls.tool = cls.env['isd.tool'].create({
            'name': 'Test Tool',
            'description': 'Does test things',
            'category_id': cls.env.ref('isd_tool.category_pdf').id,
            'action_id': cls.action.id,
            'link_ids': [
                (0, 0, {'name': 'Everyone', 'action_id': cls.action.id}),
                (0, 0, {'name': 'Admins', 'action_id': cls.action.id,
                        'group_ids': [(6, 0, cls.env.ref('base.group_system').ids)]}),
            ],
        })

    def _tool(self, user):
        data = self.env['isd.tool'].with_user(user).get_hub_data()
        return data, next((t for t in data['tools'] if t['id'] == self.tool.id), None)

    def test_employee_sees_tool_without_admin_links(self):
        # Employees cannot read ir.actions.actions: the hub must still work for them
        data, tool = self._tool(self.employee)
        self.assertTrue(tool)
        self.assertEqual([link['name'] for link in tool['links']], ['Everyone'])
        self.assertFalse(data['can_install'])
        self.assertEqual(data['available'], [])
        self.assertIn(self.tool.category_id.id, [c['id'] for c in data['categories']])

    def test_admin_sees_every_link(self):
        data, tool = self._tool(self.admin)
        self.assertEqual([link['name'] for link in tool['links']], ['Everyone', 'Admins'])
        self.assertTrue(data['can_install'])

    def test_group_restricted_tool_is_hidden(self):
        self.tool.group_ids = self.env.ref('base.group_system')
        self.assertFalse(self._tool(self.employee)[1])
        self.assertTrue(self._tool(self.admin)[1])

    def test_action_without_model_access_is_hidden(self):
        # A card that opens onto an access error is worse than no card
        self.tool.action_id = self.env.ref('base.ir_cron_act').id
        self.assertFalse(self._tool(self.employee)[1])

    def test_archived_tool_is_hidden(self):
        self.tool.active = False
        self.assertFalse(self._tool(self.admin)[1])

    def test_uninstalled_tools_listed_for_admins(self):
        category = self.env.ref('base.module_category_isd_tools', raise_if_not_found=False) \
            or self.env['ir.module.category'].create({'name': 'ISD Tools'})
        if not self.env.ref('base.module_category_isd_tools', raise_if_not_found=False):
            self.env['ir.model.data'].create({'module': 'base', 'name': 'module_category_isd_tools',
                                              'model': 'ir.module.category', 'res_id': category.id})
        self.env['ir.module.module'].create({'name': 'isd_fake_pdf_tool', 'shortdesc': 'Fake PDF Tool',
                                             'state': 'uninstalled', 'category_id': category.id})
        names = [m['name'] for m in self.env['isd.tool'].with_user(self.admin).get_hub_data()['available']]
        self.assertIn('Fake PDF Tool', names)
        self.assertNotIn('ISD Tools', names)

    def test_portal_has_no_access(self):
        with self.assertRaises(AccessError):
            self.env['isd.tool'].with_user(self.portal).get_hub_data()


@tagged('post_install', '-at_install')
class TestToolHubTour(HttpCase):

    def test_hub_tour(self):
        self.env['isd.tool'].create({
            'name': 'Tour Tool',
            'description': 'Opens the users list',
            'action_id': self.env.ref('base.action_res_users').id,
        })
        self.start_tour('/odoo/action-isd_tool.action_hub', 'isd_tool_hub_tour', login='admin')
