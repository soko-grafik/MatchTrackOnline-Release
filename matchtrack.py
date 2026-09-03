#!/usr/bin/python3
import os
import sys

# Pfade absolut ermitteln
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
LIB_DIR = os.path.join(BACKEND_DIR, "lib")

# Suchpfad für Python erweitern
sys.path.insert(0, LIB_DIR)
sys.path.insert(0, BACKEND_DIR)

try:
    from main import app
    from a2wsgi import ASGIMiddleware
    from wsgiref.handlers import CGIHandler

    # PATH_INFO aus REQUEST_URI extrahieren
    uri = os.environ.get('REQUEST_URI', '/')
    path = uri.split('?')[0] # Query-Parameter entfernen
    
    if '/api' in path:
        path = path.split('/api')[-1]
    
    if not path or path == "":
        path = "/"
        
    os.environ['PATH_INFO'] = path
    os.environ['SCRIPT_NAME'] = ""

    wsgi_app = ASGIMiddleware(app)
    CGIHandler().run(wsgi_app)

except Exception as e:
    print("Content-type: application/json\n")
    import json
    import traceback
    print(json.dumps({
        "error": str(e),
        "trace": traceback.format_exc()
    }))
