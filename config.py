from datetime import timedelta
import os

class Config: # App configuration
    SECRET_KEY = os.getenv("SECRET_KEY", 'default-super-secret-key')
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///network_monitor.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
