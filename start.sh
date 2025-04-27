#!/bin/bash

# Give execute permission to pocketbase
chmod 755 ./workplace/pocketbase

# Run node server.js in the background and redirect output to a log file
nohup node server.js > server.log 2>&1 &

# Run PocketBase server in the background and redirect output to a log file
# nohup ./pocketbase serve --http 0.0.0.0:8090 > pocketbase.log 2>&1 &
