import math

from odoo import api, fields, models

VIEWBOX_TO_PRINT = {
    '144.57': 200,
    '289.13': 400,
    '430.87': 600,
}

VIEWBOX_TO_ACTUAL = {
    '144.57': 220,
    '289.13': 440,
    '430.87': 660,
}

MARGIN_MAP = {
    (600, 400): (5, 5, 3, 5),
    (400, 600): (5, 7, 4, 5),
    (600, 200): (5, 5, 5, 5),
    (200, 600): (5, 8, 5, 5.5),
}

DEFAULT_MARGIN = (5, 5, 5, 5)

VIEWBOX_SELECTION = [
    ('144.57', '144.57 (200px)'),
    ('289.13', '289.13 (400px)'),
    ('430.87', '430.87 (600px)'),
]


class IsdLayoutType(models.Model):
    _name = 'isd.layout.type'
    _description = 'Layout Type'

    name = fields.Char(string='Name', required=True)
    view_box_width = fields.Selection(
        selection=VIEWBOX_SELECTION,
        string='ViewBox Width',
        required=True,
    )
    view_box_height = fields.Selection(
        selection=VIEWBOX_SELECTION,
        string='ViewBox Height',
        required=True,
    )
    frame_count = fields.Integer(string='Number of Image Frames', default=1)
    dpi = fields.Integer(string='DPI', default=600, readonly=True)

    print_width = fields.Float(
        string='Print Width (mm)',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    print_height = fields.Float(
        string='Print Height (mm)',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    actual_width = fields.Float(
        string='Actual Width (mm)',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    actual_height = fields.Float(
        string='Actual Height (mm)',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    is_cutted = fields.Boolean(
        string='Is Cutted',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    is_landscape = fields.Boolean(
        string='Is Landscape',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    print_top = fields.Float(
        string='Print Top (mm)',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    print_left = fields.Float(
        string='Print Left (mm)',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    print_bottom = fields.Float(
        string='Print Bottom (mm)',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )
    print_right = fields.Float(
        string='Print Right (mm)',
        compute='_compute_print_dimensions',
        store=True,
        readonly=True,
    )

    system_ids = fields.One2many(
        comodel_name='isd.layout.system',
        inverse_name='layout_type_id',
        string='Layout Systems',
    )

    @api.depends('view_box_width', 'view_box_height')
    def _compute_print_dimensions(self):
        for rec in self:
            vbw = rec.view_box_width
            vbh = rec.view_box_height

            if vbw and vbh:
                pw = float(VIEWBOX_TO_PRINT.get(vbw, 0))
                ph = float(VIEWBOX_TO_PRINT.get(vbh, 0))
                aw = float(VIEWBOX_TO_ACTUAL.get(vbw, 0))
                ah = float(VIEWBOX_TO_ACTUAL.get(vbh, 0))
            else:
                pw = ph = aw = ah = 0.0

            rec.print_width = pw
            rec.print_height = ph
            rec.actual_width = aw
            rec.actual_height = ah

            rec.is_cutted = (pw == 200 or ph == 200)
            rec.is_landscape = (float(vbw or 0) > float(vbh or 0)) if (vbw and vbh) else False

            margin_key = (int(pw), int(ph))
            top, left, bottom, right = MARGIN_MAP.get(margin_key, DEFAULT_MARGIN)
            rec.print_top = top
            rec.print_left = left
            rec.print_bottom = bottom
            rec.print_right = right

    # ------------------------------------------------------------ sample
    def _safe_area(self):
        """(left, top, right, bottom) of the printable area, in viewBox units.

        The print margins are in millimetres of the actual print, which is
        actual_width mm across the viewBox width.
        """
        self.ensure_one()
        vbw, vbh = float(self.view_box_width or 0), float(self.view_box_height or 0)
        per_mm_x = vbw / self.actual_width if self.actual_width else 0
        per_mm_y = vbh / self.actual_height if self.actual_height else 0
        return (self.print_left * per_mm_x, self.print_top * per_mm_y,
                vbw - self.print_right * per_mm_x, vbh - self.print_bottom * per_mm_y)

    def _sample_frames(self):
        """A starting layout: the photos on a grid, the QR square in a corner.

        Coordinates are in viewBox units, inside the print margins, with an
        even gap between frames, and nothing overlaps.
        """
        self.ensure_one()
        count = max(self.frame_count, 0)
        left, top, right, bottom = self._safe_area()
        width, height = right - left, bottom - top
        if width <= 0 or height <= 0:
            return []
        gap = round(min(width, height) * 0.03, 2)
        qr = round(min(width, height) * 0.16, 2)
        tall = height >= width

        # The QR gets a strip of its own: along the bottom of a tall layout,
        # down the right of a wide one
        if tall:
            area = (left, top, width, height - qr - gap)
            qr_x, qr_y = right - qr, bottom - qr
        else:
            area = (left, top, width - qr - gap, height)
            qr_x, qr_y = right - qr, bottom - qr

        frames = []
        if count:
            ax, ay, aw, ah = area
            # Columns and rows that waste the fewest cells and keep each photo
            # closest to 3:2 (or 2:3 when the cells come out tall)
            best = None
            for cols in range(1, count + 1):
                rows = -(-count // cols)
                cw = (aw - gap * (cols - 1)) / cols
                ch = (ah - gap * (rows - 1)) / rows
                if cw <= 0 or ch <= 0:
                    continue
                # Measured on a log scale, so a cell twice too tall counts
                # the same as one twice too wide
                shape = min(abs(math.log(cw / ch / 1.5)), abs(math.log(cw / ch * 1.5)))
                score = shape + 0.6 * (cols * rows - count)
                if best is None or score < best[0]:
                    best = (score, cols, rows, cw, ch)
            if best:
                _score, cols, rows, cw, ch = best
                for i in range(count):
                    row, col = divmod(i, cols)
                    in_row = min(cols, count - row * cols)
                    # A short last row is centred rather than left-aligned
                    offset = (cols - in_row) * (cw + gap) / 2
                    frames.append({
                        'frame_type': 'image',
                        'x': round(ax + offset + col * (cw + gap), 2),
                        'y': round(ay + row * (ch + gap), 2),
                        'width': round(cw, 2),
                        'height': round(ch, 2),
                    })
        frames.append({'frame_type': 'qr', 'x': round(qr_x, 2), 'y': round(qr_y, 2),
                       'width': qr, 'height': qr})
        for no, frame in enumerate(frames, start=1):
            frame['no'] = no
        return frames

    def action_init_systems(self):
        self.ensure_one()
        # Remove existing systems
        self.system_ids.unlink()
        self.env['isd.layout.system'].create([
            dict(frame, layout_type_id=self.id) for frame in self._sample_frames()])
        return True

    def action_download_svg(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': '/isd_layout_builder/layout/%s/svg' % self.id,
            'target': 'download',
        }

    def action_download_png(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'isd_layout_builder.download_png',
            'params': {
                'record_id': self.id,
            },
        }
