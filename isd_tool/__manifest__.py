{
    'name': 'ISD Tools',
    'version': '18.0.1.0.0',
    'category': 'ISD Modules',
    'summary': 'One "ISD Tools" app that shows every installed ISD tool as a card',
    'description': """
ISD Tools
=========
A single app menu for all the small ISD tools (QR, PDF, documents...).

* Each tool module adds one ``isd.tool`` record instead of its own app menu
* The hub shows installed tools as cards, grouped by category, with search
* Installing or uninstalling a tool in Apps adds or removes its card
* Administrators also see the ISD tools that are not installed yet
    """,
    'author': 'IntelliSyncData',
    'website': 'https://intellisyncdata.com',
    'license': 'LGPL-3',
    'depends': ['web'],
    'data': [
        'security/ir.model.access.csv',
        'data/tool_category_data.xml',
        'views/tool_views.xml',
        'views/menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'isd_tool/static/src/hub/*',
        ],
        'web.assets_tests': [
            'isd_tool/static/tests/tours/*.js',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}
