# Rover Command Center

A real-time control interface for the Anveshak Mars Rover with WiFi command dispatching.

## Features

- 🕹️ **Joystick Control** - Analog movement control
- 🔧 **Science Operations** - Drill, collection system, sample analysis
- 📊 **System Monitoring** - Battery, power, temperature
- 📡 **Data Transmission** - Camera feed controls
- 🎯 **Individual Wheel Control** - Precise movement
- 🤖 **Autonomous Mode** - GPS-based navigation
- 📶 **WiFi Command Dispatch** - Real-time WebSocket communication

## Setup

### Control Station (This App)

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open browser at `http://localhost:5173`

### Rover Side (Raspberry Pi / Arduino)

1. Install Python WebSocket library:
```bash
pip install websockets
```

2. Copy `rover_server.py` to your rover

3. Run the server:
```bash
python rover_server.py
```

4. Note the IP address shown (e.g., `192.168.1.100`)

## Connecting to Rover

1. Ensure both devices are on the same WiFi network
2. In the web interface, enter the rover's IP address in the "Rover Connection" panel
3. Click "Connect"
4. Status will show "CONNECTED" when link is established
5. All commands will now be transmitted to the rover in real-time

## Command Format

Commands are sent as JSON over WebSocket:

```json
{
  "id": "uuid",
  "command": "JOYSTICK_MOVE",
  "data": {
    "x": 0.5,
    "y": -0.3
  },
  "timestamp": "2025-12-01T12:00:00.000Z",
  "status": "sent"
}
```

## Available Commands

- `JOYSTICK_MOVE` - Movement control (x, y coordinates)
- `STEERING_MODE` - Ackerman/Independent steering
- `DRILL_SPEED` - Drill speed control (0-100%)
- `DRILL_TOGGLE` - Enable/disable drill
- `LINEAR_ACTUATOR` - Collection system actuator
- `SUCTION_SYSTEM` - Suction on/off
- `WATER_DISPENSE` - Water sprinkler
- `TEST_TUBE_ROTATE` - Sample carousel rotation
- `WHEEL_SPEED` - Individual wheel speed
- `WHEEL_DIRECTION` - Individual wheel direction
- `CAMERA_FEED` - Toggle camera streams
- `AUTONOMOUS_MODE` - GPS navigation
- And more...

## Network Configuration

### For Local Network:
- Use rover's local IP (e.g., `192.168.1.100`)
- Default port: `8080`

### For Remote Access:
- Set up port forwarding on rover's router
- Use public IP or domain name
- Consider VPN for security

## Customization

Edit `rover_server.py` to implement your specific rover hardware control:
- Motor controllers
- Sensor interfaces
- Camera systems
- Drill mechanisms
- etc.

## Troubleshooting

**Connection Failed:**
- Check both devices are on same network
- Verify rover server is running
- Check firewall settings
- Confirm IP address is correct

**Commands Not Working:**
- Check browser console for errors
- Verify WebSocket connection status
- Check rover server logs

## Tech Stack

- **Frontend:** SvelteKit, Tailwind CSS, Lucide Icons
- **Communication:** WebSocket
- **Backend:** Python (websockets library)

## License

MIT
