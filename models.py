from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Device(db.Model):
    __tablename__ = 'devices'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    ip = db.Column(db.String(50), nullable=False, unique=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    last_status = db.Column(db.String(20), default='Unknown')
    last_response_time = db.Column(db.Float, nullable=True) 
    last_checked = db.Column(db.DateTime, default=datetime.utcnow)

    logs = db.relationship('LogEntry', backref='device', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'ip': self.ip,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'last_status': self.last_status,
            'last_response_time': self.last_response_time,
            'last_checked': self.last_checked.isoformat() if self.last_checked else None
        }

class LogEntry(db.Model):
    __tablename__ = 'logs'
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('devices.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    latency = db.Column(db.Float, nullable=True)
    packet_loss = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'status': self.status,
            'latency': self.latency,
            'packet_loss': self.packet_loss,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
