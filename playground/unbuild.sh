#!/usr/bin/env bash

DIR=recovered
rm -rf $DIR/*
mkdir -p $DIR
cp dist/main.js $DIR
cp dist/main.js.map $DIR
yarn exec recover-source -- -i $DIR/main.js \
&& echo '^^^ Directory structure is incorrect, but we can fix that!'
