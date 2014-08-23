#!/bin/bash

rm -rf man
for section in {1..7}; do
  num=$(ls doc/*.$section.md 2> /dev/null | wc -l)
  [ $num -eq 0 ] && continue;
  mkdir -p man/man$section
  for file in $(ls doc/*.$section.md); do
    ./node_modules/ronn/bin/ronn.js --build --roff $file
    base=$(basename $file .md)
    mv doc/$base.roff man/man$section/$base
  done
done
