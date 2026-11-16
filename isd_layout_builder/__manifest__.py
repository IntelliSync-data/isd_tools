{
    'name': 'ISD Layout Builder',
    'version': '18.0.1.1.0',
    'category': 'ISD Tools',
    'summary': 'Create and manage default layouts for photo booth',
    'depends': ['base', 'web', 'isd_tool'],
    'data': [
        'security/ir.model.access.csv',
        'views/isd_layout_type_views.xml',
        'views/isd_api_token_views.xml',
        # Card in the ISD Tools app, in place of an app menu of its own
        'data/isd_tool_data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'isd_layout_builder/static/src/xml/download_png.xml',
            'isd_layout_builder/static/src/js/download_png.js',
            'isd_layout_builder/static/src/layout_editor/*',
        ],
        'web.assets_tests': [
            'isd_layout_builder/static/tests/tours/*.js',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
