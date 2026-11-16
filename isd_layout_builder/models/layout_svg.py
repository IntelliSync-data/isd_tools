"""The layout as an SVG file that carries its own structure.

The picture is the same as the PNG export: a grey sheet, photo frames cut
out as transparent holes, the QR frame white. On top of that, the exact
layout travels inside the file as JSON in <metadata id="isd-layout">, so an
import reads numbers, never shapes. Each frame is also a <rect> with data-no
and data-type, which keeps the file readable by eye and by other tools.
"""
import json

from lxml import etree

FORMAT = 'isd-layout'
FORMAT_VERSION = 1
METADATA_ID = 'isd-layout'
# The PNG export draws each viewBox unit as 5 pixels; the SVG opens at the same size
PIXELS_PER_UNIT = 5
BACKGROUND = '#cccccc'

SVG_NS = 'http://www.w3.org/2000/svg'


def _num(value):
    """2.50 -> '2.5', 3.0 -> '3': short, and exact to the stored precision."""
    return ('%.2f' % (value or 0.0)).rstrip('0').rstrip('.') or '0'


def layout_data(layout):
    """The structure of a layout, as written into the file."""
    return {
        'format': FORMAT,
        'version': FORMAT_VERSION,
        'name': layout.name,
        'view_box_width': layout.view_box_width,
        'view_box_height': layout.view_box_height,
        'frame_count': layout.frame_count,
        'frames': [{
            'no': frame.no,
            'type': frame.frame_type,
            'x': round(frame.x, 2),
            'y': round(frame.y, 2),
            'width': round(frame.width, 2),
            'height': round(frame.height, 2),
        } for frame in layout.system_ids.sorted('no')],
    }


def build_svg(layout):
    """bytes of the SVG file for one isd.layout.type record."""
    data = layout_data(layout)
    width = float(layout.view_box_width or 0)
    height = float(layout.view_box_height or 0)

    svg = etree.Element('{%s}svg' % SVG_NS, nsmap={None: SVG_NS})
    svg.set('viewBox', '0 0 %s %s' % (_num(width), _num(height)))
    svg.set('width', _num(width * PIXELS_PER_UNIT))
    svg.set('height', _num(height * PIXELS_PER_UNIT))
    svg.set('data-isd-layout', str(FORMAT_VERSION))

    etree.SubElement(svg, '{%s}title' % SVG_NS).text = layout.name or ''
    metadata = etree.SubElement(svg, '{%s}metadata' % SVG_NS, id=METADATA_ID)
    metadata.text = json.dumps(data, ensure_ascii=False, indent=1)

    # Photo frames are holes in the sheet. A mask rather than an even-odd path,
    # so two frames that overlap still both come out as holes.
    defs = etree.SubElement(svg, '{%s}defs' % SVG_NS)
    mask = etree.SubElement(defs, '{%s}mask' % SVG_NS, id='isd-photo-holes')
    etree.SubElement(mask, '{%s}rect' % SVG_NS, x='0', y='0',
                     width=_num(width), height=_num(height), fill='#ffffff')
    for frame in data['frames']:
        if frame['type'] != 'qr':
            etree.SubElement(mask, '{%s}rect' % SVG_NS, x=_num(frame['x']), y=_num(frame['y']),
                             width=_num(frame['width']), height=_num(frame['height']), fill='#000000')
    etree.SubElement(svg, '{%s}rect' % SVG_NS, id='sheet', x='0', y='0', width=_num(width),
                     height=_num(height), fill=BACKGROUND, mask='url(#isd-photo-holes)')

    group = etree.SubElement(svg, '{%s}g' % SVG_NS, id='frames')
    for frame in data['frames']:
        is_qr = frame['type'] == 'qr'
        etree.SubElement(group, '{%s}rect' % SVG_NS, {
            'id': 'frame-%s' % frame['no'],
            'data-no': str(frame['no']),
            'data-type': frame['type'],
            'x': _num(frame['x']),
            'y': _num(frame['y']),
            'width': _num(frame['width']),
            'height': _num(frame['height']),
            'fill': '#ffffff' if is_qr else 'none',
        })
    return etree.tostring(svg, xml_declaration=True, encoding='UTF-8', pretty_print=True)
