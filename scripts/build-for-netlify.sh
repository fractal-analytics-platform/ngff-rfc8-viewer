#!/bin/bash


(
    cd lib
    npm ci
    npm run build
)

npm ci
npm run build
