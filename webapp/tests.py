import json
import requests

from datetime import datetime

from django.test import TestCase
from django.test import Client
from django.http import JsonResponse

from webapp.models import Poster, Message


class BasicUsageTestCase(TestCase):
    def setUp(self):
        self.c = Client()
        p = Poster.objects.create(id="2938", given_name="Jim", family_name="Testerton", email="test@example.com")
        p2 = Poster.objects.create(id="1206", given_name="John", family_name="Testyuk", email="tests@gmail.com")
        m = Message.objects.create(poster=p, parent=None, text='This is a test message')
        m.pub_date = datetime.fromtimestamp(9000)
        m.save()
        Message.objects.create(poster=p, parent=m, text='This is a comment')
        Message.objects.create(poster=p2, parent=m, text='This is another comment')
        m2 = Message.objects.create(poster=p2, parent=None, text='This is another message')
        m2.pub_date = datetime.fromtimestamp(1000)
        m2.save()
        m3 = Message.objects.create(poster=p2, parent=None, text='One more message')
        m3.pub_date = datetime.fromtimestamp(5000)
        m3.save()
        self.messages = [m, m3, m2]

    def test_messages_layout_view(self):
        response = self.c.get("/message/layout/0/2/")
        self.assertEqual(response.status_code, 200)
        correct_resp = JsonResponse({'ids': [self.messages[0].id, self.messages[1].id, self.messages[2].id]})
        self.assertEqual(response.content, correct_resp.content)

    def test_MessageView(self):
        response = self.c.get("/message/1/")
        resp_dict = json.loads(response.content.decode('utf-8'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(resp_dict['msgs']), 3)
        response = self.c.get("/message/5/")
        resp_dict = json.loads(response.content.decode('utf-8'))
        self.assertEqual(len(resp_dict['msgs']), 1)

        response = self.c.delete("/message/5/", json.dumps({'token': 'all-wrong'}), 'application/json')
        self.assertEqual(response.status_code, 401)
        resp_dict = json.loads(response.content.decode('utf-8'))
        self.assertIsNotNone(resp_dict.get('error'))

        response = self.c.post("/message/5/", json.dumps({'token': 'all-wrong'}), 'application/json')
        self.assertEqual(response.status_code, 401)
        resp_dict = json.loads(response.content.decode('utf-8'))
        self.assertIsNotNone(resp_dict.get('error'))

        response = self.c.put("/message/5/", json.dumps({'token': 'all-wrong'}), 'application/json')
        self.assertEqual(response.status_code, 401)
        resp_dict = json.loads(response.content.decode('utf-8'))
        self.assertIsNotNone(resp_dict.get('error'))
