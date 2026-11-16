from odoo import http
from odoo.http import content_disposition, request

from ..models.layout_svg import build_svg


class LayoutSvgController(http.Controller):

    @http.route('/isd_layout_builder/layout/<int:layout_id>/svg', type='http', auth='user', methods=['GET'])
    def download_svg(self, layout_id, **kw):
        layout = request.env['isd.layout.type'].browse(layout_id).exists()
        if not layout:
            return request.not_found()
        # As the current user: someone who cannot read the layout gets an access error
        layout.check_access('read')
        filename = '%s.svg' % (layout.name or 'layout').replace('/', '-')
        return request.make_response(build_svg(layout), headers=[
            ('Content-Type', 'image/svg+xml; charset=utf-8'),
            ('Content-Disposition', content_disposition(filename)),
            ('X-Content-Type-Options', 'nosniff'),
        ])
