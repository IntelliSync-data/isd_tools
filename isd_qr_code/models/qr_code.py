import re
from urllib.parse import quote

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

QR_TYPES = [
    ('link', 'Link URL'),
    ('text', 'Văn bản'),
    ('wifi', 'Wi-Fi'),
    ('vcard', 'Danh thiếp (vCard)'),
    ('email', 'Email'),
    ('phone', 'Điện thoại'),
    ('sms', 'SMS'),
]
ECC_LEVELS = [
    ('L', 'Low (7% - Gọn nhất)'),
    ('M', 'Medium (15% - Tiêu chuẩn)'),
    ('Q', 'Quartile (25% - Đề xuất)'),
    ('H', 'High (30% - Chèn logo)'),
]
MARGINS = [
    ('0', 'Không viền (0)'),
    ('1', 'Viền mỏng (1)'),
    ('2', 'Tiêu chuẩn (2)'),
    ('4', 'Viền rộng (4)'),
]
PNG_SIZES = [
    ('512', '512 px'),
    ('1024', '1024 px (HD)'),
    ('2048', '2048 px (2K)'),
    ('4096', '4096 px (4K in ấn)'),
]
HEX_COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')
URL_SCHEME_RE = re.compile(r'^https?://', re.IGNORECASE)
WIFI_ESCAPE_RE = re.compile(r'([\\;,:"])')


def _encode_uri_component(value):
    """Tương đương encodeURIComponent của JavaScript."""
    return quote(value or '', safe="-_.!~*'()")


def format_payload(qr_type, data):
    """Dựng nội dung mã QR. Giữ đúng 1:1 với QREngine.formatters (static/lib/qr_engine)."""
    get = lambda key: data.get(key) or ''  # noqa: E731
    if qr_type == 'link':
        url = get('url').strip()
        if url and not URL_SCHEME_RE.match(url):
            url = 'https://' + url
        return url
    if qr_type == 'text':
        return get('text').strip()
    if qr_type == 'wifi':
        def esc(value):
            return WIFI_ESCAPE_RE.sub(r'\\\1', value)
        return 'WIFI:T:%s;S:%s;P:%s;H:%s;;' % (
            get('wifi_auth') or 'WPA', esc(get('wifi_ssid')), esc(get('wifi_password')),
            'true' if data.get('wifi_hidden') else 'false')
    if qr_type == 'vcard':
        first, last = get('vcard_first_name'), get('vcard_last_name')
        lines = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            'N:%s;%s;;;' % (last, first),
            'FN:%s' % ' '.join(part for part in (first, last) if part),
        ]
        for key, template in (
            ('vcard_organization', 'ORG:%s'),
            ('vcard_title', 'TITLE:%s'),
            ('vcard_phone', 'TEL;TYPE=CELL,VOICE:%s'),
            ('vcard_email', 'EMAIL;TYPE=PREF,INTERNET:%s'),
            ('vcard_website', 'URL:%s'),
            ('vcard_address', 'ADR;TYPE=WORK:;;%s;;;;'),
            ('vcard_note', 'NOTE:%s'),
        ):
            if get(key):
                lines.append(template % get(key))
        lines.append('END:VCARD')
        return '\n'.join(lines)
    if qr_type == 'email':
        result = 'mailto:%s' % _encode_uri_component(get('email_to'))
        params = []
        if get('email_subject'):
            params.append('subject=%s' % _encode_uri_component(get('email_subject')))
        if get('email_body'):
            params.append('body=%s' % _encode_uri_component(get('email_body')))
        if params:
            result += '?' + '&'.join(params)
        return result
    if qr_type == 'phone':
        return 'tel:%s' % re.sub(r'\s+', '', get('phone'))
    if qr_type == 'sms':
        return 'smsto:%s:%s' % (re.sub(r'\s+', '', get('phone')), get('sms_message'))
    return ''


PAYLOAD_FIELDS = [
    'qr_type', 'url', 'text', 'wifi_ssid', 'wifi_password', 'wifi_auth', 'wifi_hidden',
    'vcard_first_name', 'vcard_last_name', 'vcard_phone', 'vcard_email', 'vcard_organization',
    'vcard_title', 'vcard_website', 'vcard_address', 'vcard_note',
    'email_to', 'email_subject', 'email_body', 'phone', 'sms_message',
]


class IsdQrCode(models.Model):
    _name = 'isd.qr.code'
    _description = 'Mã QR'
    _inherit = ['mail.thread']
    _order = 'write_date desc, id desc'

    name = fields.Char(string='Tên mã QR', required=True, tracking=True,
                       default=lambda self: _('Mã QR mới'))
    active = fields.Boolean(default=True)
    user_id = fields.Many2one('res.users', string='Người tạo', default=lambda self: self.env.user,
                              index=True, tracking=True)
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
    tag_ids = fields.Many2many('isd.qr.code.tag', string='Nhãn')
    description = fields.Text(string='Ghi chú')

    qr_type = fields.Selection(QR_TYPES, string='Loại nội dung', required=True, default='link', tracking=True)
    url = fields.Char(string='Đường dẫn (URL)')
    text = fields.Text(string='Văn bản')
    wifi_ssid = fields.Char(string='Tên mạng (SSID)')
    wifi_password = fields.Char(string='Mật khẩu Wi-Fi')
    wifi_auth = fields.Selection([
        ('WPA', 'WPA / WPA2 / WPA3 (Phổ biến)'),
        ('WEP', 'WEP'),
        ('nopass', 'Không mật khẩu (Mạng mở)'),
    ], string='Chuẩn mã hoá', default='WPA')
    wifi_hidden = fields.Boolean(string='Mạng ẩn (Hidden SSID)')
    vcard_first_name = fields.Char(string='Tên (vCard)')
    vcard_last_name = fields.Char(string='Họ & tên đệm')
    vcard_phone = fields.Char(string='Số điện thoại (vCard)')
    vcard_email = fields.Char(string='Email')
    vcard_organization = fields.Char(string='Công ty / Tổ chức')
    vcard_title = fields.Char(string='Chức vụ')
    vcard_website = fields.Char(string='Website')
    vcard_address = fields.Char(string='Địa chỉ')
    vcard_note = fields.Char(string='Ghi chú vCard')
    email_to = fields.Char(string='Email người nhận')
    email_subject = fields.Char(string='Tiêu đề thư')
    email_body = fields.Text(string='Nội dung thư')
    phone = fields.Char(string='Số điện thoại')
    sms_message = fields.Text(string='Nội dung SMS')

    payload = fields.Text(string='Nội dung mã hoá', compute='_compute_payload', store=True,
                          help='Chuỗi thực sự được mã hoá vào QR.')
    payload_length = fields.Integer(string='Số ký tự', compute='_compute_payload', store=True)

    fg_color = fields.Char(string='Màu mã', default='#000000', required=True)
    bg_color = fields.Char(string='Màu nền', default='#ffffff', required=True)
    ecc_level = fields.Selection(ECC_LEVELS, string='Mức sửa lỗi (ECC)', default='Q', required=True)
    margin = fields.Selection(MARGINS, string='Viền an toàn', default='2', required=True)
    png_size = fields.Selection(PNG_SIZES, string='Kích thước PNG', default='1024', required=True)
    logo = fields.Image(string='Logo giữa', max_width=512, max_height=512)

    image = fields.Image(string='Ảnh QR', attachment=True, readonly=True, copy=False,
                         help='PNG 512px, tự sinh trên trình duyệt khi lưu.')
    svg_content = fields.Text(string='SVG', readonly=True, copy=False)

    @api.depends(*PAYLOAD_FIELDS)
    def _compute_payload(self):
        for rec in self:
            rec.payload = format_payload(rec.qr_type, {name: rec[name] for name in PAYLOAD_FIELDS})
            rec.payload_length = len(rec.payload or '')

    @api.constrains('fg_color', 'bg_color')
    def _check_colors(self):
        for rec in self:
            for color in (rec.fg_color, rec.bg_color):
                if not HEX_COLOR_RE.match(color or ''):
                    raise ValidationError(_('Màu "%s" không hợp lệ, dùng dạng #RRGGBB.', color))

    @api.model
    def get_studio_history(self, limit=10):
        """Các mã gần đây của người dùng hiện tại cho panel lịch sử trong QR Studio."""
        records = self.search([('user_id', '=', self.env.uid)], limit=limit)
        return records.read(['name', 'qr_type', 'payload', 'write_date'])

    def get_studio_values(self):
        """Toàn bộ giá trị cần để mở lại mã trong QR Studio."""
        self.ensure_one()
        values = self.read(PAYLOAD_FIELDS + ['name', 'fg_color', 'bg_color', 'ecc_level', 'margin', 'png_size',
                                             'logo'])[0]
        return values

    def action_open_studio(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'isd_qr_code.studio',
            'name': _('QR Studio'),
            'params': {'record_id': self.id},
        }


class IsdQrCodeTag(models.Model):
    _name = 'isd.qr.code.tag'
    _description = 'Nhãn mã QR'
    _order = 'name'

    name = fields.Char(required=True, translate=True)
    color = fields.Integer(string='Màu')

    _sql_constraints = [('name_uniq', 'unique(name)', 'Nhãn đã tồn tại.')]
