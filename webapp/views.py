import json

from django.http import JsonResponse
from django.views import View
from django.views.decorators.http import require_POST, require_GET
from oauth2client import client, crypt

from webdev.settings import GOOGLE_OAUTH2_CLIENT_ID
from .models import Message, Poster


def get_id_from_google_token(token):
    """  Check Google+ OAuth2 token validity """
    try:
        id_info = client.verify_id_token(token, GOOGLE_OAUTH2_CLIENT_ID)
        if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise crypt.AppIdentityError("Wrong issuer.")
        return True, id_info  # id_info['sub'] is actual id
    except Exception as err:
        return False, {'error': 'Authorization failed!'}


@require_POST
def receive_token(request):
    """ Check initial token validity """
    token = json.loads(request.body.decode("utf-8"))
    res, id_info = get_id_from_google_token(token)
    if res:
        return JsonResponse({'success': True})
    return JsonResponse({'success': False})


@require_GET
def messages_layout(request, start_idx, end_idx):
    """ Return an array of message (not comment!) IDs in the order they should be displayed to users """
    if end_idx == "all":
        root_messages = Message.objects.filter(parent=None).order_by('-pub_date').all()
    else:
        root_messages = Message.objects.filter(parent=None).order_by('-pub_date').all()[int(start_idx):int(end_idx)+1]
    ids = [msg.id for msg in root_messages]
    return JsonResponse({'ids': ids})


class MessageView(View):
    def get(self, request, msg_id):
        """ Get a message/comment and all child comments"""
        result = {'msgs': []}
        msg_id = int(msg_id)
        msg_list = [Message.objects.filter(id=msg_id).first()]

        # get all comments to this message
        while True:
            new_msg_list = []
            for message in msg_list:
                new_msg = {
                    'id': message.id,
                    'author_name': '{} {}'.format(message.poster.given_name, message.poster.family_name),
                    'poster_id': message.poster.id,
                    'parent_id': message.parent if message.parent is None else message.parent.id,
                    'pub_date': str(message.pub_date).split('.')[0],
                    }
                if message.is_deleted:
                    new_msg['text'] = 'This message was deleted.'
                    new_msg['is_edited'] = False
                    new_msg['is_deleted'] = True
                else:
                    new_msg['text'] = message.text
                    new_msg['is_edited'] = message.is_edited
                    new_msg['is_deleted'] = False

                result['msgs'].append(new_msg)
                new_msg_list += [msg for msg in Message.objects.filter(parent=message).all()]
            msg_list = new_msg_list
            if not msg_list:
                break
        return JsonResponse(result)

    def post(self, request, parent_msg_id=None):
        """ Create a new message and return its (new) id """
        request_data = json.loads(request.body.decode("utf-8"))
        res, id_info = get_id_from_google_token(request_data['token'])
        if not res:
            return JsonResponse({'error': id_info['error']}, status=401)

        p = Poster.objects.filter(id=id_info['sub']).first()
        if not p:
            p = Poster.objects.create(id=id_info['sub'], given_name=id_info['given_name'],
                                      family_name=id_info['family_name'], email=id_info['email'])
        parent_msg = Message.objects.get(id=parent_msg_id) if parent_msg_id else None
        msg = Message.objects.create(text=request_data['text'], poster=p, parent=parent_msg)
        return JsonResponse({'new_msg_id': msg.id})

    def put(self, request, msg_id):
        """ Update (edit) existing message """
        request_data = json.loads(request.body.decode("utf-8"))
        res, id_info = get_id_from_google_token(request_data['token'])
        if not res:
            return JsonResponse({'error': id_info['error']}, status=401)

        poster = Poster.objects.filter(id=id_info['sub']).first()
        this_msg = Message.objects.get(id=msg_id)
        if poster is None or this_msg.poster != poster:
            return JsonResponse({'error': 'You cannot edit this message'})

        this_msg.text=request_data['text']
        this_msg.is_edited = True
        this_msg.save()
        return JsonResponse({'new_msg_id': this_msg.id})

    def delete(self, request, msg_id):
        """ Delete a message by its id """
        request_data = json.loads(request.body.decode("utf-8"))
        res, id_info = get_id_from_google_token(request_data['token'])
        if not res:
            return JsonResponse({'error': id_info['error']}, status=401)

        poster = Poster.objects.filter(id=id_info['sub']).first()
        this_msg = Message.objects.get(id=msg_id)
        if poster is None or this_msg.poster != poster:
            return JsonResponse({'error': 'You cannot delete this message'}, status=401)

        this_msg.is_deleted = True
        this_msg.save()
        return JsonResponse({'new_msg_id': this_msg.id})
