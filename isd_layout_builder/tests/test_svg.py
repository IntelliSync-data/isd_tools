import json

from lxml import etree

from odoo.tests import HttpCase, tagged

from ..models import layout_svg

NS = {'svg': 'http://www.w3.org/2000/svg'}


@tagged('post_install', '-at_install')
class TestLayoutSvg(HttpCase):

    def setUp(self):
        super().setUp()
        self.layout = self.env['isd.layout.type'].create({
            'name': 'Strip "2/6" & co', 'view_box_width': '144.57', 'view_box_height': '430.87', 'frame_count': 3})
        self.layout.action_init_systems()

    def test_file_carries_the_exact_layout(self):
        root = etree.fromstring(layout_svg.build_svg(self.layout))
        # The same size as the PNG export
        self.assertEqual(root.get('viewBox'), '0 0 144.57 430.87')
        self.assertAlmostEqual(float(root.get('width')), 144.57 * 5, places=2)
        self.assertAlmostEqual(float(root.get('height')), 430.87 * 5, places=2)

        data = json.loads(root.find('svg:metadata[@id="isd-layout"]', NS).text)
        self.assertEqual(data['format'], 'isd-layout')
        self.assertEqual(data['version'], 1)
        self.assertEqual(data['name'], 'Strip "2/6" & co')
        self.assertEqual((data['view_box_width'], data['view_box_height']), ('144.57', '430.87'))
        frames = self.layout.system_ids.sorted('no')
        self.assertEqual(data['frames'], [{
            'no': f.no, 'type': f.frame_type, 'x': round(f.x, 2), 'y': round(f.y, 2),
            'width': round(f.width, 2), 'height': round(f.height, 2)} for f in frames])

        rects = root.findall('svg:g[@id="frames"]/svg:rect', NS)
        self.assertEqual([(r.get('data-no'), r.get('data-type')) for r in rects],
                         [(str(f.no), f.frame_type) for f in frames])
        for rect, frame in zip(rects, frames):
            self.assertAlmostEqual(float(rect.get('x')), frame.x, places=2)
            self.assertAlmostEqual(float(rect.get('width')), frame.width, places=2)
        # Photo frames are holes in the sheet, the QR is white
        holes = root.findall('svg:defs/svg:mask/svg:rect[@fill="#000000"]', NS)
        self.assertEqual(len(holes), 3)
        self.assertEqual(root.find('svg:g/svg:rect[@data-type="qr"]', NS).get('fill'), '#ffffff')

    def test_download(self):
        self.authenticate('admin', 'admin')
        response = self.url_open('/isd_layout_builder/layout/%s/svg' % self.layout.id)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers['Content-Type'].startswith('image/svg+xml'))
        self.assertIn('attachment', response.headers['Content-Disposition'])
        self.assertIn('.svg', response.headers['Content-Disposition'])
        etree.fromstring(response.content)
        self.assertEqual(self.url_open('/isd_layout_builder/layout/999999/svg').status_code, 404)
        action = self.layout.action_download_svg()
        self.assertEqual(action['url'], '/isd_layout_builder/layout/%s/svg' % self.layout.id)
