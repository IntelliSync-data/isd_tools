from odoo.tests import HttpCase, TransactionCase, tagged

SIZES = ('144.57', '289.13', '430.87')


@tagged('post_install', '-at_install')
class TestSampleLayout(TransactionCase):

    def _layout(self, width, height, count):
        layout = self.env['isd.layout.type'].create({
            'name': 'Test', 'view_box_width': width, 'view_box_height': height, 'frame_count': count})
        layout.action_init_systems()
        return layout

    def test_every_size_gives_a_usable_layout(self):
        for width in SIZES:
            for height in SIZES:
                for count in (1, 2, 3, 4, 6):
                    layout = self._layout(width, height, count)
                    frames = layout.system_ids
                    label = '%s x %s, %s photos' % (width, height, count)
                    self.assertEqual(len(frames), count + 1, label)
                    self.assertEqual(frames.mapped('no'), list(range(1, count + 2)), label)
                    left, top, right, bottom = layout._safe_area()
                    for f in frames:
                        self.assertTrue(f.width > 0 and f.height > 0, label)
                        # Inside the print margins
                        self.assertGreaterEqual(f.x, left - 0.01, label)
                        self.assertGreaterEqual(f.y, top - 0.01, label)
                        self.assertLessEqual(f.x + f.width, right + 0.01, label)
                        self.assertLessEqual(f.y + f.height, bottom + 0.01, label)
                    for a in frames:
                        for b in frames:
                            if a.id < b.id:
                                overlap = (a.x < b.x + b.width - 0.01 and b.x < a.x + a.width - 0.01
                                           and a.y < b.y + b.height - 0.01 and b.y < a.y + a.height - 0.01)
                                self.assertFalse(overlap, '%s: #%s and #%s overlap' % (label, a.no, b.no))
                    qr = frames.filtered('is_qr')
                    self.assertEqual(len(qr), 1, label)
                    self.assertEqual(qr.width, qr.height, label)

    def test_photos_are_not_slivers(self):
        # Three photos on a 4x6 portrait: stacked landscape photos, not three tall strips
        layout = self._layout('289.13', '430.87', 3)
        for f in layout.system_ids.filtered(lambda f: not f.is_qr):
            ratio = f.width / f.height
            self.assertTrue(0.4 < ratio < 2.5, ratio)


@tagged('post_install', '-at_install')
class TestLayoutEditor(HttpCase):

    def test_drag_and_resize(self):
        layout = self.env['isd.layout.type'].create({
            'name': 'Editor Tour', 'view_box_width': '289.13', 'view_box_height': '430.87', 'frame_count': 3})
        layout.action_init_systems()
        first = layout.system_ids.filtered(lambda f: f.no == 1)
        qr = layout.system_ids.filtered('is_qr')
        x0, y0, qr0 = first.x, first.y, qr.width
        self.start_tour('/odoo/action-isd_layout_builder.action_isd_layout_type/%s' % layout.id,
                        'isd_layout_editor_tour', login='admin')
        layout.invalidate_recordset()
        layout.system_ids.invalidate_recordset()
        # Dragged down, and a small sideways slip snapped back into line
        self.assertEqual(first.x, x0)
        self.assertGreater(first.y, y0 + 5)
        # The QR handle grew it, and it stayed square
        self.assertGreater(qr.width, qr0)
        self.assertEqual(qr.width, qr.height)
