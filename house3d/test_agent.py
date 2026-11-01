"""The CLI's screenshot waiter writes PNGs, not pending JSON responses."""
import io
import json
import runpy
import sys
import tempfile
import unittest
import urllib.error
from email.message import Message
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('agent.py')

class Response(io.BytesIO):
    def __init__(self, data, content_type='application/json'):
        super().__init__(data)
        self.headers = Message()
        self.headers['Content-Type'] = content_type

class AgentTests(unittest.TestCase):
    def test_waits_for_actual_png_and_creates_parent(self):
        png = b'\x89PNG\r\n\x1a\nfixture'
        replies = [Response(b'{"status":"pending","url":"/api/screenshots/shot"}'),
                   Response(b'{"status":"pending"}'), Response(png, 'image/png')]
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder)/'proof'/'shot.png'
            with patch.object(sys, 'argv', [str(SCRIPT), 'screenshot', '--output', str(output)]), patch('urllib.request.urlopen', side_effect=replies), patch('time.sleep'), patch('sys.stdout', new_callable=io.StringIO) as stream:
                runpy.run_path(str(SCRIPT), run_name='__main__')
            self.assertEqual(output.read_bytes(), png)
            self.assertEqual(json.loads(stream.getvalue())['status'], 'ready')

    def test_expired_request_explains_visible_page_requirement(self):
        replies = [Response(b'{"status":"pending","url":"/api/screenshots/shot"}'),
                   urllib.error.HTTPError('http://127.0.0.1:19130',410,'expired',{},None)]
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(sys, 'argv', [str(SCRIPT), 'screenshot', '--output', str(Path(folder)/'shot.png')]), patch('urllib.request.urlopen', side_effect=replies), patch('sys.stdout', new_callable=io.StringIO) as stream, self.assertRaises(SystemExit) as exit:
                runpy.run_path(str(SCRIPT), run_name='__main__')
            self.assertEqual(exit.exception.code, 1)
            self.assertIn('visible', json.loads(stream.getvalue())['error'])

if __name__ == '__main__':
    unittest.main()
