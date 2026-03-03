import subprocess
import time
import platform
from datetime import datetime
from models import db, Device, LogEntry

def ping(host):
    param = '-n' if platform.system().lower()=='windows' else '-c'
    command = ['ping', param, '1', host]
    if platform.system().lower()=='windows':
         command = ['ping', param, '1', '-w', '1000', host]

    start_time = time.time()
    try:
        # Run subprocess and capture output
        output = subprocess.check_output(command, stderr=subprocess.STDOUT, universal_newlines=True)
        latency = (time.time() - start_time) * 1000  # ms
        
        # Simple string matching to handle languages / variations loosely
        if "unreachable" in output.lower() or "timed out" in output.lower() or "100% packet loss" in output.lower():
            return False, None, 100.0
            
        return True, round(latency, 2), 0.0
    except subprocess.CalledProcessError:
        return False, None, 100.0
    except Exception:
        return False, None, 100.0

def start_monitoring(app, socketio):
    while True:
        with app.app_context():
            devices = Device.query.all()
            for device in devices:
                is_up, latency, loss = ping(device.ip)
                
                status = 'Online' if is_up else 'Offline'
                
                if is_up and latency and latency > 150:
                    status = 'Warning' # High Latency

                device.last_status = status
                device.last_response_time = latency
                device.last_checked = datetime.utcnow()
                
                log = LogEntry(
                    device_id=device.id,
                    status=status,
                    latency=latency,
                    packet_loss=loss,
                    timestamp=datetime.utcnow()
                )
                db.session.add(log)
                db.session.commit()
                
                # Emit update
                update_event = {
                    'device': device.to_dict(),
                    'log': log.to_dict()
                }
                socketio.emit('device_status_update', update_event)
        time.sleep(10) # Check every 10 seconds 
