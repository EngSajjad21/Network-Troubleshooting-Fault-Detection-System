from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO
from config import Config
from models import db, Device, LogEntry
import threading

app = Flask(__name__)
app.config.from_object(Config)

# Initialize Plugins
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

from monitor import start_monitoring

@app.route('/')
def dashboard():
    return render_template('index.html')

@app.route('/api/devices', methods=['GET'])
def get_devices():
    devices = Device.query.all()
    return jsonify([d.to_dict() for d in devices])

@app.route('/api/devices', methods=['POST'])
def add_device():
    data = request.json
    
    if not data or not data.get('ip') or not data.get('name'):
        return jsonify({"error": "Missing IP or name"}), 400
        
    existing = Device.query.filter_by(ip=data['ip']).first()
    if existing:
        return jsonify({"error": "Device with this IP already exists"}), 409
        
    device = Device(
        name=data['name'],
        ip=data['ip'],
        latitude=data.get('latitude'),
        longitude=data.get('longitude')
    )
    db.session.add(device)
    db.session.commit()
    
    # Notify connected clients
    socketio.emit('device_added', device.to_dict())
    
    return jsonify(device.to_dict()), 201

@app.route('/api/devices/<int:device_id>', methods=['DELETE'])
def delete_device(device_id):
    device = Device.query.get_or_404(device_id)
    db.session.delete(device)
    db.session.commit()
    
    socketio.emit('device_removed', {'id': device_id})
    return jsonify({"message": "Device deleted"}), 200

@app.route('/api/logs/<int:device_id>', methods=['GET'])
def get_device_logs(device_id):
    logs = LogEntry.query.filter_by(device_id=device_id).order_by(LogEntry.timestamp.desc()).limit(50).all()
    return jsonify([log.to_dict() for log in logs])

def run_app():
    with app.app_context():
        db.create_all()
        # Start background monitoring thread
        monitor_thread = threading.Thread(target=start_monitoring, args=(app, socketio), daemon=True)
        monitor_thread.start()
        
    socketio.run(app, debug=True, use_reloader=False, host='0.0.0.0', port=5000)

if __name__ == '__main__':
    run_app()
