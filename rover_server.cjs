#!/usr/bin/env node
/**
 * Simple WebSocket server for receiving rover commands
 * Run this on your Raspberry Pi or rover computer
 * 
 * Install: npm install ws
 * Usage: node rover_server.js
 */

const WebSocket = require('ws');
const os = require('os');

// Get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const PORT = 8080;
const localIP = getLocalIP();

console.log('='.repeat(50));
console.log('🤖 Rover Command Server Starting...');
console.log('='.repeat(50));
console.log(`Server IP: ${localIP}`);
console.log(`Port: ${PORT}`);
console.log(`WebSocket URL: ws://${localIP}:${PORT}`);
console.log('='.repeat(50));
console.log('Waiting for connections...\n');

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT, host: '0.0.0.0' });

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    console.log(`✅ Client connected from ${clientIP}`);
    
    ws.on('message', (message) => {
        try {
            const command = JSON.parse(message);
            console.log(`\n🚀 Received command: ${command.command}`);
            console.log(`   ID: ${command.id}`);
            console.log(`   Data:`, command.data);
            console.log(`   Timestamp: ${command.timestamp}`);
            
            // Process command
            processCommand(command);
            
            // Send acknowledgment
            const response = {
                status: 'received',
                command_id: command.id,
                timestamp: new Date().toISOString()
            };
            ws.send(JSON.stringify(response));
            
        } catch (error) {
            console.error('❌ Error processing message:', error.message);
        }
    });
    
    ws.on('close', () => {
        console.log(`❌ Client ${clientIP} disconnected`);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
    });
});

function processCommand(command) {
    const { command: cmdType, data } = command;
    
    switch (cmdType) {
        case 'JOYSTICK_MOVE':
            console.log(`   → Moving: X=${data.x.toFixed(2)}, Y=${data.y.toFixed(2)}`);
            // TODO: Send to motor controller
            break;
            
        case 'DRILL_SPEED':
            console.log(`   → Setting drill speed to ${data.speed}%`);
            // TODO: Control drill motor
            break;
            
        case 'WHEEL_SPEED':
            console.log(`   → Setting ${data.wheel} speed to ${data.speed}%`);
            // TODO: Control individual wheel
            break;
            
        case 'CAMERA_FEED':
            console.log(`   → Camera ${data.camera}: ${data.enabled ? 'ON' : 'OFF'}`);
            // TODO: Toggle camera stream
            break;
            
        case 'AUTONOMOUS_MODE':
            console.log(`   → Autonomous navigation to ${data.latitude}, ${data.longitude}`);
            // TODO: Start autonomous navigation
            break;
            
        default:
            console.log(`   → Command type: ${cmdType}`);
            // TODO: Handle other commands
    }
}

wss.on('error', (error) => {
    console.error('❌ Server error:', error.message);
});

console.log('Server is running! Press Ctrl+C to stop.\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Server stopped');
    wss.close();
    process.exit(0);
});
