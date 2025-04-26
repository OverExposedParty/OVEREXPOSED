#!/bin/bash

chmod +x ./pocketbase

nohup node server.js &
nohup ./pocketbase serve --http 0.0.0.0:8090 &
