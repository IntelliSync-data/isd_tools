{
    'name': 'ISD QR Code Studio',
    'version': '18.0.1.0.0',
    'category': 'ISD Tools',
    'summary': 'Tạo mã QR (Link, Text, Wi-Fi, vCard, Email, Điện thoại, SMS), chèn logo, '
               'xuất Vector SVG & PNG tới 4K, lưu thư viện',
    'description': """
ISD QR Code Studio
==================
Mang QR Code Studio (Vanilla JS, lõi Project Nayuki) vào Odoo:

* QR Studio: xem trước thời gian thực, 7 loại nội dung, bảng màu, ECC, viền, logo giữa
* Xuất Vector SVG, PNG 512 / 1024 / 2048 / 4096 px, copy ảnh, in
* Thư viện mã QR thay cho lịch sử localStorage: lưu, dùng lại, nhãn, chatter
* Widget ``qr_code`` dùng lại được cho field Char/Text ở module khác
    """,
    'author': 'IntelliSyncData',
    'website': 'https://intellisyncdata.com',
    'license': 'LGPL-3',
    'depends': ['web', 'mail', 'isd_tool'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/qr_code_views.xml',
        'data/isd_tool_data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'isd_qr_code/static/lib/qr_engine/qr_engine.js',
            'isd_qr_code/static/src/js/qr_utils.js',
            'isd_qr_code/static/src/qr_studio/*',
            'isd_qr_code/static/src/qr_code_field/*',
        ],
        'web.assets_tests': [
            'isd_qr_code/static/tests/tours/*.js',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}
