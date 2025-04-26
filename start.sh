#!/bin/bash

# Start node server.js
nohup node server.js &

# Start pocketbase
./pocketbase serve --http 0.0.0.0:8090
