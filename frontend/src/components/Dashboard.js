import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import styles from "../styles/Dashboard.module.css";

const socket = io("http://localhost:5000");

const MetricsCard = ({ title, value, subtext, color = "white" }) => (
  <div className={styles.card}>
    <h3>{title}</h3>
    <p style={{ color: color, fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</p>
    {subtext && <p className={styles.subtext}>{subtext}</p>}
  </div>
);

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return 'N/A';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    cpu: { usage: 0, frequency: 0, cores: 0 },
    memory: { percent: 0, available: 0, total: 0, swap_percent: 0 },
    gpu: { available: false, usage: 0, type: 'N/A' },
    disk: [],
    network: { bytes_sent: 0, bytes_recv: 0 },
    system: { os: '', os_version: '', processor: '', boot_time: '' },
    predictions: { cpu: 0 }
  });
  
  const [historicalData, setHistoricalData] = useState([]);

  useEffect(() => {
    socket.on("update_metrics", (data) => {
      try {
        const parsedData = JSON.parse(data);
        setMetrics(prevMetrics => ({
          ...prevMetrics,
          ...parsedData
        }));
        
        // Update historical data for charts
        setHistoricalData(prev => {
          const newData = [...prev, {
            time: new Date().toLocaleTimeString(),
            cpu: parsedData.cpu?.usage || 0,
            memory: parsedData.memory?.percent || 0,
            gpu: parsedData.gpu?.usage || 0,
            predicted_cpu: parsedData.predictions?.cpu || 0
          }].slice(-20);
          return newData;
        });
      } catch (error) {
        console.error("Error processing metrics:", error);
      }
    });

    return () => socket.off("update_metrics");
  }, []);

  return (
    <div className={styles.container}>
      <h1>System Monitoring Dashboard</h1>
      
      {/* System Information */}
      <div className={styles.systemInfo}>
        <h2>System Information</h2>
        <p>OS: {metrics.system?.os || 'N/A'} {metrics.system?.os_version || ''}</p>
        <p>Processor: {metrics.system?.processor || 'N/A'}</p>
        <p>Cores: {metrics.cpu?.cores || 'N/A'}</p>
        <p>Boot Time: {metrics.system?.boot_time || 'N/A'}</p>
      </div>

      {/* Main Metrics Grid */}
      <div className={styles.metricsGrid}>
        <MetricsCard 
          title="CPU Usage" 
          value={`${metrics.cpu?.usage?.toFixed(1) || '0'}%`}
          subtext={`Prediction: ${metrics.predictions?.cpu?.toFixed(1) || '0'}%`}
          color="#FFA500"
        />
        <MetricsCard 
          title="Memory Usage" 
          value={`${metrics.memory?.percent?.toFixed(1) || '0'}%`}
          subtext={`Available: ${formatBytes(metrics.memory?.available)}`}
          color="#4299E1"
        />
        <MetricsCard 
          title="GPU Usage" 
          value={metrics.gpu?.available ? `${metrics.gpu?.usage?.toFixed(1) || '0'}%` : 'N/A'}
          subtext={`Type: ${metrics.gpu?.type || 'Not detected'}`}
          color="#48BB78"
        />
        <MetricsCard 
          title="Swap Usage" 
          value={`${metrics.memory?.swap_percent?.toFixed(1) || '0'}%`}
          color="#9F7AEA"
        />
      </div>

      {/* CPU Usage Chart */}
      <div className={styles.chartContainer}>
        <h2>System Usage Over Time</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={historicalData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cpu" stroke="#FFA500" name="CPU Usage" />
            <Line type="monotone" dataKey="predicted_cpu" stroke="#FF4500" strokeDasharray="5 5" name="Predicted CPU" />
            <Line type="monotone" dataKey="memory" stroke="#4299E1" name="Memory Usage" />
            {metrics.gpu?.available && 
              <Line type="monotone" dataKey="gpu" stroke="#48BB78" name="GPU Usage" />
            }
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Disk Usage */}
      <div className={styles.diskSection}>
        <h2>Disk Usage</h2>
        <div className={styles.diskGrid}>
          {metrics.disk.map((disk, index) => (
            <div key={index} className={styles.diskCard}>
              <h3>{disk.mountpoint}</h3>
              <p>Used: {formatBytes(disk.used)}</p>
              <p>Free: {formatBytes(disk.free)}</p>
              <div className={styles.progressBar}>
                <div 
                  style={{ 
                    width: `${disk.percent || 0}%`,
                    backgroundColor: (disk.percent || 0) > 90 ? '#F56565' : '#48BB78'
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Network Statistics */}
      <div className={styles.networkSection}>
        <h2>Network Statistics</h2>
        <div className={styles.networkGrid}>
          <MetricsCard 
            title="Data Sent" 
            value={formatBytes(metrics.network?.bytes_sent)}
            color="#805AD5"
          />
          <MetricsCard 
            title="Data Received" 
            value={formatBytes(metrics.network?.bytes_recv)}
            color="#805AD5"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;