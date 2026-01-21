# ROS Integration Quick Start

Get the ROS-integrated dashboard up and running in 5 minutes.

## Prerequisites

- ROS2 installed (Foxy, Galactic, Humble, or Iron)
- Python 3.8+ with the rover backend setup
- Node.js 18+ for the dashboard
- rosbridge_server installed

Install rosbridge if needed:
```bash
sudo apt install ros-${ROS_DISTRO}-rosbridge-suite
```

## Quick Start

### 1. Terminal Setup (3 terminals)

**Terminal 1 - ROS Bridge:**
```bash
# Start rosbridge WebSocket server
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

**Terminal 2 - Backend API:**
```bash
# Navigate to endpoint directory
cd endpoint

# Start FastAPI server (with ROS integration)
uv run main.py
```

**Terminal 3 - Dashboard:**
```bash
# Navigate to dashboard directory
cd dashboard

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

### 2. Access Dashboard

Open browser to: http://localhost:5173

### 3. Verify ROS Connection

1. Look for the "ROS Bridge" panel in the left column
2. Status should show "CONNECTED" in green
3. If not connected, click "Connect to ROS" button

### 4. Test Joystick Control

1. Move the joystick in the "Driving Controls" section
2. In another terminal, verify commands are being sent:
   ```bash
   ros2 topic echo /cmd_vel
   ```
3. You should see Twist messages with linear and angular velocities

### 5. Test Emergency Stop

1. Move the joystick
2. Click the red "E-STOP" button
3. Verify all velocities go to zero

### 6. View Odometry (Optional)

If your robot publishes odometry:

1. Scroll down to see the "Odometry" panel
2. It should automatically subscribe when ROS is connected
3. View real-time position, heading, and velocity

Or publish test data:
```bash
ros2 topic pub /odom nav_msgs/msg/Odometry "{
  header: {frame_id: 'odom'},
  pose: {
    pose: {
      position: {x: 1.0, y: 2.0, z: 0.0},
      orientation: {x: 0.0, y: 0.0, z: 0.0, w: 1.0}
    }
  },
  twist: {
    twist: {
      linear: {x: 0.5, y: 0.0, z: 0.0},
      angular: {x: 0.0, y: 0.0, z: 0.2}
    }
  }
}"
```

## Common Issues & Fixes

### Issue: ROS Status shows "DISCONNECTED"

**Fix 1:** Check if rosbridge is running
```bash
ros2 node list | grep rosbridge
```

**Fix 2:** Verify rosbridge URL
```bash
# Check environment variables in endpoint
echo $ROSBRIDGE_HOST  # Should be localhost
echo $ROSBRIDGE_PORT  # Should be 9090
```

**Fix 3:** Check backend logs
```bash
# In endpoint terminal, look for:
# "✓ Connected to rosbridge at ws://localhost:9090"
```

### Issue: Joystick moves but robot doesn't

**Fix 1:** Verify /cmd_vel is being published
```bash
ros2 topic hz /cmd_vel
```

**Fix 2:** Check if your robot is subscribed to /cmd_vel
```bash
ros2 topic info /cmd_vel
```

**Fix 3:** Test manual velocity command
```bash
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.5}, angular: {z: 0.0}}"
```

### Issue: Odometry panel shows "Waiting for data"

**Fix 1:** Verify /odom is being published
```bash
ros2 topic list | grep odom
ros2 topic hz /odom
```

**Fix 2:** Check ROS Status panel for subscription
- Should show "/odom" in subscribed topics list

**Fix 3:** Manually publish test odometry (see step 6 above)

### Issue: CORS errors in browser console

**Fix:** Verify CORS settings in backend `main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Development Tips

### Monitoring ROS Topics

Keep these running in separate terminals while testing:

```bash
# Monitor velocity commands
ros2 topic echo /cmd_vel

# Monitor odometry
ros2 topic echo /odom

# List all active topics
ros2 topic list

# Check topic frequency
ros2 topic hz /cmd_vel
```

### Browser Developer Tools

Open browser console (F12) to see:
- ROS API calls
- Connection status changes
- Error messages
- Store updates

### Backend Logs

Watch FastAPI logs for:
- ROS connection status
- Published messages
- Subscription updates
- Error details

## Configuration

### Adjust Velocity Limits

Edit `dashboard/src/routes/+page.svelte`:

```svelte
<Joystick 
  maxLinearSpeed={1.0}    // m/s - reduce for slower movement
  maxAngularSpeed={1.0}   // rad/s - reduce for slower rotation
  enableRos={true}
/>
```

### Change Odometry Update Rate

Edit `dashboard/src/lib/stores/rosStore.js`:

```javascript
// In startOdometryUpdates function
return interval;
}, 500);  // Change to desired milliseconds (e.g., 1000 for 1 Hz)
```

### Change ROS Bridge URL

Edit `endpoint/.env` or set environment variables:

```bash
export ROSBRIDGE_HOST=localhost
export ROSBRIDGE_PORT=9090
```

## Next Steps

1. **Read Full Documentation**: See `ROS_INTEGRATION.md` for detailed features
2. **Check Architecture**: See `ROS_ARCHITECTURE.md` for system design
3. **Review API**: See backend quick reference for all endpoints
4. **Test with Real Robot**: Connect to actual robot hardware
5. **Customize UI**: Modify components for your specific needs

## Troubleshooting Checklist

- [ ] rosbridge_server is running
- [ ] Backend server is running
- [ ] Dashboard dev server is running
- [ ] ROS Status Panel shows "CONNECTED"
- [ ] Browser console has no errors
- [ ] /cmd_vel topic exists and is subscribed
- [ ] Robot is configured to use /cmd_vel
- [ ] Firewall allows WebSocket connections (port 9090)
- [ ] CORS is properly configured in backend

## Getting Help

If you encounter issues:

1. Check browser console for errors
2. Check backend terminal for logs
3. Verify ROS topics with `ros2 topic list`
4. Review `ROS_INTEGRATION.md` troubleshooting section
5. Check rosbridge logs: `ros2 node info /rosbridge_websocket`

## Production Checklist

Before deploying to production:

- [ ] Change CORS allow_origins to specific domains
- [ ] Add authentication to ROS endpoints
- [ ] Use HTTPS/WSS for encrypted connections
- [ ] Implement rate limiting
- [ ] Add access control lists
- [ ] Enable command logging
- [ ] Set up monitoring/alerting
- [ ] Test emergency stop thoroughly
- [ ] Document velocity limits for safety
- [ ] Create backup stop mechanisms

---

**You're Ready!** The dashboard now has full ROS integration for real-time rover control and monitoring.
