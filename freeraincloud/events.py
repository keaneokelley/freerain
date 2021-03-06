import datetime

from flask import request
from flask_socketio import emit

from .app import socketio
from .utils import distribute_shards


@socketio.on('dropzone')
def upload(data):
    h, m = distribute_shards(data['file'].encode(), data['count'])
    return {'hash': h, 'name': data['name'], 'manifest': m, 'size': len(data['file']),
            'date': datetime.datetime.now().strftime('%c')}


@socketio.on('fetch')
def fetch(data):
    emit('retrieve', {'hash': data['hash'], 'sid': request.sid}, broadcast=True)


@socketio.on('retrieval')
def retrieve(data):
    emit('chunk', {'hash': data['hash'], 'data': data['data']}, room=data['sid'])


@socketio.on('delete')
def delete(data):
    emit('delete', {'hash': data['hash']}, broadcast=True)
