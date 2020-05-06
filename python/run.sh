#!/bin/bash
mkdir search_dir
mkdir output

python3 tf-idf.py -r local -o ./output/ dataset/*
rm -rf ./search_dir/*

python3 search.py --search-string "hello my dear world" -r local -o search_dir output/*
