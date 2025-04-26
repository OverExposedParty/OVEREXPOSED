#!/bin/bash

# Make sure pocketbase is executable
chmod +x ./pocketbase

# Start node server.js in the background
nohup node server.js &

# Start pocketbase
./pocketbase serve --http 143.110.162.204:8090

