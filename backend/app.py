from flask import Flask
from flask_socketio import SocketIO
import psutil
import time
import threading
import json
import numpy as np
import pandas as pd
from datetime import datetime
import platform
import subprocess
import os
from statsmodels.tsa.arima.model import ARIMA

# Initialize Flask App
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

cpu_usage_history = []  # Store past CPU usage for ARIMA model


def get_integrated_gpu_info():
    """Get information specifically for integrated GPUs (Intel/AMD)."""
    gpu_info = {'available': False, 'type': None, 'usage': None}
    
    try:
        if platform.system() == 'Windows':
            gpu_data = subprocess.check_output('wmic path win32_VideoController get Name', shell=True).decode()
            gpu_name = [line.strip() for line in gpu_data.split('\n') if line.strip()][1]  # Extract first GPU name
            
            if 'Intel' in gpu_name:
                gpu_info['type'] = 'Intel'
                gpu_info['available'] = True
                gpu_usage_data = subprocess.check_output(
                    'nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', shell=True
                ).decode().strip()
                gpu_info['usage'] = float(gpu_usage_data) if gpu_usage_data.isdigit() else 0
            elif 'AMD' in gpu_name:
                gpu_info['type'] = 'AMD'
                gpu_info['available'] = True
                gpu_info['usage'] = 0  # AMD GPU monitoring requires additional libraries
        elif platform.system() == 'Linux':
            try:
                intel_gpu_usage = subprocess.check_output(['intel_gpu_top', '-J'], shell=True).decode()
                gpu_info['available'] = True
                gpu_info['type'] = 'Intel'
                gpu_info['usage'] = float(json.loads(intel_gpu_usage)['engines']['Render/3D/0']['busy'])
            except:
                try:
                    with open('/sys/class/drm/card0/device/gpu_busy_percent', 'r') as f:
                        gpu_info['available'] = True
                        gpu_info['type'] = 'AMD'
                        gpu_info['usage'] = float(f.read().strip())
                except:
                    pass
    except Exception as e:
        print(f"Error in GPU detection: {e}")
    
    return gpu_info


def predict_cpu_usage(current_usage):
    """Predict future CPU usage using ARIMA."""
    try:
        global cpu_usage_history
        
        # Maintain a rolling window of past CPU usage values
        cpu_usage_history.append(current_usage)
        if len(cpu_usage_history) > 20:
            cpu_usage_history.pop(0)
        
        if len(cpu_usage_history) > 5:  # ARIMA needs sufficient data
            model = ARIMA(cpu_usage_history, order=(2, 1, 2))
            model_fit = model.fit()
            prediction = model_fit.forecast(steps=1)[0]
            return min(100, max(0, prediction))
        else:
            return current_usage
    except Exception as e:
        print(f"Error in CPU prediction: {e}")
        return current_usage


def get_system_metrics():
    """Fetches comprehensive system metrics."""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_freq = psutil.cpu_freq().current if psutil.cpu_freq() else None
        cpu_count = psutil.cpu_count()
        
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        gpu_info = get_integrated_gpu_info()
        
        disk_info = []
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                disk_info.append({
                    'device': partition.device,
                    'mountpoint': partition.mountpoint,
                    'total': usage.total,
                    'used': usage.used,
                    'free': usage.free,
                    'percent': usage.percent
                })
            except:
                continue
        
        net_io = psutil.net_io_counters()
        
        system_info = {
            'os': platform.system(),
            'os_version': platform.version(),
            'processor': platform.processor(),
            'boot_time': datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")
        }
        
        metrics = {
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'cpu': {
                'usage': cpu_percent,
                'frequency': cpu_freq,
                'cores': cpu_count
            },
            'memory': {
                'total': memory.total,
                'available': memory.available,
                'percent': memory.percent,
                'swap_percent': swap.percent
            },
            'gpu': gpu_info,
            'disk': disk_info,
            'network': {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv
            },
            'system': system_info,
            'predictions': {
                'cpu': predict_cpu_usage(cpu_percent)
            }
        }
        
        return metrics
    except Exception as e:
        print(f"Error getting system metrics: {e}")
        return {}


def stream_metrics():
    """Continuously streams system metrics to clients."""
    while True:
        try:
            metrics = get_system_metrics()
            socketio.emit("update_metrics", json.dumps(metrics))
        except Exception as e:
            print(f"Error in stream_metrics: {e}")
        time.sleep(1)


@app.route("/")
def index():
    return "🚀 System Monitoring Dashboard Backend Running"


@socketio.on("connect")
def handle_connect():
    print("✅ Client Connected!")


if __name__ == "__main__":
    thread = threading.Thread(target=stream_metrics, daemon=True)
    thread.start()
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)
