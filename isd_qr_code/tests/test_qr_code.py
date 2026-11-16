import json
import os

from odoo.exceptions import AccessError, ValidationError
from odoo.tests import HttpCase, TransactionCase, new_test_user, tagged

from ..models.qr_code import format_payload

# Đầu ra của QREngine.formatters (static/lib/qr_engine/qr_engine.js) chạy bằng Node cho đúng các input
# bên dưới. Python phải cho kết quả giống hệt để payload lưu trong DB khớp với mã vẽ trên trình duyệt.
with open(os.path.join(os.path.dirname(__file__), 'js_payload_reference.json'), encoding='utf-8') as f:
    JS_REFERENCE = json.load(f)

CASES = {
    'link_plain': ('link', {'url': '  example.com/san-pham?utm_source=qr '}),
    'link_http': ('link', {'url': 'HTTP://Example.com'}),
    'link_empty': ('link', {'url': '   '}),
    'text': ('text', {'text': '  Xin chào 👋\nDòng 2  '}),
    'wifi': ('wifi', {'wifi_ssid': 'Cà phê;5G', 'wifi_password': 'p@ss:"w,d\\', 'wifi_auth': 'WPA',
                      'wifi_hidden': True}),
    'wifi_open': ('wifi', {'wifi_ssid': 'Open', 'wifi_password': '', 'wifi_auth': 'nopass', 'wifi_hidden': False}),
    'vcard': ('vcard', {'vcard_first_name': 'Nam', 'vcard_last_name': 'Nguyễn Văn', 'vcard_phone': '+84 901',
                        'vcard_email': 'a@b.vn', 'vcard_organization': 'ISD', 'vcard_title': 'Dev',
                        'vcard_website': 'https://x.vn', 'vcard_address': 'Q1, HCM', 'vcard_note': 'hi'}),
    'vcard_min': ('vcard', {'vcard_first_name': 'Nam'}),
    'email': ('email', {'email_to': 'hỗ trợ@x.vn', 'email_subject': 'Tư vấn & báo giá (gấp)!',
                        'email_body': "Xin chào,\ncần 100% *gấp* ~ ok'"}),
    'email_only': ('email', {'email_to': 'a@b.c'}),
    'phone': ('phone', {'phone': ' +84 987  654 321 '}),
    'sms': ('sms', {'phone': '+84 9 87', 'sms_message': 'Đăng ký: A'}),
}


@tagged('post_install', '-at_install', 'isd_qr_code')
class TestQrCode(TransactionCase):

    def test_payload_matches_js_engine(self):
        self.assertEqual(set(CASES), set(JS_REFERENCE))
        for key, (qr_type, data) in CASES.items():
            with self.subTest(case=key):
                self.assertEqual(format_payload(qr_type, data), JS_REFERENCE[key])

    def test_payload_computed_on_record(self):
        record = self.env['isd.qr.code'].create({'name': 'Wi-Fi văn phòng', 'qr_type': 'wifi',
                                                  'wifi_ssid': 'ISD', 'wifi_password': 'secret'})
        self.assertEqual(record.payload, 'WIFI:T:WPA;S:ISD;P:secret;H:false;;')
        self.assertEqual(record.payload_length, len(record.payload))
        record.write({'qr_type': 'link', 'url': 'intellisyncdata.com'})
        self.assertEqual(record.payload, 'https://intellisyncdata.com')
        values = record.get_studio_values()
        self.assertEqual(values['url'], 'intellisyncdata.com')
        self.assertEqual(values['ecc_level'], 'Q')

    def test_color_validation(self):
        with self.assertRaises(ValidationError):
            self.env['isd.qr.code'].create({'name': 'x', 'fg_color': 'red'})
        self.env['isd.qr.code'].create({'name': 'x', 'fg_color': '#0284C7', 'bg_color': '#ffffff'})

    def test_users_only_see_their_own_codes(self):
        alice = new_test_user(self.env, login='qr_alice', groups='base.group_user')
        bob = new_test_user(self.env, login='qr_bob', groups='base.group_user')
        manager = new_test_user(self.env, login='qr_manager', groups='base.group_user,isd_qr_code.group_qr_manager')
        Qr = self.env['isd.qr.code']
        mine = Qr.with_user(alice).create({'name': 'Wi-Fi nhà', 'qr_type': 'wifi', 'wifi_ssid': 'Home',
                                            'wifi_password': 'secret'})
        self.assertEqual(Qr.with_user(alice).search([('id', '=', mine.id)]), mine)
        self.assertFalse(Qr.with_user(bob).search([('id', '=', mine.id)]))
        with self.assertRaises(AccessError):
            mine.with_user(bob).read(['wifi_password'])
        self.assertEqual(Qr.with_user(manager).search([('id', '=', mine.id)]), mine)
        history = Qr.with_user(alice).get_studio_history()
        self.assertEqual([item['id'] for item in history], [mine.id])
        self.assertFalse(Qr.with_user(bob).get_studio_history())


@tagged('post_install', '-at_install', 'isd_qr_code')
class TestQrStudioUi(HttpCase):

    def test_studio_tour(self):
        self.start_tour('/odoo/action-isd_qr_code.action_qr_studio', 'isd_qr_code_studio_tour', login='admin')
        record = self.env['isd.qr.code'].search([('qr_type', '=', 'wifi')], order='id desc', limit=1)
        self.assertTrue(record)
        self.assertEqual(record.payload, 'WIFI:T:WPA;S:ISD Office 5G;P:secret123;H:false;;')
        self.assertEqual(record.fg_color, '#0284c7')
        self.assertTrue(record.image, 'Studio phải lưu kèm ảnh PNG')
        self.assertTrue(record.logo, 'Studio phải lưu kèm logo')
        self.assertIn('<image', record.svg_content or '')
        # URL gõ trước khi đổi sang Wi-Fi không tạo bản ghi thừa, và không bị ghi đè
        self.assertEqual(self.env['isd.qr.code'].search_count([]), 1)
        self.assertIn('#0284c7', record.svg_content or '')
