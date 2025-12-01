#!/usr/bin/env python3
"""
Simple WebSocket server for receiving rover commands
Run this on your Raspberry Pi or rover computer

Install: pip install websockets
Usage: python rover_server.py
"""

import asyncio
import websockets
import json
from datetime import datetime

# Store connected clients
connected_clients = set()

async def handle_command(websocket, path):
    """Handle incoming WebSocket connections and commands"""
    # Register client
    connected_clients.add(websocket)
    client_ip = websocket.remote_address[0]
    print(f"✅ Client connected from {client_ip}")
    
    try:
        async for message in websocket:
            try:
                # Parse command
                command = json.loads(message)
                print(f"\n🚀 Received command: {command['command']}")
                print(f"   ID: {command['id']}")
                print(f"   Data: {command['data']}")
                print(f"   Timestamp: {command['timestamp']}")
                
                # Process command based on type
                await process_command(command)
                
                # Send acknowledgment back to client
                response = {
                    "status": "received",
                    "command_id": command['id'],
                    "timestamp": datetime.utcnow().isoformat() + 'Z'
                }
                await websocket.send(json.dumps(response))
                
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON received: {message}")
            except Exception as e:
                print(f"❌ Error processing command: {e}")
    
    except websockets.exceptions.ConnectionClosed:
        print(f"❌ Client {client_ip} disconnected")
    finally:
        connected_clients.remove(websocket)

async def process_command(command):
    """Process the received command - implement your rover logic here"""
    cmd_type = command['command']
    data = command['data']
    
    # Example command handlers
    if cmd_type == 'JOYSTICK_MOVE':
        x, y = data['x'], data['y']
        print(f"   → Moving: X={x:.2f}, Y={y:.2f}")
        # TODO: Send to motor controller
        
    elif cmd_type == 'DRILL_SPEED':
        speed = data['speed']
        print(f"   → Setting drill speed to {speed}%")
        # TODO: Control drill motor
        
    elif cmd_type == 'WHEEL_SPEED':
        wheel = data['wheel']
        speed = data['speed']
        print(f"   → Setting {wheel} speed to {speed}%")
        # TODO: Control individual wheel
        
    elif cmd_type == 'CAMERA_FEED':
        camera = data['camera']
        enabled = data['enabled']
        print(f"   → Camera {camera}: {'ON' if enabled else 'OFF'}")
        # TODO: Toggle camera stream
        
    elif cmd_type == 'AUTONOMOUS_MODE':
        lat = data['latitude']
        lon = data['longitude']
        print(f"   → Autonomous navigation to {lat}, {lon}")
        # TODO: Start autonomous navigation
        
    else:
        print(f"   → Command type: {cmd_type}")
        # TODO: Handle other commands

async def main():
    """Start the WebSocket server"""
    # Get local IP
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    print("=" * 50)
    print("🤖 Rover Command Server Starting...")
    print("=" * 50)
    print(f"Server IP: {local_ip}")
    print(f"Port: 8080")
    print(f"WebSocket URL: ws://{local_ip}:8080")
    print("=" * 50)
    print("Waiting for connections...\n")
    
    # Start WebSocket server on all interfaces
    async with websockets.serve(handle_command, "0.0.0.0", 8080):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped")
