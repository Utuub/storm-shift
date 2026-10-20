# Local dev server that tells the browser not to cache, so edits show up on a normal reload.
# Usage: python serve.py [port]
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8310
http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
